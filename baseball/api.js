/* ── Live MLB & ESPN API Layer ── */

const NL_TEAMS = new Set([109,144,112,113,115,119,146,121,143,134,135,137,138,120,158])

function _nlRank(splits, statKey, teamId, asc = false) {
  const nl = splits.filter(s => NL_TEAMS.has(s.team.id))
  const sorted = [...nl].sort((a, b) =>
    asc ? parseFloat(a.stat[statKey]) - parseFloat(b.stat[statKey])
        : parseFloat(b.stat[statKey]) - parseFloat(a.stat[statKey])
  )
  const i = sorted.findIndex(s => s.team.id === teamId)
  return i >= 0 ? `#${i + 1} NL` : ''
}

async function fetchTeamStats(teamId) {
  // Try current season first; if no data yet (preseason), fall back to previous year
  let season = SEASON
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [standRes, batRes, pitRes] = await Promise.all([
        fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=${season}&standingsTypes=regularSeason`),
        fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${season}&sportId=1`),
        fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${season}&sportId=1`),
      ])
      const [stand, bat, pit] = await Promise.all([standRes.json(), batRes.json(), pitRes.json()])

      let rec = null
      for (const div of (stand.records || [])) {
        rec = div.teamRecords.find(r => r.team.id === teamId)
        if (rec) break
      }

      const batSplits = bat.stats?.[0]?.splits ?? []
      const pitSplits = pit.stats?.[0]?.splits ?? []
      const db = batSplits.find(s => s.team.id === teamId)?.stat
      const dp = pitSplits.find(s => s.team.id === teamId)?.stat

      if (!rec || !db || !dp) { season = SEASON - 1; continue }

      const divRank = `#${rec.divisionRank} ${rec.division?.nameShort || ''}`
      const pct = parseFloat(rec.winningPercentage).toFixed(3).replace('0.', '.')
      const label = season < SEASON ? ` (${season})` : ''

      return [
        { val: `${rec.wins}-${rec.losses}`, lbl: `Record${label}`,     rank: divRank },
        { val: pct,                          lbl: `Win %${label}`,      rank: divRank },
        { val: db.avg,                       lbl: 'Team AVG',   rank: _nlRank(batSplits, 'avg', teamId) },
        { val: parseInt(db.hits).toLocaleString(), lbl: 'Hits' },
        { val: db.homeRuns,                  lbl: 'Home Runs',  rank: _nlRank(batSplits, 'homeRuns', teamId) },
        { val: dp.era,                       lbl: 'Team ERA',   rank: _nlRank(pitSplits, 'era', teamId, true) },
        { val: parseInt(dp.strikeOuts).toLocaleString(), lbl: 'Strikeouts' },
      ]
    } catch { season = SEASON - 1 }
  }
  return null
}

async function fetchLastGame(teamId, teamAbbr) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${SEASON}&sportId=1&gameType=S,R,F,D,L,W,E&hydrate=team&startDate=${SEASON}-02-01&endDate=${SEASON}-11-10`
  )
  const data = await res.json()

  let lastGame = null
  for (const d of [...(data.dates ?? [])].reverse()) {
    const fin = d.games.filter(g => g.status.abstractGameState === 'Final')
    if (fin.length) { lastGame = fin[fin.length - 1]; break }
  }
  if (!lastGame) return null

  const bsRes = await fetch(`https://statsapi.mlb.com/api/v1/game/${lastGame.gamePk}/boxscore`)
  const bs = await bsRes.json()

  const isHome  = lastGame.teams.home.team.id === teamId
  const mySide  = isHome ? 'home' : 'away'
  const oppSide = isHome ? 'away' : 'home'
  const myAbbr  = lastGame.teams[mySide].team.abbreviation ?? bs.teams?.[mySide]?.team?.abbreviation ?? teamAbbr
  const oppAbbr = lastGame.teams[oppSide].team.abbreviation ?? bs.teams?.[oppSide]?.team?.abbreviation ?? lastGame.teams[oppSide].team.name?.split(' ').pop()?.substring(0, 3).toUpperCase() ?? '???'
  const myScore = lastGame.teams[mySide].score
  const oppScore = lastGame.teams[oppSide].score
  const players = bs.teams[mySide].players

  const batters = Object.values(players)
    .filter(p => (p.stats?.batting?.atBats ?? 0) > 0)
    .sort((a, b) => {
      const hd = (b.stats.batting.hits ?? 0) - (a.stats.batting.hits ?? 0)
      return hd !== 0 ? hd : (b.stats.batting.rbi ?? 0) - (a.stats.batting.rbi ?? 0)
    })

  const wp = Object.values(players).find(p => (p.stats?.pitching?.wins ?? 0) > 0)
  const performers = []

  for (const p of batters.slice(0, 3)) {
    const s = p.stats.batting
    const parts = [`${s.hits}-${s.atBats}`]
    if (s.homeRuns > 0) parts.push('HR')
    else if (s.doubles > 0) parts.push('2B')
    if (s.rbi > 0) parts.push(`${s.rbi} RBI`)
    if (s.baseOnBalls > 0 && parts.length < 4) parts.push('BB')
    performers.push({ name: p.person.fullName, line: parts.join(' · ') })
  }
  if (wp) {
    const s = wp.stats.pitching
    performers.push({
      name: wp.person.fullName,
      line: `${s.inningsPitched} IP · ${s.earnedRuns} ER · ${s.strikeOuts} K · W`
    })
  }

  const gd = new Date(lastGame.gameDate)
  return {
    score: `${myAbbr} ${myScore}, ${oppAbbr} ${oppScore}`,
    date: gd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    performers,
  }
}

