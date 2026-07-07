'use strict'

/* ══════════════════════════════════════════════════════════════
   Play-by-Play — live data layer
   Reuses the MLB Stats API game feed. Each region renders and
   animates independently; only changed values move.
   ══════════════════════════════════════════════════════════════ */

const API = 'https://statsapi.mlb.com/api'
const LOGO = id => `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`
const HEAD = id => `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto/v1/people/${id}/headshot/67/current`

let GAME_PK = null
let PREV = null          // previous normalized model (for diffing)
let BOX_TEAM = 'away'    // selected box-score tab
let firstFeedRender = true
let firstUpdatesRender = true
const seenPlays = new Set()
const seenUpdates = new Set()
let pollTimer = null

/* ── helpers ── */
const $ = id => document.getElementById(id)
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.json() }
function pad(n) { return String(n).padStart(2, '0') }
function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d) }
function qp(k) { return new URLSearchParams(location.search).get(k) }
function txt(el, v) { if (el && el.textContent !== String(v)) el.textContent = v }
function pop(el, cls, dur = 500) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), dur) }

/* ── game selection ── */
async function pickGamePk() {
  const explicit = qp('gamePk') || qp('gamepk')
  if (explicit) return +explicit
  const team = qp('team')
  const end = qp('date') || dstr(new Date())
  const start = qp('date') ? end : addDays(end, -1)
  const sched = await getJSON(`${API}/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=linescore,team`)
  let games = []
  for (const d of sched.dates || []) for (const g of d.games || []) games.push(g)
  if (team) { const f = games.filter(g => g.teams.home.team.id == team || g.teams.away.team.id == team); if (f.length) games = f }
  if (!games.length) return null
  const rank = g => ({ Live: 0, Final: 1, Preview: 2 }[g.status.abstractGameState] ?? 3)
  games.sort((a, b) => {
    const r = rank(a) - rank(b); if (r) return r
    const ta = Date.parse(a.gameDate), tb = Date.parse(b.gameDate)
    return rank(a) === 1 ? tb - ta : ta - tb   // Final: newest first · Preview: soonest first
  })
  return games[0].gamePk
}

/* ── normalize the feed into a flat model ── */
function normalize(feed) {
  const gd = feed.gameData, ld = feed.liveData
  const ls = ld.linescore || {}
  const box = ld.boxscore || {}
  const status = gd.status || {}
  const abstract = status.abstractGameState
  const isLive = abstract === 'Live', isFinal = abstract === 'Final'

  const teamSide = side => {
    const t = gd.teams[side] || {}, bx = box.teams?.[side] || {}, lst = ls.teams?.[side] || {}
    return {
      id: t.id, abbr: t.abbreviation || '—', name: t.teamName || t.name, fullName: t.name,
      record: t.record ? `${t.record.wins}-${t.record.losses}` : '',
      runs: lst.runs ?? bx.teamStats?.batting?.runs ?? 0,
      hits: lst.hits ?? bx.teamStats?.batting?.hits ?? 0,
      errors: lst.errors ?? bx.teamStats?.fielding?.errors ?? 0,
      logo: t.id ? LOGO(t.id) : '',
    }
  }
  const away = teamSide('away'), home = teamSide('home')

  const isTop = ls.isTopInning ?? (ls.inningHalf === 'Top')
  const battingSide = isTop ? 'away' : 'home'
  const pitchingSide = isTop ? 'home' : 'away'
  const off = ls.offense || {}, def = ls.defense || {}

  const boxPlayer = (side, id) => id ? box.teams?.[side]?.players?.['ID' + id] : null

  const batterId = off.batter?.id
  const pitcherId = def.pitcher?.id
  const bP = boxPlayer(battingSide, batterId)
  const pP = boxPlayer(pitchingSide, pitcherId)

  const batter = batterId ? {
    id: batterId, name: off.batter.fullName,
    meta: bP ? `${bP.position?.abbreviation || ''}${bP.jerseyNumber ? ' · #' + bP.jerseyNumber : ''}` : '',
    line: bP?.stats?.batting?.summary || '',
    avg: bP?.seasonStats?.batting?.avg || '',
  } : null
  const pitcher = pitcherId ? {
    id: pitcherId, name: def.pitcher.fullName,
    meta: pP ? (pP.stats?.pitching?.note || '') : '',
    line: pP?.stats?.pitching?.summary || '',
    era: pP?.seasonStats?.pitching?.era || '',
  } : null

  // probable pitchers for preview
  const prob = {
    away: gd.probablePitchers?.away?.fullName || '',
    home: gd.probablePitchers?.home?.fullName || '',
  }

  // completed plays (chronological)
  const allPlays = ld.plays?.allPlays || []
  const plays = allPlays.filter(p => p.about?.isComplete).map(p => ({
    idx: p.about.atBatIndex,
    inning: p.about.inning,
    ordinal: p.about.halfInning === 'top' ? '▲' + p.about.inning : '▼' + p.about.inning,
    half: p.about.halfInning,
    isTop: p.about.isTopInning,
    battingAbbr: p.about.isTopInning ? away.abbr : home.abbr,
    event: p.result?.event || '',
    desc: p.result?.description || '',
    rbi: p.result?.rbi || 0,
    isScoring: !!p.about?.isScoringPlay,
    awayScore: p.result?.awayScore ?? 0,
    homeScore: p.result?.homeScore ?? 0,
  }))

  return {
    gamePk: gd.game?.pk,
    status: { abstract, detailed: status.detailedState, isLive, isFinal },
    away, home,
    inning: {
      num: ls.currentInning || null,
      ordinal: ls.currentInningOrdinal || '',
      half: ls.inningHalf || '',
      state: ls.inningState || '',
      isTop,
    },
    battingSide,
    count: {
      balls: ls.balls ?? 0, strikes: ls.strikes ?? 0, outs: ls.outs ?? 0,
    },
    bases: { first: !!off.first, second: !!off.second, third: !!off.third },
    batter, pitcher, prob,
    onDeck: off.onDeck?.fullName || '',
    innings: ls.innings || [],
    scheduledInnings: ls.scheduledInnings || 9,
    plays,
    box,
    venue: gd.venue?.name || '',
    dateTime: gd.datetime?.dateTime || '',
    startTime: gd.datetime?.time && gd.datetime?.ampm ? `${gd.datetime.time} ${gd.datetime.ampm}` : '',
    weather: gd.weather?.temp ? `${gd.weather.temp}° ${gd.weather.condition || ''}`.trim() : '',
  }
}

