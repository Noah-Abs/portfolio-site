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
let firstPbpRender = true
const seenPbp = new Set()
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
function pitchInfo(e, i) {
  const call = e.details?.call
  let res = 'ball'
  if (e.details?.isInPlay) res = 'inplay'
  else if (/foul/i.test(call?.description || '')) res = 'foul'
  else if (e.details?.isStrike) res = 'strike'
  return {
    num: e.pitchNumber || i + 1,
    type: e.details?.type?.description || '',
    velo: e.pitchData?.startSpeed ? Math.round(e.pitchData.startSpeed * 10) / 10 : null,
    resultLabel: call?.description || '',
    res,
    balls: e.count?.balls ?? 0, strikes: e.count?.strikes ?? 0,
    pX: e.pitchData?.coordinates?.pX, pZ: e.pitchData?.coordinates?.pZ,
  }
}
function situationSummary(b) {
  const on = []
  if (b.first) on.push('1st'); if (b.second) on.push('2nd'); if (b.third) on.push('3rd')
  if (!on.length) return 'No runners on base'
  if (on.length === 3) return 'Bases loaded'
  return 'Runner' + (on.length > 1 ? 's' : '') + ' on ' + on.join(' & ')
}
function shortRes(p) {
  const r = p.resultLabel || ''
  if (/in play/i.test(r)) return 'In Play'
  if (/hit by pitch/i.test(r)) return 'HBP'
  return r.replace('Swinging Strike', 'Swing').replace('Called Strike', 'Called') || (p.res === 'ball' ? 'Ball' : p.res)
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
  const _fl = qp('forcelive')
  const isLive = _fl ? true : abstract === 'Live', isFinal = _fl ? false : abstract === 'Final'

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
    num: bP?.jerseyNumber || '', pos: bP?.position?.abbreviation || '',
    side: gd.players?.['ID' + batterId]?.batSide?.code || '',
    game: {
      ab: bP?.stats?.batting?.atBats ?? 0, h: bP?.stats?.batting?.hits ?? 0,
      hr: bP?.stats?.batting?.homeRuns ?? 0, rbi: bP?.stats?.batting?.rbi ?? 0,
      bb: bP?.stats?.batting?.baseOnBalls ?? 0, k: bP?.stats?.batting?.strikeOuts ?? 0,
    },
    avg: bP?.seasonStats?.batting?.avg || '',
    line: bP?.stats?.batting?.summary || '',
  } : null
  const pitcher = pitcherId ? {
    id: pitcherId, name: def.pitcher.fullName,
    num: pP?.jerseyNumber || '', throws: gd.players?.['ID' + pitcherId]?.pitchHand?.code || '',
    game: {
      ip: pP?.stats?.pitching?.inningsPitched ?? '0.0', pitches: pP?.stats?.pitching?.numberOfPitches ?? 0,
      h: pP?.stats?.pitching?.hits ?? 0, r: pP?.stats?.pitching?.runs ?? 0, er: pP?.stats?.pitching?.earnedRuns ?? 0,
      bb: pP?.stats?.pitching?.baseOnBalls ?? 0, k: pP?.stats?.pitching?.strikeOuts ?? 0,
    },
    era: pP?.seasonStats?.pitching?.era || '',
    note: pP?.stats?.pitching?.note || '',
  } : null

  // probable pitchers for preview
  const prob = {
    away: gd.probablePitchers?.away?.fullName || '',
    home: gd.probablePitchers?.home?.fullName || '',
  }

  // ── Pitcher's game arsenal (aggregate this game's pitches by type) ──
  const arsenalMap = new Map()
  for (const p of ld.plays?.allPlays || []) {
    if (p.matchup?.pitcher?.id !== pitcherId) continue
    for (const e of p.playEvents || []) {
      if (!e.isPitch || !e.pitchData?.startSpeed) continue
      const t = e.details?.type?.description || 'Unknown'
      const mm = arsenalMap.get(t) || { type: t, count: 0, totV: 0 }
      mm.count++; mm.totV += e.pitchData.startSpeed; arsenalMap.set(t, mm)
    }
  }
  const totalArs = [...arsenalMap.values()].reduce((a, mm) => a + mm.count, 0)
  const arsenal = [...arsenalMap.values()].sort((a, b) => b.count - a.count)
    .map(mm => ({ type: mm.type, count: mm.count, avg: (mm.totV / mm.count).toFixed(1), pct: totalArs ? Math.round(mm.count / totalArs * 100) : 0 }))

  // ── Current at-bat pitch sequence ──
  const cp = ld.plays?.currentPlay
  const curPitches = (cp?.playEvents || []).filter(e => e.isPitch).map((e, i) => pitchInfo(e, i))
  const currentAtBat = {
    batter: cp?.matchup?.batter?.fullName || '', pitcher: cp?.matchup?.pitcher?.fullName || '',
    isComplete: cp?.about?.isComplete, pitches: curPitches,
  }
  const lastPitch = curPitches.length ? curPitches[curPitches.length - 1] : null

  // ── Situation summary + high-leverage detection ──
  const bases = { first: !!off.first, second: !!off.second, third: !!off.third }
  const outsNow = ls.outs ?? 0
  const risp = bases.second || bases.third
  const runners = [bases.first, bases.second, bases.third].filter(Boolean).length
  const situationText = situationSummary(bases) + (isLive && outsNow ? `, ${outsNow} out${outsNow === 1 ? '' : 's'}` : '')
  const inningNum = ls.currentInning || 0
  const closeGame = Math.abs(away.runs - home.runs) <= 1
  const highLeverage = isLive && (
    (outsNow === 2 && risp) || (bases.first && bases.second && bases.third) ||
    (ls.balls === 3 && ls.strikes === 2 && runners > 0) ||
    (inningNum >= 7 && closeGame && runners > 0) || inningNum > 9)

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
      const lastPitchEvt = pitchesE[pitchesE.length - 1]
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
        pitch: lastPitchEvt && lastPitchEvt.pitchData?.startSpeed ? { velo: Math.round(lastPitchEvt.pitchData.startSpeed), type: lastPitchEvt.details?.type?.description || '' } : null,
        hit: inPlay?.hitData ? { ev: inPlay.hitData.launchSpeed, la: inPlay.hitData.launchAngle, dist: inPlay.hitData.totalDistance } : null,
        pitches: pitchesE.map((e, i) => pitchInfo(e, i)),
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
    bases,
    batter, pitcher, prob, arsenal, currentAtBat, lastPitch, situationText, highLeverage,
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

  // special-status pill (replay review, delay, extra innings…)
  const pill = $('sb-status-pill'), d = m.status.detailed || ''
  let pillText = '', pillCls = 'alert'
  if (/Review/i.test(d)) pillText = 'Replay Review'
  else if (/Delayed/i.test(d)) pillText = d
  else if (/Postponed/i.test(d)) pillText = 'Postponed'
  else if (/Suspended/i.test(d)) pillText = 'Suspended'
  else if (/Warmup/i.test(d)) pillText = 'Warmup'
  else if (m.status.isLive && m.inning.num > 9) pillText = 'Extra Innings'
  pill.hidden = !pillText
  pill.textContent = pillText
  pill.className = 'sb-status-pill ' + pillCls

  renderLinescore(m)
}