async function fetchNextGame(teamId) {
  const today = new Date().toISOString().slice(0, 10)
  const endDate = `${SEASON}-11-10`
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${SEASON}&sportId=1&gameType=S,R,F,D,L,W,E&startDate=${today}&endDate=${endDate}`
  )
  const data = await res.json()

  for (const d of data.dates ?? []) {
    for (const g of d.games) {
      if (g.status.abstractGameState !== 'Final') {
        const isHome = g.teams.home.team.id === teamId
        const opp = isHome ? g.teams.away.team : g.teams.home.team
        const gd = new Date(g.gameDate)
        const dateStr = gd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = gd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        return {
          atVs: isHome ? 'vs' : '@',
          opponent: opp.name,
          opponentShort: opp.name.split(' ').pop(),
          logoId: opp.id,
          date: dateStr,
          dateShort: gd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          time: timeStr,
          venue: isHome ? g.venue?.name : `@ ${g.venue?.name}`,
          tag: null,
          isHome,
        }
      }
    }
  }
  return null
}

const GAME_TYPE_LABELS = { S: 'Spring Training', R: 'Regular Season', F: 'Wild Card', D: 'Division Series', L: 'Championship Series', W: 'World Series', E: 'Exhibition', A: 'All-Star' }

async function fetchSchedule(teamId) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${SEASON}&sportId=1&gameType=S,R,F,D,L,W,E&hydrate=linescore`)
  const data = await res.json()
  if (!data.dates?.length) return []

  const games = []
  for (const d of data.dates) {
    for (const g of d.games) {
      const isHome = g.teams.home.team.id === teamId
      const opp = isHome ? g.teams.away.team : g.teams.home.team
      const dt = new Date(g.gameDate)
      const isFinal = g.status.abstractGameState === 'Final'
      const isLive = g.status.abstractGameState === 'Live'
      const myScore = isHome ? g.teams.home.score : g.teams.away.score
      const oppScore = isHome ? g.teams.away.score : g.teams.home.score
      const won = isFinal && myScore > oppScore
      const lost = isFinal && myScore < oppScore
      const tied = isFinal && myScore === oppScore
      games.push({
        day: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        monthDay: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        atVs: isHome ? 'vs' : '@',
        opponent: opp.name,
        logoId: opp.id,
        teamLogoId: teamId,
        venueName: g.venue?.name ?? '',
        time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        tv: g.content?.media?.epg?.[0]?.items?.[0]?.callSign ?? '',
        isHome,
        gamePk: g.gamePk,
        isoDate: dt.toLocaleDateString('en-CA'),
        weekday: dt.toLocaleDateString('en-US', { weekday: 'long' }),
        gameType: g.gameType,
        gameTypeLabel: GAME_TYPE_LABELS[g.gameType] || g.gameType,
        isFinal,
        isLive,
        myScore: myScore ?? null,
        oppScore: oppScore ?? null,
        won,
        lost,
        tied,
        statusDetail: g.status.detailedState,
        inning: g.linescore?.currentInningOrdinal ?? null,
        inningHalf: g.linescore?.inningHalf ?? null,
      })
    }
  }
  return games
}

async function fetchNews(espnId) {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team=${espnId || 19}&limit=25`
  )
  const data = await res.json()
  return (data.articles || []).map(a => ({
    headline: a.headline,
    description: a.description ?? '',
    image: a.images?.[0]?.url || '',
    href: a.links?.web?.href || '#',
    published: a.published,
  }))
}

async function fetchMLBNews() {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=25`
  )
  const data = await res.json()
  return (data.articles || []).map(a => ({
    headline: a.headline,
    description: a.description ?? '',
    image: a.images?.[0]?.url || '',
    href: a.links?.web?.href || '#',
    published: a.published,
  }))
}

