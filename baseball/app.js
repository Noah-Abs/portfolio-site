/* ── App State ── */
let _currentTeamKey = 'dodgers'
let _liveGamePk = null
let _liveTimer = null
let _lastLiveData = null
let _depthLoaded = false
let _contractsLoaded = false
let _currentView = 'home'
let _newsArticles = []
let _mlbNewsArticles = []
let _allScheduleGames = []
let _filteredGames = []
let rosterLoaded = false

const LOGO = 'https://www.mlbstatic.com/team-logos/team-cap-on-dark'

/* ── Team Rendering ── */
function renderTeam(key) {
  const t = APP_TEAMS[key]
  if (!t) return
  _currentTeamKey = key
  document.body.dataset.team = key
  localStorage.setItem('selectedTeam', key)

  const r = document.documentElement.style
  r.setProperty('--team-bg1', t.bg1)
  r.setProperty('--team-bg2', t.bg2)
  r.setProperty('--team-bg3', t.bg3)
  r.setProperty('--team-header1', t.h1)
  r.setProperty('--team-header2', t.h2)

  const logo = document.getElementById('bar-logo')
  logo.src = t.logoSrc; logo.alt = t.logoAlt
  document.getElementById('bar-team-name').textContent = t.name
  document.getElementById('bar-team-sub').textContent = t.division

  const heroLogo = document.getElementById('hero-logo')
  if (heroLogo) { heroLogo.src = t.logoSrc; heroLogo.alt = t.logoAlt }
  const heroCity = document.getElementById('hero-city')
  if (heroCity) heroCity.textContent = t.cityShort
  const heroName = document.getElementById('hero-team-name-display')
  if (heroName) heroName.textContent = t.nameShort
  const heroChamps = document.getElementById('hero-champs')
  if (heroChamps) heroChamps.textContent = t.wsLabel ?? ''

  const wsEl = document.getElementById('ws-banners')
  if (wsEl) {
    wsEl.innerHTML = (t.wsTitles ?? []).map(yr =>
      `<div class="ws-banner" onclick="openWsModal(${yr})"><span class="ws-banner-year">${yr}</span></div>`
    ).join('')
  }

  document.querySelector('.stats-season').textContent = `${SEASON} Season`
  document.querySelector('.stats-division').textContent = t.division

  // Show loading states
  document.querySelector('.team-stats').innerHTML = Array(7).fill(0).map(() =>
    '<div class="stat-item"><span class="stat-val" style="opacity:0.3">\u2026</span><span class="stat-lbl">Loading</span></div>'
  ).join('')
  document.querySelector('.performers-date').textContent = 'Loading\u2026'
  document.getElementById('lg-score').innerHTML = ''
  document.querySelector('.performers').innerHTML = ''
  document.getElementById('hero-next').innerHTML = ''
  document.getElementById('schedule-list').innerHTML = '<div style="padding:2rem 1.25rem;font-size:0.72rem;color:rgba(255,255,255,0.25);text-align:center">Loading schedule\u2026</div>'

  if (_currentView === 'settings') renderSettingsTeams()

  _depthLoaded = false
  rosterLoaded = false
  _contractsLoaded = false

  const centerLogo = document.getElementById('mob-center-logo')
  if (centerLogo) { centerLogo.src = t.logoSrc; centerLogo.alt = t.logoAlt }

  if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null }
  _liveGamePk = null
  _lastLiveData = null
  document.getElementById('live-game-card').style.display = 'none'

  renderMobHomeCards(t, null, null, null)
  loadLiveData()
  loadNews()
  startLiveTracker()
}

function renderMobHomeCards(t, stats, lastGameData, nextGame) {
  const mhcNext = document.getElementById('mhc-next')
  if (mhcNext) {
    if (nextGame) {
      const myLogo = t.logoSrc
      const oppLogo = `${LOGO}/${nextGame.logoId}.svg`
      const isHome = nextGame.atVs === 'vs' || nextGame.isHome === true
      mhcNext.innerHTML = `
        <div class="mhc-next-label">Next Game</div>
        ${nextGame.tag ? `<span class="mhc-next-tag">${nextGame.tag}</span>` : ''}
        <div class="mhc-next-matchup">
          <img src="${isHome ? myLogo : oppLogo}" alt="">
          <span class="mhc-next-sep">${nextGame.atVs || (isHome ? 'vs' : '@')}</span>
          <img src="${isHome ? oppLogo : myLogo}" alt="">
        </div>
        <div class="mhc-next-opp">${nextGame.opponent}</div>
        <div class="mhc-next-time">${nextGame.dateShort || nextGame.monthDay || nextGame.date || ''} \u00b7 ${nextGame.time}</div>`
    } else {
      mhcNext.innerHTML = '<div class="mhc-next-label">Next Game</div><div style="color:rgba(255,255,255,0.25);font-size:0.65rem">Loading\u2026</div>'
    }
  }

  const mhcHL = document.getElementById('mhc-headline')
  if (mhcHL && !document.getElementById('mhc-hl-text')?.querySelector('a')) {
    mhcHL.innerHTML = '<div class="mhc-hl-label">Top Story</div><div class="mhc-hl-text" id="mhc-hl-text" style="color:rgba(255,255,255,0.35);font-size:0.65rem">Loading\u2026</div>'
  }

  const mhcStats = document.getElementById('mhc-stats')
  if (mhcStats) {
    if (stats) {
      mhcStats.innerHTML = stats.slice(0, 6).map(s => `
        <div>
          <div class="mhc-stat-val">${s.val}</div>
          <div class="mhc-stat-lbl">${s.lbl}</div>
          ${s.rank ? `<div class="mhc-stat-rank">${s.rank}</div>` : ''}
        </div>`).join('')
    } else {
      mhcStats.innerHTML = '<div style="color:rgba(255,255,255,0.25);font-size:0.65rem;grid-column:1/-1">Loading\u2026</div>'
    }
  }

  const mhcLG = document.getElementById('mhc-last-game')
  if (mhcLG) {
    if (lastGameData) {
      mhcLG.innerHTML = `
        <div class="mhc-lg-score">${lastGameData.score}</div>
        ${lastGameData.performers.slice(0, 3).map(p => `
          <div class="mhc-performer">
            <span class="mhc-p-name">${p.name}</span>
            <span class="mhc-p-line">${p.line}</span>
          </div>`).join('')}`
    } else {
      mhcLG.innerHTML = '<div style="color:rgba(255,255,255,0.25);font-size:0.65rem">Loading\u2026</div>'
    }
  }
}

/* ── Next Game Renderer ── */
function renderNextGame(g) {
  const el = document.getElementById('hero-next')
  if (!el || !g) return
  const myLogo = APP_TEAMS[_currentTeamKey]?.logoSrc ?? `${LOGO}/119.svg`
  const oppLogo = `${LOGO}/${g.logoId}.svg`
  const isHome = g.atVs === 'vs' || g.isHome === true
  const atVs = g.atVs || (isHome ? 'vs' : '@')
  const venue = g.venueName || g.venue || ''
  const dateStr = g.monthDay || g.dateShort || g.date || ''
  const leftLogo = isHome ? myLogo : oppLogo
  const rightLogo = isHome ? oppLogo : myLogo
  el.innerHTML = `
    <div class="hero-next-label">Next Game</div>
    ${venue ? `<div class="hero-next-venue">${venue}</div>` : ''}
    <div class="hero-next-matchup">
      <img class="hero-next-logo" src="${leftLogo}" alt="">
      <span class="hero-next-sep">${atVs}</span>
      <img class="hero-next-logo" src="${rightLogo}" alt="${g.opponent}">
      <span class="hero-next-team">${g.opponent}</span>
    </div>
    <div class="hero-next-time">${dateStr ? dateStr + ' \u00b7 ' : ''}${g.time}</div>`
}

/* ── Last Game Score Display ── */
function renderLgScore(scoreStr) {
  const el = document.getElementById('lg-score')
  if (!el || !scoreStr) return
  const parts = scoreStr.split(',').map(s => s.trim())
  if (parts.length !== 2) return
  const [a1, s1] = parts[0].split(' ')
  const [a2, s2] = parts[1].split(' ')
  el.innerHTML = `
    <div class="lgs-side"><span class="lgs-abbr">${a1}</span><span class="lgs-num">${s1}</span></div>
    <span class="lgs-sep">\u2014</span>
    <div class="lgs-side"><span class="lgs-num">${s2}</span><span class="lgs-abbr">${a2}</span></div>`
}

/* ── Live Data Loading (uses api.js) ── */
async function loadLiveData() {
  const key = _currentTeamKey
  const t = APP_TEAMS[key]
  if (!t) return

  const [statsResult, scheduleResult, lastGameResult] = await Promise.allSettled([
    fetchTeamStats(t.id),
    fetchSchedule(t.id),
    fetchLastGame(t.id, t.teamAbbr),
  ])

  // Render stats
  if (statsResult.status === 'fulfilled' && statsResult.value && _currentTeamKey === key) {
    const stats = statsResult.value
    document.querySelector('.team-stats').innerHTML = stats.map(s => `
      <div class="stat-item">
        <span class="stat-val">${s.val}</span>
        <span class="stat-lbl">${s.lbl}</span>
        ${s.rank ? `<span class="stat-rank">${s.rank}</span>` : ''}
      </div>`).join('')
    const mhcStats = document.getElementById('mhc-stats')
    if (mhcStats) {
      mhcStats.innerHTML = stats.slice(0, 6).map(s => `
        <div>
          <div class="mhc-stat-val">${s.val}</div>
          <div class="mhc-stat-lbl">${s.lbl}</div>
          ${s.rank ? `<div class="mhc-stat-rank">${s.rank}</div>` : ''}
        </div>`).join('')
    }
  }

  // Render schedule + next game
  let nextGame = null
  if (scheduleResult.status === 'fulfilled' && scheduleResult.value?.length && _currentTeamKey === key) {
    const games = scheduleResult.value
    renderSchedule(games)
    const today = new Date().toLocaleDateString('en-CA')
    nextGame = games.find(g => g.isoDate >= today) || games[0]
    if (nextGame) {
      renderNextGame(nextGame)
      renderMobHomeCards(t,
        statsResult.status === 'fulfilled' ? statsResult.value : null,
        lastGameResult.status === 'fulfilled' ? lastGameResult.value : null,
        nextGame)
    }
  }

  // Render last game
  if (lastGameResult.status === 'fulfilled' && lastGameResult.value && _currentTeamKey === key) {
    const data = lastGameResult.value
    document.querySelector('.performers-date').textContent = data.date
    renderLgScore(data.score)
    document.querySelector('.performers').innerHTML = data.performers.map(p => `
      <div class="performer">
        <span class="p-name">${p.name}</span>
        <span class="p-line">${p.line}</span>
      </div>`).join('')
    const mhcLG = document.getElementById('mhc-last-game')
    if (mhcLG) {
      mhcLG.innerHTML = `
        <div class="mhc-lg-score">${data.score}</div>
        ${data.performers.slice(0, 3).map(p => `
          <div class="mhc-performer">
            <span class="mhc-p-name">${p.name}</span>
            <span class="mhc-p-line">${p.line}</span>
          </div>`).join('')}`
    }
  } else if (_currentTeamKey === key) {
    document.querySelector('.performers-date').textContent = ''
    document.querySelector('.performers').innerHTML = '<div style="font-size:0.65rem;color:rgba(255,255,255,0.25)">No recent games</div>'
  }
}

