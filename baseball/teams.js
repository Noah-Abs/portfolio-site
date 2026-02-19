/* ── Team Data & Constants ── */

const SEASON = 2025

const APP_TEAMS = {
  dodgers: {
    id: 119,
    espnId: 19,
    name: 'Los Angeles Dodgers',
    cityShort: 'Los Angeles',
    nameShort: 'Dodgers',
    teamAbbr: 'LAD',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg',
    logoAlt: 'Dodgers',
    venueName: 'Dodger Stadium',
    division: 'NL West',
    wsTitles: [1955, 1959, 1963, 1965, 1981, 1988, 2020, 2024, 2025],
    wsLabel: 'Back-to-Back World Series Champions',
    bg1: '#002580', bg2: '#000D3A', bg3: '#000510',
    h1: '#001E62', h2: '#003DA5',
  },
  mets: {
    id: 121,
    espnId: 21,
    name: 'New York Mets',
    cityShort: 'New York',
    nameShort: 'Mets',
    teamAbbr: 'NYM',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/121.svg',
    logoAlt: 'Mets',
    venueName: 'Citi Field',
    division: 'NL East',
    wsTitles: [1969, 1986],
    wsLabel: '2x World Series Champions',
    bg1: '#001840', bg2: '#000E30', bg3: '#000515',
    h1: '#001840', h2: '#002D72',
  },
}

const ACCENT_COLORS = [
  { name: 'Dodger Blue', value: '#003DA5' },
  { name: 'Sunset',      value: '#e65c00' },
  { name: 'Mint',        value: '#00c896' },
  { name: 'Lavender',    value: '#7c5cbf' },
  { name: 'Coral',       value: '#ff6b6b' },
  { name: 'Gold',        value: '#daa520' },
]

/* ── World Series Info ── */
const WS_INFO = {
  1955: {
    subtitle: 'Brooklyn Dodgers vs. New York Yankees',
    result: 'Dodgers win 4-3',
    mvp: 'Johnny Podres',
    venue: 'Ebbets Field / Yankee Stadium',
    desc: "Brooklyn's only World Series title after decades of heartbreak against the Yankees. Johnny Podres threw a shutout in Game 7, and Sandy Amoros made a stunning running catch in the 6th inning to preserve the lead.",
    wiki: '1955_World_Series'
  },
  1959: {
    subtitle: 'Los Angeles Dodgers vs. Chicago White Sox',
    result: 'Dodgers win 4-2',
    mvp: 'Larry Sherry',
    venue: 'LA Memorial Coliseum / Comiskey Park',
    desc: "Los Angeles' first championship after relocating from Brooklyn. Down 2-0 in the series, the Dodgers rallied to win four straight.",
    wiki: '1959_World_Series'
  },
  1963: {
    subtitle: 'Los Angeles Dodgers vs. New York Yankees',
    result: 'Dodgers win 4-0',
    mvp: 'Sandy Koufax',
    venue: 'Yankee Stadium / Dodger Stadium',
    desc: "A dominant sweep of the mighty Yankees. Sandy Koufax won Games 1 and 4 while striking out 23 batters across the series.",
    wiki: '1963_World_Series'
  },
  1965: {
    subtitle: 'Los Angeles Dodgers vs. Minnesota Twins',
    result: 'Dodgers win 4-3',
    mvp: 'Sandy Koufax',
    venue: 'Dodger Stadium / Metropolitan Stadium',
    desc: "Sandy Koufax at his absolute peak. He pitched Games 5 and 7 on short rest, throwing a complete game shutout in the clincher.",
    wiki: '1965_World_Series'
  },
  1981: {
    subtitle: 'Los Angeles Dodgers vs. New York Yankees',
    result: 'Dodgers win 4-2',
    mvp: 'Ron Cey / Pedro Guerrero / Steve Yeager',
    venue: 'Yankee Stadium / Dodger Stadium',
    desc: "Down 2-0, the Dodgers became the first NL team to come back from an 0-2 deficit to win the World Series. Three players shared the MVP award.",
    wiki: '1981_World_Series'
  },
  1988: {
    subtitle: 'Los Angeles Dodgers vs. Oakland Athletics',
    result: 'Dodgers win 4-1',
    mvp: 'Orel Hershiser',
    venue: 'Dodger Stadium / Oakland Coliseum',
    desc: "Kirk Gibson, barely able to walk, hit a walk-off pinch-hit home run off Dennis Eckersley in Game 1. His fist pump around the bases is one of the most iconic moments in sports history.",
    wiki: '1988_World_Series'
  },
  2020: {
    subtitle: 'Los Angeles Dodgers vs. Tampa Bay Rays',
    result: 'Dodgers win 4-2',
    mvp: 'Corey Seager',
    venue: 'Globe Life Field (neutral site)',
    desc: "Played in a bubble during the COVID-19 pandemic, the Dodgers ended a 32-year championship drought. Corey Seager hit .400 with 2 home runs.",
    wiki: '2020_World_Series'
  },
  2024: {
    subtitle: 'Los Angeles Dodgers vs. New York Yankees',
    result: 'Dodgers win 4-1',
    mvp: 'Freddie Freeman',
    venue: 'Dodger Stadium / Yankee Stadium',
    desc: "Freddie Freeman delivered a walk-off grand slam in the 10th inning of Game 1 while battling a severe ankle injury. He finished hitting .400 with 12 RBI.",
    wiki: '2024_World_Series'
  },
  2025: {
    subtitle: 'Los Angeles Dodgers vs. Toronto Blue Jays',
    result: 'Dodgers win 4-3',
    mvp: 'Yoshinobu Yamamoto (3 W, 1.02 ERA)',
    venue: 'Dodger Stadium / Rogers Centre',
    desc: "Called one of the greatest World Series of all time. Game 3 went 18 innings. In Game 7, Miguel Rojas tied it, Will Smith hit the go-ahead shot in the 11th, and Yamamoto closed it out from the bullpen.",
    wiki: '2025_World_Series'
  },
  1969: {
    subtitle: 'New York Mets vs. Baltimore Orioles',
    result: 'Mets win 4-1',
    mvp: 'Donn Clendenon',
    venue: 'Memorial Stadium / Shea Stadium',
    desc: "The original Miracle Mets. After being baseball's worst team since 1962, the Mets pulled off one of the biggest upsets in World Series history.",
    wiki: '1969_World_Series'
  },
  1986: {
    subtitle: 'New York Mets vs. Boston Red Sox',
    result: 'Mets win 4-3',
    mvp: 'Ray Knight',
    venue: 'Shea Stadium / Fenway Park',
    desc: "Down to their last strike in Game 6, Mookie Wilson's grounder rolled through Bill Buckner's legs. The Mets then rallied from a 3-run deficit in Game 7.",
    wiki: '1986_World_Series'
  },
}