async function fetchLiveGameFeed(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
  return res.json()
}

async function fetchTodayGame(teamId) {
  const today = new Date().toLocaleDateString('en-CA')
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&date=${today}`)
  const data = await res.json()
  return data.dates?.[0]?.games?.[0] ?? null
}

async function fetchTodayScoreboard() {
  const today = new Date().toLocaleDateString('en-CA')
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&gameType=S,R,F,D,L,W,E&hydrate=linescore,team`)
  const data = await res.json()
  if (!data.dates?.length) return []
  return data.dates[0].games.map(g => {
    const isFinal = g.status.abstractGameState === 'Final'
    const isLive = g.status.abstractGameState === 'Live'
    const isPre = g.status.abstractGameState === 'Preview'
    const away = g.teams.away, home = g.teams.home
    const dt = new Date(g.gameDate)
    return {
      gamePk: g.gamePk,
      awayAbbr: away.team.abbreviation || away.team.name?.split(' ').pop()?.substring(0,3).toUpperCase() || '???',
      homeAbbr: home.team.abbreviation || home.team.name?.split(' ').pop()?.substring(0,3).toUpperCase() || '???',
      awayId: away.team.id, homeId: home.team.id,
      awayScore: away.score ?? 0, homeScore: home.score ?? 0,
      isFinal, isLive, isPre,
      inning: g.linescore?.currentInningOrdinal || '',
      inningHalf: g.linescore?.inningHalf || '',
      time: dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      status: g.status.detailedState,
    }
  })
}

async function fetchRoster(teamId) {
  const season = new Date().getFullYear()
  const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&season=${season}`)
  const data = await res.json()
  return data.roster ?? []
}

async function fetchDepthChart(teamId) {
  const season = new Date().getFullYear()
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=depthChart&season=${season}&hydrate=person`
  )
  const data = await res.json()
  return data.roster ?? []
}

async function fetchPlayerStats(playerId) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting,pitching],type=[season,career],season=${SEASON})`
  )
  const { people } = await res.json()
  return people[0] ?? null
}

async function fetchWikiImage(wikiSlug) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`)
  const data = await res.json()
  return data.thumbnail?.source ?? null
}

/* ── Game Breakdown Helpers ── */

const PITCH_COLORS = {
  'Four-Seam Fastball':'#ef5350','Fastball':'#ef5350','Sinker':'#78909c',
  'Cutter':'#26c6da','Slider':'#42a5f5','Curveball':'#ab47bc',
  'Changeup':'#ffa726','Splitter':'#66bb6a','Knuckle Curve':'#ce93d8',
  'Sweeper':'#00bcd4','Slurve':'#7e57c2','Knuckleball':'#8d6e63',
}

function _estimateWP(homeScore, awayScore, inning, isTop, totalInn) {
  const diff = homeScore - awayScore
  const remaining = Math.max(0.5, (totalInn - inning) * 2 + (isTop ? 2 : 1))
  const k = 1.8 / Math.sqrt(remaining * 0.5)
  const p = 1 / (1 + Math.exp(-k * diff))
  return Math.max(2, Math.min(98, Math.round(p * 100)))
}

function _gradePitcher(ip, er, k, bb) {
  const ipN = parseFloat(ip) || 0.1
  const era = (er / ipN) * 9, kp9 = (k / ipN) * 9
  let s = 70
  s += era < 0.01 ? 15 : era < 2 ? 10 : era < 4 ? 5 : era < 6 ? 0 : -10
  s += kp9 > 12 ? 8 : kp9 > 9 ? 5 : kp9 > 6 ? 2 : 0
  s -= bb * 3
  s += ipN > 6 ? 5 : ipN > 4 ? 3 : ipN > 2 ? 1 : 0
  if (s >= 93) return { grade:'A+', gcls:'a' }
  if (s >= 87) return { grade:'A', gcls:'a' }
  if (s >= 82) return { grade:'A\u2212', gcls:'a' }
  if (s >= 78) return { grade:'B+', gcls:'b' }
  if (s >= 72) return { grade:'B', gcls:'b' }
  if (s >= 67) return { grade:'B\u2212', gcls:'b' }
  if (s >= 62) return { grade:'C+', gcls:'c' }
  if (s >= 57) return { grade:'C', gcls:'c' }
  if (s >= 52) return { grade:'C\u2212', gcls:'c' }
  if (s >= 47) return { grade:'D+', gcls:'d' }
  return { grade:'D', gcls:'d' }
}

