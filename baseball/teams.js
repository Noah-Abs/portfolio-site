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
}

/* ══════════════════════════════════════════════
   GAME BREAKDOWN — update after each game
   ══════════════════════════════════════════════ */
const GAME_BREAKDOWN = {
  dodgers: {
    tag: 'FILM STUDY',
    title: 'Game Breakdown Center',
    seriesLabel: '2025 World Series',
    gameLabel: 'Game 7',
    scoreLabel: 'LAD 5, TOR 4 (11)',
    venue: 'Rogers Centre',

    /* ── Box Score ── */
    lineScore: {
      innings: [1,2,3,4,5,6,7,8,9,10,11],
      away: { abbr: 'LAD', runs: [0,0,0,1,0,1,0,1,1,0,1], R: 5, H: 11, E: 0 },
      home: { abbr: 'TOR', runs: [0,0,3,0,0,1,0,0,0,0,0], R: 4, H: 14, E: 0 },
    },

    /* ── Win Probability ── */
    wpa: {
      label: 'LAD WIN %',
      data: [48,48,47,47,48,49,48,47,46,47,46,47,49,48,47,46,45,15,14,14,15,14,14,16,20,18,19,18,19,18,17,18,19,18,17,18,19,28,26,25,18,17,18,17,16,17,18,17,16,17,18,17,30,32,31,32,33,32,31,30,55,53,52,51,52,50,48,50,49,50,88,85,90,92,88,90,92,95,98,100],
      innStarts: [0,7,15,23,30,37,43,50,58,66,73],
      keyMoments: [
        { i: 17, lbl: 'Bichette 3-Run HR', c: '#ef5350' },
        { i: 24, lbl: 'Hern\u00e1ndez Sac Fly', c: '#42a5f5' },
        { i: 37, lbl: 'Edman Sac Fly', c: '#42a5f5' },
        { i: 40, lbl: 'Gim\u00e9nez RBI 2B', c: '#ef5350' },
        { i: 52, lbl: 'Muncy HR', c: '#42a5f5' },
        { i: 60, lbl: 'Rojas ties it!', c: '#66bb6a' },
        { i: 70, lbl: 'Smith HR!', c: '#66bb6a' },
      ],
    },

    /* ── Turning Points ── */
    turningPoints: [
      { rank: 1, title: 'Will Smith Go-Ahead Solo HR', inn: '\u25b2 Top 11th', delta: '+38%', cls: 'pos',
        desc: 'On a 2\u20130 count, Smith sent a Shane Bieber pitch into the Toronto bullpen in left field. The first extra-inning HR in a winner-take-all World Series game.' },
      { rank: 2, title: 'Bo Bichette 3-Run HR', inn: '\u25bc Bot 3rd', delta: '\u221230%', cls: 'neg',
        desc: 'Bichette crushed a 442-foot bomb to deep center off Shohei Ohtani, scoring Springer and Guerrero Jr. to put Toronto up 3\u20130.' },
      { rank: 3, title: 'Miguel Rojas Game-Tying Solo HR', inn: '\u25b2 Top 9th', delta: '+25%', cls: 'pos',
        desc: 'Facing closer Jeff Hoffman, Rojas hammered a hanging slider 387 feet to left field, tying the game 4\u20134 and sending it to extras.' },
      { rank: 4, title: 'Max Muncy Solo HR', inn: '\u25b2 Top 8th', delta: '+12%', cls: 'pos',
        desc: 'Muncy launched a solo shot 373 feet to right off Trey Yesavage, cutting the Dodgers\u2019 deficit to 4\u20133.' },
      { rank: 5, title: 'Andr\u00e9s Gim\u00e9nez RBI Double', inn: '\u25bc Bot 6th', delta: '\u221210%', cls: 'neg',
        desc: 'Gim\u00e9nez ripped a double to right off Tyler Glasnow, scoring Ernie Clement to extend Toronto\u2019s lead to 4\u20132.' },
    ],

    /* ── Best At-Bats ── */
    bestAtBats: [
      { batter: 'Will Smith', inn: '\u25b2 11th', pitches: 3, result: 'Solo HR', wpa: '+38%', cls: 'pos',
        note: 'Jumped on a 2\u20130 fastball from Shane Bieber and drove it 366 feet into the Toronto bullpen. Go-ahead run in extras.' },
      { batter: 'Miguel Rojas', inn: '\u25b2 9th', pitches: 4, result: 'Solo HR', wpa: '+25%', cls: 'pos',
        note: 'Crushed a hanging slider from closer Jeff Hoffman 387 feet to left. Game-tying blast that forced extras.' },
      { batter: 'Max Muncy', inn: '\u25b2 8th', pitches: 5, result: 'Solo HR', wpa: '+12%', cls: 'pos',
        note: 'Launched a 373-foot solo shot to right off Trey Yesavage. Cut the deficit to 4\u20133 and kept the comeback alive.' },
      { batter: 'Bo Bichette', inn: '\u25bc 3rd', pitches: 4, result: '3-Run HR', wpa: '\u221230%', cls: 'neg',
        note: 'Hammered a 442-foot moonshot to deep center off Ohtani, scoring Springer and Guerrero Jr. Gave Toronto a commanding 3\u20130 lead.' },
    ],

    /* ── Pitch Sequencing ── */
    pitchSequencing: {
      label: 'Both Teams Combined \u00b7 364 Total Pitches',
      pitches: [
        { type: 'Four-Seam Fastball', pct: 35, velo: '95.8', color: '#ef5350' },
        { type: 'Slider', pct: 22, velo: '86.9', color: '#42a5f5' },
        { type: 'Splitter', pct: 14, velo: '88.2', color: '#66bb6a' },
        { type: 'Curveball', pct: 12, velo: '80.1', color: '#ab47bc' },
        { type: 'Changeup', pct: 10, velo: '84.5', color: '#ffa726' },
        { type: 'Sinker', pct: 7, velo: '93.4', color: '#78909c' },
      ],
    },

    /* ── Bullpen Usage ── */
    bullpen: {
      away: {
        name: 'Los Angeles Dodgers',
        pitchers: [
          { name: 'Shohei Ohtani', role: 'SP', ip: '2.1', p: 51, k: 3, bb: 2, er: 3, grade: 'C+', gcls: 'c' },
          { name: 'Justin Wrobleski', role: 'RP', ip: '1.1', p: 21, k: 2, bb: 0, er: 0, grade: 'A', gcls: 'a' },
          { name: 'Tyler Glasnow', role: 'RP', ip: '2.1', p: 38, k: 2, bb: 0, er: 1, grade: 'B+', gcls: 'b' },
          { name: 'Emmet Sheehan', role: 'RP', ip: '1.0', p: 20, k: 2, bb: 0, er: 0, grade: 'A', gcls: 'a' },
          { name: 'Blake Snell', role: 'RP', ip: '1.1', p: 28, k: 2, bb: 1, er: 0, grade: 'A\u2212', gcls: 'a' },
          { name: 'Yoshinobu Yamamoto', role: 'W', ip: '2.2', p: 34, k: 1, bb: 1, er: 0, grade: 'A+', gcls: 'a' },
        ],
      },
      home: {
        name: 'Toronto Blue Jays',
        pitchers: [
          { name: 'Max Scherzer', role: 'SP', ip: '4.1', p: 54, k: 3, bb: 1, er: 1, grade: 'B+', gcls: 'b' },
          { name: 'Louis Varland', role: 'RP', ip: '0.2', p: 9, k: 0, bb: 0, er: 0, grade: 'B', gcls: 'b' },
          { name: 'Chris Bassitt', role: 'RP', ip: '1.0', p: 26, k: 0, bb: 1, er: 1, grade: 'C+', gcls: 'c' },
          { name: 'Trey Yesavage', role: 'RP', ip: '1.2', p: 21, k: 0, bb: 1, er: 1, grade: 'C+', gcls: 'c' },
          { name: 'Jeff Hoffman', role: 'RP', ip: '1.1', p: 22, k: 2, bb: 0, er: 1, grade: 'C', gcls: 'c' },
          { name: 'Seranthony Dom\u00ednguez', role: 'RP', ip: '1.0', p: 27, k: 0, bb: 2, er: 0, grade: 'B\u2212', gcls: 'b' },
          { name: 'Shane Bieber', role: 'L', ip: '1.0', p: 13, k: 0, bb: 0, er: 1, grade: 'D+', gcls: 'd' },
        ],
      },
    },

    /* ── Manager Decisions ── */
    managerDecisions: [
      { grade: 'A+', gcls: 'a', title: 'Roberts: Yamamoto from the bullpen on 1 day rest',
        impact: 'After throwing 96 pitches in Game 6 the night before, Yamamoto tossed 2.2 scoreless innings with a bases-loaded escape. WS MVP performance. Series-defining decision.' },
      { grade: 'B+', gcls: 'b', title: 'Roberts: Pulling Ohtani after 2.1 IP',
        impact: 'Gutsy to pull your two-way ace early, but the right call after Bichette\u2019s 3-run bomb. The bullpen was dominant the rest of the way.' },
      { grade: 'A', gcls: 'a', title: 'Roberts: All-hands bullpen approach (6 relievers)',
        impact: 'Used Wrobleski, Glasnow, Sheehan, Snell, and Yamamoto in relief. Combined for 8.2 IP, 1 ER, 9 K. Masterful management.' },
      { grade: 'C', gcls: 'c', title: 'Schneider: Leaving Hoffman in for the 9th',
        impact: 'Hoffman surrendered the game-tying Rojas HR on a hanging slider. A fresh arm might have held the 4\u20133 lead.' },
      { grade: 'C+', gcls: 'c', title: 'Schneider: Bieber for the 11th inning',
        impact: 'Bieber gave up the go-ahead Smith HR on just his 7th pitch. Seranthony Dom\u00ednguez had just thrown a scoreless 10th and might have continued.' },
    ],
  },

}