function renderLinescore(m) {
  const table = $('sb-linescore')
  const n = Math.max(m.scheduledInnings, m.innings.length)
  const curInn = m.status.isLive ? m.inning.num : 0
  const arrow = m.inning.isTop ? '▲' : '▼'
  let head = '<tr class="ls-head"><th class="ls-team"></th>'
  for (let i = 1; i <= n; i++) head += `<th class="${i === curInn ? 'ls-cur' : ''}">${i === curInn ? `<span class="ls-arrow">${arrow}</span> ` : ''}${i}</th>`
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
  const card = $('card-matchup')
  // bases (with illuminate animation)
  ;['first', 'second', 'third'].forEach((b, i) => {
    const el = $(['base-1b', 'base-2b', 'base-3b'][i]); if (!el) return
    const on = m.bases[b]
    el.classList.toggle('on', on)
    if (prev && !prev.bases[b] && on) pop(el, 'anim-base', 340)
  })
  // outs pips (with pulse on a new out)
  const outsEl = $('pips-outs')
  const grewOut = prev && m.count.outs > prev.count.outs
  pips(outsEl, 3, m.count.outs, 'on-out')
  if (grewOut) { const dots = outsEl.querySelectorAll('.pip.on-out'); pop(dots[dots.length - 1], 'anim-out', 360) }
  // situation summary
  txt($('gs-situation'), m.status.isLive ? m.situationText : (m.status.isFinal ? 'Final' : 'Pre-Game'))
  card.classList.toggle('risp', m.status.isLive && (m.bases.second || m.bases.third))
  // high-leverage
  $('gs-leverage').hidden = !m.highLeverage
  card.classList.toggle('high-lev', m.highLeverage)
}

function pips(container, total, on, cls) {
  if (!container) return
  if (container.children.length !== total) {
    container.innerHTML = ''
    for (let i = 0; i < total; i++) { const s = document.createElement('span'); s.className = 'pip'; container.appendChild(s) }
  }
  ;[...container.children].forEach((p, i) => p.className = 'pip' + (i < on ? ' ' + cls : ''))
}

