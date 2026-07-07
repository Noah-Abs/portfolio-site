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
let firstTimelineRender = true
const seenTimeline = new Set()
let userAwayFromLive = false
let LIVE_NOW = false
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
function abbrevName(full) { if (!full) return ''; const p = full.split(' '); return p.length < 2 ? full : p[0][0] + '. ' + p.slice(1).join(' ') }
function ordinalNum(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
function cleanSub(d) { return (d || '').replace(/^(Pitching Change|Offensive Substitution|Defensive Substitution|Defensive Switch):\s*/i, '') }
function hitLabel(et) { return et === 'single' ? '1B' : et === 'double' ? '2B' : et === 'triple' ? '3B' : 'H' }
function classifyEvent(et, ev) {
  if (et === 'home_run') return 'hr'
  if (/walk|hit_by_pitch/.test(et)) return 'walk'
  if (/single|double|triple/.test(et)) return 'hit'
  if (et === 'field_error' || /error/i.test(ev)) return 'error'
  if (/out|strikeout|force|grounded_into|sac_|fielders_choice|double_play|triple_play|pickoff|caught_stealing/.test(et)) return 'out'
  return 'info'
}
function outcomeIcon(item) {
  switch (item.klass) {
    case 'hr': return { t: 'HR', c: 'ic-hr', dot: false }
    case 'hit': return { t: hitLabel(item.eventType), c: 'ic-hit', dot: false }
    case 'walk': return { t: item.eventType === 'hit_by_pitch' ? 'HBP' : 'BB', c: 'ic-walk', dot: false }
    case 'error': return { t: 'E', c: 'ic-error', dot: false }
    case 'out': return item.eventType === 'strikeout' ? { t: 'K', c: 'ic-out', dot: false } : { t: '', c: 'ic-out', dot: true }
    default: return { t: '', c: 'ic-info', dot: true }
  }
}
function arrowSym(isTop) { return isTop ? '▲' : '▼' }
function basesText(b) {
  const on = []
  if (b.first) on.push('1st'); if (b.second) on.push('2nd'); if (b.third) on.push('3rd')
  if (!on.length) return 'Bases empty'
  if (on.length === 3) return 'Bases loaded'
  return 'Runner' + (on.length > 1 ? 's' : '') + ' on ' + on.join(' & ')
}
function situationHtml(it) {
  const parts = [
    `<span class="tl-arrow${it.isTop ? '' : ' bottom'}">${arrowSym(it.isTop)}</span> ${it.isTop ? 'Top' : 'Bot'} ${it.ordinal}`,
    `${it.outsBefore} Out${it.outsBefore === 1 ? '' : 's'}`,
    basesText(it.basesBefore),
  ]
  return parts.map((p, i) => i === 0 ? p : `<span class="tl-sit-sep">•</span> ${p}`).join(' ')
}
function playChips(it) {
  const chips = []
  if (it.eventType === 'home_run' && it.hit) {
    if (it.hit.dist) chips.push(`<span class="chip chip-gold">${it.hit.dist} ft</span>`)
    if (it.hit.ev) chips.push(`<span class="chip">${Math.round(it.hit.ev)} mph EV</span>`)
    if (it.hit.la != null) chips.push(`<span class="chip">${Math.round(it.hit.la)}° LA</span>`)
  } else if (it.eventType === 'strikeout' && it.pitch && it.pitch.velo) {
    chips.push(`<span class="chip chip-red">${it.pitch.velo} mph ${it.pitch.type || ''}</span>`.replace(' </span>', '</span>'))
  } else if (it.klass === 'hit' && it.hit && it.hit.ev) {
    chips.push(`<span class="chip">${Math.round(it.hit.ev)} mph EV</span>`)
    if (it.hit.dist) chips.push(`<span class="chip">${it.hit.dist} ft</span>`)
  }
  if (it.rbi > 0) chips.push(`<span class="chip chip-gold">${it.rbi} RBI</span>`)
  return chips
}
function reviewRuling(desc) {
  const m = /call on the field was (\w+)/i.exec(desc || '')
  if (m) return 'Call ' + m[1].toLowerCase()
  return 'Play under review'
}

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

  const starterOf = side => {
    const id = box.teams?.[side]?.pitchers?.[0] || gd.probablePitchers?.[side]?.id
    if (!id) return { name: '', hand: '' }
    const person = gd.players?.['ID' + id]
    const full = person?.fullName || gd.probablePitchers?.[side]?.fullName || box.teams?.[side]?.players?.['ID' + id]?.person?.fullName || ''
    const hand = person?.pitchHand?.code ? person.pitchHand.code + 'HP' : ''
    return { name: abbrevName(full), hand }
  }
  const teamSide = side => {
    const t = gd.teams[side] || {}, bx = box.teams?.[side] || {}, lst = ls.teams?.[side] || {}
    return {
      id: t.id, abbr: t.abbreviation || '—', name: t.teamName || t.name, fullName: t.name,
      record: t.record ? `${t.record.wins}-${t.record.losses}` : '',
      runs: lst.runs ?? bx.teamStats?.batting?.runs ?? 0,
      hits: lst.hits ?? bx.teamStats?.batting?.hits ?? 0,
      errors: lst.errors ?? bx.teamStats?.fielding?.errors ?? 0,
      logo: t.id ? LOGO(t.id) : '',
      starter: starterOf(side),
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

  // ── Chronological timeline: enriched play cards + special-event notes ──
  const allPlays = ld.plays?.allPlays || []
  const timeline = []
  let simOuts = 0, simHalf = null, prevLeader = 0
  let postFirst = false, postSecond = false, postThird = false
  for (const p of allPlays) {
    const ab = p.about || {}
    const hk = `${ab.inning}${ab.halfInning}`
    if (hk !== simHalf) { simHalf = hk; simOuts = 0; postFirst = postSecond = postThird = false }
    const outsBefore = simOuts
    const basesBefore = { first: postFirst, second: postSecond, third: postThird }

    // special-event notifications (happen before the at-bat resolves)
    for (const e of p.playEvents || []) {
      if (e.type !== 'action') continue
      const et = e.details?.eventType || ''
      if (et === 'pitching_substitution') {
        timeline.push({ kind: 'note', id: `n:${ab.atBatIndex}:pit:${e.details?.description}`, noteType: 'pitching', title: 'Pitching Change', isTop: ab.isTopInning, ordinal: ordinalNum(ab.inning), text: cleanSub(e.details?.description) })
      } else if (/ejection/i.test(et)) {
        timeline.push({ kind: 'note', id: `n:${ab.atBatIndex}:ej`, noteType: 'ejection', title: 'Ejection', isTop: ab.isTopInning, ordinal: ordinalNum(ab.inning), text: e.details?.description || '' })
      }
    }

    if (ab.isComplete) {
      const pitchesE = (p.playEvents || []).filter(e => e.isPitch)
      const lastPitch = pitchesE[pitchesE.length - 1]
      const inPlay = (p.playEvents || []).find(e => e.hitData)
      const eventType = p.result?.eventType || ''
      const aS = p.result?.awayScore ?? 0, hS = p.result?.homeScore ?? 0
      const leadNow = aS > hS ? 1 : (hS > aS ? 2 : 0)
      const leadChange = !!ab.isScoringPlay && leadNow !== 0 && leadNow !== prevLeader
      const item = {
        kind: 'play', id: `p:${ab.atBatIndex}`,
        inning: ab.inning, isTop: ab.isTopInning, ordinal: ordinalNum(ab.inning),
        outsBefore, basesBefore,
        event: p.result?.event || '', eventType, klass: classifyEvent(eventType, p.result?.event || ''),
        desc: p.result?.description || '',
        rbi: p.result?.rbi || 0, isScoring: !!ab.isScoringPlay, hasReview: !!ab.hasReview,
        aS, hS, awayAbbr: away.abbr, homeAbbr: home.abbr,
        pitch: lastPitch && lastPitch.pitchData?.startSpeed ? { velo: Math.round(lastPitch.pitchData.startSpeed), type: lastPitch.details?.type?.description || '' } : null,
        hit: inPlay?.hitData ? { ev: inPlay.hitData.launchSpeed, la: inPlay.hitData.launchAngle, dist: inPlay.hitData.totalDistance } : null,
        leadChange,
      }
      item.major = eventType === 'home_run' || leadChange || (item.isScoring && item.rbi >= 2)
      item.emph = item.isScoring
      timeline.push(item)
      if (ab.hasReview) timeline.push({ kind: 'note', id: `n:${ab.atBatIndex}:rev`, noteType: 'review', title: 'Replay Review', isTop: ab.isTopInning, ordinal: ordinalNum(ab.inning), text: reviewRuling(p.result?.description) })
      prevLeader = leadNow
    }

    // advance situation for the next play — postOn* is the authoritative
    // base state after this at-bat, i.e. the pre-state of the next one
    if (p.count?.outs != null) simOuts = p.count.outs
    postFirst = !!p.matchup?.postOnFirst
    postSecond = !!p.matchup?.postOnSecond
    postThird = !!p.matchup?.postOnThird
  }

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
    timeline,
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
  else if (!m.status.isLive || !m.inning.num) { txt(num, '—'); arrow.style.visibility = 'hidden'; txt(line, m.startTime ? `First Pitch ${m.startTime}` : (m.status.detailed || 'Scheduled')) }
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

function timelineEl(it, animate) {
  const el = document.createElement('div')
  if (it.kind === 'note') {
    el.className = `tl-item tl-note note-${it.noteType}${animate ? ' tl-in' : ''}`
    el.innerHTML =
      `<div class="tl-note-head"><span class="tl-note-type">${it.title}</span>` +
      `<span class="tl-note-sit">${arrowSym(it.isTop)} ${it.ordinal}</span></div>` +
      `<div class="tl-note-body">${it.text || ''}</div>`
    return el
  }
  const ic = outcomeIcon(it)
  const iconHtml = `<span class="tl-icon ${ic.c}${ic.dot ? ' dot' : ''}">${ic.t}</span>`
  const chips = playChips(it)
  const chipsHtml = chips.length ? `<div class="tl-chips">${chips.join('')}</div>` : ''

  if (it.major) {
    const isLead = it.leadChange && it.eventType !== 'home_run'
    const title = it.eventType === 'home_run' ? 'HOME RUN' : (isLead ? 'LEAD CHANGE' : 'SCORING PLAY')
    el.className = `tl-item tl-feature${isLead ? ' lead' : ''}${animate ? ' tl-in' : ''}`
    el.innerHTML =
      `<div class="tl-sit">${situationHtml(it)}</div>` +
      `<div class="tl-feature-head">${iconHtml}<span class="tl-feature-title">${title}</span>` +
      `<span class="tl-feature-score">${it.awayAbbr} ${it.aS} · ${it.homeAbbr} ${it.hS}</span></div>` +
      `<div class="tl-desc">${it.desc}</div>${chipsHtml}`
    return el
  }
  el.className = `tl-item tl-play${it.emph ? ' emph' : ''}${animate ? ' tl-in' : ''}`
  el.innerHTML =
    `<div class="tl-sit">${situationHtml(it)}</div>` +
    `<div class="tl-main">${iconHtml}<span class="tl-desc">${it.desc}</span></div>${chipsHtml}`
  return el
}

function renderTimeline(m) {
  const body = $('tl-body')
  const items = m.timeline
  LIVE_NOW = m.status.isLive
  $('card-timeline').classList.toggle('not-live', !m.status.isLive)
  const nPlays = items.reduce((a, i) => a + (i.kind === 'play' ? 1 : 0), 0)
  txt($('tl-count'), nPlays ? `${nPlays} plays` : '')
  if (!items.length) return

  const THRESH = 60
  if (firstTimelineRender) {
    body.innerHTML = ''
    for (let i = items.length - 1; i >= 0; i--) { body.appendChild(timelineEl(items[i], false)); seenTimeline.add(items[i].id) }
    firstTimelineRender = false
    body.scrollTop = 0
    updateReturnBtn()
    return
  }
  const fresh = items.filter(i => !seenTimeline.has(i.id))
  if (!fresh.length) return
  const atLive = body.scrollTop <= THRESH
  const before = body.scrollHeight
  for (const it of fresh) { body.insertBefore(timelineEl(it, true), body.firstChild); seenTimeline.add(it.id) }
  const added = body.scrollHeight - before
  if (atLive) body.scrollTop = 0
  else body.scrollTop += added   // hold the user's position while reviewing
  updateReturnBtn()
}

function updateReturnBtn() {
  const body = $('tl-body'), btn = $('tl-return')
  if (!body || !btn) return
  const away = body.scrollTop > 60
  userAwayFromLive = away
  btn.hidden = !(away && LIVE_NOW)
}

function liveStateText(m) {
  const st = m.inning.state
  const half = (st === 'Middle' || st === 'End') ? st : (m.inning.isTop ? 'Top' : 'Bottom')
  return `${half} ${m.inning.ordinal}`.trim()
}

function statusInfo(m) {
  const d = m.status.detailed || ''
  if (m.status.isLive) return { cls: 'st-live', label: 'LIVE', state: liveStateText(m) }
  if (m.status.isFinal) return { cls: 'st-final', label: 'FINAL', state: m.inning.num > 9 ? `${m.inning.num} innings` : '' }
  if (/Delayed/i.test(d)) return { cls: 'st-alert', label: 'DELAYED', state: d.replace(/^Delayed:?\s*/i, '') }
  if (/Postponed/i.test(d)) return { cls: 'st-alert', label: 'POSTPONED', state: '' }
  if (/Suspended/i.test(d)) return { cls: 'st-alert', label: 'SUSPENDED', state: '' }
  if (/Warmup/i.test(d)) return { cls: 'st-upcoming', label: 'WARMUP', state: m.startTime || '' }
  return { cls: 'st-upcoming', label: 'UPCOMING', state: m.startTime || '' }
}

function renderStatus(m) {
  const card = $('card-status')
  const info = statusInfo(m)
  card.className = 'card card-status ' + info.cls
  txt($('status-badge'), info.label)
  txt($('status-state'), info.state)
  const showScore = m.status.isLive || m.status.isFinal
  txt($('status-score'), showScore
    ? `${m.away.name} ${m.away.runs}, ${m.home.name} ${m.home.runs}`
    : `${m.away.name} vs ${m.home.name}`)
}

function renderSummary(m) {
  const showLead = m.status.isLive || m.status.isFinal
  const set = (side, t, leading) => {
    const logo = $(`gs-${side}-logo`); if (logo && t.logo && logo.src !== t.logo) logo.src = t.logo
    txt($(`gs-${side}-name`), t.name)
    const sp = t.starter && t.starter.name ? (t.starter.hand ? `${t.starter.hand} ${t.starter.name}` : t.starter.name) : ''
    txt($(`gs-${side}-sub`), [t.record, sp].filter(Boolean).join(' · '))
    txt($(`gs-${side}-score`), t.runs)
    $(`gs-${side}`).classList.toggle('leading', leading)
  }
  set('away', m.away, showLead && m.away.runs > m.home.runs)
  set('home', m.home, showLead && m.home.runs > m.away.runs)
  txt($('gs-venue'), m.venue || '')
  txt($('gs-time'), m.status.isFinal ? 'Final' : (m.startTime || ''))
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
  renderStatus(m)
  renderSummary(m)
  renderScoreboard(m, PREV)
  renderState(m, PREV)
  renderMatchup(m)
  renderTimeline(m)
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

function wireTimeline() {
  const body = $('tl-body'), btn = $('tl-return')
  if (body) body.addEventListener('scroll', updateReturnBtn, { passive: true })
  if (btn) btn.addEventListener('click', () => body.scrollTo({ top: 0, behavior: 'smooth' }))
}

async function init() {
  wireBoxTabs()
  wireTimeline()
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
