const STORAGE_KEY = 'jarvis_anthropic_key';
const MODE_KEY = 'jarvis_baseball_mode';
const VOICE_KEY = 'jarvis_voice_name';
const MUTE_KEY = 'jarvis_muted';
const HISTORY_KEY = 'jarvis_history';
const MODEL = 'claude-sonnet-4-6';

const SYS_GENERAL = `You are J.A.R.V.I.S., the AI butler from Iron Man. You address the user as "sir". Be witty, dry, deferential, and concise — one or two sentences unless asked for detail. Stay in character. Never break the persona, never mention being an AI made by Anthropic. You are JARVIS. If sir asks a question that would require live MLB data (player stats, scores, standings, leaderboards), note in passing that you have a dedicated baseball-analyst mode he may engage via the BASEBALL toggle in the top-right of the HUD.`;

const SYS_BASEBALL = `You are J.A.R.V.I.S., the AI butler from Iron Man, now serving as sir's personal baseball analyst. You address the user as "sir". You have direct access to the live MLB Stats API via tools. Use the tools to answer baseball questions with real, current data — never invent stats.

WHEN TO USE WHICH TOOL:
- When sir says just a player's name, asks "who is X", "tell me about X", "give me an overview of X", or "show me X" — use player_dossier. The UI renders the bio + stats as a personnel-file card automatically; you only need to add a brief 2-3 sentence JARVIS-style commentary on the player's notable trait or current form. Do NOT re-list the bio fields in your text.
- For specific stat questions (e.g. "what's his AVG"), use player_stats.
- For teams, use team_info.
- For "who leads in X", use stat_leaders. The UI renders leader cards automatically.

Be witty and concise, in JARVIS's deferential British tone. Stay in character.`;

const els = {
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  apiKey: document.getElementById('apiKey'),
  saveKey: document.getElementById('saveKey'),
  clearKey: document.getElementById('clearKey'),
  closeModal: document.getElementById('closeModal'),
  status: document.getElementById('status'),
  statusDot: document.getElementById('statusDot'),
  clock: document.getElementById('clock'),
  clockDate: document.getElementById('clockDate'),
  transcript: document.getElementById('transcript'),
  clearChat: document.getElementById('clearChat'),
  textInput: document.getElementById('textInput'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  reactor: document.getElementById('reactor'),
  modeSwitch: document.getElementById('modeSwitch'),
  modeState: document.getElementById('modeState'),
  systemLog: document.getElementById('systemLog'),
  procSpeech: document.getElementById('procSpeech'),
  procApi: document.getElementById('procApi'),
  procMlb: document.getElementById('procMlb'),
  cpuBar: document.getElementById('cpuBar'),
  cpuVal: document.getElementById('cpuVal'),
  memBar: document.getElementById('memBar'),
  memVal: document.getElementById('memVal'),
  netBar: document.getElementById('netBar'),
  netVal: document.getElementById('netVal'),
  wavePoly: document.getElementById('wavePoly'),
  roSession: document.getElementById('roSession'),
  roQueries: document.getElementById('roQueries'),
  roTokens: document.getElementById('roTokens'),
  roMode: document.getElementById('roMode'),
};

const state = {
  history: [],
  busy: false,
  recognizing: false,
  baseballMode: localStorage.getItem(MODE_KEY) === '1',
  queries: 0,
  tokens: 0,
  sessionStart: Date.now(),
};

/* ---------- Status / mode ---------- */
function setStatus(text, kind) {
  els.status.textContent = text;
  els.statusDot.classList.remove('online', 'listening', 'thinking', 'error');
  if (kind) els.statusDot.classList.add(kind);
}

function applyMode() {
  if (state.baseballMode) {
    els.modeSwitch.classList.add('on');
    els.modeSwitch.setAttribute('aria-checked', 'true');
    els.modeState.textContent = 'ON';
    els.roMode.textContent = 'BASEBALL';
    document.body.classList.add('bb');
  } else {
    els.modeSwitch.classList.remove('on');
    els.modeSwitch.setAttribute('aria-checked', 'false');
    els.modeState.textContent = 'OFF';
    els.roMode.textContent = 'GENERAL';
    document.body.classList.remove('bb');
  }
}
applyMode();

function toggleMode() {
  state.baseballMode = !state.baseballMode;
  localStorage.setItem(MODE_KEY, state.baseballMode ? '1' : '0');
  applyMode();
  console.log(`[jarvis] baseball mode ${state.baseballMode ? 'ENGAGED' : 'DISENGAGED'}`);
  pushLog(state.baseballMode ? 'BASEBALL MODE engaged. MLB feed online.' : 'BASEBALL MODE disengaged.', 'ok');
  if (!state.history.length) renderSuggestions();
}
els.modeSwitch.addEventListener('click', toggleMode);
els.modeSwitch.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleMode(); }
});

/* ---------- Transcript ---------- */
function clearPlaceholder() {
  const ph = els.transcript.querySelector('.placeholder');
  if (ph) ph.remove();
  const sug = els.transcript.querySelector('.suggestions');
  if (sug) sug.remove();
}

function appendTurn(role, text) {
  clearPlaceholder();
  const turn = document.createElement('div');
  turn.className = `turn ${role}`;
  const label = role === 'user' ? 'SIR' : 'JARVIS';
  turn.innerHTML = `<div class="role">${label}</div><div class="text"></div>`;
  turn.querySelector('.text').textContent = text;
  els.transcript.appendChild(turn);
  els.transcript.scrollTop = els.transcript.scrollHeight;
  return turn;
}

function attachCards(turnEl, cards) {
  if (!cards || !cards.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'cards';
  for (const c of cards) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.className = 'card-img' + (c.logo ? ' logo' : '');
    img.alt = c.name || '';
    img.src = c.img;
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);
    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = `<div class="card-name"></div><div class="card-sub"></div>`;
    info.querySelector('.card-name').textContent = c.name || '';
    info.querySelector('.card-sub').textContent = c.sub || '';
    card.appendChild(info);
    wrap.appendChild(card);
  }
  turnEl.appendChild(wrap);
}

/* ---------- Settings ---------- */
function openSettings() {
  els.apiKey.value = localStorage.getItem(STORAGE_KEY) || '';
  els.settingsPanel.classList.add('open');
  setTimeout(() => els.apiKey.focus(), 80);
}
function closeSettings() { els.settingsPanel.classList.remove('open'); }

els.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.settingsPanel.classList.contains('open')) closeSettings();
  else openSettings();
});
els.closeModal.addEventListener('click', closeSettings);
document.addEventListener('click', (e) => {
  if (!els.settingsPanel.classList.contains('open')) return;
  if (els.settingsPanel.contains(e.target) || els.settingsBtn.contains(e.target)) return;
  closeSettings();
});

els.saveKey.addEventListener('click', () => {
  const key = els.apiKey.value.trim();
  if (!key.startsWith('sk-ant-')) {
    alert('That does not appear to be an Anthropic API key, sir. They begin with "sk-ant-".');
    return;
  }
  localStorage.setItem(STORAGE_KEY, key);
  closeSettings();
  setStatus('ONLINE', 'online');
  pushLog('credentials accepted. system online.', 'ok');
});
els.clearKey.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  els.apiKey.value = '';
  setStatus('STANDBY');
});

els.clearChat.addEventListener('click', () => {
  state.history = [];
  saveHistory();
  els.transcript.innerHTML = '<div class="placeholder">Awaiting instruction, sir.</div>';
  renderSuggestions();
});

/* ---------- Persistent history ---------- */
function saveHistory() {
  const simplified = [];
  for (const turn of state.history) {
    if (turn.role !== 'user' && turn.role !== 'assistant') continue;
    let text = '';
    if (typeof turn.content === 'string') text = turn.content;
    else if (Array.isArray(turn.content)) text = turn.content.filter(b => b.type === 'text').map(b => b.text).join('');
    if (!text.trim()) continue;
    simplified.push({ role: turn.role, content: text });
  }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(simplified.slice(-24))); } catch (e) {}
}
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