function battingChips(b) {
  const g = b.game, c = [`<span class="mu-stat"><b>${g.h}</b>-${g.ab}</span>`]
  if (g.hr) c.push(`<span class="mu-stat hot"><b>${g.hr}</b> HR</span>`)
  if (g.rbi) c.push(`<span class="mu-stat"><b>${g.rbi}</b> RBI</span>`)
  if (g.bb) c.push(`<span class="mu-stat"><b>${g.bb}</b> BB</span>`)
  if (g.k) c.push(`<span class="mu-stat"><b>${g.k}</b> K</span>`)
  if (b.avg) c.push(`<span class="mu-stat">${b.avg} AVG</span>`)
  return c.join('')
}
function pitchingChips(p) {
  const g = p.game, c = [`<span class="mu-stat"><b>${g.ip}</b> IP</span>`]
  c.push(`<span class="mu-stat${g.pitches >= 100 ? ' pc-alert' : ''}"><b>${g.pitches}</b> P</span>`)
  c.push(`<span class="mu-stat"><b>${g.k}</b> K</span>`)
  if (g.bb) c.push(`<span class="mu-stat"><b>${g.bb}</b> BB</span>`)
  c.push(`<span class="mu-stat"><b>${g.er}</b> ER</span>`)
  if (p.era) c.push(`<span class="mu-stat">${p.era} ERA</span>`)
  return c.join('')
}

function renderMatchup(m) {
  const live = m.status.isLive && m.batter && m.pitcher
  const b = m.batter, p = m.pitcher
  // batter side
  if (live && b) {
    const img = $('mu-batter-img'), u = HEAD(b.id); if (img.src !== u) img.src = u; img.style.visibility = ''
    txt($('mu-batter-name'), b.name)
    txt($('mu-batter-meta'), [b.num ? '#' + b.num : '', b.pos, b.side ? 'Bats ' + b.side : ''].filter(Boolean).join(' · '))
    $('mu-batter-stats').innerHTML = battingChips(b)
  } else {
    $('mu-batter-img').style.visibility = 'hidden'
    txt($('mu-batter-name'), m.away.fullName)
    txt($('mu-batter-meta'), m.status.isFinal ? 'Away' : 'Probable SP')
    $('mu-batter-stats').innerHTML = m.prob.away ? `<span class="mu-stat">${m.prob.away}</span>` : ''
  }
  // pitcher side
  if (live && p) {
    const img = $('mu-pitcher-img'), u = HEAD(p.id); if (img.src !== u) img.src = u; img.style.visibility = ''
    txt($('mu-pitcher-name'), p.name)
    txt($('mu-pitcher-meta'), [p.num ? '#' + p.num : '', p.throws ? p.throws + 'HP' : '', p.throws ? 'Throws ' + p.throws : ''].filter(Boolean).join(' · '))
    $('mu-pitcher-stats').innerHTML = pitchingChips(p)
  } else {
    $('mu-pitcher-img').style.visibility = 'hidden'
    txt($('mu-pitcher-name'), m.home.fullName)
    txt($('mu-pitcher-meta'), m.status.isFinal ? 'Home' : 'Probable SP')
    $('mu-pitcher-stats').innerHTML = m.prob.home ? `<span class="mu-stat">${m.prob.home}</span>` : ''
  }
  // middle: count
  txt($('mu-count'), live ? `${m.count.balls}–${m.count.strikes}` : 'vs')
}

