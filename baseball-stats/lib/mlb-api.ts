const MLB_BASE = 'https://statsapi.mlb.com/api/v1'

async function mlbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${MLB_BASE}${path}`, {
    next: { revalidate: 600 }, // 10-minute cache
  })
  if (!res.ok) throw new Error(`MLB API error: ${res.status} ${path}`)
  return res.json()
}

// ── Today's schedule / live scores ────────────────────────────────────────
export async function getLiveScores(date?: string) {
  const d = date ?? new Date().toISOString().slice(0, 10)
  const data = await mlbFetch<any>(
    `/schedule?sportId=1&date=${d}&hydrate=linescore,team`
  )
  const games = data.dates?.[0]?.games ?? []
  return games.map((g: any) => ({
    gamePk: g.gamePk,
    status: g.status?.abstractGameState ?? 'Preview',
    detailedState: g.status?.detailedState ?? '',
    homeTeam: {
      id: g.teams.home.team.id,
      name: g.teams.home.team.name,
      abbreviation: g.teams.home.team.abbreviation ?? g.teams.home.team.name.slice(0,3).toUpperCase(),
      score: g.teams.home.score ?? 0,
    },
    awayTeam: {
      id: g.teams.away.team.id,
      name: g.teams.away.team.name,
      abbreviation: g.teams.away.team.abbreviation ?? g.teams.away.team.name.slice(0,3).toUpperCase(),
      score: g.teams.away.score ?? 0,
    },
    inning: g.linescore?.currentInning ?? 0,
    inningHalf: g.linescore?.inningHalf ?? '',
    gameDate: g.gameDate,
    venue: g.venue?.name ?? '',
  }))
}

// ── All teams ──────────────────────────────────────────────────────────────
export async function getAllTeams() {
  const data = await mlbFetch<any>('/teams?sportId=1&activeStatus=Active')
  return (data.teams ?? []).sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  )
}

// ── Single team ────────────────────────────────────────────────────────────
export async function getTeam(id: number) {
  const [teamData, rosterData, statsData] = await Promise.all([
    mlbFetch<any>(`/teams/${id}?hydrate=division,league,venue`),
    mlbFetch<any>(`/teams/${id}/roster/active?hydrate=person,stats(group=hitting,type=season)`),
    mlbFetch<any>(`/teams/${id}/stats?stats=season&group=hitting,pitching&season=${new Date().getFullYear()}`),
  ])
  return {
    team: teamData.teams?.[0] ?? null,
    roster: rosterData.roster ?? [],
    stats: statsData.stats ?? [],
  }
}

// ── Player search ──────────────────────────────────────────────────────────
export async function searchPlayers(query: string, season?: number) {
  const yr = season ?? new Date().getFullYear()
  const data = await mlbFetch<any>(`/sports/1/players?season=${yr}&fields=people,id,fullName,primaryPosition,currentTeam,active`)
  const all: any[] = data.people ?? []
  const q = query.toLowerCase()
  return all
    .filter((p) => p.fullName?.toLowerCase().includes(q))
    .slice(0, 20)
}

// ── Player profile + career stats ─────────────────────────────────────────
export async function getPlayer(id: number) {
  const [info, hittingStats, pitchingStats] = await Promise.all([
    mlbFetch<any>(`/people/${id}?hydrate=currentTeam,rosterEntries`),
    mlbFetch<any>(`/people/${id}/stats?stats=yearByYear&group=hitting&sportId=1`).catch(() => ({ stats: [] })),
    mlbFetch<any>(`/people/${id}/stats?stats=yearByYear&group=pitching&sportId=1`).catch(() => ({ stats: [] })),
  ])

  const person = info.people?.[0] ?? null

  const mapHitting = (s: any) => ({
    season: s.season,
    teamName: s.team?.name ?? '—',
    teamId: s.team?.id ?? 0,
    gamesPlayed: s.stat?.gamesPlayed ?? 0,
    atBats: s.stat?.atBats ?? 0,
    runs: s.stat?.runs ?? 0,
    hits: s.stat?.hits ?? 0,
    doubles: s.stat?.doubles ?? 0,
    triples: s.stat?.triples ?? 0,
    homeRuns: s.stat?.homeRuns ?? 0,
    rbi: s.stat?.rbi ?? 0,
    stolenBases: s.stat?.stolenBases ?? 0,
    caughtStealing: s.stat?.caughtStealing ?? 0,
    baseOnBalls: s.stat?.baseOnBalls ?? 0,
    strikeOuts: s.stat?.strikeOuts ?? 0,
    avg: s.stat?.avg ?? '.000',
    obp: s.stat?.obp ?? '.000',
    slg: s.stat?.slg ?? '.000',
    ops: s.stat?.ops ?? '.000',
    babip: s.stat?.babip ?? '—',
  })

  const mapPitching = (s: any) => ({
    season: s.season,
    teamName: s.team?.name ?? '—',
    teamId: s.team?.id ?? 0,
    wins: s.stat?.wins ?? 0,
    losses: s.stat?.losses ?? 0,
    era: s.stat?.era ?? '—',
    gamesPlayed: s.stat?.gamesPlayed ?? 0,
    gamesStarted: s.stat?.gamesStarted ?? 0,
    saves: s.stat?.saves ?? 0,
    inningsPitched: s.stat?.inningsPitched ?? '0.0',
    hits: s.stat?.hits ?? 0,
    homeRuns: s.stat?.homeRuns ?? 0,
    baseOnBalls: s.stat?.baseOnBalls ?? 0,
    strikeOuts: s.stat?.strikeOuts ?? 0,
    whip: s.stat?.whip ?? '—',
    strikeoutsPer9: s.stat?.strikeoutsPer9Inn ?? '—',
    walksPer9: s.stat?.walksPer9Inn ?? '—',
  })

  const hitting = (hittingStats.stats?.[0]?.splits ?? []).map(mapHitting)
  const pitching = (pitchingStats.stats?.[0]?.splits ?? []).map(mapPitching)

  return { person, hitting, pitching }
}

// ── Leaderboards ───────────────────────────────────────────────────────────
export async function getLeaderboard(category: string, season: number, limit = 50) {
  const data = await mlbFetch<any>(
    `/stats/leaders?leaderCategories=${category}&season=${season}&sportId=1&limit=${limit}&hydrate=person,team`
  )
  const leaders = data.leagueLeaders?.[0]?.leaders ?? []
  return leaders.map((l: any, i: number) => ({
    rank: l.rank ?? i + 1,
    playerId: l.person?.id ?? 0,
    playerName: l.person?.fullName ?? '—',
    teamName: l.team?.name ?? '—',
    teamAbbr: l.team?.abbreviation ?? '—',
    value: l.value ?? '—',
    season: String(season),
  }))
}

// ── Player image URL ───────────────────────────────────────────────────────
export function playerImageUrl(id: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${id}/headshot/67/current`
}