/* ---------- Empty-state suggestion chips ---------- */
const SUGGESTIONS_GENERAL = [
  'Good evening, Jarvis',
  'Run a system diagnostic',
  'What is the weather in Malibu?',
  'Tell me a joke',
];
const SUGGESTIONS_BASEBALL = [
  'Aaron Judge',
  'Shohei Ohtani',
  'Today\'s schedule',
  'AL HR leaders',
  'NL standings',
  'Yankees roster',
];
function renderSuggestions() {
  if (state.history.length) return;
  const existing = els.transcript.querySelector('.suggestions');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.className = 'suggestions';
  const list = state.baseballMode ? SUGGESTIONS_BASEBALL : SUGGESTIONS_GENERAL;
  for (const s of list) {
    const chip = document.createElement('button');
    chip.className = 'suggestion';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      els.textInput.value = s;
      send();
    });
    wrap.appendChild(chip);
  }
  els.transcript.appendChild(wrap);
}

/* ---------- Live MLB games widget ---------- */
let gamesTimer = null;
async function fetchGames() {
  const body = document.getElementById('gamesBody');
  const led = document.getElementById('liveLed');
  if (!body) return;
  try {
    const teams = await getAllTeams();
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
    const d = new Date().toISOString().slice(0, 10);
    const r = await fetch(`${STATS}/schedule?sportId=1&date=${d}&hydrate=linescore,team`);
    const j = await r.json();
    const games = [];
    for (const day of (j.dates || [])) {
      for (const g of (day.games || [])) {
        const homeT = teamById[g.teams.home.team.id];
        const awayT = teamById[g.teams.away.team.id];
        games.push({
          gamePk: g.gamePk,
          state: g.status?.abstractGameState,
          detail: g.status?.detailedState,
          inning: g.linescore?.currentInningOrdinal,
          half: g.linescore?.inningHalf,
          time: g.gameDate,
          home: { id: homeT?.id, abbr: homeT?.abbreviation || homeT?.teamCode?.toUpperCase() || '???', score: g.teams.home.score },
          away: { id: awayT?.id, abbr: awayT?.abbreviation || awayT?.teamCode?.toUpperCase() || '???', score: g.teams.away.score },
        });
      }
    }
    const anyLive = games.some(g => g.state === 'Live');
    if (led) led.classList.toggle('live', anyLive);

    if (!games.length) {
      body.innerHTML = '<div class="games-loading">No games today, sir.</div>';
    } else {
      games.sort((a, b) => {
        const rank = (g) => g.state === 'Live' ? 0 : g.state === 'Preview' ? 1 : 2;
        return rank(a) - rank(b);
      });
      let html = '';
      for (const g of games.slice(0, 14)) {
        let status = '';
        let cls = '';
        if (g.state === 'Live') {
          status = `${(g.half || '').slice(0,3).toUpperCase()} ${g.inning || ''}`.trim();
          cls = 'live';
        } else if (g.state === 'Final') {
          status = 'FIN';
          cls = 'final';
        } else if (g.state === 'Preview') {
          const t = new Date(g.time);
          status = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          cls = 'preview';
        }
        const awayWin = g.away.score != null && g.home.score != null && g.away.score > g.home.score;
        const homeWin = g.away.score != null && g.home.score != null && g.home.score > g.away.score;
        html += `<div class="game ${cls}">
          <div class="g-side ${awayWin ? 'won' : ''}"><span class="g-team">${escapeHtml(g.away.abbr)}</span><span class="g-score">${g.away.score ?? '-'}</span></div>
          <div class="g-side ${homeWin ? 'won' : ''}"><span class="g-team">${escapeHtml(g.home.abbr)}</span><span class="g-score">${g.home.score ?? '-'}</span></div>
          <div class="g-status">${escapeHtml(status)}</div>
        </div>`;
      }
      body.innerHTML = html;
    }
    const interval = anyLive ? 30000 : 180000;
    if (gamesTimer) clearTimeout(gamesTimer);
    gamesTimer = setTimeout(fetchGames, interval);
  } catch (e) {
    console.warn('[games] fetch failed', e);
    if (gamesTimer) clearTimeout(gamesTimer);
    gamesTimer = setTimeout(fetchGames, 60000);
  }
}

/* ---------- Clock + telemetry ---------- */
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function tickClock() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  els.clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (els.clockDate) {
    els.clockDate.textContent = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
}
tickClock();
setInterval(tickClock, 1000);

function tickSession() {
  const s = Math.floor((Date.now() - state.sessionStart) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  els.roSession.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
setInterval(tickSession, 1000);

function tickLoad() {
  const wobble = (base) => Math.max(4, Math.min(96, base + (Math.random() - 0.5) * 18));
  const cpu = Math.round(wobble(state.busy ? 72 : 28));
  const mem = Math.round(wobble(48));
  const net = Math.round(wobble(state.busy ? 60 : 14));
  els.cpuBar.style.width = cpu + '%'; els.cpuVal.textContent = cpu + '%';
  els.memBar.style.width = mem + '%'; els.memVal.textContent = mem + '%';
  els.netBar.style.width = net + '%'; els.netVal.textContent = net + '%';
}
setInterval(tickLoad, 1400);
tickLoad();

/* ---------- System log ---------- */
const LOG_LINES = [
  ['boot sequence verified.', 'ok'],
  ['heuristic core online.', ''],
  ['n-pole biometric scan: clear.', ''],
  ['perimeter telemetry nominal.', ''],
  ['mark-iii diagnostics complete.', 'ok'],
  ['weather: fine, sir.', ''],
  ['power: stable.', ''],
  ['stark industries proxy verified.', ''],
  ['speech: ' + (window.SpeechRecognition || window.webkitSpeechRecognition ? 'supported' : 'unsupported'), ''],
  ['arc reactor: 100%', 'ok'],
  ['scanning ambient threats: none.', ''],
  ['internal clock synchronised.', ''],
  ['repulsor charge: idle.', ''],
];
function pushLog(text, level) {
  const t = new Date();
  const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
  const line = document.createElement('div');
  line.className = 'log-line' + (level === 'ok' ? ' ok' : level === 'warn' ? ' warn' : '');
  line.innerHTML = `<span class="lt">[${ts}]</span><span class="lm"></span>`;
  line.querySelector('.lm').textContent = text;
  els.systemLog.appendChild(line);
  while (els.systemLog.children.length > 9) els.systemLog.removeChild(els.systemLog.firstChild);
}
LOG_LINES.slice(0, 7).forEach(([t, l]) => pushLog(t, l));
setInterval(() => {
  const [t, l] = LOG_LINES[Math.floor(Math.random() * LOG_LINES.length)];
  pushLog(t, l);
}, 4200);

/* ---------- Waveform ---------- */
let waveData = new Array(40).fill(25);
function drawWave() {
  if (!els.wavePoly) return;
  const pts = waveData.map((v, i) => `${(i / (waveData.length - 1)) * 200},${v}`).join(' ');
  els.wavePoly.setAttribute('points', pts);
}
function pushWave(v) {
  waveData.shift();
  waveData.push(v);
  drawWave();
}
setInterval(() => {
  let amp;
  if (state.recognizing) amp = 8 + Math.random() * 34;
  else if (state.busy) amp = 12 + Math.random() * 22;
  else amp = 22 + (Math.random() - 0.5) * 4;
  pushWave(Math.round(25 + (amp - 25) * (Math.random() < 0.5 ? -1 : 1)));
}, 80);
drawWave();

function updateReadouts() {
  els.roQueries.textContent = String(state.queries);
  els.roTokens.textContent = state.tokens > 1000 ? (state.tokens / 1000).toFixed(1) + 'k' : String(state.tokens);
}

/* ---------- Speech synth + recog ---------- */
let voice = null;
let allVoices = [];
let muted = localStorage.getItem(MUTE_KEY) === '1';

function rankVoice(v) {
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  let score = 0;
  if (/google/.test(name)) score += 60;
  if (/natural|neural|premium|enhanced/.test(name)) score += 40;
  if (/microsoft .+ online/.test(name)) score += 30;
  if (/^(daniel|alex|samantha|karen|tom|aaron|nicky|jamie|fred|moira)$/.test(name)) score += 25;
  if (/microsoft (george|ryan|liam|guy|jenny|aria)/.test(name)) score += 20;
  if (/^en-GB/i.test(v.lang)) score += 10;
  if (/(microsoft david|microsoft mark|microsoft zira|microsoft hazel)/.test(name)) score -= 30;
  if (/espeak/.test(name)) score -= 50;
  return score;
}

function loadVoices() {
  allVoices = window.speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang || ''));
  allVoices.sort((a, b) => rankVoice(b) - rankVoice(a));
  if (!allVoices.length) return;

  const saved = localStorage.getItem(VOICE_KEY);
  voice = (saved && allVoices.find(v => v.name === saved)) || allVoices[0];

  const sel = document.getElementById('voiceSelect');
  if (sel) {
    sel.innerHTML = '';
    for (const v of allVoices) {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (voice && v.name === voice.name) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

let speakingCount = 0;
function speak(text) {
  const clean = text.trim();
  if (!clean || muted || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.rate = 0.98;
  u.pitch = 0.9;
  u.volume = 1.0;
  u.onstart = () => {
    speakingCount++;
    els.reactor?.classList.add('speaking');
  };
  const done = () => {
    speakingCount = Math.max(0, speakingCount - 1);
    if (!speakingCount) els.reactor?.classList.remove('speaking');
  };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}

function applyMute() {
  const btn = document.getElementById('muteVoice');
  if (btn) btn.textContent = muted ? 'UNMUTE' : 'MUTE';
  const top = document.getElementById('topbarMute');
  if (top) {
    top.classList.toggle('muted', muted);
    top.title = muted ? 'Voice muted — click to unmute' : 'Click to mute voice';
  }
  if (muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleMute() {
  muted = !muted;
  if (muted) localStorage.setItem(MUTE_KEY, '1');
  else localStorage.removeItem(MUTE_KEY);
  applyMute();
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('voiceSelect');
  const test = document.getElementById('testVoice');
  const mute = document.getElementById('muteVoice');
  const topMute = document.getElementById('topbarMute');
  if (topMute) topMute.addEventListener('click', toggleMute);

  if (sel) {
    sel.addEventListener('change', () => {
      const picked = allVoices.find(v => v.name === sel.value);
      if (picked) { voice = picked; localStorage.setItem(VOICE_KEY, picked.name); }
    });
  }
  if (test) {
    test.addEventListener('click', () => {
      if (muted) { muted = false; localStorage.removeItem(MUTE_KEY); applyMute(); }
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance('Good evening, sir. All systems are nominal.');
      if (voice) u.voice = voice;
      u.rate = 0.98; u.pitch = 0.9;
      window.speechSynthesis.speak(u);
    });
  }
  if (mute) {
    mute.addEventListener('click', toggleMute);
  }
  applyMute();
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim) els.textInput.value = interim;
    if (final) els.textInput.value = final.trim();
  };
  recognition.onerror = (e) => {
    console.warn('Speech recog error:', e.error);
    state.recognizing = false;
    els.micBtn.classList.remove('recording');
    els.procSpeech.textContent = 'IDLE';
    els.procSpeech.classList.remove('busy');
    setStatus('ONLINE', 'online');
  };
  recognition.onend = () => {
    if (state.recognizing) {
      state.recognizing = false;
      els.micBtn.classList.remove('recording');
      els.procSpeech.textContent = 'IDLE';
      els.procSpeech.classList.remove('busy');
      setStatus('ONLINE', 'online');
      const text = els.textInput.value.trim();
      if (text) send();
    }
  };
} else {
  els.micBtn.classList.add('hidden');
}

function startRecognition() {
  if (!recognition || state.recognizing || state.busy) return;
  try {
    window.speechSynthesis.cancel();
    els.textInput.value = '';
    recognition.start();
    state.recognizing = true;
    els.micBtn.classList.add('recording');
    els.procSpeech.textContent = 'ACTIVE';
    els.procSpeech.classList.add('busy');
    setStatus('LISTENING', 'listening');
  } catch (e) {/* already running */}
}
function stopRecognition() {
  if (!recognition || !state.recognizing) return;
  try { recognition.stop(); } catch (e) {}
}

els.micBtn.addEventListener('mousedown', (e) => { e.preventDefault(); startRecognition(); });
els.micBtn.addEventListener('mouseup', (e) => { e.preventDefault(); stopRecognition(); });
els.micBtn.addEventListener('mouseleave', () => { if (state.recognizing) stopRecognition(); });
els.micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecognition(); });
els.micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecognition(); });