async function fetchGameBreakdown(gamePk, teamId) {
  const feed = await fetchLiveGameFeed(gamePk)
  const gd = feed.gameData, ld = feed.liveData
  const ls = ld.linescore, bs = ld.boxscore
  if (!ls?.innings?.length) return null

  const homeTeam = gd.teams.home, awayTeam = gd.teams.away
  const isHome = homeTeam.id === teamId
  const myAbbr = isHome ? homeTeam.abbreviation : awayTeam.abbreviation
  const oppAbbr = isHome ? awayTeam.abbreviation : homeTeam.abbreviation
  const totalInn = ls.innings.length
  const homeR = ls.teams.home.runs, awayR = ls.teams.away.runs
  const myScore = isHome ? homeR : awayR
  const oppScore = isHome ? awayR : homeR
  const venue = gd.venue?.name || ''
  const dt = new Date(gd.datetime?.dateTime || Date.now())
  const dateStr = dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
  const gameTypeCode = gd.game?.type || 'R'

  /* ── Line Score ── */
  const lineScore = {
    innings: ls.innings.map((_,i) => i+1),
    away: { abbr: awayTeam.abbreviation, runs: ls.innings.map(inn => inn.away?.runs ?? 0), R: awayR, H: ls.teams.away.hits, E: ls.teams.away.errors },
    home: { abbr: homeTeam.abbreviation, runs: ls.innings.map(inn => inn.home?.runs ?? 0), R: homeR, H: ls.teams.home.hits, E: ls.teams.home.errors },
  }

  /* ── WPA from play-by-play ── */
  const allPlays = ld.plays?.allPlays || []
  const wpaData = [50]
  const innStarts = [0]
  const scoringMoments = []
  let curInn = 1, hS = 0, aS = 0

  for (const play of allPlays) {
    if (!play.about?.isComplete) continue
    const inn = play.about.inning
    const isTop = play.about.halfInning === 'top'
    while (inn > curInn) { curInn++; innStarts.push(wpaData.length) }
    if (play.result?.homeScore !== undefined) { hS = play.result.homeScore; aS = play.result.awayScore }
    const hwp = _estimateWP(hS, aS, inn, isTop, Math.max(totalInn, 9))
    const myWP = isHome ? hwp : 100 - hwp
    const prev = wpaData[wpaData.length - 1]
    wpaData.push(myWP)
    if (play.about?.isScoringPlay) {
      scoringMoments.push({
        i: wpaData.length - 1, delta: myWP - prev,
        desc: play.result?.description || '', event: play.result?.event || '',
        batter: play.matchup?.batter?.fullName || '',
        inn, isTop, rbi: play.result?.rbi || 0,
        pitchCount: (play.playEvents || []).filter(e => e.isPitch).length,
      })
    }
  }
  wpaData.push(myScore > oppScore ? 100 : myScore < oppScore ? 0 : 50)
  scoringMoments.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))

  const keyMoments = scoringMoments.slice(0,7).map(m => ({
    i: m.i,
    lbl: m.batter ? `${m.batter.split(' ').pop()} ${m.event}` : m.event,
    c: m.delta > 0 ? (m.delta > 15 ? '#66bb6a' : '#42a5f5') : '#ef5350',
  }))

  /* ── Turning Points ── */
  const _ord = n => { const s=['th','st','nd','rd']; const v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]) }
  const turningPoints = scoringMoments.slice(0,5).map((m,idx) => ({
    rank: idx+1,
    title: `${m.batter} ${m.event}`,
    inn: `${m.isTop?'\u25b2':'\u25bc'} ${m.isTop?'Top':'Bot'} ${_ord(m.inn)}`,
    delta: `${m.delta>0?'+':''}${Math.round(m.delta)}%`,
    cls: m.delta > 0 ? 'pos' : 'neg',
    desc: m.desc,
  }))

  /* ── Best At-Bats ── */
  const bestAtBats = scoringMoments.filter(m=>m.batter).slice(0,4).map(m => ({
    batter: m.batter,
    inn: `${m.isTop?'\u25b2':'\u25bc'} ${_ord(m.inn)}`,
    pitches: m.pitchCount,
    result: m.event,
    wpa: `${m.delta>0?'+':''}${Math.round(m.delta)}%`,
    cls: m.delta > 0 ? 'pos' : 'neg',
    note: m.desc,
  }))

  /* ── Pitch Sequencing ── */
  const pitchCounts = {}, pitchVelos = {}
  let totalPitches = 0
  for (const play of allPlays) {
    for (const evt of (play.playEvents || [])) {
      if (!evt.isPitch || !evt.details?.type?.description) continue
      const t = evt.details.type.description
      pitchCounts[t] = (pitchCounts[t]||0) + 1; totalPitches++
      if (evt.pitchData?.startSpeed) { (pitchVelos[t] = pitchVelos[t]||[]).push(evt.pitchData.startSpeed) }
    }
  }
  const pitchSequencing = {
    label: `Both Teams Combined \u00b7 ${totalPitches} Total Pitches`,
    pitches: Object.entries(pitchCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([type,cnt]) => ({
      type, pct: Math.round((cnt/totalPitches)*100),
      velo: pitchVelos[type]?.length ? (pitchVelos[type].reduce((a,b)=>a+b,0)/pitchVelos[type].length).toFixed(1) : '\u2014',
      color: PITCH_COLORS[type] || '#90a4ae',
    })),
  }

  /* ── Bullpen / Pitcher Usage ── */
  function _buildPitchers(side) {
    const tb = bs.teams[side]
    return (tb.pitchers || []).map((pid,idx) => {
      const p = tb.players[`ID${pid}`]
      if (!p?.stats?.pitching) return null
      const s = p.stats.pitching
      const ip = s.inningsPitched||'0.0', er = s.earnedRuns??0, k = s.strikeOuts??0, bb = s.baseOnBalls??0
      const pc = s.numberOfPitches ?? s.pitchesThrown ?? 0
      let role = idx === 0 ? 'SP' : 'RP'
      if (s.saves > 0) role = 'SV'
      else if (s.wins > 0) role = 'W'
      else if (s.losses > 0) role = 'L'
      const { grade, gcls } = _gradePitcher(ip, er, k, bb)
      return { name: p.person?.fullName||'Unknown', role, ip, p: pc, k, bb, er, grade, gcls }
    }).filter(Boolean)
  }
  const bullpen = {
    away: { name: awayTeam.name, pitchers: _buildPitchers('away') },
    home: { name: homeTeam.name, pitchers: _buildPitchers('home') },
  }

  /* ── Assemble ── */
  const resultStr = `${myAbbr} ${myScore}, ${oppAbbr} ${oppScore}${totalInn>9 ? ' ('+totalInn+')' : ''}`
  return {
    tag: 'FILM STUDY', title: 'Game Breakdown Center',
    seriesLabel: GAME_TYPE_LABELS[gameTypeCode] || 'Game',
    gameLabel: dateStr, scoreLabel: resultStr, venue,
    lineScore,
    wpa: { label: `${myAbbr} WIN %`, data: wpaData, innStarts, keyMoments },
    turningPoints, bestAtBats, pitchSequencing, bullpen,
    managerDecisions: [],
  }
}

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