/* ══════════════════ Renderers ══════════════════ */

function renderHeader(m) {
  const live = $('ph-live-badge')
  live.hidden = !m.status.isLive
  $('ph-matchup').innerHTML = `<b>${m.away.fullName}</b> @ <b>${m.home.fullName}</b> · ${m.status.detailed || ''}`
  const now = new Date()
  txt($('ph-updated'), (m.status.isFinal ? 'Final' : 'Updated ') + (m.status.isFinal ? '' : `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`))
}

function renderScoreboard(m, prev) {
  const set = (side, t) => {
    const logo = $(`sb-${side}-logo`); if (logo && logo.src !== t.logo) logo.src = t.logo
    txt($(`sb-${side}-abbr`), t.abbr)
    txt($(`sb-${side}-record`), t.record)
    const sc = $(`sb-${side}-score`)
    txt(sc, t.runs)
    if (prev && prev[side].runs !== t.runs) pop(sc, 'anim-score')
  }
  set('away', m.away); set('home', m.home)

  // batting-team highlight
  $('sb-away').classList.toggle('batting', m.status.isLive && m.battingSide === 'away')
  $('sb-home').classList.toggle('batting', m.status.isLive && m.battingSide === 'home')

  // inning indicator
  const arrow = $('sb-inning-arrow'), num = $('sb-inning-num'), line = $('sb-state-line')
  const st = m.inning.state
  const mid = st === 'Middle' || st === 'End'
  arrow.classList.toggle('bottom', !m.inning.isTop && !mid)
  arrow.classList.toggle('mid', mid)
  arrow.textContent = mid ? '■' : '▲'
  if (m.status.isFinal) { txt(num, 'F'); arrow.style.visibility = 'hidden'; txt(line, 'Final' + (m.inning.num > 9 ? ` / ${m.inning.num}` : '')) }
  else if (!m.inning.num) { txt(num, '—'); arrow.style.visibility = 'hidden'; txt(line, m.startTime ? `First Pitch ${m.startTime}` : 'Scheduled') }
  else {
    arrow.style.visibility = 'visible'
    txt(num, m.inning.num)
    txt(line, `${st || m.inning.half} ${m.inning.ordinal}`.trim())
    if (prev && (prev.inning.num !== m.inning.num || prev.inning.half !== m.inning.half)) pop($('sb-inning'), 'anim-inning', 400)
  }

  renderLinescore(m)
}