/* ── Contract Data ── */
const CONTRACTS = {
  dodgers: {
    payroll: 286,
    luxTax: 241,
    players: [
      { id: 660271, name: 'Shohei Ohtani',    pos: 'DH', aav: 46.0, total: 700, start: 2024, end: 2033 },
      { id: 605141, name: 'Mookie Betts',     pos: 'RF', aav: 30.4, total: 365, start: 2021, end: 2032 },
      { id: 808982, name: 'Y. Yamamoto',      pos: 'SP', aav: 27.1, total: 325, start: 2024, end: 2035 },
      { id: 518692, name: 'Freddie Freeman',  pos: '1B', aav: 27.0, total: 162, start: 2022, end: 2027 },
      { id: 607192, name: 'Tyler Glasnow',    pos: 'SP', aav: 19.4, total: 136, start: 2025, end: 2031 },
      { id: 657136, name: 'Will Smith',       pos: 'C',  aav: 16.0, total: 140, start: 2022, end: 2031 },
      { id: 606061, name: 'T. Hernandez',     pos: 'LF', aav: 14.5, total: 29,  start: 2025, end: 2026 },
      { id: 669242, name: 'Tommy Edman',      pos: '2B', aav: 12.0, total: 48,  start: 2025, end: 2028 },
    ]
  },
  mets: {
    payroll: 322,
    luxTax: 241,
    players: [
      { id: 665742, name: 'Juan Soto',        pos: 'RF', aav: 51.0, total: 765, start: 2025, end: 2039 },
      { id: 596019, name: 'F. Lindor',        pos: 'SS', aav: 34.1, total: 341, start: 2022, end: 2031 },
      { id: 624413, name: 'Pete Alonso',      pos: '1B', aav: 27.0, total: 54,  start: 2025, end: 2026 },
      { id: 607680, name: 'Brandon Nimmo',    pos: 'LF', aav: 22.1, total: 162, start: 2023, end: 2030 },
      { id: 621244, name: 'Edwin Diaz',       pos: 'CL', aav: 20.4, total: 102, start: 2023, end: 2027 },
      { id: 669923, name: 'Kodai Senga',      pos: 'SP', aav: 15.0, total: 75,  start: 2024, end: 2028 },
      { id: 648717, name: 'Sean Manaea',      pos: 'SP', aav: 14.0, total: 28,  start: 2025, end: 2026 },
      { id: 678103, name: 'Mark Vientos',     pos: '3B', aav: 1.2,  total: 2.4, start: 2025, end: 2026 },
    ]
  }
}
