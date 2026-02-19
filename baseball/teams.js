/* ── Team Metadata (no stats — all stats come from API) ── */

const SEASON = 2025

const APP_TEAMS = {
  dodgers: {
    id: 119,
    espnId: 19,
    name: 'Los Angeles Dodgers',
    cityShort: 'Los Angeles',
    nameShort: 'Dodgers',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg',
    wsLabel: 'Back-to-Back World Series Champions',
    wsTitles: [1955, 1959, 1963, 1965, 1981, 1988, 2020, 2024, 2025],
  },
  mets: {
    id: 121,
    espnId: 21,
    name: 'New York Mets',
    cityShort: 'New York',
    nameShort: 'Mets',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/121.svg',
    wsLabel: '2x World Series Champions',
    wsTitles: [1969, 1986],
  },
}

const ACCENT_COLORS = [
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Cyan',   value: '#06b6d4' },
  { name: 'Green',  value: '#10b981' },
  { name: 'Rose',   value: '#f43f5e' },
  { name: 'Orange', value: '#f97316' },
]