/* ══════════════════════════════════════════════
   ADVANCED STATS API FUNCTIONS
   ══════════════════════════════════════════════ */

// Detect if we're in spring training (no regular season data yet)
let _advGameType = null // null = auto-detect, 'S' = spring, 'R' = regular
async function _detectGameType() {
  if (_advGameType) return _advGameType
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${SEASON}&sportId=1`)
    const data = await res.json()
    const splits = data.stats?.[0]?.splits || []
    const any = splits.find(s => (+s.stat?.gamesPlayed || 0) > 5)
    // If some teams have played >5 regular season games, use regular season
    _advGameType = any ? 'R' : 'S'
  } catch {
    _advGameType = 'S'
  }
  return _advGameType
}

function _mlbRank(allTeams, statKey, teamId, asc = false) {
  const sorted = [...allTeams].sort((a, b) =>
    asc ? parseFloat(a.stat[statKey]) - parseFloat(b.stat[statKey])
        : parseFloat(b.stat[statKey]) - parseFloat(a.stat[statKey])
  )
  const i = sorted.findIndex(s => s.team.id === teamId)
  return i >= 0 ? i + 1 : 30
}

async function fetchAdvancedRoster(teamId) {
  const gt = await _detectGameType()
  const gtParam = gt === 'S' ? ',gameType=S' : ''
  // Sabermetrics & expectedStatistics not available for spring training
  const types = gt === 'S' ? 'season,seasonAdvanced' : 'season,sabermetrics,seasonAdvanced,expectedStatistics'
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&season=${SEASON}&hydrate=person(stats(group=[hitting,pitching],type=[${types}],season=${SEASON}${gtParam}))`
  const res = await fetch(url)
  const data = await res.json()
  const roster = data.roster || []

  const hitters = []
  const pitchers = []

  for (const entry of roster) {
    const p = entry.person
    if (!p || !p.stats) continue
    const pos = entry.position?.abbreviation || ''
    const posType = entry.position?.type || ''

    // Collect all stat groups into flat objects
    const seasonHit = p.stats.find(s => s.type?.displayName === 'season' && s.group?.displayName === 'hitting')
    const seasonPit = p.stats.find(s => s.type?.displayName === 'season' && s.group?.displayName === 'pitching')
    const saberHit  = p.stats.find(s => s.type?.displayName === 'sabermetrics' && s.group?.displayName === 'hitting')
    const saberPit  = p.stats.find(s => s.type?.displayName === 'sabermetrics' && s.group?.displayName === 'pitching')
    const advHit    = p.stats.find(s => s.type?.displayName === 'seasonAdvanced' && s.group?.displayName === 'hitting')
    const advPit    = p.stats.find(s => s.type?.displayName === 'seasonAdvanced' && s.group?.displayName === 'pitching')
    const expHit    = p.stats.find(s => s.type?.displayName === 'expectedStatistics' && s.group?.displayName === 'hitting')

    const _s = (group) => group?.splits?.[0]?.stat || {}

    // Build hitter entry
    if (seasonHit && _s(seasonHit).plateAppearances > 0 && (posType === 'Hitter' || posType === 'TwoWay' || (posType === 'Pitcher' && parseFloat(_s(seasonHit).plateAppearances) >= 30))) {
      const s = _s(seasonHit), sb = _s(saberHit), adv = _s(advHit), exp = _s(expHit)
      hitters.push({
        id: p.id, name: p.fullName, pos,
        pa: +s.plateAppearances || 0,
        avg: +s.avg || 0, obp: +s.obp || 0, slg: +s.slg || 0, ops: +s.ops || 0,
        hr: +s.homeRuns || 0, rbi: +s.rbi || 0, sb: +s.stolenBases || 0,
        k: +s.strikeOuts || 0, bb: +s.baseOnBalls || 0, g: +s.gamesPlayed || 0,
        war: +sb.war || 0, woba: +sb.woba || 0, wrc: +sb.wRcPlus || 0,
        wRaa: +sb.wRaa || 0, spd: +sb.spd || 0,
        fielding: +sb.fielding || 0, baseRunning: +sb.baseRunning || 0,
        iso: +adv.iso || 0, babip: +adv.babip || 0,
        kPct: +adv.strikeoutsPerPlateAppearance || 0,
        bbPct: +adv.walksPerPlateAppearance || 0,
        totalSwings: +adv.totalSwings || 0, swingAndMiss: +adv.swingAndMiss || 0,
        xAvg: +exp.avg || 0, xSlg: +exp.slg || 0, xWoba: +exp.woba || 0,
      })
    }

    // Build pitcher entry
    if (seasonPit && _s(seasonPit).inningsPitched && parseFloat(_s(seasonPit).inningsPitched) > 0) {
      const s = _s(seasonPit), sb = _s(saberPit), adv = _s(advPit)
      pitchers.push({
        id: p.id, name: p.fullName, pos,
        g: +s.gamesPlayed || 0, gs: +s.gamesStarted || 0,
        ip: parseFloat(s.inningsPitched) || 0,
        era: +s.era || 0, whip: +s.whip || 0,
        k: +s.strikeOuts || 0, bb: +s.baseOnBalls || 0,
        h: +s.hits || 0, hr: +s.homeRuns || 0,
        w: +s.wins || 0, l: +s.losses || 0, sv: +s.saves || 0,
        bf: +s.battersFaced || 0,
        war: +sb.war || 0, fip: +sb.fip || 0, xfip: +sb.xfip || 0,
        babip: +(adv.babip) || 0,
        k9: +(adv.strikeoutsPer9) || 0, bb9: +(adv.baseOnBallsPer9) || 0,
        hr9: +(adv.homeRunsPer9) || 0,
        kbbPct: +(adv.strikeoutsMinusWalksPercentage) || 0,
        whiffPct: +(adv.whiffPercentage) || 0,
        strikePct: +(adv.strikePercentage) || 0,
        wl: `${s.wins || 0}-${s.losses || 0}`,
      })
    }
  }

  return { hitters, pitchers }
}