function renderLinescore(m) {
  const table = $('sb-linescore')
  const n = Math.max(m.scheduledInnings, m.innings.length)
  let head = '<tr class="ls-head"><th class="ls-team"></th>'
  for (let i = 1; i <= n; i++) head += `<th class="${i === m.inning.num && m.status.isLive ? 'ls-cur' : ''}">${i}</th>`
  head += '<th class="ls-rhe">R</th><th class="ls-rhe">H</th><th class="ls-rhe">E</th></tr>'

  const row = (side, t) => {
    let r = `<tr><td class="ls-team">${t.abbr}</td>`
    for (let i = 1; i <= n; i++) {
      const inn = m.innings.find(x => x.num === i)
      const v = inn ? (inn[side]?.runs ?? '') : ''
      r += `<td>${v === '' ? '·' : v}</td>`
    }
    r += `<td class="ls-tot">${t.runs}</td><td>${t.hits}</td><td>${t.errors}</td></tr>`
    return r
  }
  table.innerHTML = head + row('away', m.away) + row('home', m.home)
}

function renderState(m, prev) {
  // bases
  ;['first', 'second', 'third'].forEach((b, i) => {
    const id = ['base-1b', 'base-2b', 'base-3b'][i]
    const el = $(id); if (!el) return
    const on = m.bases[b]
    el.classList.toggle('on', on)
    if (prev && !prev.bases[b] && on) pop(el, 'anim-base', 340)
  })
  // count pips
  pips($('pips-balls'), 4, m.count.balls, 'on-ball')
  pips($('pips-strikes'), 3, m.count.strikes, 'on-strike')
  const outsEl = $('pips-outs')
  const grewOut = prev && m.count.outs > prev.count.outs
  pips(outsEl, 3, m.count.outs, 'on-out')
  if (grewOut) { const dots = outsEl.querySelectorAll('.pip.on-out'); const last = dots[dots.length - 1]; pop(last, 'anim-out', 360) }
  // big count
  txt($('scb-balls'), m.count.balls)
  txt($('scb-strikes'), m.count.strikes)
}

function pips(container, total, on, cls) {
  if (!container) return
  if (container.children.length !== total) {
    container.innerHTML = ''
    for (let i = 0; i < total; i++) { const s = document.createElement('span'); s.className = 'pip'; container.appendChild(s) }
  }
  ;[...container.children].forEach((p, i) => p.className = 'pip' + (i < on ? ' ' + cls : ''))
}

function renderMatchup(m) {
  const showLive = m.status.isLive && m.batter && m.pitcher
  if (showLive) {
    const b = m.batter, p = m.pitcher
    const bi = $('mu-batter-img'); if (bi.src !== HEAD(b.id)) bi.src = HEAD(b.id)
    txt($('mu-batter-name'), b.name)
    txt($('mu-batter-meta'), b.meta)
    txt($('mu-batter-line'), b.line || (b.avg ? 'AVG ' + b.avg : ''))
    const pi = $('mu-pitcher-img'); if (pi.src !== HEAD(p.id)) pi.src = HEAD(p.id)
    txt($('mu-pitcher-name'), p.name)
    txt($('mu-pitcher-meta'), p.meta)
    txt($('mu-pitcher-line'), p.line || (p.era ? 'ERA ' + p.era : ''))
    $('mu-batter-img').style.visibility = ''; $('mu-pitcher-img').style.visibility = ''
  } else {
    // preview / final → show probable or final pitchers
    txt($('mu-batter-name'), m.away.fullName)
    txt($('mu-batter-meta'), m.status.isFinal ? 'Away' : 'Probable SP')
    txt($('mu-batter-line'), m.prob.away || '')
    txt($('mu-pitcher-name'), m.home.fullName)
    txt($('mu-pitcher-meta'), m.status.isFinal ? 'Home' : 'Probable SP')
    txt($('mu-pitcher-line'), m.prob.home || '')
    $('mu-batter-img').style.visibility = 'hidden'; $('mu-pitcher-img').style.visibility = 'hidden'
  }
}