/* ── News ── */
async function loadNews() {
  try {
    const espnId = APP_TEAMS[_currentTeamKey]?.espnId ?? 19
    const [teamArticles, mlbArticles] = await Promise.all([
      fetchNews(espnId),
      fetchMLBNews()
    ])
    _newsArticles = teamArticles ?? []
    const teamIds = new Set(_newsArticles.map(a => a.headline))
    _mlbNewsArticles = (mlbArticles ?? []).filter(a => !teamIds.has(a.headline))

    const mhcHL = document.getElementById('mhc-hl-text')
    if (mhcHL && _newsArticles.length) {
      const a = _newsArticles[0]
      mhcHL.style.color = ''
      mhcHL.style.fontSize = ''
      mhcHL.innerHTML = `<a href="${a.href}" target="_blank" rel="noopener">${a.headline}</a>`
    }
    if (_currentView === 'news') renderNewsPage()
  } catch (e) {
    _newsArticles = []
    _mlbNewsArticles = []
  }
}

function _newsCardHTML(a) {
  const img = a.image ?? ''
  const href = a.href ?? '#'
  const ago = timeAgo(a.published)
  return `<a class="news-card" href="${href}" target="_blank" rel="noopener">
    ${img ? `<img class="news-card-img" src="${img}" alt="" loading="lazy">` : ''}
    <div class="news-card-body">
      <div class="news-card-headline">${a.headline}</div>
      <div class="news-card-meta">${ago}</div>
    </div>
  </a>`
}

function renderNewsPage() {
  const loading = document.getElementById('news-page-loading')
  const featured = document.getElementById('news-featured')
  const grid = document.getElementById('news-page-grid')
  const mlbSec = document.getElementById('news-mlb-section')
  const mlbGrid = document.getElementById('news-mlb-grid')
  const sub = document.getElementById('news-page-sub')
  if (!grid) return
  if (!_newsArticles.length && !_mlbNewsArticles.length) {
    if (loading) loading.style.display = ''
    if (featured) featured.innerHTML = ''
    grid.innerHTML = ''
    if (mlbSec) mlbSec.style.display = 'none'
    return
  }
  if (loading) loading.style.display = 'none'
  const teamName = APP_TEAMS[_currentTeamKey]?.name ?? 'MLB'
  if (sub) sub.textContent = `${teamName} \u00b7 Latest headlines`
  if (featured && _newsArticles.length) {
    const a = _newsArticles[0]
    const img = a.image ?? ''
    const href = a.href ?? '#'
    const ago = timeAgo(a.published)
    const desc = a.description ?? ''
    featured.innerHTML = `<a class="news-featured-card" href="${href}" target="_blank" rel="noopener">
      ${img ? `<img class="news-featured-img" src="${img}" alt="" loading="lazy">` : ''}
      <div class="news-featured-body">
        <div class="news-featured-tag">Top Story</div>
        <div class="news-featured-headline">${a.headline}</div>
        ${desc ? `<div class="news-featured-desc">${desc}</div>` : ''}
        <div class="news-featured-meta">${ago}</div>
      </div>
    </a>`
  }
  const rest = _newsArticles.slice(1)
  grid.innerHTML = rest.map(a => _newsCardHTML(a)).join('')
  if (mlbSec && mlbGrid && _mlbNewsArticles.length) {
    mlbSec.style.display = ''
    mlbGrid.innerHTML = _mlbNewsArticles.map(a => _newsCardHTML(a)).join('')
  } else if (mlbSec) {
    mlbSec.style.display = 'none'
  }
}

function renderNewsPanel() {
  const panel = document.getElementById('sp-news')
  if (!panel) return
  if (!_newsArticles.length) {
    panel.innerHTML = '<div class="news-loading" style="padding:3rem 1rem">No news available</div>'
    return
  }
  panel.innerHTML = `<div class="news-panel-grid">${_newsArticles.slice(0, 8).map(a => _newsCardHTML(a)).join('')}</div>`
}

/* ── Schedule ── */
function renderSchedule(games) {
  _allScheduleGames = games
  applyScheduleFilters()
}

function toggleFilterSheet() {
  const sheet = document.getElementById('sched-filter-sheet')
  const isOpen = sheet.style.display !== 'none' && sheet.style.display !== ''
  sheet.style.display = isOpen ? 'none' : 'block'
}

function applyScheduleFilters() {
  const homeChk = document.getElementById('filter-home')?.checked ?? false
  const awayChk = document.getElementById('filter-away')?.checked ?? false
  const weekdayChk = document.getElementById('filter-weekday')?.checked ?? false
  const weekendChk = document.getElementById('filter-weekend')?.checked ?? false

  _filteredGames = _allScheduleGames.filter(g => {
    const isWeekend = ['Saturday', 'Sunday'].includes(g.weekday)
    const locationOk = (!homeChk && !awayChk) || (homeChk && g.isHome) || (awayChk && !g.isHome)
    const dayOk = (!weekdayChk && !weekendChk) || (weekdayChk && !isWeekend) || (weekendChk && isWeekend)
    return locationOk && dayOk
  })

  const count = [homeChk, awayChk, weekdayChk, weekendChk].filter(Boolean).length
  const badge = document.getElementById('filter-badge')
  const btn = document.getElementById('filter-trigger-btn')
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none' }
  if (btn) btn.classList.toggle('has-filters', count > 0)

  const list = document.getElementById('schedule-list')
  if (!list) return
  if (_filteredGames.length === 0) {
    list.innerHTML = '<div style="padding:2rem 1.25rem;font-size:0.72rem;color:rgba(255,255,255,0.25);text-align:center">No games match this filter</div>'
    return
  }
  list.innerHTML = _filteredGames.map((g, i) => `
    <div class="schedule-row" onclick="openGameDetail(${i})">
      <div class="sr-date">
        <span class="sr-day">${g.day}</span>
        <span class="sr-monthday">${g.monthDay}</span>
      </div>
      <div class="sr-opponent">
        <img class="sr-logo" src="${LOGO}/${g.logoId}.svg" alt="${g.opponent}">
        <div class="sr-opp-info">
          <span class="sr-at-vs">${g.atVs}</span>
          <span class="sr-name">${g.opponent}</span>
        </div>
      </div>
      <span class="sr-time">${g.time}</span>
      <span class="sr-chevron">\u203a</span>
    </div>`).join('')
}

function clearScheduleFilters() {
  ;['filter-home', 'filter-away', 'filter-weekday', 'filter-weekend'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.checked = false
  })
  applyScheduleFilters()
}

function openGameDetail(idx) {
  const g = _filteredGames[idx]
  if (!g) return
  document.getElementById('filter-trigger-btn').style.display = 'none'
  document.getElementById('sched-filter-sheet').style.display = 'none'
  document.getElementById('schedule-list').style.display = 'none'
  document.getElementById('game-detail').style.display = 'flex'

  const t = APP_TEAMS[_currentTeamKey] ?? APP_TEAMS.dodgers
  const myTeamId = t.id
  const homeName = g.isHome ? t.name : g.opponent
  const awayName = g.isHome ? g.opponent : t.name
  const homeLogoId = g.isHome ? myTeamId : g.logoId
  const awayLogoId = g.isHome ? g.logoId : myTeamId
  const gameUrl = `https://www.mlb.com/gameday/${g.gamePk}`
  const homeLabel = g.isHome ? `Home \u00b7 ${t.venueName ?? 'Home Stadium'}` : 'Away'

  document.getElementById('gd-scroll').innerHTML = `
    <div class="gd-date-label">${g.fullDate}</div>
    <div class="gd-matchup">
      <div class="gd-team">
        <img class="gd-team-logo" src="${LOGO}/${awayLogoId}.svg" alt="${awayName}">
        <span class="gd-team-name">${awayName}</span>
      </div>
      <span class="gd-vs">@</span>
      <div class="gd-team">
        <img class="gd-team-logo" src="${LOGO}/${homeLogoId}.svg" alt="${homeName}">
        <span class="gd-team-name">${homeName}</span>
      </div>
    </div>
    <div class="gd-info-grid">
      <div class="gd-info-row">
        <span class="gd-info-label">First Pitch</span>
        <span class="gd-info-val">${g.time}</span>
      </div>
      <div class="gd-info-row">
        <span class="gd-info-label">Venue</span>
        <span class="gd-info-val">${g.venueName || '\u2014'}</span>
      </div>
      ${g.tv ? `<div class="gd-info-row">
        <span class="gd-info-label">TV</span>
        <span class="gd-info-val">${g.tv}</span>
      </div>` : ''}
      <div class="gd-info-row">
        <span class="gd-info-label">Location</span>
        <span class="gd-info-val">${homeLabel}</span>
      </div>
    </div>
    <a class="gd-tickets-btn" href="${gameUrl}" target="_blank" rel="noopener">Get Tickets</a>`
}

