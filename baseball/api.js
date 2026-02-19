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
  const [standRes, batRes, pitRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=${SEASON}&standingsTypes=regularSeason`),
    fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${SEASON}&sportId=1`),
    fetch(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${SEASON}&sportId=1`),
  ])
  const [stand, bat, pit] = await Promise.all([standRes.json(), batRes.json(), pitRes.json()])

  let rec = null
  for (const div of stand.records) {
    rec = div.teamRecords.find(r => r.team.id === teamId)
    if (rec) break
  }

  const batSplits = bat.stats[0].splits
  const pitSplits = pit.stats[0].splits
  const db = batSplits.find(s => s.team.id === teamId)?.stat
  const dp = pitSplits.find(s => s.team.id === teamId)?.stat

  if (!rec || !db || !dp) return null

  const divRank = `#${rec.divisionRank} ${rec.division?.nameShort || ''}`
  const pct = parseFloat(rec.winningPercentage).toFixed(3).replace('0.', '.')

  return [
    { val: `${rec.wins}-${rec.losses}`, lbl: 'Record',     rank: divRank },
    { val: pct,                          lbl: 'Win %',      rank: divRank },
    { val: db.avg,                       lbl: 'Team AVG',   rank: _nlRank(batSplits, 'avg', teamId) },
    { val: parseInt(db.hits).toLocaleString(), lbl: 'Hits' },
    { val: db.homeRuns,                  lbl: 'Home Runs',  rank: _nlRank(batSplits, 'homeRuns', teamId) },
    { val: dp.era,                       lbl: 'Team ERA',   rank: _nlRank(pitSplits, 'era', teamId, true) },
    { val: parseInt(dp.strikeOuts).toLocaleString(), lbl: 'Strikeouts' },
  ]
}

async function fetchLastGame(teamId, teamAbbr) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${SEASON}&sportId=1&gameType=R,F,D,L,W&startDate=${SEASON}-03-01&endDate=${SEASON}-11-10`
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
  const myAbbr  = lastGame.teams[mySide].team.abbreviation ?? teamAbbr
  const oppAbbr = lastGame.teams[oppSide].team.abbreviation ?? '???'
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
  const endDate = `${SEASON + 1}-11-10`
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${SEASON + 1}&sportId=1&gameType=R,F,D,L,W&startDate=${today}&endDate=${endDate}`
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

async function fetchSchedule(teamId) {
  const season = SEASON + 1
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R`)
  const data = await res.json()
  if (!data.dates?.length) return []

  const games = []
  for (const d of data.dates) {
    for (const g of d.games) {
      const isHome = g.teams.home.team.id === teamId
      const opp = isHome ? g.teams.away.team : g.teams.home.team
      const dt = new Date(g.gameDate)
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

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}