async function fetchAdvancedTeamOverview(teamId) {
  const gt = await _detectGameType()
  const gtParam = gt === 'S' ? '&gameType=S' : ''
  // Fetch all 30 teams' hitting + pitching stats for MLB ranking
  const [hitRes, pitRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${SEASON}&sportId=1${gtParam}`).then(r => r.json()),
    fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${SEASON}&sportId=1${gtParam}`).then(r => r.json()),
  ])

  const hitSplits = hitRes.stats?.[0]?.splits || []
  const pitSplits = pitRes.stats?.[0]?.splits || []
  const myHit = hitSplits.find(s => s.team.id === teamId)?.stat || {}
  const myPit = pitSplits.find(s => s.team.id === teamId)?.stat || {}

  // Compute run differential from schedule
  let runsScored = 0, runsAllowed = 0, gamesPlayed = 0
  if (typeof _allScheduleGames !== 'undefined' && _allScheduleGames.length > 0) {
    for (const g of _allScheduleGames) {
      if (g.result === 'W' || g.result === 'L') {
        gamesPlayed++
        const parts = g.score.split(/\D+/).map(Number)
        if (g.homeAway === 'home') {
          runsScored += parts[0] || 0; runsAllowed += parts[1] || 0
        } else {
          runsScored += parts[1] || 0; runsAllowed += parts[0] || 0
        }
      }
    }
  } else {
    runsScored = +myHit.runs || 0
    runsAllowed = +myPit.runs || 0
    gamesPlayed = +myHit.gamesPlayed || 0
  }

  const runDiff = runsScored - runsAllowed
  // Pythagorean record
  const exp = 1.83
  const pythPct = runsScored > 0 ? Math.pow(runsScored, exp) / (Math.pow(runsScored, exp) + Math.pow(runsAllowed || 1, exp)) : 0.5
  const pythW = Math.round(pythPct * gamesPlayed)
  const pythL = gamesPlayed - pythW

  // K-BB%
  const teamPA = +myHit.plateAppearances || 1
  const teamKPct = (+myHit.strikeOuts || 0) / teamPA
  const teamBBPct = (+myHit.baseOnBalls || 0) / teamPA

  // MLB ranks (1-30)
  const ranks = {
    avg:  _mlbRank(hitSplits, 'avg', teamId),
    ops:  _mlbRank(hitSplits, 'ops', teamId),
    hr:   _mlbRank(hitSplits, 'homeRuns', teamId),
    runs: _mlbRank(hitSplits, 'runs', teamId),
    era:  _mlbRank(pitSplits, 'era', teamId, true),
    whip: _mlbRank(pitSplits, 'whip', teamId, true),
    k:    _mlbRank(pitSplits, 'strikeOuts', teamId),
    opsAgainst: _mlbRank(pitSplits, 'ops', teamId, true),
  }

  return {
    teamHit: myHit, teamPit: myPit, ranks,
    runsScored, runsAllowed, runDiff, pythRecord: `${pythW}-${pythL}`,
    kbbPct: ((teamKPct - teamBBPct) * 100).toFixed(1),
    gamesPlayed,
  }
}