function closeGameDetail() {
  document.getElementById('game-detail').style.display = 'none'
  document.getElementById('filter-trigger-btn').style.display = ''
  document.getElementById('sched-filter-sheet').style.display = 'none'
  document.getElementById('schedule-list').style.display = ''
}

/* ── Settings Dropdown ── */
function toggleSettingsDropdown() {
  const btn = document.getElementById('bar-settings-btn')
  const dd = document.getElementById('settings-dropdown')
  if (!btn || !dd) return
  dd.classList.toggle('open')
  btn.classList.toggle('open')
}

function closeSettingsDropdown() {
  document.getElementById('settings-dropdown')?.classList.remove('open')
  document.getElementById('bar-settings-btn')?.classList.remove('open')
}

/* ── Event Listeners ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMoreSheet(); closeWsModal(); closeSettingsDropdown() }
})
document.addEventListener('click', e => {
  if (!e.target.closest('#bar-settings-btn') && !e.target.closest('#settings-dropdown')) closeSettingsDropdown()
})

/* ── Side Panel ── */
function togglePanel() {
  document.getElementById('side-panel').classList.toggle('open')
  document.getElementById('panel-backdrop').classList.toggle('open')
}

function closePanel() {
  document.getElementById('side-panel').classList.remove('open')
  document.getElementById('panel-backdrop').classList.remove('open')
  document.getElementById('filter-trigger-btn').style.display = 'none'
  _setMobTab(_currentView)
}

function openSidePanel(tab) {
  if (tab === 'schedule') closeGameDetail()
  document.getElementById('side-panel').classList.add('open')
  document.getElementById('panel-backdrop').classList.add('open')
  switchSideTab(tab)
  if (tab === 'news') renderNewsPanel()
  document.querySelectorAll('.rn-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === tab)
  })
  _setMobTab(tab)
  const titles = { schedule: 'Schedule', roster: '40-Man Roster', news: 'News' }
  const titleEl = document.getElementById('sp-title')
  if (titleEl && titles[tab]) titleEl.textContent = titles[tab]
  document.getElementById('filter-trigger-btn').style.display = tab === 'schedule' ? '' : 'none'
}

function switchSideTab(id) {
  const tabs = document.getElementById('sp-tabs')
  if (tabs) tabs.style.display = (id === 'news') ? 'none' : ''
  document.querySelectorAll('.sp-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['schedule', 'roster'][i] === id)
  })
  document.querySelectorAll('.sp-panel').forEach(p => {
    p.classList.toggle('active', p.id === `sp-${id}`)
  })
  if (id === 'roster' && !rosterLoaded) { rosterLoaded = true; loadRoster() }
}

/* ── 40-Man Roster ── */
async function loadRoster() {
  const el = document.getElementById('sp-roster')
  el.innerHTML = '<div class="roster-placeholder">Loading\u2026</div>'
  try {
    const teamId = APP_TEAMS[_currentTeamKey]?.id ?? 119
    const roster = await fetchRoster(teamId)
    renderRoster(roster)
  } catch (e) {
    el.innerHTML = '<div class="roster-placeholder">Could not load roster</div>'
  }
}

function renderRoster(roster) {
  const ORDER = ['Two-Way Player', 'Pitcher', 'Catcher', 'Infielder', 'Outfielder', 'Hitter']
  const LABELS = {
    'Two-Way Player': 'Two-Way Players', 'Pitcher': 'Pitchers', 'Catcher': 'Catchers',
    'Infielder': 'Infielders', 'Outfielder': 'Outfielders', 'Hitter': 'Designated Hitters',
  }
  const groups = {}
  ORDER.forEach(k => groups[k] = [])
  for (const p of roster) {
    const t = p.position?.type ?? 'Hitter'
    ;(groups[t] ?? groups['Hitter']).push(p)
  }
  document.getElementById('sp-roster').innerHTML = ORDER
    .filter(k => groups[k].length > 0)
    .map(k => `
      <div class="roster-group">
        <div class="roster-group-title">${LABELS[k]}</div>
        ${groups[k].map(p => `
          <div class="roster-row" onclick="openPlayerOverlay(${p.person.id},'${(p.position?.type || '').replace(/'/g, "\\'")}','${p.jerseyNumber || ''}','${p.person.fullName.replace(/'/g, "\\'")}','${p.position.abbreviation}')">
            <span class="roster-num">${p.jerseyNumber || '\u2013'}</span>
            <span class="roster-name">${p.person.fullName}</span>
            <span class="roster-pos">${p.position.abbreviation}</span>
            <span class="roster-chevron">\u203a</span>
          </div>`).join('')}
      </div>`).join('')
}

/* ── Player Overlay ── */
function openPlayerOverlay(id, posType, jersey, name, posAbbr) {
  const teamKey = document.body.dataset.team || 'dodgers'
  const t = APP_TEAMS[teamKey] ?? APP_TEAMS.dodgers
  document.getElementById('po-team-label').textContent = t.name
  document.getElementById('po-jersey-num').textContent = jersey ? `#${jersey}` : ''
  document.getElementById('po-name').textContent = name
  document.getElementById('po-pos').textContent = `${posAbbr} \u00b7 ${t.name}`
  const backLogo = document.getElementById('po-back-logo')
  if (backLogo) backLogo.src = t.logoSrc
  const img = document.getElementById('po-headshot')
  img.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${id}/headshot/silo/current`
  img.alt = name
  document.getElementById('po-bio').innerHTML = ''
  document.getElementById('po-summary').style.display = 'none'
  document.getElementById('po-stats').innerHTML = '<div class="pd-loading">Loading\u2026</div>'
  document.getElementById('po-scroll').scrollTop = 0
  document.getElementById('player-overlay').classList.add('open')
  document.body.style.overflow = 'hidden'
  fetchPlayerStatsOverlay(id, posType)
}

function closePlayerOverlay() {
  document.getElementById('player-overlay').classList.remove('open')
  document.body.style.overflow = ''
}

async function fetchPlayerStatsOverlay(playerId, posType) {
  try {
    const person = await fetchPlayerStats(playerId)
    if (!person) { document.getElementById('po-stats').innerHTML = '<div class="pd-loading">No stats available</div>'; return }
    const stats = person.stats ?? []
    const get = (group, type) =>
      stats.find(s => s.group.displayName === group && s.type.displayName === type)?.splits?.[0]?.stat ?? null

    const bioEl = document.getElementById('po-bio')
    if (bioEl) {
      const items = [
        person.currentAge && { lbl: 'Age', val: person.currentAge },
        person.height && { lbl: 'Height', val: person.height },
        person.weight && { lbl: 'Weight', val: `${person.weight} lbs` },
        person.batSide?.description && { lbl: 'Bats', val: person.batSide.description },
        person.pitchHand?.description && { lbl: 'Throws', val: person.pitchHand.description },
        (person.birthCity || person.birthCountry) && {
          lbl: 'Born', val: [person.birthCity, person.birthCountry].filter(Boolean).join(', ')
        },
        person.mlbDebutDate && { lbl: 'Debut', val: new Date(person.mlbDebutDate).getFullYear() },
      ].filter(Boolean)
      bioEl.innerHTML = items.map(i =>
        `<div class="po-bio-item"><span class="po-bio-label">${i.lbl}</span><span>${i.val}</span></div>`
      ).join('')
    }

    const isPit = posType === 'Pitcher'
    const isTW = posType === 'Two-Way Player'

    const summaryEl = document.getElementById('po-summary')
    if (summaryEl) {
      const sh = !isPit ? get('hitting', 'season') : null
      const sp = (isPit || isTW) ? get('pitching', 'season') : null
      const summaryStats = sh
        ? [{ v: sh.avg, l: 'AVG' }, { v: sh.homeRuns, l: 'HR' }, { v: sh.rbi, l: 'RBI' }, { v: sh.ops, l: 'OPS' }]
        : sp
        ? [{ v: sp.era, l: 'ERA' }, { v: `${sp.wins ?? 0}-${sp.losses ?? 0}`, l: 'W-L' }, { v: sp.strikeOuts, l: 'K' }, { v: sp.whip, l: 'WHIP' }]
        : []
      if (summaryStats.length) {
        summaryEl.innerHTML = summaryStats.map(s => `
          <div class="po-summary-stat">
            <span class="po-summary-season">${SEASON}</span>
            <span class="po-summary-val">${s.v ?? '\u2013'}</span>
            <span class="po-summary-lbl">${s.l}</span>
          </div>`).join('')
        summaryEl.style.display = ''
      }
    }

    let html = ''
    if (!isPit) {
      const sh = get('hitting', 'season'), ch = get('hitting', 'career')
      if (sh) { const g = hitGrid(sh); html += statSection(`${SEASON} Season \u00b7 Batting`, g.primary, g.secondary) }
      if (ch) { const g = hitGrid(ch); html += statSection('Career \u00b7 Batting', g.primary, g.secondary) }
    }
    if (isPit || isTW) {
      const sp = get('pitching', 'season'), cp = get('pitching', 'career')
      if (sp) { const g = pitGrid(sp); html += statSection(`${SEASON} Season \u00b7 Pitching`, g.primary, g.secondary) }
      if (cp) { const g = pitGrid(cp); html += statSection('Career \u00b7 Pitching', g.primary, g.secondary) }
    }
    document.getElementById('po-stats').innerHTML = html || '<div class="pd-loading">No stats available</div>'
  } catch (e) {
    document.getElementById('po-stats').innerHTML = '<div class="pd-loading">Could not load stats</div>'
  }
}

function statSection(title, primaryHtml, secondaryHtml) {
  return `<div class="pd-section">
    <div class="pd-section-title">${title}</div>
    <div class="pd-stat-grid">${primaryHtml}</div>
    ${secondaryHtml ? `<div class="pd-stat-grid" style="border-top:1px solid rgba(255,255,255,0.05)">${secondaryHtml}</div>` : ''}
  </div>`
}

function pdStat(val, lbl) {
  return `<div class="pd-stat"><span class="pd-stat-val">${val ?? '\u2013'}</span><span class="pd-stat-lbl">${lbl}</span></div>`
}

function hitGrid(s) {
  const primary = [pdStat(s.avg, 'AVG'), pdStat(s.homeRuns, 'HR'), pdStat(s.rbi, 'RBI'), pdStat(s.ops, 'OPS')].join('')
  const secondary = [
    pdStat(s.gamesPlayed, 'G'), pdStat(s.atBats, 'AB'), pdStat(s.hits, 'H'), pdStat(s.doubles, '2B'),
    pdStat(s.stolenBases, 'SB'), pdStat(s.baseOnBalls, 'BB'), pdStat(s.strikeOuts, 'K'), pdStat(s.obp, 'OBP'),
  ].join('')
  return { primary, secondary }
}

function pitGrid(s) {
  const primary = [
    pdStat(s.era, 'ERA'), pdStat(`${s.wins ?? 0}-${s.losses ?? 0}`, 'W-L'),
    pdStat(s.strikeOuts, 'K'), pdStat(s.whip, 'WHIP'),
  ].join('')
  const secondary = [
    pdStat(s.gamesPlayed, 'G'), pdStat(s.gamesStarted, 'GS'), pdStat(s.inningsPitched, 'IP'), pdStat(s.hits, 'H'),
    pdStat(s.baseOnBalls, 'BB'), pdStat(s.homeRuns, 'HR'), pdStat(s.strikeoutsPer9Inn, 'K/9'), pdStat(s.walksPer9Inn, 'BB/9'),
  ].join('')
  return { primary, secondary }
}

/* ── Settings ── */
function renderSettingsTeams() {
  const list = document.getElementById('settings-team-list')
  if (!list) return
  /* Only show the current team (each subdirectory is its own team page) */
  const teams = _urlTeam
    ? Object.entries(APP_TEAMS)
    : Object.entries(APP_TEAMS).filter(([key]) => key === 'dodgers')
  list.innerHTML = teams.map(([key, t]) => `
    <div class="settings-team-row ${key === _currentTeamKey ? 'active' : ''}" data-team="${key}" onclick="settingsPickTeam('${key}')">
      <img src="${t.logoSrc}" alt="${t.nameShort}">
      <div class="settings-team-info">
        <div class="settings-team-name">${t.name}</div>
        <div class="settings-team-div">${t.division}</div>
      </div>
      <span class="settings-team-check">\u2713</span>
    </div>
  `).join('')
  const msg = document.getElementById('settings-saved-msg')
  if (msg) msg.classList.remove('show')
}

function settingsPickTeam(key) {
  switchTeam(key)
  renderSettingsTeams()
}

function settingsSaveTeam() {
  localStorage.setItem('defaultTeam', _currentTeamKey)
  localStorage.setItem('selectedTeam', _currentTeamKey)
  const msg = document.getElementById('settings-saved-msg')
  if (!msg) return
  msg.classList.add('show')
  setTimeout(() => msg.classList.remove('show'), 2200)
}

function switchTeam(key) {
  renderTeam(key)
}

/* ── View Switching ── */
function switchView(view) {
  _currentView = view
  /* always start on home - no view persistence */
  closePanel()
  document.body.classList.toggle('no-left-sidebar', view !== 'home')
  const allViews = ['home', 'live', 'depth', 'contracts', 'news', 'settings']
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`)
    if (el) el.classList.toggle('active', v === view)
  })
  if (view === 'live' && _lastLiveData) renderFullLiveGame(_lastLiveData)
  if (view === 'depth') loadDepthChart()
  if (view === 'contracts') loadContracts(_currentTeamKey)
  if (view === 'news') renderNewsPage()
  if (view === 'settings') renderSettingsTeams()
  document.querySelectorAll('.rn-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view)
  })
  _setMobTab(view)
}