function classifyPlay(p) {
  const ev = p.event || ''
  if (/Home Run/i.test(ev)) return 'hr'
  if (p.isScoring) return 'scoring'
  if (/Strikeout|Strikes Out/i.test(ev)) return 'out'
  if (/out|Grounded|Flyout|Lineout|Pop|Forceout|Play|Double Play/i.test(ev)) return 'out'
  if (/Single|Double|Triple|Walk|Hit By Pitch|Reached|Balk|Wild Pitch|Stolen/i.test(ev)) return 'hit'
  return 'info'
}
const KLASS = { hr: 'is-hr', scoring: 'is-scoring', out: 'is-out', hit: 'is-hit', info: 'is-info' }

function playEl(p, animate) {
  const kind = classifyPlay(p)
  const el = document.createElement('div')
  el.className = `play-item ${KLASS[kind]}${animate ? ' pbp-new' : ''}`
  const scoreLine = p.isScoring ? `<div class="play-score">${p.awayScore}–${p.homeScore}</div>` : ''
  el.innerHTML =
    `<div class="play-badge">${p.ordinal}<span class="pb-inn">${p.battingAbbr}</span></div>` +
    `<div class="play-body"><div class="play-event">${p.event}</div><div class="play-desc">${p.desc}</div>${scoreLine}</div>`
  return el
}

function renderPbp(m) {
  const body = $('pbp-body')
  txt($('pbp-count'), m.plays.length ? `${m.plays.length} plays` : '')
  if (!m.plays.length) return
  if (firstFeedRender) {
    body.innerHTML = ''
    for (let i = m.plays.length - 1; i >= 0; i--) { body.appendChild(playEl(m.plays[i], false)); seenPlays.add(m.plays[i].idx) }
    firstFeedRender = false
    return
  }
  // prepend only new completed plays (chronological → newest ends on top)
  for (const p of m.plays) {
    if (seenPlays.has(p.idx)) continue
    body.insertBefore(playEl(p, true), body.firstChild)
    seenPlays.add(p.idx)
  }
}

function renderUpdates(m) {
  const body = $('updates-body')
  const key = m.plays.filter(p => p.isScoring || /Home Run/i.test(p.event))
  if (!key.length) return
  if (firstUpdatesRender) {
    body.innerHTML = ''
    for (let i = key.length - 1; i >= 0; i--) { body.appendChild(playEl(key[i], false)); seenUpdates.add(key[i].idx) }
    firstUpdatesRender = false
    return
  }
  for (const p of key) {
    if (seenUpdates.has(p.idx)) continue
    body.insertBefore(playEl(p, true), body.firstChild)
    seenUpdates.add(p.idx)
  }
}

function renderGameInfo(m) {
  const rows = [
    ['Status', m.status.detailed || '—'],
    ['Venue', m.venue || '—'],
    ['First Pitch', m.startTime || '—'],
  ]
  if (m.weather) rows.push(['Weather', m.weather])
  txt($('gi-state'), m.status.isLive ? `${m.inning.state || m.inning.half} ${m.inning.ordinal}`.trim() : '')
  $('gi-body').innerHTML = rows.map(([k, v]) => `<div class="gi-row"><span class="gi-k">${k}</span><span class="gi-v">${v}</span></div>`).join('')
}

function renderSituation(m) {
  const body = $('situation-body')
  if (!m.status.isLive) {
    body.innerHTML = `<div class="empty-note">${m.status.isFinal ? 'Game complete.' : 'Game has not started.'}</div>`
    return
  }
  const risp = m.bases.second || m.bases.third
  const runners = ['first', 'second', 'third'].filter(b => m.bases[b]).length
  const cells = [
    ['Count', `${m.count.balls}-${m.count.strikes}`, false],
    ['Outs', m.count.outs, false],
    ['On Base', runners, runners > 0],
    ['RISP', risp ? 'Yes' : 'No', risp],
  ]
  body.innerHTML = `<div class="sit-grid">` + cells.map(([k, v, hot]) =>
    `<div class="sit-cell"><span class="sit-v${hot ? ' hot' : ''}">${v}</span><span class="sit-k">${k}</span></div>`).join('') +
    `<div class="sit-cell wide"><span class="sit-v">${m.onDeck || '—'}</span><span class="sit-k">On Deck</span></div></div>`
}

