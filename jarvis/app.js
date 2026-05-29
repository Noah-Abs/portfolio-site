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
- For ANY "leaders", "leaderboard", "best in X", "top N", "who leads", or "X leaders for [league/division]" question — use show_leaderboard. The UI opens a draggable rank panel. DO NOT list the players in your text — just briefly acknowledge ("Here you are, sir."). The panel supports filters by league (AL, NL) and division (e.g. "NL West"). Note: WAR is not in the MLB API — for WAR/best-overall queries, fall back to OPS (hitters) or ERA (pitchers) and briefly mention this.
- For "show me scores"/"open the scoreboard" — use show_scoreboard.

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

function renderSuggestions() {}

/* ---------- Live MLB games — on-demand scoreboard panel ---------- */
let scoreboardEl = null;
let scoreboardTimer = null;

function buildGamesHTML(games) {
  if (!games.length) return '<div class="games-loading">No games today, sir.</div>';
  games.sort((a, b) => {
    const rank = (g) => g.state === 'Live' ? 0 : g.state === 'Preview' ? 1 : 2;
    return rank(a) - rank(b);
  });
  let html = '';
  for (const g of games) {
    let status = '', cls = '';
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
      <div class="g-side ${awayWin ? 'won' : ''}" data-team-id="${g.away.id || ''}" title="Click for franchise file"><span class="g-team">${escapeHtml(g.away.abbr)}</span><span class="g-score">${g.away.score ?? '-'}</span></div>
      <div class="g-side ${homeWin ? 'won' : ''}" data-team-id="${g.home.id || ''}" title="Click for franchise file"><span class="g-team">${escapeHtml(g.home.abbr)}</span><span class="g-score">${g.home.score ?? '-'}</span></div>
      <div class="g-status">${escapeHtml(status)}</div>
    </div>`;
  }
  return html;
}

function wireScoreboardClicks(panel) {
  panel.addEventListener('click', async (e) => {
    const side = e.target.closest('.g-side[data-team-id]');
    if (!side) return;
    const teamId = parseInt(side.dataset.teamId);
    if (!teamId) return;
    side.classList.add('loading');
    try {
      const teams = await getAllTeams();
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      const result = await mlb.team_dossier({ name: team.name });
      if (result?.team_dossier) floatTeamDossier(result.team_dossier);
    } catch (err) { console.warn('[scoreboard→team]', err); }
    side.classList.remove('loading');
  });
}

async function refreshScoreboard() {
  if (!scoreboardEl || !document.body.contains(scoreboardEl)) return;
  const body = scoreboardEl.querySelector('.scoreboard-body');
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
          state: g.status?.abstractGameState,
          inning: g.linescore?.currentInningOrdinal,
          half: g.linescore?.inningHalf,
          time: g.gameDate,
          home: { id: g.teams.home.team.id, abbr: homeT?.abbreviation || homeT?.teamCode?.toUpperCase() || '???', score: g.teams.home.score },
          away: { id: g.teams.away.team.id, abbr: awayT?.abbreviation || awayT?.teamCode?.toUpperCase() || '???', score: g.teams.away.score },
        });
      }
    }
    const anyLive = games.some(g => g.state === 'Live');
    const meta = scoreboardEl.querySelector('.sb-meta');
    if (meta) meta.textContent = anyLive ? `${games.filter(g=>g.state==='Live').length} LIVE` : `${games.length} GAMES`;
    body.innerHTML = buildGamesHTML(games);
    if (scoreboardTimer) clearTimeout(scoreboardTimer);
    scoreboardTimer = setTimeout(refreshScoreboard, anyLive ? 30000 : 180000);
  } catch (e) {
    console.warn('[scoreboard] fetch failed', e);
    if (scoreboardTimer) clearTimeout(scoreboardTimer);
    scoreboardTimer = setTimeout(refreshScoreboard, 60000);
  }
}

/* ---------- Leaderboard panel ---------- */
function matchDivisionTeams(teams, query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return null;
  const direction = ['east', 'central', 'west'].find(x => q.includes(x));
  if (!direction) return null;
  const wantNL = /\bnl\b|national/.test(q);
  const wantAL = /\bal\b|american/.test(q);
  return teams.filter(t => {
    const d = (t.division?.name || '').toLowerCase();
    if (!d.includes(direction)) return false;
    if (wantNL && !d.includes('national')) return false;
    if (wantAL && !d.includes('american')) return false;
    return true;
  });
}

async function floatDossier(d) {
  const temp = document.createElement('div');
  document.body.appendChild(temp);
  attachDossier(temp, d);
  const dossier = temp.querySelector('.dossier');
  if (!dossier) { temp.remove(); return; }
  document.body.appendChild(dossier);
  temp.remove();
  dossier.classList.add('floating');
  Object.assign(dossier.style, {
    position: 'fixed',
    left: Math.max(40, (window.innerWidth - 660) / 2) + 'px',
    top: '60px',
    width: '640px',
    maxWidth: 'calc(100vw - 40px)',
    zIndex: String(++floatTopZ),
    margin: '0',
  });
  addCloseBtn(dossier);
}

function attachTeamDossier(turnEl, t) {
  const card = document.createElement('div');
  card.className = 'dossier team-dossier';
  card.setAttribute('data-team-id', t.id);

  let html = `
    <div class="ds-head">
      <span class="ds-grip" title="Drag to move">&#8942;&#8942;</span>
      <span class="ds-flag">FRANCHISE</span>
      <span class="ds-title">${escapeHtml((t.name || '').toUpperCase())}</span>
      <span class="ds-id">// MLB-${t.id}</span>
    </div>
    <div class="ds-bio">
      <div class="ds-img-wrap">
        <img class="ds-img logo" src="${t.logo}" alt="${escapeHtml(t.name || '')}" onerror="this.style.opacity=0.2">
      </div>
      <div class="ds-fields">
        <div class="ds-name">${escapeHtml(t.name)}</div>
        <div class="ds-alias">${escapeHtml(t.abbreviation || '')}${t.clubName ? ' · ' + escapeHtml(t.clubName) : ''}</div>
        <div class="ds-grid">
          ${field('LEAGUE', t.league)}
          ${field('DIVISION', t.division)}
          ${field('CITY', t.location)}
          ${field('VENUE', t.venue)}
          ${field('FOUNDED', t.firstYearOfPlay)}
        </div>
      </div>
    </div>
  `;

  if (t.record) {
    html += `<div class="ds-section">
      <div class="ds-section-title">// ${SEASON} RECORD</div>
      <div class="ds-fullbreak"><div class="ds-group"><div class="ds-pills">
        <div class="ds-pill"><span class="dp-lbl">W</span><span class="dp-val">${escapeHtml(String(t.record.wins))}</span></div>
        <div class="ds-pill"><span class="dp-lbl">L</span><span class="dp-val">${escapeHtml(String(t.record.losses))}</span></div>
        <div class="ds-pill"><span class="dp-lbl">PCT</span><span class="dp-val">${escapeHtml(String(t.record.pct))}</span></div>
        <div class="ds-pill"><span class="dp-lbl">DIV</span><span class="dp-val">#${escapeHtml(String(t.record.divRank))}</span></div>
        ${t.record.gb != null ? `<div class="ds-pill"><span class="dp-lbl">GB</span><span class="dp-val">${escapeHtml(String(t.record.gb))}</span></div>` : ''}
        ${t.record.streak ? `<div class="ds-pill"><span class="dp-lbl">STRK</span><span class="dp-val">${escapeHtml(t.record.streak)}</span></div>` : ''}
        ${t.record.runDiff != null ? `<div class="ds-pill"><span class="dp-lbl">RUN DIFF</span><span class="dp-val">${escapeHtml(String(t.record.runDiff))}</span></div>` : ''}
        ${t.record.last10 ? `<div class="ds-pill"><span class="dp-lbl">L10</span><span class="dp-val">${t.record.last10.wins}-${t.record.last10.losses}</span></div>` : ''}
        ${t.record.home ? `<div class="ds-pill"><span class="dp-lbl">HOME</span><span class="dp-val">${t.record.home.wins}-${t.record.home.losses}</span></div>` : ''}
        ${t.record.away ? `<div class="ds-pill"><span class="dp-lbl">AWAY</span><span class="dp-val">${t.record.away.wins}-${t.record.away.losses}</span></div>` : ''}
      </div></div></div>
    </div>`;
  }
  if (t.hitting) {
    html += `<div class="ds-section"><div class="ds-section-title">// TEAM HITTING &mdash; ${SEASON}</div>` +
      fullBreakdown(t.hitting, HIT_GROUPS) + `</div>`;
  }
  if (t.pitching) {
    html += `<div class="ds-section"><div class="ds-section-title">// TEAM PITCHING &mdash; ${SEASON}</div>` +
      fullBreakdown(t.pitching, PIT_GROUPS) + `</div>`;
  }
  if (t.roster?.length) {
    html += `<div class="ds-section"><div class="ds-section-title">// ROSTER &mdash; ${t.roster.length} ACTIVE</div>
      <div class="td-roster" title="Double-click any player for dossier">`;
    for (const p of t.roster) {
      html += `<div class="td-player" data-player-id="${p.id}">
        <img class="td-pimg" src="${p.headshot}" alt="${escapeHtml(p.name)}" onerror="this.style.opacity=0.2">
        <div class="td-pmeta">
          <div class="td-pname">${escapeHtml(p.name)}</div>
          <div class="td-ppos">${escapeHtml(p.position || '')}${p.jersey ? ' · #' + escapeHtml(p.jersey) : ''}</div>
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }

  card.innerHTML = html;
  turnEl.appendChild(card);

  const handle = card.querySelector('.ds-head');
  if (handle) makeDraggable(card, handle);

  card.addEventListener('dblclick', async (e) => {
    const player = e.target.closest('.td-player');
    if (!player) return;
    const id = parseInt(player.dataset.playerId);
    if (!id) return;
    e.stopPropagation();
    player.classList.add('loading');
    try {
      const r = await mlb.player_dossier({ player_id: id });
      if (r.dossier) floatDossier(r.dossier);
    } catch (err) { console.warn('[team→player]', err); }
    player.classList.remove('loading');
  });
}

function floatTeamDossier(t) {
  const existing = document.querySelector(`.team-dossier[data-team-id="${t.id}"]`);
  if (existing) { existing.style.zIndex = String(++floatTopZ); return; }
  const temp = document.createElement('div');
  document.body.appendChild(temp);
  attachTeamDossier(temp, t);
  const card = temp.querySelector('.team-dossier');
  if (!card) { temp.remove(); return; }
  document.body.appendChild(card);
  temp.remove();
  card.classList.add('floating');
  Object.assign(card.style, {
    position: 'fixed',
    left: Math.max(40, (window.innerWidth - 700) / 2) + 'px',
    top: '60px',
    width: '680px',
    maxWidth: 'calc(100vw - 40px)',
    zIndex: String(++floatTopZ),
    margin: '0',
  });
  addCloseBtn(card);
}

function openLeaderboard(opts) {
  const panel = document.createElement('div');
  panel.className = 'leaderboard-panel';
  let rowsHtml = '';
  if (!opts.leaders.length) {
    rowsHtml = '<div class="games-loading">No data on file, sir.</div>';
  } else {
    for (const l of opts.leaders) {
      rowsHtml += `<div class="lb-row" data-player-id="${l.playerId}" title="Double-click for full dossier">
        <span class="lb-rank">${l.rank}</span>
        <img class="lb-img" src="${l.headshot}" alt="${escapeHtml(l.name || '')}" onerror="this.style.opacity=0.2">
        <div class="lb-info">
          <div class="lb-name">${escapeHtml(l.name || '')}</div>
          <div class="lb-team">${escapeHtml(l.teamAbbr || l.team || '—')}</div>
        </div>
        <span class="lb-value">${escapeHtml(String(l.value ?? '—'))}</span>
      </div>`;
    }
  }
  panel.innerHTML = `
    <div class="lb-head">
      <span class="ds-grip" title="Drag to move">&#8942;&#8942;</span>
      <span class="lb-flag">RANK</span>
      <span class="lb-title">${escapeHtml(opts.title || 'LEADERBOARD')}</span>
      <span class="lb-meta">${escapeHtml(opts.subtitle || '')}</span>
    </div>
    <div class="lb-body">${rowsHtml}</div>
  `;
  document.body.appendChild(panel);
  const W = 340;
  panel.style.width = W + 'px';
  panel.style.maxHeight = 'calc(100vh - 160px)';
  panel.style.left = Math.max(20, window.innerWidth - W - 60) + 'px';
  panel.style.top = '90px';
  panel.style.zIndex = String(++floatTopZ);

  const handle = panel.querySelector('.lb-head');
  if (handle) makeDraggable(panel, handle);

  panel.addEventListener('dblclick', async (e) => {
    const row = e.target.closest('.lb-row');
    if (!row) return;
    const id = parseInt(row.dataset.playerId);
    if (!id) return;
    e.stopPropagation();
    row.classList.add('loading');
    try {
      const result = await mlb.player_dossier({ player_id: id });
      if (result.dossier) floatDossier(result.dossier);
    } catch (err) {
      console.warn('[leaderboard→dossier]', err);
    }
    row.classList.remove('loading');
  });
}

function openScoreboard() {
  if (scoreboardEl && document.body.contains(scoreboardEl)) {
    scoreboardEl.style.zIndex = String(++floatTopZ);
    refreshScoreboard();
    return;
  }
  const panel = document.createElement('div');
  panel.className = 'scoreboard-panel';
  panel.innerHTML = `
    <div class="sb-head">
      <span class="ds-grip" title="Drag to move">&#8942;&#8942;</span>
      <span class="sb-flag">LIVE</span>
      <span class="sb-title">MLB SCOREBOARD</span>
      <span class="sb-meta">&mdash;</span>
    </div>
    <div class="scoreboard-body"><div class="games-loading">Polling feed...</div></div>
  `;
  document.body.appendChild(panel);
  const W = 300;
  panel.style.width = W + 'px';
  panel.style.maxHeight = 'calc(100vh - 160px)';
  panel.style.left = Math.max(20, window.innerWidth - W - 40) + 'px';
  panel.style.top = '96px';
  panel.style.zIndex = String(++floatTopZ);
  scoreboardEl = panel;
  const handle = panel.querySelector('.sb-head');
  if (handle) makeDraggable(panel, handle);
  wireScoreboardClicks(panel);
  refreshScoreboard();
}

/* ---------- Legacy fetcher kept as a no-op (sidebars removed) ---------- */
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

  async team_dossier({ name }) {
    const teams = await getAllTeams();
    const t = matchTeam(name, teams);
    if (!t) return { error: `No team matched "${name}".` };
    const [rosterRes, standingsRes, statsRes] = await Promise.all([
      fetch(`${STATS}/teams/${t.id}/roster?rosterType=active&season=${SEASON}`).then(r => r.json()).catch(() => ({})),
      fetch(`${STATS}/standings?leagueId=${t.league?.id}&season=${SEASON}&standingsTypes=regularSeason`).then(r => r.json()).catch(() => ({})),
      fetch(`${STATS}/teams/${t.id}/stats?stats=season&group=hitting,pitching&season=${SEASON}`).then(r => r.json()).catch(() => ({})),
    ]);
    let record = null;
    for (const div of (standingsRes.records || [])) {
      const r = div.teamRecords?.find(tr => tr.team.id === t.id);
      if (r) { record = r; break; }
    }
    const findStat = (g) => statsRes.stats?.find(s => s.group?.displayName === g)?.splits?.[0]?.stat;
    return {
      team_dossier: {
        id: t.id,
        name: t.name,
        abbreviation: t.abbreviation,
        teamCode: t.teamCode,
        shortName: t.shortName,
        clubName: t.clubName,
        division: t.division?.name,
        league: t.league?.name,
        venue: t.venue?.name,
        location: t.locationName,
        firstYearOfPlay: t.firstYearOfPlay,
        logo: teamLogo(t.id),
        record: record ? {
          wins: record.wins,
          losses: record.losses,
          pct: record.winningPercentage,
          gb: record.gamesBack === '-' ? '0.0' : record.gamesBack,
          streak: record.streak?.streakCode,
          divRank: record.divisionRank,
          wcRank: record.wildCardRank,
          runDiff: record.runDifferential,
          last10: record.records?.splitRecords?.find(s => s.type === 'lastTen'),
          home: record.records?.splitRecords?.find(s => s.type === 'home'),
          away: record.records?.splitRecords?.find(s => s.type === 'away'),
        } : null,
        hitting: findStat('hitting'),
        pitching: findStat('pitching'),
        roster: (rosterRes.roster || []).map(p => ({
          id: p.person.id,
          name: p.person.fullName,
          position: p.position?.abbreviation,
          jersey: p.jerseyNumber,
          headshot: headshot(p.person.id),
        })),
      },
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

  async show_leaderboard({ stat, group, season, league, division, limit }) {
    const s = season || String(SEASON);
    const g = group || 'hitting';
    const n = Math.min(50, limit || 10);
    const fetchN = division ? Math.max(60, n * 6) : n;

    let url = `${STATS}/stats/leaders?leaderCategories=${encodeURIComponent(stat)}&season=${s}&statGroup=${g}&limit=${fetchN}&sportId=1`;
    if (league === 'AL') url += '&leagueId=103';
    else if (league === 'NL') url += '&leagueId=104';

    const r = await fetch(url);
    if (!r.ok) return { error: `MLB API ${r.status}` };
    const j = await r.json();
    const cat = j.leagueLeaders?.[0];
    if (!cat) return { error: `No leaderboard available for "${stat}".` };

    const teams = await getAllTeams();
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

    let leaders = (cat.leaders || []).map(l => ({
      rank: l.rank,
      playerId: l.person?.id,
      name: l.person?.fullName,
      teamId: l.team?.id,
      team: l.team?.name,
      teamAbbr: teamById[l.team?.id]?.abbreviation || null,
      value: l.value,
      headshot: headshot(l.person?.id),
    }));

    let scopeLabel = league || 'MLB';
    if (division) {
      const divTeams = matchDivisionTeams(teams, division);
      if (divTeams && divTeams.length) {
        const divIds = new Set(divTeams.map(t => t.id));
        leaders = leaders.filter(l => divIds.has(l.teamId));
        leaders.forEach((l, i) => l.rank = i + 1);
        scopeLabel = division.toUpperCase();
      }
    }

    leaders = leaders.slice(0, n);

    openLeaderboard({
      title: `${(STAT_DISPLAY[stat] || stat).toUpperCase()} — ${scopeLabel}`,
      subtitle: `${s} ${g.toUpperCase()}`,
      leaders,
    });

    return { ok: true, opened: true, count: leaders.length, scope: scopeLabel, stat };
  },
};

const baseballTools = [
  { name: 'team_dossier',
    description: 'Open a floating, draggable FRANCHISE FILE panel for an MLB team: logo, division, venue, record (W-L, pct, division rank, GB, streak, run diff, last 10, home/away splits), full team hitting + pitching breakdowns, and the active roster. Sir can double-click any roster player to open their dossier. ALWAYS use this when sir asks for an overview of a team ("show me the Dodgers", "tell me about the Yankees", just a team name). Do NOT re-list bio fields in your text — just acknowledge briefly.',
    input_schema: { type: 'object', properties: {
      name: { type: 'string', description: 'Team name (e.g. "Dodgers", "Yankees", "NYY")' },
    }, required: ['name'] } },
  { name: 'show_scoreboard',
    description: 'Open a floating, draggable LIVE SCOREBOARD panel that shows every MLB game today with current scores and inning. The UI handles the data — just call the tool, then briefly acknowledge ("Right away, sir."). Use whenever sir asks to see, open, or pull up scores, games, or the scoreboard.',
    input_schema: { type: 'object', properties: {} } },
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
  { name: 'show_leaderboard',
    description: 'Open a floating, draggable LEADERBOARD panel showing top players for a stat (rank, headshot, name, team, value). Sir can double-click any row to open that player\'s full dossier. ALWAYS use this for any "leaders" / "leaderboard" / "best in X" question — never list leaders in prose. Supports optional league (AL/NL) and division ("NL West", "AL East") filters. After calling, briefly acknowledge ("Here you are, sir."). IMPORTANT: WAR is NOT available via MLB Stats API — if sir asks for WAR leaders or "best overall", use OPS for hitters or ERA for pitchers as proxy and mention this briefly.',
    input_schema: { type: 'object', properties: {
      stat: { type: 'string', description: 'Stat name (camelCase): homeRuns, battingAverage, rbi, hits, stolenBases, onBasePercentage, sluggingPercentage, ops, era, wins, strikeOuts, saves, whip.' },
      group: { type: 'string', enum: ['hitting', 'pitching'], description: 'Stat group' },
      season: { type: 'string', description: 'Year (defaults to current)' },
      league: { type: 'string', enum: ['AL', 'NL'], description: 'Optional league filter' },
      division: { type: 'string', description: 'Optional division: "NL West", "AL East", etc.' },
      limit: { type: 'integer', description: 'Top N (default 10)' },
    }, required: ['stat', 'group'] } },
];

/* Execute a tool call and return { result, cards } */
async function runTool(name, input) {
  console.log(`[tool] ${name}`, input);
  if (name === 'show_scoreboard') {
    openScoreboard();
    return { result: { ok: true, message: 'Scoreboard panel opened on screen.' }, cards: [], dossier: null };
  }
  if (!mlb[name]) return { result: { error: `Unknown tool: ${name}` }, cards: [] };
  if (name === 'team_dossier') {
    try {
      const result = await mlb.team_dossier(input);
      if (result?.team_dossier) floatTeamDossier(result.team_dossier);
      return { result, cards: [], dossier: null };
    } catch (e) { return { result: { error: e.message }, cards: [], dossier: null }; }
  }
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
  if (name === 'show_scoreboard') {
    openScoreboard();
  } else if (name === 'player_dossier' && result.dossier) {
    dossier = result.dossier;
  } else if (name === 'search_player' && result.players) {
    for (const p of result.players.slice(0, 4)) {
      cards.push({ img: p.headshot, name: p.fullName, sub: [p.currentTeam, p.primaryPosition].filter(Boolean).join(' · ') });
    }
  } else if ((name === 'player_stats' || name === 'player_career') && result.player) {
    cards.push({ img: result.player.headshot, name: result.player.name, sub: [result.player.team, result.player.position].filter(Boolean).join(' · ') });
  } else if (name === 'team_info' && result.team) {
    cards.push({ img: result.team.logo, logo: true, name: result.team.name, sub: result.team.division || result.team.league || '' });
  }
  // show_leaderboard renders its own panel; no inline cards
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
const STAT_ALIAS_MAP = {
  'war': { stat: 'ops', group: 'hitting', note: 'WAR is not provided by the league API, sir — substituting OPS.' },
  'wins above replacement': { stat: 'ops', group: 'hitting', note: 'WAR is not on file via the league API, sir — substituting OPS.' },
  'overall': { stat: 'ops', group: 'hitting' },
  'best player': { stat: 'ops', group: 'hitting' },
  'hr': { stat: 'homeRuns', group: 'hitting' },
  'hrs': { stat: 'homeRuns', group: 'hitting' },
  'home run': { stat: 'homeRuns', group: 'hitting' },
  'home runs': { stat: 'homeRuns', group: 'hitting' },
  'homers': { stat: 'homeRuns', group: 'hitting' },
  'homeruns': { stat: 'homeRuns', group: 'hitting' },
  'rbi': { stat: 'rbi', group: 'hitting' },
  'rbis': { stat: 'rbi', group: 'hitting' },
  'runs batted in': { stat: 'rbi', group: 'hitting' },
  'runs': { stat: 'runs', group: 'hitting' },
  'hits': { stat: 'hits', group: 'hitting' },
  'avg': { stat: 'battingAverage', group: 'hitting' },
  'average': { stat: 'battingAverage', group: 'hitting' },
  'batting average': { stat: 'battingAverage', group: 'hitting' },
  'obp': { stat: 'onBasePercentage', group: 'hitting' },
  'on base': { stat: 'onBasePercentage', group: 'hitting' },
  'on-base': { stat: 'onBasePercentage', group: 'hitting' },
  'slg': { stat: 'sluggingPercentage', group: 'hitting' },
  'slugging': { stat: 'sluggingPercentage', group: 'hitting' },
  'ops': { stat: 'ops', group: 'hitting' },
  'sb': { stat: 'stolenBases', group: 'hitting' },
  'steals': { stat: 'stolenBases', group: 'hitting' },
  'stolen bases': { stat: 'stolenBases', group: 'hitting' },
  'era': { stat: 'era', group: 'pitching' },
  'earned run average': { stat: 'era', group: 'pitching' },
  'whip': { stat: 'whip', group: 'pitching' },
  'wins': { stat: 'wins', group: 'pitching' },
  'saves': { stat: 'saves', group: 'pitching' },
  'sv': { stat: 'saves', group: 'pitching' },
  'k': { stat: 'strikeouts', group: 'pitching' },
  'ks': { stat: 'strikeouts', group: 'pitching' },
  'strikeouts': { stat: 'strikeouts', group: 'pitching' },
  'strike outs': { stat: 'strikeouts', group: 'pitching' },
  'k/9': { stat: 'strikeoutsPer9Inn', group: 'pitching' },
};

function detectLeaderboardQuery(text) {
  const lower = text.toLowerCase().trim();
  const isLeaderQuery =
    /\b(leaders?|leaderboard|leading|top\s+\d+|best|who\s+leads?)\b/.test(lower) ||
    /^(top|best)\s+/.test(lower);
  if (!isLeaderQuery) return null;

  let bestAlias = null;
  let bestEntry = null;
  for (const [alias, entry] of Object.entries(STAT_ALIAS_MAP)) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      if (!bestAlias || alias.length > bestAlias.length) {
        bestAlias = alias;
        bestEntry = entry;
      }
    }
  }

  if (!bestEntry) {
    bestAlias = '(default)';
    bestEntry = { stat: 'ops', group: 'hitting' };
  }

  let league = null;
  let division = null;
  const divM = /\b(al|nl|american|national)\s+(east|central|west)\b/i.exec(lower);
  if (divM) {
    const lg = /al|american/i.test(divM[1]) ? 'AL' : 'NL';
    const dir = divM[2].charAt(0).toUpperCase() + divM[2].slice(1).toLowerCase();
    division = `${lg} ${dir}`;
  } else if (/\bal\b/.test(lower) || /american league/.test(lower)) {
    league = 'AL';
  } else if (/\bnl\b/.test(lower) || /national league/.test(lower)) {
    league = 'NL';
  }

  let limit = 10;
  const lm = /\btop\s+(\d+)/i.exec(lower);
  if (lm) limit = Math.min(50, Math.max(3, parseInt(lm[1])));

  return {
    stat: bestEntry.stat,
    group: bestEntry.group,
    league, division, limit,
    note: bestEntry.note || null,
    alias: bestAlias,
  };
}

const TEAM_KEYWORDS = [
  'yankees','red sox','blue jays','orioles','rays',
  'white sox','guardians','indians','tigers','royals','twins',
  'astros','rangers','athletics','mariners','angels',
  'braves','mets','phillies','marlins','nationals',
  'cubs','cardinals','brewers','reds','pirates',
  'dodgers','giants','padres','rockies','diamondbacks','d-backs','dbacks',
];

function detectTeamQuery(text) {
  const lower = text.toLowerCase().trim();
  if (/\bleader|leaderboard|top \d|scores|score|standings\b/.test(lower)) return null;
  for (const tn of TEAM_KEYWORDS) {
    const re = new RegExp(`\\b${tn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      const askPattern = /^(show|tell|give|pull up|open|look up|info|about|the)\b/.test(lower);
      const bareName = lower === tn || lower === 'the ' + tn || lower === tn + '?';
      if (askPattern || bareName) return { name: tn };
    }
  }
  return null;
}

function detectQuickCommand(text) {
  const t = text.toLowerCase().trim();
  if (/\b(show|open|display|bring up|pull up|gimme|give me)\b[^.?!]*\b(scores?|scoreboard|games?|matchups?)\b/.test(t) ||
      /^(scoreboard|scores)\s*\.?$/.test(t)) {
    return 'scoreboard';
  }
  return null;
}

function send() {
  if (state.busy) return;
  const text = els.textInput.value.trim();
  if (!text) return;
  els.textInput.value = '';

  const cmd = detectQuickCommand(text);
  if (cmd === 'scoreboard') {
    quickReply(text, 'Pulling up the scoreboard, sir.');
    openScoreboard();
    return;
  }

  const lb = detectLeaderboardQuery(text);
  if (lb) {
    let ack = 'Here you are, sir.';
    if (lb.note) ack = lb.note;
    quickReply(text, ack);
    mlb.show_leaderboard({ stat: lb.stat, group: lb.group, league: lb.league, division: lb.division, limit: lb.limit }).catch(err => {
      console.warn('[leaderboard] failed', err);
      openLeaderboard({ title: 'ERROR', subtitle: lb.alias.toUpperCase(), leaders: [] });
    });
    return;
  }

  const tm = detectTeamQuery(text);
  if (tm) {
    quickReply(text, `Bringing up the ${tm.name}, sir.`);
    mlb.team_dossier({ name: tm.name }).then(result => {
      if (result?.team_dossier) floatTeamDossier(result.team_dossier);
      else console.warn('[team] no dossier returned', result);
    }).catch(err => console.warn('[team] failed', err));
    return;
  }

  callJarvis(text);
}

function quickReply(userText, jarvisText) {
  appendTurn('user', userText);
  const t = appendTurn('jarvis', '');
  t.querySelector('.text').textContent = jarvisText;
  speak(jarvisText);
  state.history.push({ role: 'user', content: userText });
  state.history.push({ role: 'assistant', content: jarvisText });
  saveHistory();
  state.queries++;
  updateReadouts();
}
els.sendBtn.addEventListener('click', send);
els.textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

/* =====================================================
 *  Highlight + Ask — select text anywhere, ask Jarvis about it
 * ===================================================== */
const ASK_MODE_KEY = 'jarvis_ask_mode';
let askEnabled = localStorage.getItem(ASK_MODE_KEY) !== '0';
let askPop = null;
let lastSelectedText = '';

function syncAskBtn() {
  const btn = document.getElementById('askToggle');
  if (btn) btn.classList.toggle('active', askEnabled);
  if (btn) btn.title = askEnabled
    ? 'Ask-on-highlight is ON — select any text and a popover appears. Click to disable.'
    : 'Ask-on-highlight is OFF. Click to enable.';
}

function hideAskPop() {
  if (askPop) { askPop.remove(); askPop = null; }
}

function setAskMode(on) {
  askEnabled = on;
  localStorage.setItem(ASK_MODE_KEY, on ? '1' : '0');
  syncAskBtn();
  if (!on) hideAskPop();
}

document.addEventListener('DOMContentLoaded', () => {
  const askBtn = document.getElementById('askToggle');
  if (askBtn) askBtn.addEventListener('click', () => setAskMode(!askEnabled));
  syncAskBtn();
});

const ASK_SKIP_SELECTOR = 'input, textarea, [contenteditable="true"], .ask-pop, .popover, .ab-body';

function showAskPop(rect, text) {
  hideAskPop();
  askPop = document.createElement('div');
  askPop.className = 'ask-pop';
  askPop.innerHTML = `
    <button class="ask-quick" title="Ask Jarvis about the selected text">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5" stroke-linecap="round"></path></svg>
      <span>ASK JARVIS</span>
    </button>
  `;
  document.body.appendChild(askPop);
  const popW = askPop.offsetWidth;
  const popH = askPop.offsetHeight;
  let x = rect.left + rect.width / 2 - popW / 2;
  let y = rect.top - popH - 10;
  if (y < 8) y = rect.bottom + 10;
  x = Math.max(8, Math.min(window.innerWidth - popW - 8, x));
  askPop.style.left = x + 'px';
  askPop.style.top = y + 'px';
  askPop.style.zIndex = String(++floatTopZ);

  askPop.querySelector('.ask-quick').addEventListener('click', (e) => {
    e.stopPropagation();
    expandAsk(text);
  });
}

function expandAsk(selectedText) {
  if (!askPop) return;
  askPop.classList.add('expanded');
  askPop.innerHTML = `
    <div class="ask-head">
      <span class="ask-icon">&#128270;</span>
      <span class="ask-snippet">"${escapeHtml(selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText)}"</span>
      <button class="ask-close" title="Close">&times;</button>
    </div>
    <div class="ask-input-row">
      <input type="text" class="ask-input" placeholder="What about this, sir?">
      <button class="ask-send" title="Send">&#9654;</button>
    </div>
  `;
  const input = askPop.querySelector('.ask-input');
  const send = askPop.querySelector('.ask-send');
  const close = askPop.querySelector('.ask-close');
  input.focus();
  const submit = () => {
    const q = input.value.trim();
    const prompt = q
      ? `Regarding "${selectedText}" — ${q}`
      : `Tell me about: "${selectedText}"`;
    hideAskPop();
    els.textInput.value = prompt;
    send();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') hideAskPop();
  });
  send.addEventListener('click', submit);
  close.addEventListener('click', hideAskPop);
}

document.addEventListener('selectionchange', () => {
  if (!askEnabled) return;
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < 2 || text.length > 600) { hideAskPop(); return; }
  const range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range) { hideAskPop(); return; }
  let node = range.commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  if (!node || node.closest(ASK_SKIP_SELECTOR)) { hideAskPop(); return; }
  const rect = range.getBoundingClientRect();
  if (!rect.width || !rect.height) { hideAskPop(); return; }
  lastSelectedText = text;
  showAskPop(rect, text);
});

document.addEventListener('pointerdown', (e) => {
  if (askPop && !askPop.contains(e.target)) hideAskPop();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideAskPop();
});

function restoreAnnotations() { /* draw mode removed */ }

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
  if (!localStorage.getItem(STORAGE_KEY)) {
    setStatus('STANDBY');
    setTimeout(openSettings, 500);
  } else {
    setStatus('ONLINE', 'online');
  }
  updateReadouts();
}
init();