function _setMobTab(view) {
  document.querySelectorAll('.mob-tab, .mob-tab-center').forEach(b => b.classList.remove('active'))
  if (view === 'live') {
    const t = document.getElementById('mobtab-live')
    if (t) t.classList.add('active')
  } else if (view === 'home') {
    const t = document.getElementById('mobtab-home')
    if (t) t.classList.add('active')
  } else {
    const t = document.getElementById('mobtab-more')
    if (t) t.classList.add('active')
  }
}

/* ── Demo Live Data (2025 WS Game 7 — Full Game) ── */
function getDemoLiveData() {
  const T = true, B = false
  const p = (inn, top, evt, desc) => ({ about: { inning: inn, isTopInning: top }, result: { event: evt, description: desc } })
  return {
    gameData: {
      status: { abstractGameState: 'Final' },
      teams: {
        away: { team: { id: 141, abbreviation: 'TOR', name: 'Toronto Blue Jays' } },
        home: { team: { id: 119, abbreviation: 'LAD', name: 'Los Angeles Dodgers' } },
      }
    },
    liveData: {
      linescore: {
        currentInning: 11, isTopInning: true,
        balls: 2, strikes: 3, outs: 3, offense: {},
        innings: [
          { num: 1,  away: { runs: 0 }, home: { runs: 0 } },
          { num: 2,  away: { runs: 0 }, home: { runs: 0 } },
          { num: 3,  away: { runs: 1 }, home: { runs: 0 } },
          { num: 4,  away: { runs: 0 }, home: { runs: 1 } },
          { num: 5,  away: { runs: 0 }, home: { runs: 0 } },
          { num: 6,  away: { runs: 2 }, home: { runs: 0 } },
          { num: 7,  away: { runs: 0 }, home: { runs: 1 } },
          { num: 8,  away: { runs: 0 }, home: { runs: 0 } },
          { num: 9,  away: { runs: 0 }, home: { runs: 1 } },
          { num: 10, away: { runs: 0 }, home: { runs: 1 } },
          { num: 11, away: { runs: 0 }, home: {} },
        ],
        teams: { away: { runs: 3, hits: 7, errors: 0 }, home: { runs: 4, hits: 9, errors: 1 } }
      },
      plays: {
        currentPlay: {
          matchup: {
            batter:  { fullName: 'Vladimir Guerrero Jr.' },
            pitcher: { fullName: 'Yoshinobu Yamamoto' },
          },
          result: { description: 'Vladimir Guerrero Jr. strikes out swinging. Yoshinobu Yamamoto closes it from the bullpen \u2014 Dodgers win the 2025 World Series!' },
          playEvents: [
            { isPitch: true, pitchData: { coordinates: { pX: 0.2, pZ: 1.1 }, startSpeed: 90, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'B', type: { description: 'Splitter' }, description: 'Ball' } },
            { isPitch: true, pitchData: { coordinates: { pX: -0.6, pZ: 2.8 }, startSpeed: 98, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'C', type: { description: 'Four-Seam Fastball' }, description: 'Called Strike' } },
            { isPitch: true, pitchData: { coordinates: { pX: 1.1, pZ: 1.3 }, startSpeed: 86, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'B', type: { description: 'Slider' }, description: 'Ball' } },
            { isPitch: true, pitchData: { coordinates: { pX: 0.1, pZ: 2.5 }, startSpeed: 99, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'F', type: { description: 'Four-Seam Fastball' }, description: 'Foul' } },
            { isPitch: true, pitchData: { coordinates: { pX: 0.6, pZ: 1.8 }, startSpeed: 91, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'F', type: { description: 'Splitter' }, description: 'Foul' } },
            { isPitch: true, pitchData: { coordinates: { pX: 0.3, pZ: 1.2 }, startSpeed: 90, sz_top: 3.5, sz_bot: 1.5 },
              details: { code: 'S', type: { description: 'Splitter' }, description: 'Swinging Strike' } },
          ]
        },
        allPlays: [
          /* ── Top 1 ── */
          p(1,T,'Flyout','George Springer flies out to center fielder Andy Pages.'),
          p(1,T,'Groundout','Bo Bichette grounds out, shortstop Miguel Rojas to first baseman Freddie Freeman.'),
          p(1,T,'Lineout','Vladimir Guerrero Jr. lines out to right fielder Mookie Betts.'),
          /* ── Bottom 1 ── */
          p(1,B,'Strikeout','Shohei Ohtani called out on strikes.'),
          p(1,B,'Single','Mookie Betts singles on a ground ball to right field.'),
          p(1,B,'Grounded Into DP','Freddie Freeman grounds into a double play, shortstop Bo Bichette to second baseman Davis Schneider to first baseman Vladimir Guerrero Jr. Mookie Betts out at 2nd.'),
          /* ── Top 2 ── */
          p(2,T,'Walk','Alejandro Kirk walks on 5 pitches.'),
          p(2,T,'Sac Bunt','Daulton Varsho out on a sacrifice bunt, pitcher Walker Buehler to first baseman Freddie Freeman. Alejandro Kirk to 2nd.'),
          p(2,T,'Flyout','Addison Barger flies out to left fielder Teoscar Hernandez.'),
          p(2,T,'Groundout','Davis Schneider grounds out, second baseman Tommy Edman to first baseman Freddie Freeman.'),
          /* ── Bottom 2 ── */
          p(2,B,'Flyout','Teoscar Hernandez flies out to center fielder George Springer.'),
          p(2,B,'Single','Will Smith singles on a line drive to center field.'),
          p(2,B,'Strikeout','Tommy Edman strikes out swinging.'),
          p(2,B,'Groundout','Miguel Rojas grounds out, shortstop Bo Bichette to first baseman Vladimir Guerrero Jr.'),
          /* ── Top 3 ── */
          p(3,T,'Single','Kevin Kiermaier singles on a ground ball to left field.'),
          p(3,T,'Groundout','Spencer Horwitz grounds out, second baseman Tommy Edman to first baseman Freddie Freeman. Kevin Kiermaier to 2nd.'),
          p(3,T,'Flyout','George Springer flies out to right fielder Mookie Betts.'),
          p(3,T,'Single','Bo Bichette singles on a line drive to left field. Kevin Kiermaier scores.'),
          p(3,T,'Flyout','Vladimir Guerrero Jr. flies out to center fielder Andy Pages.'),
          /* ── Bottom 3 ── */
          p(3,B,'Groundout','Gavin Lux grounds out, third baseman Addison Barger to first baseman Vladimir Guerrero Jr.'),
          p(3,B,'Strikeout','Andy Pages strikes out swinging.'),
          p(3,B,'Groundout','Shohei Ohtani grounds out, second baseman Davis Schneider to first baseman Vladimir Guerrero Jr.'),
          /* ── Top 4 ── */
          p(4,T,'Flyout','Alejandro Kirk flies out to left fielder Teoscar Hernandez.'),
          p(4,T,'Strikeout','Daulton Varsho called out on strikes.'),
          p(4,T,'Groundout','Addison Barger grounds out, shortstop Miguel Rojas to first baseman Freddie Freeman.'),
          /* ── Bottom 4 ── */
          p(4,B,'Home Run','Mookie Betts homers (1) on a fly ball to left center field.'),
          p(4,B,'Single','Freddie Freeman singles on a ground ball to right field.'),
          p(4,B,'Strikeout','Teoscar Hernandez strikes out swinging.'),
          p(4,B,'Flyout','Will Smith flies out to center fielder George Springer.'),
          p(4,B,'Groundout','Tommy Edman grounds out, pitcher Jose Berrios to first baseman Vladimir Guerrero Jr.'),
          /* ── Top 5 ── */
          p(5,T,'Flyout','Davis Schneider flies out to center fielder Andy Pages.'),
          p(5,T,'Groundout','Kevin Kiermaier grounds out, third baseman Gavin Lux to first baseman Freddie Freeman.'),
          p(5,T,'Strikeout','Spencer Horwitz called out on strikes.'),
          /* ── Bottom 5 ── */
          p(5,B,'Lineout','Miguel Rojas lines out to second baseman Davis Schneider.'),
          p(5,B,'Single','Gavin Lux singles on a ground ball to center field.'),
          p(5,B,'Flyout','Andy Pages flies out to right fielder Kevin Kiermaier.'),
          p(5,B,'Groundout','Shohei Ohtani grounds out, first baseman Vladimir Guerrero Jr. to pitcher Jose Berrios covering.'),
          /* ── Top 6 ── */
          p(6,T,'Single','George Springer singles on a line drive to right field.'),
          p(6,T,'Strikeout','Bo Bichette strikes out swinging.'),
          p(6,T,'Home Run','Vladimir Guerrero Jr. homers (2) on a fly ball to left field. George Springer scores.'),
          p(6,T,'Groundout','Alejandro Kirk grounds out, shortstop Miguel Rojas to first baseman Freddie Freeman.'),
          p(6,T,'Flyout','Daulton Varsho flies out to center fielder Andy Pages.'),
          /* ── Bottom 6 ── */
          p(6,B,'Walk','Mookie Betts walks on 4 pitches.'),
          p(6,B,'Flyout','Freddie Freeman flies out to right fielder Kevin Kiermaier.'),
          p(6,B,'Strikeout','Teoscar Hernandez strikes out swinging.'),
          p(6,B,'Flyout','Will Smith flies out to left fielder Daulton Varsho.'),
          /* ── Top 7 ── */
          p(7,T,'Strikeout','Addison Barger called out on strikes.'),
          p(7,T,'Groundout','Davis Schneider grounds out, shortstop Miguel Rojas to first baseman Freddie Freeman.'),
          p(7,T,'Flyout','Kevin Kiermaier flies out to center fielder Andy Pages.'),
          /* ── Bottom 7 ── */
          p(7,B,'Flyout','Tommy Edman flies out to left fielder Daulton Varsho.'),
          p(7,B,'Strikeout','Miguel Rojas strikes out looking.'),
          p(7,B,'Walk','Shohei Ohtani walks on 6 pitches.'),
          p(7,B,'Double','Freddie Freeman doubles (3) on a sharp line drive to right field. Shohei Ohtani scores.'),
          p(7,B,'Groundout','Teoscar Hernandez grounds out, shortstop Bo Bichette to first baseman Vladimir Guerrero Jr.'),
          /* ── Top 8 ── */
          p(8,T,'Groundout','Spencer Horwitz grounds out, second baseman Tommy Edman to first baseman Freddie Freeman.'),
          p(8,T,'Single','George Springer singles on a ground ball to center field.'),
          p(8,T,'Grounded Into DP','Bo Bichette grounds into a double play, shortstop Miguel Rojas to second baseman Tommy Edman to first baseman Freddie Freeman. George Springer out at 2nd.'),
          /* ── Bottom 8 ── */
          p(8,B,'Walk','Will Smith walks on 5 pitches.'),
          p(8,B,'Sac Bunt','Tommy Edman out on a sacrifice bunt, catcher Alejandro Kirk to first baseman Vladimir Guerrero Jr. Will Smith to 2nd.'),
          p(8,B,'Flyout','Miguel Rojas flies out to center fielder George Springer.'),
          p(8,B,'Strikeout','Gavin Lux strikes out swinging.'),
          /* ── Top 9 ── */
          p(9,T,'Flyout','Vladimir Guerrero Jr. flies out to deep center fielder Andy Pages.'),
          p(9,T,'Strikeout','Alejandro Kirk strikes out swinging.'),
          p(9,T,'Groundout','Daulton Varsho grounds out, third baseman Gavin Lux to first baseman Freddie Freeman.'),
          /* ── Bottom 9 ── */
          p(9,B,'Strikeout','Andy Pages strikes out looking.'),
          p(9,B,'Flyout','Teoscar Hernandez flies out to right fielder Kevin Kiermaier.'),
          p(9,B,'Double','Tommy Edman doubles on a fly ball to left-center field.'),
          p(9,B,'Single','Miguel Rojas singles on a ground ball to center field. Tommy Edman scores. Tie game, 3\u20133!'),
          p(9,B,'Groundout','Gavin Lux grounds out, second baseman Davis Schneider to first baseman Vladimir Guerrero Jr.'),
          /* ── Top 10 ── */
          p(10,T,'Strikeout','Addison Barger strikes out swinging.'),
          p(10,T,'Groundout','Davis Schneider grounds out, third baseman Gavin Lux to first baseman Freddie Freeman.'),
          p(10,T,'Flyout','George Springer flies out to center fielder Andy Pages.'),
          /* ── Bottom 10 ── */
          p(10,B,'Groundout','Mookie Betts grounds out, second baseman Davis Schneider to first baseman Vladimir Guerrero Jr.'),
          p(10,B,'Flyout','Freddie Freeman flies out to deep center fielder George Springer.'),
          p(10,B,'Home Run','Will Smith homers (2) on a fly ball to left-center field. Dodgers take the lead, 4\u20133!'),
          p(10,B,'Strikeout','Teoscar Hernandez strikes out swinging.'),
          /* ── Top 11 ── */
          p(11,T,'Groundout','Daulton Varsho grounds out, shortstop Miguel Rojas to first baseman Freddie Freeman.'),
          p(11,T,'Flyout','George Springer flies out to right fielder Mookie Betts.'),
          p(11,T,'Strikeout','Vladimir Guerrero Jr. strikes out swinging. Dodgers win the 2025 World Series!'),
        ]
      }
    }
  }
}

