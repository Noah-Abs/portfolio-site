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
  redsox: {
    id: 111,
    espnId: 2,
    name: 'Boston Red Sox',
    cityShort: 'Boston',
    nameShort: 'Red Sox',
    teamAbbr: 'BOS',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/111.svg',
    logoAlt: 'Red Sox',
    venueName: 'Fenway Park',
    division: 'AL East',
    wsTitles: [1903, 1912, 1915, 1916, 1918, 2004, 2007, 2013, 2018],
    wsLabel: '9x World Series Champions',
    bg1: '#1a0510', bg2: '#0C0310', bg3: '#050008',
    h1: '#0C2340', h2: '#BD3039',
  },
  usa: {
    id: 2524,
    espnId: null,
    name: 'Team USA',
    cityShort: 'United States',
    nameShort: 'USA',
    teamAbbr: 'USA',
    logoSrc: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/2524.svg',
    logoAlt: 'Team USA',
    venueName: 'Various',
    division: 'World Baseball Classic',
    wsTitles: [2017],
    wsLabel: 'WBC Champions',
    bg1: '#0A1128', bg2: '#050B1A', bg3: '#020510',
    h1: '#0A1E3D', h2: '#B31942',
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
  1903: {
    subtitle: 'Boston Americans vs. Pittsburgh Pirates',
    result: 'Boston wins 5-3',
    mvp: 'Bill Dinneen',
    venue: 'Huntington Avenue Grounds / Exposition Park',
    desc: "The first modern World Series ever played. Boston's pitching staff dominated, with Bill Dinneen throwing three complete game victories to clinch the best-of-nine series.",
    wiki: '1903_World_Series'
  },
  1912: {
    subtitle: 'Boston Red Sox vs. New York Giants',
    result: 'Red Sox win 4-3-1',
    mvp: 'Smoky Joe Wood',
    venue: 'Fenway Park / Polo Grounds',
    desc: "Played in the inaugural season of Fenway Park. Smoky Joe Wood went 34-5 in the regular season. The Red Sox won Game 8 after a famous Fred Snodgrass dropped fly ball.",
    wiki: '1912_World_Series'
  },
  1915: {
    subtitle: 'Boston Red Sox vs. Philadelphia Phillies',
    result: 'Red Sox win 4-1',
    mvp: 'Duffy Lewis',
    venue: 'Baker Bowl / Braves Field',
    desc: "The Red Sox won four straight after dropping Game 1. Rube Foster won two games and Duffy Lewis drove in the winning runs in multiple contests.",
    wiki: '1915_World_Series'
  },
  1916: {
    subtitle: 'Boston Red Sox vs. Brooklyn Robins',
    result: 'Red Sox win 4-1',
    mvp: 'Babe Ruth',
    venue: 'Braves Field / Ebbets Field',
    desc: "A young Babe Ruth pitched a 14-inning complete game victory in Game 2, allowing just one run. It remained the longest complete game in World Series history for decades.",
    wiki: '1916_World_Series'
  },
  1918: {
    subtitle: 'Boston Red Sox vs. Chicago Cubs',
    result: 'Red Sox win 4-2',
    mvp: 'Carl Mays',
    venue: 'Fenway Park / Comiskey Park',
    desc: "The last Red Sox title for 86 years. Babe Ruth extended his scoreless innings streak to 29.2 in the Series. The season was shortened due to World War I.",
    wiki: '1918_World_Series'
  },
  2004: {
    subtitle: 'Boston Red Sox vs. St. Louis Cardinals',
    result: 'Red Sox win 4-0',
    mvp: 'Manny Ramirez',
    venue: 'Fenway Park / Busch Stadium',
    desc: "The Red Sox broke the Curse of the Bambino with a dominant sweep after becoming the first MLB team to come back from a 3-0 deficit against the Yankees in the ALCS.",
    wiki: '2004_World_Series'
  },
  2007: {
    subtitle: 'Boston Red Sox vs. Colorado Rockies',
    result: 'Red Sox win 4-0',
    mvp: 'Mike Lowell',
    venue: 'Fenway Park / Coors Field',
    desc: "Another dominant sweep. Mike Lowell hit .400 with a home run, and the pitching staff held the high-powered Rockies offense to just 10 runs in four games.",
    wiki: '2007_World_Series'
  },
  2013: {
    subtitle: 'Boston Red Sox vs. St. Louis Cardinals',
    result: 'Red Sox win 4-2',
    mvp: 'David Ortiz',
    venue: 'Fenway Park / Busch Stadium',
    desc: "Boston Strong. After the Boston Marathon bombing, David Ortiz hit .688 with 2 homers and led the Red Sox to their third title in 10 years, clinching at Fenway.",
    wiki: '2013_World_Series'
  },
  2018: {
    subtitle: 'Boston Red Sox vs. Los Angeles Dodgers',
    result: 'Red Sox win 4-1',
    mvp: 'Steve Pearce',
    venue: 'Fenway Park / Dodger Stadium',
    desc: "The 108-win Red Sox dominated the Dodgers. Steve Pearce hit three home runs including two in the clinching Game 5, earning MVP honors.",
    wiki: '2018_World_Series'
  },
  2017: {
    subtitle: 'Team USA vs. Puerto Rico',
    result: 'USA wins 8-0',
    mvp: 'Marcus Stroman',
    venue: 'Dodger Stadium',
    desc: "Team USA won the World Baseball Classic for the first time. Marcus Stroman threw six scoreless innings in the final, and the U.S. offense erupted for eight runs against Puerto Rico.",
    wiki: '2017_World_Baseball_Classic'
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
  },
  redsox: {
    payroll: 183,
    luxTax: 241,
    players: [
      { id: 646240, name: 'Rafael Devers',    pos: '3B', aav: 31.4, total: 331, start: 2024, end: 2034 },
      { id: 596115, name: 'Trevor Story',     pos: 'SS', aav: 23.3, total: 140, start: 2022, end: 2027 },
      { id: 807799, name: 'M. Yoshida',       pos: 'LF', aav: 18.0, total: 90,  start: 2023, end: 2027 },
      { id: 666142, name: 'Tanner Houck',     pos: 'SP', aav: 10.0, total: 40,  start: 2025, end: 2028 },
      { id: 680776, name: 'Jarren Duran',     pos: 'CF', aav: 7.5,  total: 60,  start: 2025, end: 2032 },
      { id: 676475, name: 'Brayan Bello',     pos: 'SP', aav: 4.5,  total: 55,  start: 2025, end: 2032 },
      { id: 680737, name: 'C. Rafaela',       pos: 'SS', aav: 1.5,  total: 9,   start: 2025, end: 2030 },
      { id: 680646, name: 'Connor Wong',      pos: 'C',  aav: 1.3,  total: 5.2, start: 2025, end: 2028 },
    ]
  },
  usa: null,
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

  mets: null,
  redsox: null,
  usa: null,
}