/* ── Prospect Rankings (MLB Pipeline 2026 Preseason) ── */
const PROSPECTS = {
  dodgers: {
    source: 'MLB Pipeline',
    updated: '2026 Preseason',
    players: [
      { rank: 1,  ovr: 15,   name: 'Josue De Paula',      pos: 'OF',  eta: 2027 },
      { rank: 2,  ovr: 27,   name: 'Zyhir Hope',          pos: 'OF',  eta: 2027 },
      { rank: 3,  ovr: 30,   name: 'Eduardo Quintero',    pos: 'OF',  eta: 2028 },
      { rank: 4,  ovr: 60,   name: 'Mike Sirota',         pos: 'OF',  eta: 2027 },
      { rank: 5,  ovr: 92,   name: 'Emil Morales',        pos: 'SS',  eta: 2028 },
      { rank: 6,  ovr: null, name: 'Jackson Ferris',      pos: 'LHP', eta: 2027 },
      { rank: 7,  ovr: null, name: 'Alex Freeland',       pos: 'SS',  eta: 2026 },
      { rank: 8,  ovr: null, name: 'James Tibbs III',     pos: 'OF',  eta: 2027 },
      { rank: 9,  ovr: null, name: 'Adam Serwinowski',    pos: 'LHP', eta: 2027 },
      { rank: 10, ovr: null, name: 'River Ryan',          pos: 'RHP', eta: 2026 },
      { rank: 11, ovr: null, name: 'Christian Zazueta',   pos: 'RHP', eta: 2028 },
      { rank: 12, ovr: null, name: 'Kellon Lindsey',      pos: 'SS',  eta: 2028 },
      { rank: 13, ovr: null, name: 'Ching-Hsien Ko',      pos: 'OF',  eta: 2029 },
      { rank: 14, ovr: null, name: 'Charles Davalan',     pos: 'OF',  eta: 2028 },
      { rank: 15, ovr: null, name: 'Chase Harlan',        pos: '3B',  eta: 2028 },
      { rank: 16, ovr: null, name: 'Zachary Root',        pos: 'LHP', eta: 2028 },
      { rank: 17, ovr: null, name: 'Joendry Vargas',      pos: 'SS',  eta: 2028 },
      { rank: 18, ovr: null, name: 'Kendall George',      pos: 'CF',  eta: 2027 },
      { rank: 19, ovr: null, name: 'Patrick Copen',       pos: 'RHP', eta: 2026 },
      { rank: 20, ovr: null, name: 'Payton Martin',       pos: 'RHP', eta: 2027 },
    ]
  },
}