/* ── Live Game Tracker ── */
async function startLiveTracker() {
  try {
    const liveTeamId = APP_TEAMS[_currentTeamKey]?.id ?? 119
    const game = await fetchTodayGame(liveTeamId)
    if (!game) {
      /* No live game — show demo data (2025 WS Game 7 final out) */
      if (_currentTeamKey === 'dodgers') {
        const demo = getDemoLiveData()
        renderLiveGame(demo)
      }
      return
    }
    _liveGamePk = game.gamePk
    const state = game.status.abstractGameState
    if (state === 'Live' || state === 'Final') {
      await updateLiveGame()
      if (state === 'Live') _liveTimer = setInterval(updateLiveGame, 2000)
    }
  } catch (e) { console.warn('Live tracker:', e) }
}

async function updateLiveGame() {
  if (!_liveGamePk) return
  try {
    const data = await fetchLiveGameFeed(_liveGamePk)
    renderLiveGame(data)
  } catch (e) {}
}

function renderLiveGame(data) {
  _lastLiveData = data
  const card = document.getElementById('live-game-card')
  if (!card) return

  const gs = data.gameData.status
  const ls = data.liveData.linescore
  const away = data.gameData.teams.away.team
  const home = data.gameData.teams.home.team
  const isLive = gs.abstractGameState === 'Live'
  const isFinal = gs.abstractGameState === 'Final'

  const sbBadge = document.getElementById('sb-live-badge')
  if (sbBadge) sbBadge.style.display = isLive ? 'inline' : 'none'
  const mobDot = document.getElementById('mob-live-dot')
  if (mobDot) mobDot.style.display = isLive ? 'block' : 'none'

  const awayRuns = ls.teams?.away?.runs ?? 0
  const homeRuns = ls.teams?.home?.runs ?? 0
  const inning = ls.currentInning ?? 1
  const isTop = ls.isTopInning ?? true
  const balls = ls.balls ?? 0
  const strikes = ls.strikes ?? 0
  const outs = ls.outs ?? 0
  const first = !!ls.offense?.first
  const second = !!ls.offense?.second
  const third = !!ls.offense?.third
  const batter = data.liveData.plays?.currentPlay?.matchup?.batter?.fullName ?? ''
  const pitcher = data.liveData.plays?.currentPlay?.matchup?.pitcher?.fullName ?? ''
  const lastPlay = data.liveData.plays?.currentPlay?.result?.description ?? ''
  const inningStr = isFinal ? 'Final' : `${isTop ? '\u25b2' : '\u25bc'}\u00a0${inning}`
  const awayBatting = isLive && isTop
  const homeBatting = isLive && !isTop

  function dots(count, max, cls) {
    return Array.from({ length: max }, (_, i) =>
      `<span class="count-dot ${i < count ? cls : ''}"></span>`).join('')
  }

  const isDemo = !_liveGamePk && isFinal
  card.style.display = 'block'
  card.innerHTML = `
    <div class="dash-card-header">
      <span class="dash-card-label">${isFinal ? 'Final Score' : 'Live Game'}</span>
      ${isLive ? '<span class="live-pill"><span class="live-dot"></span>LIVE</span>' : ''}
    </div>
    ${isDemo ? '<div style="font-size:0.55rem;color:rgba(255,255,255,0.35);text-align:center;margin:-0.2rem 0 0.3rem;letter-spacing:0.04em">2025 World Series \u00b7 Game 7</div>' : ''}
    <div class="live-score">
      <div class="live-team">
        <img class="live-logo" src="${LOGO}/${away.id}.svg" alt="${away.abbreviation}">
        <span class="live-abbr">${away.abbreviation}</span>
        <span class="live-runs${awayBatting ? ' batting' : ''}">${awayRuns}</span>
      </div>
      <span class="live-inning">${inningStr}</span>
      <div class="live-team">
        <span class="live-runs${homeBatting ? ' batting' : ''}">${homeRuns}</span>
        <span class="live-abbr">${home.abbreviation}</span>
        <img class="live-logo" src="${LOGO}/${home.id}.svg" alt="${home.abbreviation}">
      </div>
    </div>
    ${isLive ? `
    <div class="live-details">
      <div class="live-bases-count">
        <div class="bases-wrap">
          <div class="base base-2b ${second ? 'on' : ''}"></div>
          <div class="base base-3b ${third ? 'on' : ''}"></div>
          <div class="base base-1b ${first ? 'on' : ''}"></div>
          <div class="base base-home"></div>
        </div>
        <div class="count-wrap">
          <div class="count-row"><span class="count-lbl">B</span>${dots(balls, 3, 'ball')}</div>
          <div class="count-row"><span class="count-lbl">S</span>${dots(strikes, 2, 'strike')}</div>
          <div class="count-row"><span class="count-lbl">O</span>${dots(outs, 2, 'out')}</div>
        </div>
      </div>
      ${batter ? `<div class="live-matchup-row"><span class="live-role">AB</span><span class="live-player">${batter}</span></div>` : ''}
      ${pitcher ? `<div class="live-matchup-row"><span class="live-role">P</span><span class="live-player">${pitcher}</span></div>` : ''}
      ${lastPlay ? `<div class="live-last-play">${lastPlay}</div>` : ''}
    </div>` : ''}`

  if (isFinal && _liveTimer) { clearInterval(_liveTimer); _liveTimer = null }
  if (_currentView === 'live') renderFullLiveGame(data)
}