/* ─── Pitch sequence (current at-bat) ─── */
function miniZone(p) {
  const W = 34, H = 40
  const mapX = v => (v + 2) / 4 * W, mapY = v => H - ((v - 0.5) / 4) * H
  const szx = mapX(-0.83), szw = mapX(0.83) - mapX(-0.83), szy = mapY(3.5), szh = mapY(1.5) - mapY(3.5)
  let dot = ''
  if (p.pX != null && p.pZ != null) {
    const cx = Math.max(3, Math.min(W - 3, mapX(p.pX))), cy = Math.max(3, Math.min(H - 3, mapY(p.pZ)))
    const col = p.res === 'inplay' ? 'var(--c-green)' : p.res === 'strike' ? 'var(--c-red)' : p.res === 'foul' ? 'var(--c-orange)' : 'var(--text-2)'
    dot = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="${col}"/>`
  }
  return `<svg class="ps-zone" viewBox="0 0 ${W} ${H}"><rect x="${szx.toFixed(1)}" y="${szy.toFixed(1)}" width="${szw.toFixed(1)}" height="${szh.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1" rx="2"/>${dot}</svg>`
}

function renderPitchSeq(m) {
  const track = $('ps-track'), ab = m.currentAtBat
  txt($('ps-sub'), ab.batter ? `${ab.batter} vs ${ab.pitcher}` : '')
  if (!ab.pitches.length) { track.innerHTML = '<div class="empty-note">No pitches yet.</div>'; return }
  const n = ab.pitches.length
  track.innerHTML = ab.pitches.map((p, i) => {
    const cur = i === n - 1 && !ab.isComplete
    return `<div class="ps-card${cur ? ' current' : ''}">
      <span class="ps-num">Pitch ${p.num}</span>
      ${miniZone(p)}
      <span class="ps-type">${p.type || '—'}</span>
      <span class="ps-velo">${p.velo ? p.velo + ' mph' : ''}</span>
      <span class="ps-result res-${p.res}">${shortRes(p)}</span>
      <span class="ps-count">${p.balls}-${p.strikes}</span>
    </div>`
  }).join('')
  track.scrollLeft = track.scrollWidth
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

/* ─── Center play-by-play feed (at-bat grouped, newest at bottom) ─── */
function pbpEl(it, animate) {
  const el = document.createElement('div')
  if (it.kind === 'note') {
    el.className = `pbp-ab pbp-note note-${it.noteType}${animate ? ' pbp-new' : ''}`
    el.innerHTML = `<div class="pbp-ab-head"><span class="pbp-ab-sit">${it.title}</span><span class="pbp-ab-desc">${it.text || ''}</span><span class="pbp-ab-sit">${arrowSym(it.isTop)} ${it.ordinal}</span></div>`
    return el
  }
  const ic = outcomeIcon(it)
  const klass = it.eventType === 'home_run' ? ' is-hr' : (it.isScoring ? ' is-scoring' : '')
  el.className = `pbp-ab${klass}${animate ? ' pbp-new' : ''}`
  const hasPitches = it.pitches && it.pitches.length
  const pitchesHtml = hasPitches ? `<div class="pbp-ab-pitches">${it.pitches.map(pp =>
    `<div class="pbp-pitch"><span class="pbp-pitch-n">${pp.num}</span><span class="pbp-pitch-type">${pp.type || '—'}</span><span class="pbp-pitch-velo">${pp.velo ? pp.velo + ' mph' : ''}</span><span class="pbp-pitch-res res-${pp.res}">${shortRes(pp)}</span></div>`).join('')}</div>` : ''
  const caret = hasPitches ? '<span class="pbp-ab-caret">▸</span>' : ''
  el.innerHTML = `<div class="pbp-ab-head"><span class="pbp-ab-sit">${arrowSym(it.isTop)}${it.ordinal} · ${it.outsBefore}o</span>` +
    `<span class="tl-icon ${ic.c}${ic.dot ? ' dot' : ''} pbp-ab-icon">${ic.t}</span>` +
    `<span class="pbp-ab-desc">${it.desc}</span>${caret}</div>${pitchesHtml}`
  if (hasPitches) el.querySelector('.pbp-ab-head').addEventListener('click', () => el.classList.toggle('open'))
  return el
}

function renderPbpFeed(m) {
  const body = $('pbp-scroll'), items = m.timeline
  const pip = $('pbp-live-pip'); if (pip) pip.style.display = m.status.isLive ? '' : 'none'
  const nPlays = items.reduce((a, i) => a + (i.kind === 'play' ? 1 : 0), 0)
  txt($('pbp-sub'), m.status.isLive ? `LIVE · ${liveStateText(m)}` : (nPlays ? `${nPlays} plays` : ''))
  if (!items.length) return
  const THRESH = 60
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= THRESH
  if (firstPbpRender) {
    body.innerHTML = ''
    for (const it of items) { body.appendChild(pbpEl(it, false)); seenPbp.add(it.id) }
    firstPbpRender = false
    body.scrollTop = body.scrollHeight
    updatePbpReturn()
    return
  }
  let added = false
  for (const it of items) { if (seenPbp.has(it.id)) continue; body.appendChild(pbpEl(it, true)); seenPbp.add(it.id); added = true }
  if (added && atBottom) body.scrollTop = body.scrollHeight
  updatePbpReturn()
}

function updatePbpReturn() {
  const body = $('pbp-scroll'), btn = $('pbp-return')
  if (!body || !btn) return
  const away = body.scrollHeight - body.scrollTop - body.clientHeight > 80
  btn.hidden = !(away && LIVE_NOW)
}

/* ══════════════════ Orchestration ══════════════════ */

function renderAll(m) {
  renderHeader(m)
  renderStatus(m)
  renderSummary(m)
  renderScoreboard(m, PREV)
  renderMatchup(m)
  renderState(m, PREV)
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
  const pbpBody = $('pbp-scroll'), pbpBtn = $('pbp-return')
  if (pbpBody) pbpBody.addEventListener('scroll', updatePbpReturn, { passive: true })
  if (pbpBtn) pbpBtn.addEventListener('click', () => pbpBody.scrollTo({ top: pbpBody.scrollHeight, behavior: 'smooth' }))
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