/* =====================================================
 *  MLB Stats API client
 * ===================================================== */
const STATS = 'https://statsapi.mlb.com/api/v1';
const SEASON = new Date().getFullYear();

function headshot(playerId) {
  return `https://midfield.mlbstatic.com/v1/people/${playerId}/spots/120`;
}
function teamLogo(teamId) {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

let teamCache = null;
async function getAllTeams() {
  if (teamCache) return teamCache;
  const r = await fetch(`${STATS}/teams?sportId=1&activeStatus=Yes&season=${SEASON}`);
  const j = await r.json();
  teamCache = j.teams || [];
  return teamCache;
}

let playerCache = null;
async function getAllPlayers() {
  if (playerCache) return playerCache;
  console.log('[mlb] fetching full active player list...');
  const r = await fetch(`${STATS}/sports/1/players?season=${SEASON}`);
  if (!r.ok) throw new Error(`Player list fetch failed: ${r.status}`);
  const j = await r.json();
  playerCache = j.people || [];
  console.log(`[mlb] cached ${playerCache.length} players`);
  return playerCache;
}

function matchTeam(query, teams) {
  const q = query.toLowerCase().trim();
  return teams.find(t =>
    t.abbreviation?.toLowerCase() === q ||
    t.teamCode?.toLowerCase() === q ||
    t.fileCode?.toLowerCase() === q ||
    t.name?.toLowerCase() === q ||
    t.teamName?.toLowerCase() === q ||
    t.shortName?.toLowerCase() === q ||
    t.name?.toLowerCase().includes(q) ||
    t.teamName?.toLowerCase().includes(q)
  );
}

function scorePlayer(p, query) {
  const fn = (p.fullName || '').toLowerCase();
  const ln = (p.lastName || '').toLowerCase();
  const fnt = (p.firstName || '').toLowerCase();
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  if (fn === q) return 100;
  if (ln === q) return 80;
  if (fn.startsWith(q)) return 70;
  if (tokens.length > 1 && tokens.every(t => fn.includes(t))) return 60;
  if (fn.includes(q)) return 40;
  if (ln.includes(q) || fnt.includes(q)) return 20;
  return 0;
}

const mlb = {
  async player_dossier({ name, player_id }) {
    let id = player_id;
    if (!id && name) {
      const search = await this.search_player({ name });
      if (!search.players?.length) return { error: `No player matched "${name}".` };
      id = search.players[0].id;
    }
    if (!id) return { error: 'Provide name or player_id.' };
    const r = await fetch(`${STATS}/people/${id}?hydrate=stats(group=[hitting,pitching],type=[season,career],season=${SEASON}),currentTeam`);
    const j = await r.json();
    const p = j.people?.[0];
    if (!p) return { error: 'Player data unavailable.' };
    const pick = (group, type) =>
      p.stats?.find(s => s.group?.displayName === group && (s.type?.displayName === type || s.type?.displayName === type + ' ' || (type === 'season' && s.type?.displayName === 'statsSingleSeason')))?.splits?.[0]?.stat;
    return {
      dossier: {
        id: p.id,
        name: p.fullName,
        nickName: p.nickName,
        position: p.primaryPosition?.abbreviation,
        positionName: p.primaryPosition?.name,
        team: p.currentTeam?.name,
        jersey: p.primaryNumber,
        birthDate: p.birthDate,
        age: p.currentAge,
        birthCity: p.birthCity,
        birthCountry: p.birthCountry,
        height: p.height,
        weight: p.weight,
        bats: p.batSide?.code,
        throws: p.pitchHand?.code,
        mlbDebut: p.mlbDebutDate,
        active: p.active,
        headshot: headshot(p.id),
        hitting_season: pick('hitting', 'statsSingleSeason'),
        hitting_career: pick('hitting', 'career'),
        pitching_season: pick('pitching', 'statsSingleSeason'),
        pitching_career: pick('pitching', 'career'),
      },
    };
  },

  async search_player({ name }) {
    const players = await getAllPlayers();
    const scored = players
      .map(p => ({ p, score: scorePlayer(p, name) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return {
      players: scored.map(({ p }) => ({
        id: p.id,
        fullName: p.fullName,
        primaryPosition: p.primaryPosition?.abbreviation,
        currentTeam: p.currentTeam?.name,
        birthDate: p.birthDate,
        headshot: headshot(p.id),
      })),
    };
  },

  async player_stats({ player_id, season, group }) {
    const s = season || String(SEASON);
    const g = group || 'hitting';
    const r = await fetch(`${STATS}/people/${player_id}?hydrate=stats(group=${g},type=season,season=${s}),currentTeam`);
    const j = await r.json();
    const p = j.people?.[0];
    if (!p) return { error: 'Player not found.' };
    const stats = p.stats?.[0]?.splits?.[0]?.stat || {};
    return {
      player: { id: p.id, name: p.fullName, position: p.primaryPosition?.abbreviation, team: p.currentTeam?.name, headshot: headshot(p.id) },
      season: s, group: g, stats,
    };
  },

  async player_career({ player_id, group }) {
    const g = group || 'hitting';
    const r = await fetch(`${STATS}/people/${player_id}?hydrate=stats(group=${g},type=career),currentTeam`);
    const j = await r.json();
    const p = j.people?.[0];
    if (!p) return { error: 'Player not found.' };
    return {
      player: { id: p.id, name: p.fullName, team: p.currentTeam?.name, headshot: headshot(p.id) },
      career: p.stats?.[0]?.splits?.[0]?.stat || {},
    };
  },

  async team_info({ team_name }) {
    const teams = await getAllTeams();
    const t = matchTeam(team_name, teams);
    if (!t) return { error: `No team matched "${team_name}".` };
    const r = await fetch(`${STATS}/teams/${t.id}/roster?rosterType=active&season=${SEASON}`);
    const j = await r.json();
    const roster = (j.roster || []).slice(0, 30).map(r => ({
      id: r.person.id, name: r.person.fullName,
      position: r.position?.abbreviation,
      jersey: r.jerseyNumber,
    }));
    return {
      team: {
        id: t.id, name: t.name, abbreviation: t.abbreviation,
        division: t.division?.name, league: t.league?.name,
        venue: t.venue?.name, locationName: t.locationName,
        logo: teamLogo(t.id),
      },
      roster_count: roster.length,
      roster_sample: roster,
    };
  },

  async schedule({ date, team_name }) {
    const d = date || new Date().toISOString().slice(0, 10);
    let url = `${STATS}/schedule?sportId=1&date=${d}`;
    if (team_name) {
      const teams = await getAllTeams();
      const t = matchTeam(team_name, teams);
      if (t) url += `&teamId=${t.id}`;
    }
    const r = await fetch(url);
    const j = await r.json();
    const games = [];
    for (const day of (j.dates || [])) {
      for (const g of (day.games || [])) {
        games.push({
          gamePk: g.gamePk,
          date: g.gameDate,
          status: g.status?.detailedState,
          home: { id: g.teams.home.team.id, name: g.teams.home.team.name, score: g.teams.home.score },
          away: { id: g.teams.away.team.id, name: g.teams.away.team.name, score: g.teams.away.score },
          venue: g.venue?.name,
        });
      }
    }
    return { date: d, games };
  },

  async standings({ league }) {
    let leagueId = '103,104';
    if (league === 'AL') leagueId = '103';
    else if (league === 'NL') leagueId = '104';
    const r = await fetch(`${STATS}/standings?leagueId=${leagueId}&season=${SEASON}&standingsTypes=regularSeason`);
    const j = await r.json();
    const out = [];
    for (const rec of (j.records || [])) {
      out.push({
        division: rec.division?.id,
        league: rec.league?.id,
        teams: (rec.teamRecords || []).map(tr => ({
          id: tr.team.id,
          name: tr.team.name,
          wins: tr.wins, losses: tr.losses,
          pct: tr.winningPercentage,
          gb: tr.gamesBack,
          streak: tr.streak?.streakCode,
          divRank: tr.divisionRank,
          wcRank: tr.wildCardRank,
        })),
      });
    }
    return { standings: out };
  },

  async stat_leaders({ stat, group, season, limit }) {
    const s = season || String(SEASON);
    const g = group || 'hitting';
    const n = limit || 10;
    const r = await fetch(`${STATS}/stats/leaders?leaderCategories=${encodeURIComponent(stat)}&season=${s}&statGroup=${g}&limit=${n}&sportId=1`);
    const j = await r.json();
    const cat = j.leagueLeaders?.[0];
    if (!cat) return { error: `No leaderboard found for "${stat}".` };
    return {
      stat: cat.statGroup + '.' + cat.leaderCategory,
      season: s,
      leaders: (cat.leaders || []).map(l => ({
        rank: l.rank,
        playerId: l.person?.id,
        name: l.person?.fullName,
        team: l.team?.name,
        value: l.value,
        headshot: headshot(l.person?.id),
      })),
    };
  },
};

const baseballTools = [
  { name: 'player_dossier',
    description: 'Build a comprehensive personnel-file dossier for a player: bio (height, weight, age, bats/throws, debut, origin) plus current-season and career stats for hitting/pitching as applicable. Use this whenever sir asks for an overview of a player ("tell me about X", "who is X", "show me X", or just a bare name). Returns a "dossier" object — the UI renders it as a personnel file automatically, so do not repeat the bio fields in your response. Add a short, JARVIS-style summary (2-3 sentences) about the player\'s notable trait or current form.',
    input_schema: { type: 'object', properties: {
      name: { type: 'string', description: 'Player name; you can pass the user\'s phrase directly' },
      player_id: { type: 'integer', description: 'Optional MLB player ID if known (skips name lookup)' },
    } } },
  { name: 'search_player',
    description: 'Search for an MLB player by name. Returns up to 5 matches with player_id, position, team, and headshot URL.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Player name, e.g. "Aaron Judge"' } }, required: ['name'] } },
  { name: 'player_stats',
    description: 'Get a player\'s stats for a season. Call search_player first to get player_id.',
    input_schema: { type: 'object', properties: {
      player_id: { type: 'integer', description: 'MLB player ID' },
      season: { type: 'string', description: 'Year, e.g. "2025". Defaults to current season.' },
      group: { type: 'string', enum: ['hitting', 'pitching', 'fielding'], description: 'Stats group' },
    }, required: ['player_id', 'group'] } },
  { name: 'player_career',
    description: 'Get a player\'s career totals.',
    input_schema: { type: 'object', properties: {
      player_id: { type: 'integer' },
      group: { type: 'string', enum: ['hitting', 'pitching', 'fielding'] },
    }, required: ['player_id', 'group'] } },
  { name: 'team_info',
    description: 'Get an MLB team\'s info, division, venue, and active roster sample.',
    input_schema: { type: 'object', properties: {
      team_name: { type: 'string', description: 'Team name or abbreviation (e.g. "Yankees", "NYY")' },
    }, required: ['team_name'] } },
  { name: 'schedule',
    description: 'Get the MLB schedule for a date (with scores if completed). Optionally filter by team.',
    input_schema: { type: 'object', properties: {
      date: { type: 'string', description: 'YYYY-MM-DD; defaults to today.' },
      team_name: { type: 'string', description: 'Optional team filter.' },
    } } },
  { name: 'standings',
    description: 'Current MLB standings. Optionally filter by league.',
    input_schema: { type: 'object', properties: {
      league: { type: 'string', enum: ['AL', 'NL', 'all'], description: 'League filter' },
    } } },
  { name: 'stat_leaders',
    description: 'Leaderboard for a stat in a season. Stat names use MLB Stats API conventions: homeRuns, battingAverage, rbi, hits, stolenBases, onBasePercentage, sluggingPercentage, ops, era, wins, strikeOuts, saves, whip.',
    input_schema: { type: 'object', properties: {
      stat: { type: 'string', description: 'Stat name (camelCase)' },
      group: { type: 'string', enum: ['hitting', 'pitching'], description: 'Stats group' },
      season: { type: 'string', description: 'Year' },
      limit: { type: 'integer', description: 'Top N (default 10)' },
    }, required: ['stat', 'group'] } },
];

/* Execute a tool call and return { result, cards } */
async function runTool(name, input) {
  console.log(`[tool] ${name}`, input);
  if (!mlb[name]) return { result: { error: `Unknown tool: ${name}` }, cards: [] };
  let result;
  try {
    result = await mlb[name](input);
    console.log(`[tool] ${name} →`, result);
  } catch (e) {
    console.error(`[tool] ${name} FAILED`, e);
    return { result: { error: e.message }, cards: [] };
  }
  const cards = [];
  let dossier = null;
  if (name === 'player_dossier' && result.dossier) {
    dossier = result.dossier;
  } else if (name === 'search_player' && result.players) {
    for (const p of result.players.slice(0, 4)) {
      cards.push({ img: p.headshot, name: p.fullName, sub: [p.currentTeam, p.primaryPosition].filter(Boolean).join(' · ') });
    }
  } else if ((name === 'player_stats' || name === 'player_career') && result.player) {
    cards.push({ img: result.player.headshot, name: result.player.name, sub: [result.player.team, result.player.position].filter(Boolean).join(' · ') });
  } else if (name === 'team_info' && result.team) {
    cards.push({ img: result.team.logo, logo: true, name: result.team.name, sub: result.team.division || result.team.league || '' });
  } else if (name === 'stat_leaders' && result.leaders) {
    for (const l of result.leaders.slice(0, 4)) {
      cards.push({ img: l.headshot, name: l.name, sub: `${l.team || ''} · ${l.value}` });
    }
  }
  return { result, cards, dossier };
}

/* ---------- Draggable / detachable cards ---------- */
let floatTopZ = 80;
function makeDraggable(el, handle) {
  let startX = 0, startY = 0, elX = 0, elY = 0;
  let dragging = false, detached = false;
  handle.style.cursor = 'grab';
  handle.style.touchAction = 'none';

  function bringFront() { el.style.zIndex = String(++floatTopZ); }

  function ensureDetached() {
    if (detached) return;
    const rect = el.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.margin = '0';
    document.body.appendChild(el);
    el.classList.add('floating');
    addCloseBtn(el);
    detached = true;
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.float-close')) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    dragging = true;
    ensureDetached();
    bringFront();
    elX = parseFloat(el.style.left) || 0;
    elY = parseFloat(el.style.top) || 0;
    startX = e.clientX;
    startY = e.clientY;
    el.classList.add('dragging');
    handle.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const rect = el.getBoundingClientRect();
    let nx = elX + dx, ny = elY + dy;
    nx = Math.max(-rect.width + 80, Math.min(window.innerWidth - 80, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 36, ny));
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    el.classList.remove('dragging');
    handle.style.cursor = 'grab';
  }

  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
  el.addEventListener('mousedown', () => { if (detached) bringFront(); });
}

function addCloseBtn(el) {
  if (el.querySelector('.float-close')) return;
  const btn = document.createElement('button');
  btn.className = 'float-close';
  btn.title = 'Dismiss';
  btn.innerHTML = '&times;';
  btn.addEventListener('click', (e) => { e.stopPropagation(); el.remove(); });
  el.appendChild(btn);
}

/* Dossier renderer (personnel-file card) */
const STAT_LABELS = {
  G: 'gamesPlayed', AB: 'atBats', R: 'runs', H: 'hits', '2B': 'doubles', '3B': 'triples',
  HR: 'homeRuns', RBI: 'rbi', BB: 'baseOnBalls', SO: 'strikeOuts', SB: 'stolenBases',
  AVG: 'avg', OBP: 'obp', SLG: 'slg', OPS: 'ops',
  W: 'wins', L: 'losses', GS: 'gamesStarted', SV: 'saves', IP: 'inningsPitched',
  ER: 'earnedRuns', ERA: 'era', WHIP: 'whip', K: 'strikeOuts',
};
function getStat(obj, displayKey) {
  if (!obj) return null;
  const k = STAT_LABELS[displayKey];
  return k && obj[k] != null ? obj[k] : null;
}
function statTable(season, career, keys) {
  if (!season && !career) return '';
  let html = '<table class="ds-stats"><thead><tr><th></th>';
  for (const k of keys) html += `<th>${k}</th>`;
  html += '</tr></thead><tbody>';
  if (season) {
    html += `<tr><td class="ds-row-lbl">${SEASON}</td>`;
    for (const k of keys) { const v = getStat(season, k); html += `<td>${v == null ? '—' : escapeHtml(String(v))}</td>`; }
    html += '</tr>';
  }
  if (career) {
    html += '<tr><td class="ds-row-lbl">CAREER</td>';
    for (const k of keys) { const v = getStat(career, k); html += `<td>${v == null ? '—' : escapeHtml(String(v))}</td>`; }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}
function field(lbl, val) {
  return `<div class="ds-field"><span class="ds-lbl">${lbl}</span><span class="ds-val">${escapeHtml(String(val || '—'))}</span></div>`;
}

/* Full-breakdown stat label map (camelCase API key → display label) */
const STAT_DISPLAY = {
  // hitting
  gamesPlayed: 'G', plateAppearances: 'PA', atBats: 'AB', runs: 'R', hits: 'H',
  doubles: '2B', triples: '3B', homeRuns: 'HR', rbi: 'RBI', totalBases: 'TB',
  baseOnBalls: 'BB', strikeOuts: 'SO', intentionalWalks: 'IBB', hitByPitch: 'HBP',
  stolenBases: 'SB', caughtStealing: 'CS', stolenBasePercentage: 'SB%',
  avg: 'AVG', obp: 'OBP', slg: 'SLG', ops: 'OPS', babip: 'BABIP',
  atBatsPerHomeRun: 'AB/HR', groundIntoDoublePlay: 'GIDP',
  sacFlies: 'SF', sacBunts: 'SH', leftOnBase: 'LOB',
  groundOuts: 'GO', airOuts: 'AO', groundOutsToAirouts: 'GO/AO',
  numberOfPitches: 'P', catchersInterference: 'CI',
  // pitching
  gamesStarted: 'GS', wins: 'W', losses: 'L', saves: 'SV', saveOpportunities: 'SVO',
  holds: 'HLD', blownSaves: 'BS', inningsPitched: 'IP', battersFaced: 'BF',
  era: 'ERA', whip: 'WHIP', earnedRuns: 'ER',
  strikeoutWalkRatio: 'K/BB', strikeoutsPer9Inn: 'K/9', walksPer9Inn: 'BB/9',
  hitsPer9Inn: 'H/9', homeRunsPer9: 'HR/9', runsScoredPer9: 'R/9',
  completeGames: 'CG', shutouts: 'SHO', hitBatsmen: 'HBP', wildPitches: 'WP',
  balks: 'BK', pickoffs: 'PO', gamesPitched: 'GP', gamesFinished: 'GF',
  winPercentage: 'W%', pitchesPerInning: 'P/IP', strikePercentage: 'STR%',
  strikes: 'STR', outs: 'OUTS',
  inheritedRunners: 'IR', inheritedRunnersScored: 'IRS',
};

const HIT_GROUPS = {
  'TRIPLE SLASH': ['avg', 'obp', 'slg', 'ops'],
  'COUNTING': ['gamesPlayed', 'plateAppearances', 'atBats', 'runs', 'hits', 'rbi'],
  'EXTRA-BASE': ['doubles', 'triples', 'homeRuns', 'totalBases'],
  'PLATE DISCIPLINE': ['baseOnBalls', 'strikeOuts', 'intentionalWalks', 'hitByPitch'],
  'BASES': ['stolenBases', 'caughtStealing', 'stolenBasePercentage'],
  'BATTED BALL': ['babip', 'groundOuts', 'airOuts', 'groundOutsToAirouts'],
  'SITUATIONAL': ['atBatsPerHomeRun', 'groundIntoDoublePlay', 'sacFlies', 'sacBunts', 'leftOnBase'],
};

const PIT_GROUPS = {
  'TOP-LINE': ['era', 'whip', 'wins', 'losses', 'saves', 'holds', 'blownSaves'],
  'WORKLOAD': ['gamesPlayed', 'gamesStarted', 'inningsPitched', 'battersFaced', 'completeGames', 'shutouts'],
  'STRIKEOUTS / WALKS': ['strikeOuts', 'baseOnBalls', 'intentionalWalks', 'strikeoutWalkRatio'],
  'RATES /9': ['strikeoutsPer9Inn', 'walksPer9Inn', 'hitsPer9Inn', 'homeRunsPer9', 'runsScoredPer9'],
  'AGAINST': ['avg', 'hits', 'homeRuns', 'earnedRuns', 'runs'],
  'CONTROL': ['hitBatsmen', 'wildPitches', 'balks', 'pickoffs'],
  'PITCH MIX': ['numberOfPitches', 'strikes', 'strikePercentage', 'pitchesPerInning'],
  'INHERITED': ['inheritedRunners', 'inheritedRunnersScored', 'gamesFinished'],
};

function fullBreakdown(stat, groups) {
  if (!stat) return '<div class="ds-empty">— no data on file —</div>';
  let html = '<div class="ds-fullbreak">';
  for (const [groupName, keys] of Object.entries(groups)) {
    const pills = [];
    for (const k of keys) {
      let v = stat[k];
      if (v == null || v === '' || v === '-.--') continue;
      if (typeof v === 'string' && v.startsWith('0.') && /[OPS|AVG|SLG|OBP|BABIP|K%|BB%]/.test(STAT_DISPLAY[k] || '')) v = v.replace(/^0/, '');
      pills.push(`<div class="ds-pill"><span class="dp-lbl">${STAT_DISPLAY[k] || k}</span><span class="dp-val">${escapeHtml(String(v))}</span></div>`);
    }
    if (!pills.length) continue;
    html += `<div class="ds-group"><div class="ds-group-title">${groupName}</div><div class="ds-pills">${pills.join('')}</div></div>`;
  }
  html += '</div>';
  return html;
}

/* ---------- Full career archive (double-click dossier) ---------- */
const PREFERRED_ORDER = {
  hitting: ['gamesPlayed','plateAppearances','atBats','runs','hits','doubles','triples','homeRuns','rbi','baseOnBalls','intentionalWalks','hitByPitch','strikeOuts','stolenBases','caughtStealing','stolenBasePercentage','avg','obp','slg','ops','babip','groundIntoDoublePlay','sacFlies','sacBunts','totalBases','groundOuts','airOuts','groundOutsToAirouts','atBatsPerHomeRun','leftOnBase','numberOfPitches','catchersInterference'],
  pitching: ['gamesPlayed','gamesStarted','wins','losses','winPercentage','saves','saveOpportunities','holds','blownSaves','completeGames','shutouts','inningsPitched','battersFaced','hits','runs','earnedRuns','homeRuns','baseOnBalls','intentionalWalks','strikeOuts','hitBatsmen','wildPitches','balks','pickoffs','era','whip','avg','strikeoutWalkRatio','strikeoutsPer9Inn','walksPer9Inn','hitsPer9Inn','homeRunsPer9','runsScoredPer9','strikePercentage','strikes','numberOfPitches','pitchesPerInning','gamesPitched','gamesFinished','inheritedRunners','inheritedRunnersScored'],
  fielding: ['position','gamesPlayed','gamesStarted','innings','chances','assists','putOuts','errors','doublePlays','fielding','rangeFactorPerGame','rangeFactorPer9Inn','passedBall','catcherERA','throwingErrors','pickoffs'],
};
const FIELDING_LABELS = {
  position: 'POS', innings: 'INN', chances: 'CH', assists: 'A', putOuts: 'PO',
  errors: 'E', doublePlays: 'DP', fielding: 'FLD%',
  rangeFactorPerGame: 'RF/G', rangeFactorPer9Inn: 'RF/9',
  passedBall: 'PB', catcherERA: 'cERA', throwingErrors: 'TE',
};

function orderStatKeys(keys, group) {
  const pref = PREFERRED_ORDER[group] || [];
  const ordered = [];
  const rest = new Set(keys);
  for (const k of pref) {
    if (rest.has(k)) { ordered.push(k); rest.delete(k); }
  }
  for (const k of [...rest].sort()) ordered.push(k);
  return ordered;
}

function labelFor(key) {
  return STAT_DISPLAY[key] || FIELDING_LABELS[key] || key;
}

function renderHistoryTables(statsArr) {
  let html = '';
  let any = false;
  for (const s of statsArr || []) {
    const group = s.group?.displayName?.toLowerCase() || '';
    const splits = (s.splits || []).filter(sp => sp.stat);
    if (!splits.length) continue;
    any = true;
    const keys = new Set();
    for (const sp of splits) Object.keys(sp.stat || {}).forEach(k => keys.add(k));
    const ordered = orderStatKeys([...keys], group);

    html += `<div class="hp-section"><div class="hp-section-title">// ${group.toUpperCase()} &mdash; YEAR BY YEAR</div>`;
    html += `<div class="hp-table-wrap"><table class="hp-table"><thead><tr>`;
    html += `<th class="sticky-l">YEAR</th><th class="sticky-l">TEAM</th>`;
    for (const k of ordered) html += `<th>${labelFor(k)}</th>`;
    html += `</tr></thead><tbody>`;
    for (const sp of splits) {
      const teamAbbr = sp.team?.abbreviation || sp.team?.name || '—';
      html += `<tr>`;
      html += `<td class="hp-yr sticky-l">${escapeHtml(sp.season || '')}</td>`;
      html += `<td class="hp-team sticky-l">${escapeHtml(teamAbbr)}</td>`;
      for (const k of ordered) {
        const v = sp.stat?.[k];
        html += `<td>${v == null || v === '' ? '—' : escapeHtml(String(v))}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div></div>`;
  }
  if (!any) return '<div class="hp-err">No archive data on file for this individual, sir.</div>';
  return html;
}

async function showHistory(d) {
  if (document.querySelector(`[data-history-id="${d.id}"]`)) {
    const existing = document.querySelector(`[data-history-id="${d.id}"]`);
    existing.style.zIndex = String(++floatTopZ);
    return;
  }
  const panel = document.createElement('div');
  panel.className = 'history-panel';
  panel.setAttribute('data-history-id', d.id);
  panel.innerHTML = `
    <div class="hp-head">
      <span class="ds-grip" title="Drag to move">&#8942;&#8942;</span>
      <span class="ds-flag">ARCHIVE</span>
      <span class="hp-title">${escapeHtml(d.name)} &mdash; FULL HISTORY</span>
      <span class="ds-id">// MLB-${d.id}</span>
    </div>
    <div class="hp-body"><div class="hp-loading">Compiling archive, sir...</div></div>
  `;
  document.body.appendChild(panel);

  const W = Math.min(window.innerWidth - 40, 1180);
  const H = Math.min(window.innerHeight - 40, 800);
  panel.style.width = W + 'px';
  panel.style.height = H + 'px';
  panel.style.left = Math.max(20, (window.innerWidth - W) / 2) + 'px';
  panel.style.top = Math.max(20, (window.innerHeight - H) / 2) + 'px';
  panel.style.zIndex = String(++floatTopZ);

  const handle = panel.querySelector('.hp-head');
  if (handle) makeDraggable(panel, handle);
  addCloseBtn(panel);

  try {
    const r = await fetch(`${STATS}/people/${d.id}/stats?stats=yearByYear&group=hitting,pitching,fielding`);
    if (!r.ok) throw new Error(`MLB API ${r.status}`);
    const j = await r.json();
    panel.querySelector('.hp-body').innerHTML = renderHistoryTables(j.stats || []);
  } catch (e) {
    console.error('[history] failed', e);
    panel.querySelector('.hp-body').innerHTML = `<div class="hp-err">Archive unreachable: ${escapeHtml(e.message)}</div>`;
  }
}

function attachDossier(turnEl, d) {
  const card = document.createElement('div');
  card.className = 'dossier';
  const isPitcher = d.position === 'P' || d.position === 'SP' || d.position === 'RP';
  let html = `
    <div class="ds-head">
      <span class="ds-grip" title="Drag to move">&#8942;&#8942;</span>
      <span class="ds-flag">CLASSIFIED</span>
      <span class="ds-title">PERSONNEL FILE</span>
      <span class="ds-id">// MLB-${d.id}</span>
    </div>
    <div class="ds-bio">
      <div class="ds-img-wrap">
        <img class="ds-img" src="${d.headshot}" alt="${escapeHtml(d.name)}" onerror="this.style.opacity=0.2">
        <div class="ds-img-corner"></div>
      </div>
      <div class="ds-fields">
        <div class="ds-name">${escapeHtml(d.name)}</div>
        ${d.nickName ? `<div class="ds-alias">"${escapeHtml(d.nickName)}"</div>` : ''}
        <div class="ds-grid">
          ${field('POS', `${d.position || '—'}${d.positionName && d.positionName !== d.position ? ' · ' + d.positionName : ''}`)}
          ${field('TEAM', d.team)}
          ${field('JERSEY', d.jersey ? '#' + d.jersey : null)}
          ${field('AGE', d.age ? `${d.age} (${d.birthDate || ''})` : null)}
          ${field('ORIGIN', [d.birthCity, d.birthCountry].filter(Boolean).join(', '))}
          ${field('HT / WT', `${d.height || '—'} / ${d.weight ? d.weight + ' lbs' : '—'}`)}
          ${field('BATS / THROWS', `${d.bats || '—'} / ${d.throws || '—'}`)}
          ${field('MLB DEBUT', d.mlbDebut)}
        </div>
      </div>
    </div>
  `;
  const hasHit = d.hitting_season || d.hitting_career;
  const hasPit = isPitcher || d.pitching_season || d.pitching_career;

  if (hasPit) {
    html += `<div class="ds-section">
      <div class="ds-section-title">// PITCHING &mdash; SEASON vs CAREER</div>` +
      statTable(d.pitching_season, d.pitching_career, ['G','GS','W','L','SV','IP','SO','BB','ER','ERA','WHIP']) +
      `</div>`;
    if (d.pitching_season) {
      html += `<div class="ds-section">
        <div class="ds-section-title">// ${SEASON} PITCHING &mdash; FULL BREAKDOWN</div>` +
        fullBreakdown(d.pitching_season, PIT_GROUPS) +
        `</div>`;
    }
  }
  if (hasHit && !isPitcher || (isPitcher && d.hitting_season)) {
    html += `<div class="ds-section">
      <div class="ds-section-title">// HITTING &mdash; SEASON vs CAREER</div>` +
      statTable(d.hitting_season, d.hitting_career, ['G','AB','R','H','HR','RBI','BB','SO','SB','AVG','OBP','SLG','OPS']) +
      `</div>`;
    if (d.hitting_season) {
      html += `<div class="ds-section">
        <div class="ds-section-title">// ${SEASON} HITTING &mdash; FULL BREAKDOWN</div>` +
        fullBreakdown(d.hitting_season, HIT_GROUPS) +
        `</div>`;
    }
  }

  card.innerHTML = html;
  turnEl.appendChild(card);
  const handle = card.querySelector('.ds-head');
  if (handle) makeDraggable(card, handle);

  const bio = card.querySelector('.ds-bio');
  if (bio) {
    bio.title = 'Double-click for full archive (every season, every stat)';
    bio.style.cursor = 'zoom-in';
    bio.addEventListener('dblclick', (e) => { e.stopPropagation(); showHistory(d); });
  }
}

/* =====================================================
 *  Markdown rendering — small, scoped to chat output
 * ===================================================== */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function inlineMd(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function parseRow(line) {
  const cells = line.split('|').map(c => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function renderMarkdown(text) {
  if (!text) return '';
  const stripped = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  const lines = stripped.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const header = parseRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      let html = '<table><thead><tr>';
      for (const h of header) html += `<th>${inlineMd(escapeHtml(h))}</th>`;
      html += '</tr></thead><tbody>';
      for (const r of rows) {
        html += '<tr>';
        for (const c of r) html += `<td>${inlineMd(escapeHtml(c))}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table>';
      out.push(html);
      continue;
    }

    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineMd(escapeHtml(h[2]))}</h${lvl}>`);
      i++; continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push('<ul>' + items.map(it => `<li>${inlineMd(escapeHtml(it))}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol>' + items.map(it => `<li>${inlineMd(escapeHtml(it))}</li>`).join('') + '</ol>');
      continue;
    }

    if (!line.trim()) { i++; continue; }

    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() &&
           !lines[i].includes('|') &&
           !/^\s*[-*]\s+/.test(lines[i]) &&
           !/^\s*\d+\.\s+/.test(lines[i]) &&
           !/^#/.test(lines[i])) {
      para += ' ' + lines[i];
      i++;
    }
    out.push(`<p>${inlineMd(escapeHtml(para))}</p>`);
  }
  return out.join('');
}

function stripMd(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\|/g, ',')
    .replace(/-{3,}/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/* =====================================================
 *  Claude API call: streaming (general) and tool loop (baseball)
 * ===================================================== */
async function callJarvis(userText) {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  if (!apiKey) { openSettings(); return; }

  state.busy = true;
  els.sendBtn.disabled = true;
  els.procApi.textContent = 'ACTIVE';
  els.procApi.classList.add('busy');

  state.history.push({ role: 'user', content: userText });
  if (state.history.length > 24) state.history = state.history.slice(-24);

  appendTurn('user', userText);
  const jarvisTurn = appendTurn('jarvis', '');
  jarvisTurn.classList.add('streaming');
  const jarvisText = jarvisTurn.querySelector('.text');
  setStatus('PROCESSING', 'thinking');
  els.reactor.classList.add('thinking');

  state.queries++;
  updateReadouts();

  console.log(`[jarvis] sending — mode=${state.baseballMode ? 'BASEBALL' : 'GENERAL'} text="${userText}"`);

  try {
    if (state.baseballMode) {
      await runWithTools(apiKey, jarvisTurn, jarvisText);
    } else {
      await runStreaming(apiKey, jarvisTurn, jarvisText);
    }
  } catch (err) {
    console.error(err);
    jarvisText.textContent = 'Apologies, sir — the connection appears unstable.';
    speak('Apologies, sir. The connection appears unstable.');
    state.history.pop();
    setStatus('CONNECTION LOST', 'error');
    pushLog('connection error: ' + err.message, 'warn');
  } finally {
    state.busy = false;
    els.sendBtn.disabled = false;
    els.procApi.textContent = 'IDLE';
    els.procApi.classList.remove('busy');
    jarvisTurn.classList.remove('streaming');
    if (!els.statusDot.classList.contains('error')) setStatus('ONLINE', 'online');
    els.reactor.classList.remove('thinking');
  }
}

async function runStreaming(apiKey, jarvisTurn, jarvisText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: [{ type: 'text', text: SYS_GENERAL, cache_control: { type: 'ephemeral' } }],
      messages: state.history,
    }),
  });

  if (!res.ok) { await handleApiError(res, jarvisText); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', assistantText = '', speakBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n'); buffer = events.pop();
    for (const evt of events) {
      const dataLine = evt.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine.slice(6));
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const chunk = data.delta.text;
          assistantText += chunk;
          jarvisText.textContent = assistantText;
          els.transcript.scrollTop = els.transcript.scrollHeight;
          speakBuffer += chunk;
          let m;
          while ((m = speakBuffer.match(/^([\s\S]*?[.!?])(\s+|$)/))) {
            const sentence = stripMd(m[1].trim());
            if (sentence) speak(sentence);
            speakBuffer = speakBuffer.slice(m[0].length);
          }
        } else if (data.type === 'message_delta' && data.usage) {
          state.tokens += (data.usage.output_tokens || 0);
          updateReadouts();
        }
      } catch (e) {/* skip */}
    }
  }
  if (speakBuffer.trim()) speak(stripMd(speakBuffer.trim()));
  jarvisText.innerHTML = renderMarkdown(assistantText);
  state.history.push({ role: 'assistant', content: assistantText });
  saveHistory();
}

async function runWithTools(apiKey, jarvisTurn, jarvisText) {
  let messages = [...state.history];
  let allCards = [];
  let allDossiers = [];
  let iterations = 0;
  jarvisText.textContent = 'Consulting league records...';
  els.procMlb.textContent = 'ACTIVE';
  els.procMlb.classList.add('busy');

  while (iterations++ < 6) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: [{ type: 'text', text: SYS_BASEBALL, cache_control: { type: 'ephemeral' } }],
        tools: baseballTools,
        messages,
      }),
    });

    if (!res.ok) { await handleApiError(res, jarvisText); break; }

    const data = await res.json();
    console.log(`[jarvis] iter ${iterations} response`, data);
    if (data.usage) {
      state.tokens += (data.usage.output_tokens || 0);
      updateReadouts();
    }

    const content = data.content || [];
    messages.push({ role: 'assistant', content });

    const toolUses = content.filter(b => b.type === 'tool_use');
    const textBlocks = content.filter(b => b.type === 'text');

    if (data.stop_reason === 'tool_use' && toolUses.length) {
      const toolResults = [];
      for (const tu of toolUses) {
        pushLog(`tool: ${tu.name}(${Object.values(tu.input || {}).join(', ')})`, '');
        let result, cards = [], dossier = null;
        try { ({ result, cards, dossier } = await runTool(tu.name, tu.input)); }
        catch (e) { result = { error: e.message }; }
        allCards.push(...cards);
        if (dossier) allDossiers.push(dossier);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      messages.push({ role: 'user', content: toolResults });
      jarvisText.textContent = textBlocks.map(b => b.text).join(' ').trim() || 'Analysing...';
      continue;
    }

    const finalText = textBlocks.map(b => b.text).join('').trim();
    jarvisText.innerHTML = renderMarkdown(finalText);
    if (finalText) speak(stripMd(finalText));
    for (const d of allDossiers) attachDossier(jarvisTurn, d);
    if (allCards.length) attachCards(jarvisTurn, allCards.slice(0, 8));
    state.history = messages;
    saveHistory();
    break;
  }

  els.procMlb.textContent = 'STANDBY';
  els.procMlb.classList.remove('busy');
}

async function handleApiError(res, jarvisText) {
  const errBody = await res.text();
  let errMsg = `Error ${res.status}`;
  try { errMsg = JSON.parse(errBody).error?.message || errMsg; } catch (e) {}
  if (res.status === 401) {
    jarvisText.textContent = 'Sir, my credentials appear to be invalid.';
    speak('Sir, my credentials appear to be invalid.');
    state.history.pop();
    setStatus('AUTH ERROR', 'error');
    openSettings();
  } else {
    jarvisText.textContent = `Apologies, sir — ${errMsg}`;
    speak('Apologies, sir. A momentary lapse.');
    state.history.pop();
    setStatus('ERROR', 'error');
  }
}

/* ---------- Send ---------- */
function send() {
  if (state.busy) return;
  const text = els.textInput.value.trim();
  if (!text) return;
  els.textInput.value = '';
  callJarvis(text);
}
els.sendBtn.addEventListener('click', send);
els.textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

/* =====================================================
 *  Draw mode — annotation boxes anywhere on screen
 * ===================================================== */
const ANNOTATIONS_KEY = 'jarvis_annotations';
let drawMode = false;
let drawStart = null;
let drawPreview = null;

function setDrawMode(on) {
  drawMode = on;
  document.body.classList.toggle('draw-mode', drawMode);
  const btn = document.getElementById('drawToggle');
  if (btn) btn.classList.toggle('active', drawMode);
  pushLog(drawMode ? 'DRAW LAYER engaged. Tap and drag to annotate.' : 'DRAW LAYER disengaged.', 'ok');
}

document.addEventListener('DOMContentLoaded', () => {
  const drawBtn = document.getElementById('drawToggle');
  if (drawBtn) drawBtn.addEventListener('click', () => setDrawMode(!drawMode));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (drawMode) setDrawMode(false);
    if (drawPreview) { drawPreview.remove(); drawPreview = null; drawStart = null; }
  }
});

const NO_DRAW_SELECTOR = '.no-draw, button, input, select, textarea, a, .turn, .widget, .input-bar, .topbar, .annotation-box, .dossier, .history-panel, .popover, .transcript, .panel-head';

document.addEventListener('pointerdown', (e) => {
  if (!drawMode) return;
  if (e.target.closest && e.target.closest(NO_DRAW_SELECTOR)) return;
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  drawStart = { x: e.clientX, y: e.clientY };
  drawPreview = document.createElement('div');
  drawPreview.className = 'draw-preview';
  document.body.appendChild(drawPreview);
  Object.assign(drawPreview.style, { left: e.clientX + 'px', top: e.clientY + 'px', width: '0px', height: '0px' });
});
document.addEventListener('pointermove', (e) => {
  if (!drawStart || !drawPreview) return;
  const x = Math.min(drawStart.x, e.clientX);
  const y = Math.min(drawStart.y, e.clientY);
  const w = Math.abs(e.clientX - drawStart.x);
  const h = Math.abs(e.clientY - drawStart.y);
  Object.assign(drawPreview.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
});
document.addEventListener('pointerup', (e) => {
  if (!drawStart) return;
  const start = drawStart;
  drawStart = null;
  if (drawPreview) { drawPreview.remove(); drawPreview = null; }
  const x = Math.min(start.x, e.clientX);
  const y = Math.min(start.y, e.clientY);
  const w = Math.abs(e.clientX - start.x);
  const h = Math.abs(e.clientY - start.y);
  if (w < 36 || h < 36) return;
  createAnnotationBox({ x, y, w, h, label: 'NOTE', body: '' });
});

function dragInPlace(el, handle, onEnd) {
  let sx = 0, sy = 0, ex = 0, ey = 0, dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, [contenteditable], .ab-resize')) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ex = parseFloat(el.style.left) || 0;
    ey = parseFloat(el.style.top) || 0;
    el.style.zIndex = String(++floatTopZ);
    el.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let nx = ex + e.clientX - sx;
    let ny = ey + e.clientY - sy;
    nx = Math.max(0, Math.min(window.innerWidth - 40, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 30, ny));
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  });
  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    el.classList.remove('dragging');
    onEnd && onEnd();
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function createAnnotationBox(opts) {
  const box = document.createElement('div');
  box.className = 'annotation-box';
  Object.assign(box.style, {
    left: opts.x + 'px',
    top: opts.y + 'px',
    width: Math.max(120, opts.w) + 'px',
    height: Math.max(80, opts.h) + 'px',
    zIndex: String(++floatTopZ),
  });
  box.innerHTML = `
    <div class="ab-head">
      <span class="ab-grip">&#8942;&#8942;</span>
      <input class="ab-label" value="${escapeHtml(opts.label || 'NOTE')}" maxlength="48">
      <button class="ab-close" title="Delete">&times;</button>
    </div>
    <div class="ab-body" contenteditable="true" spellcheck="false">${escapeHtml(opts.body || '')}</div>
    <div class="ab-resize" title="Resize"></div>
  `;
  document.body.appendChild(box);

  const head = box.querySelector('.ab-head');
  dragInPlace(box, head, saveAnnotations);

  const resize = box.querySelector('.ab-resize');
  let rsx = 0, rsy = 0, rw = 0, rh = 0, resizing = false;
  resize.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { resize.setPointerCapture(e.pointerId); } catch (err) {}
    resizing = true;
    rsx = e.clientX; rsy = e.clientY;
    rw = box.offsetWidth; rh = box.offsetHeight;
    box.style.zIndex = String(++floatTopZ);
  });
  resize.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    box.style.width = Math.max(120, rw + (e.clientX - rsx)) + 'px';
    box.style.height = Math.max(80, rh + (e.clientY - rsy)) + 'px';
  });
  const stopResize = (e) => {
    if (!resizing) return;
    resizing = false;
    try { resize.releasePointerCapture(e.pointerId); } catch (err) {}
    saveAnnotations();
  };
  resize.addEventListener('pointerup', stopResize);
  resize.addEventListener('pointercancel', stopResize);

  box.querySelector('.ab-close').addEventListener('click', () => {
    box.remove();
    saveAnnotations();
  });

  box.querySelector('.ab-label').addEventListener('input', saveAnnotations);
  box.querySelector('.ab-body').addEventListener('input', saveAnnotations);

  box.addEventListener('mousedown', () => { box.style.zIndex = String(++floatTopZ); });

  saveAnnotations();
  return box;
}

function saveAnnotations() {
  const boxes = document.querySelectorAll('.annotation-box');
  const data = [];
  for (const b of boxes) {
    data.push({
      x: parseFloat(b.style.left) || 0,
      y: parseFloat(b.style.top) || 0,
      w: parseFloat(b.style.width) || 160,
      h: parseFloat(b.style.height) || 100,
      label: b.querySelector('.ab-label')?.value || '',
      body: b.querySelector('.ab-body')?.innerText || '',
    });
  }
  try { localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(data)); } catch (e) {}
}

function restoreAnnotations() {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    for (const a of data) createAnnotationBox(a);
  } catch (e) { console.warn('[annotations] restore failed', e); }
}

/* ---------- Init ---------- */
function restoreTranscript() {
  const persisted = loadHistory();
  if (!persisted.length) {
    renderSuggestions();
    return;
  }
  state.history = persisted;
  els.transcript.innerHTML = '';
  for (const t of persisted) {
    const text = typeof t.content === 'string' ? t.content : '';
    if (!text) continue;
    if (t.role === 'user') {
      appendTurn('user', text);
    } else {
      const turn = appendTurn('jarvis', '');
      turn.querySelector('.text').innerHTML = renderMarkdown(text);
    }
  }
  state.queries = persisted.filter(t => t.role === 'user').length;
  updateReadouts();
}

function init() {
  restoreTranscript();
  restoreAnnotations();
  fetchGames();
  if (!localStorage.getItem(STORAGE_KEY)) {
    setStatus('STANDBY');
    setTimeout(openSettings, 500);
  } else {
    setStatus('ONLINE', 'online');
  }
  updateReadouts();
}
init();