/* ── Full Live Game View ── */
function renderFullLiveGame(data) {
  const el = document.getElementById('live-full-view')
  if (!el) return

  const gs = data.gameData.status
  const ls = data.liveData.linescore
  const away = data.gameData.teams.away.team
  const home = data.gameData.teams.home.team
  const isLive = gs.abstractGameState === 'Live'
  const isFinal = gs.abstractGameState === 'Final'

  if (!isLive && !isFinal) {
    el.innerHTML = '<div class="lf-empty">No live game data available.</div>'
    return
  }

  const isDemo = !_liveGamePk && isFinal
  const innings = ls.innings ?? []
  const curInning = ls.currentInning ?? 0
  const isTop = ls.isTopInning ?? true
  const awayTotals = ls.teams?.away ?? {}
  const homeTotals = ls.teams?.home ?? {}
  const balls = ls.balls ?? 0
  const strikes = ls.strikes ?? 0
  const outs = ls.outs ?? 0
  const first = !!ls.offense?.first, second = !!ls.offense?.second, third = !!ls.offense?.third

  const cp = data.liveData.plays?.currentPlay
  const batter = cp?.matchup?.batter?.fullName ?? '\u2014'
  const pitcher = cp?.matchup?.pitcher?.fullName ?? '\u2014'
  const pitchEvts = (cp?.playEvents ?? []).filter(e => e.isPitch)

  const inningStr = isFinal ? 'FINAL' : `${isTop ? '\u25b2' : '\u25bc'} ${curInning}`

  /* ── Score Banner ── */
  const awayRuns = awayTotals.runs ?? 0, homeRuns = homeTotals.runs ?? 0
  const statusDetail = isFinal ? (innings.length > 9 ? `Final/${innings.length}` : 'Final') : inningStr
  const bannerHtml = `
    <div class="lf-banner">
      ${isDemo ? '<div class="lf-banner-tag">2025 World Series \u00b7 Game 7 \u00b7 Dodger Stadium</div>' : ''}
      <div class="lf-banner-score">
        <div class="lf-banner-team">
          <img class="lf-banner-logo" src="${LOGO}/${away.id}.svg" alt="${away.abbreviation}">
          <div class="lf-banner-info">
            <span class="lf-banner-name">${away.abbreviation}</span>
          </div>
          <span class="lf-banner-runs">${awayRuns}</span>
        </div>
        <div class="lf-banner-status">
          ${isLive ? '<span class="live-dot"></span>' : ''}
          <span class="lf-banner-status-text">${statusDetail}</span>
        </div>
        <div class="lf-banner-team">
          <span class="lf-banner-runs">${homeRuns}</span>
          <div class="lf-banner-info" style="text-align:right">
            <span class="lf-banner-name">${home.abbreviation}</span>
          </div>
          <img class="lf-banner-logo" src="${LOGO}/${home.id}.svg" alt="${home.abbreviation}">
        </div>
      </div>
    </div>`

  /* ── Line Score Table ── */
  const maxInn = Math.max(9, innings.length)
  const innHeaders = Array.from({ length: maxInn }, (_, i) => {
    const n = i + 1
    const isCur = isLive && n === curInning
    return `<th${isCur ? ' class="lf-cur-inn"' : ''}>${n}</th>`
  }).join('')

  function innRow(side) {
    return Array.from({ length: maxInn }, (_, i) => {
      const n = i + 1
      const inn = innings.find(x => x.num === n)
      const val = inn ? (inn[side]?.runs ?? '') : ''
      const isCur = isLive && n === curInning
      const display = val !== '' ? val : (n <= (innings.length || 0) ? '0' : '')
      return `<td${isCur ? ' class="lf-cur-inn"' : ''}>${display !== '' ? display : '\u00b7'}</td>`
    }).join('')
  }

  const lineScoreHtml = `
    <div class="lf-scoreboard">
      <table class="lf-sb-table">
        <thead><tr><th></th>${innHeaders}<th class="lf-rhe">R</th><th class="lf-rhe">H</th><th class="lf-rhe">E</th></tr></thead>
        <tbody>
          <tr>
            <td><div class="lf-sb-team"><img class="lf-sb-logo" src="${LOGO}/${away.id}.svg" alt="${away.abbreviation}"><span>${away.abbreviation}</span></div></td>
            ${innRow('away')}
            <td class="lf-rhe"><strong>${awayTotals.runs ?? 0}</strong></td><td class="lf-rhe">${awayTotals.hits ?? 0}</td><td class="lf-rhe">${awayTotals.errors ?? 0}</td>
          </tr>
          <tr>
            <td><div class="lf-sb-team"><img class="lf-sb-logo" src="${LOGO}/${home.id}.svg" alt="${home.abbreviation}"><span>${home.abbreviation}</span></div></td>
            ${innRow('home')}
            <td class="lf-rhe"><strong>${homeTotals.runs ?? 0}</strong></td><td class="lf-rhe">${homeTotals.hits ?? 0}</td><td class="lf-rhe">${homeTotals.errors ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </div>`

  /* ── Strike Zone SVG ── */
  const SVG_W = 200, SVG_H = 240
  const mapX = px => ((px + 1.5) / 3.0) * SVG_W
  const mapY = pz => SVG_H - ((pz - 0.5) / 4.5) * SVG_H
  let szTop = 3.5, szBot = 1.5
  if (pitchEvts.length > 0) {
    const szT = pitchEvts[0].pitchData?.sz_top
    const szB = pitchEvts[0].pitchData?.sz_bot
    if (szT) szTop = parseFloat(szT)
    if (szB) szBot = parseFloat(szB)
  }
  const zx1 = mapX(-0.708), zx2 = mapX(0.708)
  const zy1 = mapY(szTop), zy2 = mapY(szBot)
  const zw = zx2 - zx1, zh = zy2 - zy1
  const thirdW = zw / 3, thirdH = zh / 3
  const plateX = SVG_W / 2, plateY = SVG_H - 8
  const platePts = `${plateX},${plateY - 10} ${plateX + 9},${plateY - 5} ${plateX + 9},${plateY} ${plateX - 9},${plateY} ${plateX - 9},${plateY - 5}`

  const pitchColor = code => {
    switch (code) {
      case 'B': return '#4caf50'; case 'C': return '#f44336'; case 'S': return '#ff9800'
      case 'F': return '#ffeb3b'; case 'X': return '#2196f3'; default: return '#9e9e9e'
    }
  }
  const pitchResultLabel = code => {
    switch (code) {
      case 'B': return 'Ball'; case 'C': return 'Called Strike'; case 'S': return 'Swinging Strike'
      case 'F': return 'Foul'; case 'X': return 'In Play'; default: return code
    }
  }
  const pitchResultClass = code => {
    if (code === 'B') return 'ball'
    if (code === 'C' || code === 'S') return 'strike'
    if (code === 'F') return 'foul'
    if (code === 'X') return 'inplay'
    return ''
  }

  /* All pitches get numbers */
  const pitchDots = pitchEvts.map((e, i) => {
    const px = e.pitchData?.coordinates?.pX
    const pz = e.pitchData?.coordinates?.pZ
    if (px == null || pz == null) return ''
    const cx = mapX(px), cy = mapY(pz)
    const code = e.details?.code ?? ''
    const color = pitchColor(code)
    const isLast = i === pitchEvts.length - 1
    const r = isLast ? 10 : 8
    const num = i + 1
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="${isLast ? 2 : 1}" stroke-opacity="0.7"/>
      <text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" font-size="${isLast ? 9 : 7.5}" font-family="Inter,sans-serif" font-weight="700" fill="#fff" stroke="none">${num}</text>`
  }).join('\n')

  const zoneSvg = `<svg class="lf-zone-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SVG_W}" height="${SVG_H}" fill="none"/>
  <rect x="${zx1.toFixed(1)}" y="${zy1.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" rx="2"/>
  <line x1="${(zx1 + thirdW).toFixed(1)}" y1="${zy1.toFixed(1)}" x2="${(zx1 + thirdW).toFixed(1)}" y2="${zy2.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="4,3"/>
  <line x1="${(zx1 + thirdW * 2).toFixed(1)}" y1="${zy1.toFixed(1)}" x2="${(zx1 + thirdW * 2).toFixed(1)}" y2="${zy2.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="4,3"/>
  <line x1="${zx1.toFixed(1)}" y1="${(zy1 + thirdH).toFixed(1)}" x2="${zx2.toFixed(1)}" y2="${(zy1 + thirdH).toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="4,3"/>
  <line x1="${zx1.toFixed(1)}" y1="${(zy1 + thirdH * 2).toFixed(1)}" x2="${zx2.toFixed(1)}" y2="${(zy1 + thirdH * 2).toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-dasharray="4,3"/>
  <polygon points="${platePts}" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
  ${pitchDots}
</svg>`

  /* ── Count / Outs / Bases ── */
  function lfDots(count, max, cls) {
    return Array.from({ length: max }, (_, i) =>
      `<span class="lf-count-dot ${i < count ? cls : ''}"></span>`).join('')
  }
  const countText = `${balls}\u2013${strikes}`
  const countHtml = `
    <div class="lf-situation">
      <div class="lf-count-text">${countText}</div>
      <div class="lf-count-col">
        <div class="lf-count-row"><span class="lf-count-lbl">B</span>${lfDots(balls, 4, 'ball')}</div>
        <div class="lf-count-row"><span class="lf-count-lbl">S</span>${lfDots(strikes, 3, 'strike')}</div>
        <div class="lf-count-row"><span class="lf-count-lbl">O</span>${lfDots(outs, 3, 'out')}</div>
      </div>
      ${isLive ? `<div class="lf-bases-mini">
        <div class="base base-2b ${second ? 'on' : ''}"></div>
        <div class="base base-3b ${third ? 'on' : ''}"></div>
        <div class="base base-1b ${first ? 'on' : ''}"></div>
        <div class="base base-home"></div>
      </div>` : ''}
    </div>`

  /* ── Pitch Legend ── */
  const legendHtml = `
    <div class="lf-pitch-legend">
      <span class="lf-legend-item"><span class="lf-legend-dot" style="background:#4caf50"></span>Ball</span>
      <span class="lf-legend-item"><span class="lf-legend-dot" style="background:#f44336"></span>Called Strike</span>
      <span class="lf-legend-item"><span class="lf-legend-dot" style="background:#ff9800"></span>Swinging Strike</span>
      <span class="lf-legend-item"><span class="lf-legend-dot" style="background:#ffeb3b"></span>Foul</span>
      <span class="lf-legend-item"><span class="lf-legend-dot" style="background:#2196f3"></span>In Play</span>
    </div>`

  /* ── Pitch Log ── */
  const pitchLogRows = pitchEvts.length === 0
    ? '<div style="font-size:0.65rem;color:rgba(255,255,255,0.2);padding:0.5rem 0;">No pitches yet</div>'
    : [...pitchEvts].reverse().map((e, ri) => {
      const idx = pitchEvts.length - ri
      const speed = e.pitchData?.startSpeed ? `${Math.round(e.pitchData.startSpeed)}` : '\u2014'
      const type = e.details?.type?.description ?? e.details?.description ?? '\u2014'
      const code = e.details?.code ?? ''
      return `<div class="lf-pitch-row">
        <span class="lf-pitch-num">${idx}</span>
        <span class="lf-pitch-speed">${speed}<small> mph</small></span>
        <span class="lf-pitch-type">${type}</span>
        <span class="lf-pitch-result ${pitchResultClass(code)}">${pitchResultLabel(code)}</span>
      </div>`
    }).join('')

  /* ── Inning-Grouped Play-by-Play ── */
  const ordinal = n => {
    if (n >= 11 && n <= 13) return n + 'th'
    const s = ['th','st','nd','rd']
    return n + (s[n % 10] || s[0])
  }

  const rawPlays = data.liveData.plays?.allPlays ?? []
  const groups = []
  let curKey = null, curGroup = null
  for (const play of rawPlays) {
    const inn = play.about?.inning ?? 0
    const top = play.about?.isTopInning ?? true
    const key = `${top ? 'T' : 'B'}${inn}`
    if (key !== curKey) {
      curGroup = { inning: inn, isTop: top, plays: [] }
      groups.push(curGroup)
      curKey = key
    }
    curGroup.plays.push(play)
  }
  groups.reverse()

  const ppHtml = groups.length === 0
    ? '<div class="lf-empty">No plays yet</div>'
    : groups.map(g => {
      const arrow = g.isTop ? '\u25b2' : '\u25bc'
      const label = `${arrow} ${g.isTop ? 'Top' : 'Bottom'} ${ordinal(g.inning)}`
      const playRows = [...g.plays].reverse().map(play => {
        const event = play.result?.event ?? ''
        const desc = play.result?.description ?? ''
        const isScoring = /scores|homers|home run/i.test(desc)
        return `<div class="lf-pp-play${isScoring ? ' lf-pp-scoring' : ''}">
          <div class="lf-pp-event">${event}</div>
          <div class="lf-pp-desc">${desc}</div>
        </div>`
      }).join('')
      return `<div class="lf-pp-group">
        <div class="lf-pp-inning-hdr">${label}</div>
        ${playRows}
      </div>`
    }).join('')

  /* ── At-Bat Labels ── */
  const atBatLabel = isFinal ? 'Final At-Bat' : 'Current At-Bat'

  /* ── Assemble ── */
  el.innerHTML = `
    ${bannerHtml}
    ${lineScoreHtml}
    <div class="lf-body">
      <div class="lf-at-bat">
        <div class="lf-at-bat-header">${atBatLabel}</div>
        <div class="lf-matchup">
          <div class="lf-matchup-row"><span class="lf-role">AB</span><span class="lf-player-name">${batter}</span></div>
          <div class="lf-matchup-row"><span class="lf-role">P</span><span class="lf-player-name">${pitcher}</span></div>
        </div>
        <div class="lf-zone-area">
          <div class="lf-zone-wrap">${zoneSvg}</div>
          ${countHtml}
        </div>
        ${legendHtml}
        <div class="lf-pitch-log">
          <div class="lf-pitch-log-label">Pitch Log</div>
          ${pitchLogRows}
        </div>
      </div>
      <div class="lf-play-log">
        <div class="lf-play-log-header">Play-by-Play</div>
        <div class="lf-play-log-scroll">${ppHtml}</div>
      </div>
    </div>`
}