async function fetchPlayerSplits(playerId, group) {
  const gt = _advGameType || 'R'
  const gtParam = gt === 'S' ? '&gameType=S' : ''
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&group=${group}&season=${SEASON}&sitCodes=vl,vr,h,a${gtParam}`
  const res = await fetch(url)
  const data = await res.json()
  const splits = data.stats?.[0]?.splits || []
  const result = {}
  for (const sp of splits) {
    const code = sp.split?.code || ''
    result[code] = sp.stat || {}
  }
  return result // { vl: {...}, vr: {...}, h: {...}, a: {...} }
}

async function fetchPlayerGameLog(playerId, group) {
  const gt = _advGameType || 'R'
  const gtParam = gt === 'S' ? '&gameType=S' : ''
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=${group}&season=${SEASON}${gtParam}`
  const res = await fetch(url)
  const data = await res.json()
  return data.stats?.[0]?.splits || []
}

/* ── Custom Leaderboards API ── */

const SAVANT_TEAM_ABBREV = { 119: 'LAD', 108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU', 118: 'KC', 120: 'WSH', 121: 'NYM', 133: 'OAK', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL' }

async function fetchRosterSituational(teamId, sitCode, group) {
  const gt = await _detectGameType()
  const gtParam = gt === 'S' ? ',gameType=S' : ''
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&season=${SEASON}&hydrate=person(stats(group=[${group}],type=[statSplits],season=${SEASON},sitCodes=${sitCode}${gtParam}))`
  const res = await fetch(url)
  const data = await res.json()
  const roster = data.roster || []
  const players = []
  for (const entry of roster) {
    const p = entry.person
    if (!p || !p.stats) continue
    const splitGroup = p.stats.find(s => s.type?.displayName === 'statSplits' && s.group?.displayName === group)
    if (!splitGroup) continue
    const split = splitGroup.splits?.find(sp => sp.split?.code === sitCode)
    if (!split || !split.stat) continue
    const s = split.stat
    players.push({
      id: p.id, name: p.fullName, pos: entry.position?.abbreviation || '',
      avg: +s.avg || 0, obp: +s.obp || 0, slg: +s.slg || 0,
      ops: +s.ops || 0, rbi: +s.rbi || 0, hr: +s.homeRuns || 0,
      k: +s.strikeOuts || 0, bb: +s.baseOnBalls || 0,
      pa: +s.plateAppearances || 0, ab: +s.atBats || 0,
      h: +s.hits || 0, ip: parseFloat(s.inningsPitched) || 0,
      era: +s.era || 0, whip: +s.whip || 0,
      kPct: (+s.plateAppearances > 0) ? +s.strikeOuts / +s.plateAppearances : 0,
      bbPct: (+s.plateAppearances > 0) ? +s.baseOnBalls / +s.plateAppearances : 0,
    })
  }
  return players
}

async function fetchPreviousSeasonRoster(teamId) {
  const prevSeason = SEASON - 1
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&season=${prevSeason}&hydrate=person(stats(group=[hitting,pitching],type=[season,sabermetrics],season=${prevSeason}))`
  const res = await fetch(url)
  const data = await res.json()
  const roster = data.roster || []
  const players = {}
  for (const entry of roster) {
    const p = entry.person
    if (!p || !p.stats) continue
    const seasonHit = p.stats.find(s => s.type?.displayName === 'season' && s.group?.displayName === 'hitting')
    const seasonPit = p.stats.find(s => s.type?.displayName === 'season' && s.group?.displayName === 'pitching')
    const saberHit  = p.stats.find(s => s.type?.displayName === 'sabermetrics' && s.group?.displayName === 'hitting')
    const saberPit  = p.stats.find(s => s.type?.displayName === 'sabermetrics' && s.group?.displayName === 'pitching')
    const _s = (g) => g?.splits?.[0]?.stat || {}
    const sh = _s(seasonHit), sp = _s(seasonPit), sbh = _s(saberHit), sbp = _s(saberPit)
    players[p.id] = {
      name: p.fullName, age: p.currentAge || 0,
      war: +sbh.war || +sbp.war || 0,
      ops: +sh.ops || 0, era: +sp.era || 0,
      ip: parseFloat(sp.inningsPitched) || 0,
      g: +sh.gamesPlayed || +sp.gamesPlayed || 0,
    }
  }
  return players
}

