const STORAGE_KEY = 'jarvis_anthropic_key';
const MODE_KEY = 'jarvis_baseball_mode';
const MODEL = 'claude-sonnet-4-6';

const SYS_GENERAL = `You are J.A.R.V.I.S., the AI butler from Iron Man. You address the user as "sir". Be witty, dry, deferential, and concise — one or two sentences unless asked for detail. Stay in character. Never break the persona, never mention being an AI made by Anthropic. You are JARVIS.`;

const SYS_BASEBALL = `You are J.A.R.V.I.S., the AI butler from Iron Man, now serving as sir's personal baseball analyst. You address the user as "sir". You have direct access to the live MLB Stats API via tools. Use the tools to answer baseball questions with real, current data — never invent stats. When a player or team is involved, call the corresponding lookup tool first so the user can see their picture. Be witty and concise (2-4 sentences for an analysis), in JARVIS's deferential British tone. Stay in character.`;

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
  pushLog(state.baseballMode ? 'BASEBALL MODE engaged. MLB feed online.' : 'BASEBALL MODE disengaged.', 'ok');
}
els.modeSwitch.addEventListener('click', toggleMode);
els.modeSwitch.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleMode(); }
});

/* ---------- Transcript ---------- */
function clearPlaceholder() {
  const ph = els.transcript.querySelector('.placeholder');
  if (ph) ph.remove();
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
  els.transcript.innerHTML = '<div class="placeholder">Awaiting instruction, sir.</div>';
});

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
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  voice =
    voices.find(v => /en-GB/i.test(v.lang) && /daniel|oliver|arthur|male/i.test(v.name)) ||
    voices.find(v => /en-GB/i.test(v.lang)) ||
    voices.find(v => /en[-_]?US/i.test(v.lang) && /male|david|alex/i.test(v.name)) ||
    voices.find(v => /^en/i.test(v.lang)) || voices[0];
}
if ('speechSynthesis' in window) { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }

function speak(text) {
  const clean = text.trim();
  if (!clean || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.rate = 1.0; u.pitch = 0.92; u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

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

const mlb = {
  async search_player({ name }) {
    const r = await fetch(`${STATS}/people/search?names=${encodeURIComponent(name)}&sportId=1`);
    if (!r.ok) {
      const r2 = await fetch(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${SEASON}`);
      const j2 = await r2.json();
      const q = name.toLowerCase();
      const matches = (j2.people || []).filter(p => (p.fullName || '').toLowerCase().includes(q)).slice(0, 5);
      return { players: matches.map(p => ({
        id: p.id, fullName: p.fullName,
        primaryPosition: p.primaryPosition?.abbreviation,
        currentTeam: p.currentTeam?.name,
        headshot: headshot(p.id),
      })) };
    }
    const j = await r.json();
    const players = (j.people || []).slice(0, 5).map(p => ({
      id: p.id,
      fullName: p.fullName,
      primaryPosition: p.primaryPosition?.abbreviation,
      currentTeam: p.currentTeam?.name,
      birthDate: p.birthDate,
      headshot: headshot(p.id),
    }));
    return { players };
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
  if (!mlb[name]) return { result: { error: `Unknown tool: ${name}` }, cards: [] };
  const result = await mlb[name](input);
  const cards = [];
  if (name === 'search_player' && result.players) {
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
  return { result, cards };
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
            const sentence = m[1].trim();
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
  if (speakBuffer.trim()) speak(speakBuffer.trim());
  state.history.push({ role: 'assistant', content: assistantText });
}

async function runWithTools(apiKey, jarvisTurn, jarvisText) {
  let messages = [...state.history];
  let allCards = [];
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
        let result, cards = [];
        try { ({ result, cards } = await runTool(tu.name, tu.input)); }
        catch (e) { result = { error: e.message }; }
        allCards.push(...cards);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      messages.push({ role: 'user', content: toolResults });
      jarvisText.textContent = textBlocks.map(b => b.text).join(' ').trim() || 'Analysing...';
      continue;
    }

    const finalText = textBlocks.map(b => b.text).join('').trim();
    jarvisText.textContent = finalText;
    if (finalText) speak(finalText);
    if (allCards.length) attachCards(jarvisTurn, allCards.slice(0, 8));
    state.history = messages;
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

/* ---------- Init ---------- */
function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    setStatus('STANDBY');
    setTimeout(openSettings, 500);
  } else {
    setStatus('ONLINE', 'online');
  }
  updateReadouts();
}
init();