/* ── Depth Chart ── */
const DC_POS_ORDER = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH']
const DC_PIT_ORDER = ['SP', 'RP', 'CL']
const DC_POS_NAMES = {
  'C': 'Catcher', '1B': 'First Base', '2B': 'Second Base', 'SS': 'Shortstop',
  '3B': 'Third Base', 'LF': 'Left Field', 'CF': 'Center Field', 'RF': 'Right Field',
  'DH': 'Designated Hitter', 'SP': 'Starting Pitcher', 'RP': 'Relief Pitcher', 'CL': 'Closer'
}

async function loadDepthChart() {
  if (_depthLoaded) return
  const gridPos = document.getElementById('dc-grid-pos')
  const gridPit = document.getElementById('dc-grid-pit')
  gridPos.innerHTML = '<div class="dc-loading">Loading depth chart\u2026</div>'
  gridPit.innerHTML = ''

  const t = APP_TEAMS[_currentTeamKey]
  const dcSub = document.getElementById('dc-page-sub')
  if (dcSub && t) dcSub.textContent = `${t.name} \u00b7 ${new Date().getFullYear()}`

  try {
    const teamId = t?.id ?? 119
    const roster = await fetchDepthChart(teamId)

    const byPos = {}
    for (const entry of roster) {
      let abbr = entry.position?.abbreviation ?? entry.position?.code ?? '?'
      if (abbr === 'P') abbr = 'RP'
      if (!byPos[abbr]) byPos[abbr] = []
      byPos[abbr].push(entry)
    }
    for (const key of Object.keys(byPos)) {
      byPos[key].sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99))
    }

    function renderCard(abbr) {
      const players = byPos[abbr]
      if (!players || players.length === 0) return ''
      const posName = DC_POS_NAMES[abbr] ?? abbr
      const playerRows = players.map((entry, i) => {
        const id = entry.person?.id
        const name = entry.person?.fullName ?? '\u2014'
        const jersey = entry.jerseyNumber ?? ''
        const posType = (entry.position?.type ?? '').replace(/'/g, "\\'")
        const safeName = name.replace(/'/g, "\\'")
        const clickAttr = id
          ? `onclick="openPlayerOverlay(${id},'${posType}','${jersey}','${safeName}','${abbr}')" style="cursor:pointer"`
          : ''
        const photo = id
          ? `<img class="dc-photo" src="https://img.mlbstatic.com/mlb-photos/image/upload/w_60,q_auto/v1/people/${id}/headshot/67/current" alt="${name}" onerror="this.parentNode.innerHTML='<span class=\\'dc-photo-fallback\\'>&#x25C9;</span>'">`
          : '<span class="dc-photo-fallback">&#x25C9;</span>'
        return `
          <div class="dc-player ${i === 0 ? 'dc-starter' : ''}" ${clickAttr}>
            <div class="dc-photo-wrap">${photo}</div>
            <div class="dc-player-info">
              <div class="dc-player-name">${name}</div>
            </div>
            <span class="dc-depth-num">${i + 1}</span>
          </div>`
      }).join('')
      return `
        <div class="dc-card">
          <div class="dc-pos-header">
            <span class="dc-pos-abbr">${abbr}</span>
            <span class="dc-pos-name">${posName}</span>
          </div>
          <div class="dc-players">${playerRows}</div>
        </div>`
    }

    const posHtml = DC_POS_ORDER.map(renderCard).filter(Boolean).join('')
    gridPos.innerHTML = posHtml || '<div class="dc-loading">No data available.</div>'

    const pitAbbrs = [...DC_PIT_ORDER, ...Object.keys(byPos).filter(k => !DC_POS_ORDER.includes(k) && !DC_PIT_ORDER.includes(k))]
    const pitHtml = pitAbbrs.map(renderCard).filter(Boolean).join('')
    gridPit.innerHTML = pitHtml || '<div class="dc-loading">No data available.</div>'

    _depthLoaded = true
  } catch (e) {
    console.warn('Depth chart fetch failed:', e)
    gridPos.innerHTML = '<div class="dc-loading">Could not load depth chart.</div>'
  }
}