function _parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
    const obj = {}
    headers.forEach((h, i) => obj[h] = vals[i] || '')
    return obj
  })
}

async function _fetchWithCORSFallback(url) {
  try {
    const res = await fetch(url)
    if (res.ok) { const t = await res.text(); if (t && !t.startsWith('<!')) return t }
  } catch {}
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const res = await fetch(proxy)
    if (res.ok) { const t = await res.text(); if (t && !t.startsWith('<!')) return t }
  } catch {}
  return null
}

async function fetchStatcastExitVelo(teamId) {
  const abbrev = SAVANT_TEAM_ABBREV[teamId] || 'LAD'
  const url = `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${SEASON}&position=&team=${abbrev}&min=q&csv=true`
  const csv = await _fetchWithCORSFallback(url)
  if (!csv) return null
  return _parseCSV(csv).map(r => ({
    name: `${r.first_name} ${r.last_name}`.trim(),
    playerId: +r.player_id || 0,
    avgEV: +r.avg_hit_speed || 0,
    maxEV: +r.max_hit_speed || 0,
    hardHitPct: +r.ev95percent || 0,
    barrelPct: +r.brl_percent || 0,
    barrels: +r.barrels || 0,
    barrelPA: +r.brl_pa || 0,
    avgAngle: +r.avg_hit_angle || 0,
    sweetSpotPct: +r.anglesweetspotpercent || 0,
    attempts: +r.attempts || 0,
  }))
}

async function fetchStatcastSprintSpeed(teamId) {
  const abbrev = SAVANT_TEAM_ABBREV[teamId] || 'LAD'
  const url = `https://baseballsavant.mlb.com/leaderboard/sprint_speed?min_opp=1&position=&team=${abbrev}&year=${SEASON}&csv=true`
  const csv = await _fetchWithCORSFallback(url)
  if (!csv) return null
  return _parseCSV(csv).map(r => ({
    name: `${r.first_name} ${r.last_name}`.trim(),
    playerId: +r.player_id || 0,
    sprintSpeed: +r.sprint_speed || 0,
    hpTo1b: +r.hp_to_1b || 0,
    competitiveRuns: +r.competitive_runs || 0,
    bolts: +r.bolts || 0,
    position: r.position || '',
  }))
}

async function fetchStatcastSprintSpeedAll() {
  const url = `https://baseballsavant.mlb.com/leaderboard/sprint_speed?min_opp=1&position=&team=&year=${SEASON}&csv=true`
  const csv = await _fetchWithCORSFallback(url)
  if (!csv) return null
  return _parseCSV(csv).map(r => +r.sprint_speed || 0).filter(v => v > 0)
}
