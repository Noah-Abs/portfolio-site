// ── Player ───────────────────────────────────────────────────────────────────
export interface Player {
  id: number
  fullName: string
  firstName: string
  lastName: string
  primaryNumber: string
  birthDate: string
  birthCity: string
  birthStateProvince?: string
  birthCountry: string
  height: string
  weight: number
  active: boolean
  currentTeam: { id: number; name: string }
  primaryPosition: { code: string; name: string; type: string; abbreviation: string }
  batSide: { code: string; description: string }
  pitchHand: { code: string; description: string }
  mlbDebutDate: string
  imageUrl?: string
}

// ── Batting Stats ─────────────────────────────────────────────────────────────
export interface BattingStats {
  season: string
  teamName: string
  teamId: number
  gamesPlayed: number
  atBats: number
  runs: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  rbi: number
  stolenBases: number
  caughtStealing: number
  baseOnBalls: number
  strikeOuts: number
  avg: string
  obp: string
  slg: string
  ops: string
  babip?: string
  // Advanced
  war?: number
  wrc_plus?: number
  woba?: string
  iso?: string
  ops_plus?: number
  // Statcast
  exitVelocity?: number
  launchAngle?: number
  barrelPct?: number
  hardHitPct?: number
}

// ── Pitching Stats ────────────────────────────────────────────────────────────
export interface PitchingStats {
  season: string
  teamName: string
  teamId: number
  wins: number
  losses: number
  era: string
  gamesPlayed: number
  gamesStarted: number
  completeGames: number
  shutouts: number
  saves: number
  inningsPitched: string
  hits: number
  runs: number
  earnedRuns: number
  homeRuns: number
  baseOnBalls: number
  strikeOuts: number
  whip: string
  strikeoutsPer9: string
  walksPer9: string
  // Advanced
  fip?: string
  xfip?: string
  war?: number
  ops_against?: string
  babip_against?: string
  // Statcast
  spinRate?: number
  velocity?: number
  exitVelocityAgainst?: number
}

// ── Team ──────────────────────────────────────────────────────────────────────
export interface Team {
  id: number
  name: string
  abbreviation: string
  teamName: string
  locationName: string
  division: { id: number; name: string }
  league: { id: number; name: string }
  venue: { id: number; name: string }
  record?: { wins: number; losses: number; pct: string; gamesBack: string }
}

// ── Live Score ────────────────────────────────────────────────────────────────
export interface LiveGame {
  gamePk: number
  status: string
  homeTeam: { id: number; name: string; abbreviation: string; score: number }
  awayTeam: { id: number; name: string; abbreviation: string; score: number }
  inning: number
  inningHalf: 'top' | 'bottom'
  gameDate: string
  venue: string
}

// ── News ──────────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: string
  headline: string
  subhead?: string
  description: string
  published: string
  type: string
  image?: string
  url: string
  contributor?: string
}

// ── Leaderboard Row ───────────────────────────────────────────────────────────
export interface LeaderboardRow {
  rank: number
  playerId: number
  playerName: string
  teamName: string
  teamAbbr: string
  value: string | number
  season: string
}

// ── Stat Category ─────────────────────────────────────────────────────────────
export type StatCategory =
  | 'avg' | 'hr' | 'rbi' | 'obp' | 'slg' | 'ops' | 'sb' | 'runs' | 'hits'
  | 'era' | 'whip' | 'wins' | 'strikeouts' | 'saves' | 'fip'
  | 'war' | 'wrc_plus' | 'ops_plus'

export type StatType = 'hitting' | 'pitching'