/* ── World Series Modal ── */
function openWsModal(year) {
  const info = WS_INFO[year]
  if (!info) return
  document.getElementById('ws-modal-year').textContent = year
  document.getElementById('ws-modal-subtitle').textContent = info.subtitle
  document.getElementById('ws-modal-result').textContent = info.result
  document.getElementById('ws-modal-meta').innerHTML = `
    <div class="ws-modal-meta-row"><span class="ws-modal-meta-label">Opponent</span><span class="ws-modal-meta-value">${info.subtitle.split(' vs. ')[1] ?? '\u2014'}</span></div>
    <div class="ws-modal-meta-row"><span class="ws-modal-meta-label">MVP</span><span class="ws-modal-meta-value">${info.mvp}</span></div>
    <div class="ws-modal-meta-row"><span class="ws-modal-meta-label">Venues</span><span class="ws-modal-meta-value">${info.venue}</span></div>`
  document.getElementById('ws-modal-desc').textContent = info.desc

  const img = document.getElementById('ws-modal-img')
  const placeholder = document.getElementById('ws-modal-img-placeholder')
  img.style.display = 'none'
  img.src = ''
  placeholder.style.display = 'block'

  document.getElementById('ws-backdrop').classList.add('open')
  document.getElementById('ws-modal').classList.add('open')
  document.body.style.overflow = 'hidden'

  fetchWikiImage(info.wiki).then(src => {
    if (src) {
      img.src = src
      img.onload = () => { img.style.display = 'block'; placeholder.style.display = 'none' }
    }
  }).catch(() => {})
}

function closeWsModal() {
  document.getElementById('ws-backdrop').classList.remove('open')
  document.getElementById('ws-modal').classList.remove('open')
  document.body.style.overflow = ''
}

/* ── More Sheet ── */
function openMoreSheet() {
  document.getElementById('mob-more-backdrop').classList.add('open')
  document.getElementById('mob-more-sheet').classList.add('open')
  document.body.style.overflow = 'hidden'
}

function closeMoreSheet() {
  document.getElementById('mob-more-backdrop').classList.remove('open')
  document.getElementById('mob-more-sheet').classList.remove('open')
  document.body.style.overflow = ''
}

;(function initMoreSheetDrag() {
  const sheet = document.getElementById('mob-more-sheet')
  const handle = document.getElementById('mob-more-handle')
  const backdrop = document.getElementById('mob-more-backdrop')
  const content = sheet ? sheet.querySelector('.mob-more-content') : null
  if (!sheet || !handle) return

  let startY = 0, currentY = 0, isDragging = false, sheetHeight = 0, dragSource = ''

  handle.addEventListener('touchstart', function (e) {
    if (!sheet.classList.contains('open')) return
    startY = e.touches[0].clientY; currentY = startY
    sheetHeight = sheet.offsetHeight; isDragging = true; dragSource = 'handle'
    sheet.classList.add('dragging')
  }, { passive: true })

  if (content) {
    content.addEventListener('touchstart', function (e) {
      if (!sheet.classList.contains('open')) return
      startY = e.touches[0].clientY; currentY = startY
      sheetHeight = sheet.offsetHeight; dragSource = 'content'
    }, { passive: true })

    content.addEventListener('touchmove', function (e) {
      if (dragSource !== 'content') return
      currentY = e.touches[0].clientY
      const dy = currentY - startY
      if (!isDragging && dy > 8 && content.scrollTop <= 0) {
        isDragging = true; sheet.classList.add('dragging'); startY = currentY
      }
      if (isDragging) {
        let offset = currentY - startY
        if (offset < 0) offset = offset * 0.15
        sheet.style.transform = 'translateY(' + Math.max(offset, -30) + 'px)'
        backdrop.style.opacity = Math.max(0, 1 - (offset / sheetHeight) * 1.5)
        e.preventDefault()
      }
    }, { passive: false })
  }

  sheet.addEventListener('touchmove', function (e) {
    if (!isDragging || dragSource !== 'handle') return
    currentY = e.touches[0].clientY
    let dy = currentY - startY
    if (dy < 0) dy = dy * 0.15
    sheet.style.transform = 'translateY(' + Math.max(dy, -30) + 'px)'
    backdrop.style.opacity = Math.max(0, 1 - (dy / sheetHeight) * 1.5)
    if (dy > 0) e.preventDefault()
  }, { passive: false })

  sheet.addEventListener('touchend', function () {
    if (!isDragging) { dragSource = ''; return }
    isDragging = false; dragSource = ''
    sheet.classList.remove('dragging')
    sheet.style.transform = ''; backdrop.style.opacity = ''
    const dy = currentY - startY
    if (dy > sheetHeight * 0.25) closeMoreSheet()
  }, { passive: true })
})()

/* ── Contracts & Payroll ── */
function loadContracts(key) {
  if (_contractsLoaded) return
  _contractsLoaded = true
  const wrap = document.getElementById('contracts-wrap')
  if (!wrap) return
  const data = CONTRACTS[key]
  if (!data) { wrap.innerHTML = '<div class="dc-loading">No contract data available.</div>'; return }

  const t = APP_TEAMS[key]
  const accentColor = t?.h2 ?? '#003DA5'
  const maxAav = Math.max(...data.players.map(p => p.aav))

  const minYear = Math.min(...data.players.map(p => p.start))
  const maxYear = Math.max(...data.players.map(p => p.end))
  const totalYears = maxYear - minYear + 1
  const yearLabels = Array.from({ length: totalYears }, (_, i) => minYear + i)

  const payrollPct = Math.min(100, (data.payroll / (data.payroll * 1.1)) * 100)
  const luxPctOfBar = Math.min(100, (data.luxTax / (data.payroll * 1.1)) * 100)

  wrap.innerHTML = `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1.5rem;">
      <div>
        <div class="dc-page-title">Contracts &amp; Payroll</div>
        <div class="dc-page-sub">${t.name} \u00b7 ${new Date().getFullYear()}</div>
      </div>
    </div>
    <div class="payroll-bar-wrap">
      <div class="payroll-bar-label">2026 Payroll vs. Luxury Tax Threshold</div>
      <div class="payroll-bar-track">
        <div class="payroll-bar" style="width:${payrollPct.toFixed(1)}%; background: linear-gradient(90deg, ${accentColor} 0%, rgba(0,82,204,0.8) 100%);"></div>
        <div class="payroll-marker" style="left:${luxPctOfBar.toFixed(1)}%">
          <span class="payroll-marker-label">CBT $${data.luxTax}M</span>
        </div>
      </div>
      <div class="payroll-totals">
        <div class="payroll-total-item">
          <span class="payroll-total-val">$${data.payroll}M</span>
          <span class="payroll-total-lbl">Total Payroll</span>
        </div>
        <div class="payroll-total-item" style="text-align:right">
          <span class="payroll-total-val" style="color:${data.payroll > data.luxTax ? 'rgba(220,60,40,0.9)' : 'rgba(100,200,100,0.9)'}">
            ${data.payroll > data.luxTax ? '+' : '-'}$${Math.abs(data.payroll - data.luxTax)}M
          </span>
          <span class="payroll-total-lbl">${data.payroll > data.luxTax ? 'Over CBT' : 'Under CBT'}</span>
        </div>
      </div>
    </div>
    <div class="salary-chart">
      <div class="salary-chart-title">Top Salaries (AAV)</div>
      ${data.players.map(p => `
        <div class="salary-row">
          <span class="salary-pos">${p.pos}</span>
          <span class="salary-name">${p.name}</span>
          <div class="salary-bar-wrap">
            <div class="salary-bar" style="width:${((p.aav / maxAav) * 100).toFixed(1)}%; background:linear-gradient(90deg,${accentColor},rgba(0,82,204,0.7))"></div>
          </div>
          <span class="salary-val">$${p.aav}M</span>
        </div>`).join('')}
    </div>
    <div class="contract-timeline">
      <div class="contract-timeline-title">Contract Timeline</div>
      <div class="ct-year-labels">
        ${yearLabels.map(y => `<span class="ct-year-label">${y}</span>`).join('')}
      </div>
      ${data.players.map(p => {
        const leftPct = ((p.start - minYear) / totalYears) * 100
        const widthPct = ((p.end - p.start + 1) / totalYears) * 100
        return `
        <div class="ct-row">
          <span class="ct-name">${p.name}</span>
          <div class="ct-bar-wrap">
            <div class="ct-bar" style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;background:linear-gradient(90deg,${accentColor},rgba(0,82,204,0.6))">
              <span class="ct-bar-aav">$${p.aav}M</span>
            </div>
          </div>
        </div>`
      }).join('')}
    </div>`
}

/* ── Initialize ── */
const _urlTeam = window.__TEAM_KEY__ || null
const _initTeam = _urlTeam && APP_TEAMS[_urlTeam] ? _urlTeam : 'dodgers'
renderTeam(_initTeam)

/* Always start on home */