function renderBox(m) {
  const body = $('box-body')
  const side = BOX_TEAM
  const bx = m.box.teams?.[side]
  if (!bx) { body.innerHTML = '<div class="empty-note">No box score yet.</div>'; return }
  const players = bx.players || {}
  const curBatterId = m.status.isLive && m.battingSide === side ? m.batter?.id : null

  // Batting
  let html = '<div class="box-section-label">Batting</div><table class="box-table"><tr>' +
    '<th class="bx-name">Batter</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>AVG</th></tr>'
  for (const id of bx.batters || []) {
    const p = players['ID' + id]; if (!p) continue
    const s = p.stats?.batting || {}
    if ((s.atBats == null) && (s.plateAppearances == null) && !p.battingOrder) continue
    const pos = p.position?.abbreviation || ''
    const now = curBatterId && +id === +curBatterId ? ' class="batting-now"' : ''
    html += `<tr${now}><td class="bx-name">${p.person?.fullName || ''}<span class="bx-pos">${pos}</span></td>` +
      `<td>${s.atBats ?? 0}</td><td>${s.runs ?? 0}</td><td>${s.hits ?? 0}</td><td>${s.rbi ?? 0}</td>` +
      `<td>${s.baseOnBalls ?? 0}</td><td>${s.strikeOuts ?? 0}</td><td>${p.seasonStats?.batting?.avg ?? '—'}</td></tr>`
  }
  const tb = bx.teamStats?.batting || {}
  html += `<tr class="box-team-tot"><td class="bx-name">Team</td><td>${tb.atBats ?? 0}</td><td>${tb.runs ?? 0}</td>` +
    `<td>${tb.hits ?? 0}</td><td>${tb.rbi ?? 0}</td><td>${tb.baseOnBalls ?? 0}</td><td>${tb.strikeOuts ?? 0}</td><td>${tb.avg ?? '—'}</td></tr></table>`

  // Pitching
  html += '<div class="box-section-label">Pitching</div><table class="box-table"><tr>' +
    '<th class="bx-name">Pitcher</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>ERA</th></tr>'
  for (const id of bx.pitchers || []) {
    const p = players['ID' + id]; if (!p) continue
    const s = p.stats?.pitching || {}
    const note = p.stats?.pitching?.note ? ` <span class="bx-pos">${p.stats.pitching.note}</span>` : ''
    html += `<tr><td class="bx-name">${p.person?.fullName || ''}${note}</td>` +
      `<td>${s.inningsPitched ?? '0.0'}</td><td>${s.hits ?? 0}</td><td>${s.runs ?? 0}</td><td>${s.earnedRuns ?? 0}</td>` +
      `<td>${s.baseOnBalls ?? 0}</td><td>${s.strikeOuts ?? 0}</td><td>${p.seasonStats?.pitching?.era ?? '—'}</td></tr>`
  }
  html += '</table>'
  body.innerHTML = html
}

/* ══════════════════ Orchestration ══════════════════ */

function renderAll(m) {
  renderHeader(m)
  renderScoreboard(m, PREV)
  renderState(m, PREV)
  renderMatchup(m)
  renderPbp(m)
  renderUpdates(m)
  renderGameInfo(m)
  renderSituation(m)
  renderBox(m)
  PREV = m
}

async function tick() {
  try {
    const feed = await getJSON(`${API}/v1.1/game/${GAME_PK}/feed/live`)
    const m = normalize(feed)
    renderAll(m)
    schedule(m.status.isLive ? 12000 : 45000)
  } catch (e) {
    console.error('pbp tick failed', e)
    schedule(20000)
  }
}
function schedule(ms) { clearTimeout(pollTimer); pollTimer = setTimeout(tick, ms) }

function wireBoxTabs() {
  document.querySelectorAll('.box-tab').forEach(btn => btn.addEventListener('click', () => {
    BOX_TEAM = btn.dataset.team
    document.querySelectorAll('.box-tab').forEach(b => b.classList.toggle('active', b === btn))
    if (PREV) renderBox(PREV)
  }))
}

async function init() {
  wireBoxTabs()
  try {
    GAME_PK = await pickGamePk()
    if (!GAME_PK) { $('ph-matchup').innerHTML = '<span class="ph-loading">No game found.</span>'; return }
    await tick()
  } catch (e) {
    console.error(e)
    $('ph-matchup').innerHTML = '<span class="ph-loading">Could not load game data.</span>'
  }
}

document.addEventListener('DOMContentLoaded', init)
