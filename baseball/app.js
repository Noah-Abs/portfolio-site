/* ── App State ── */
let _currentTeamKey = 'dodgers'
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

  renderMobHomeCards(t, null, null, null)
  loadLiveData()
  loadNews()
  renderBreakdown()
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
  const allViews = ['home', 'depth', 'contracts', 'news', 'settings']
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`)
    if (el) el.classList.toggle('active', v === view)
  })
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
  if (view === 'news') {
    const t = document.getElementById('mobtab-news')
    if (t) t.classList.add('active')
  } else if (view === 'home') {
    const t = document.getElementById('mobtab-home')
    if (t) t.classList.add('active')
  } else {
    const t = document.getElementById('mobtab-more')
    if (t) t.classList.add('active')
  }
}

/* ── Game Breakdown Center ── */
function renderBreakdown() {
  const el = document.getElementById('home-breakdown')
  if (!el) return
  if (_currentTeamKey === 'dodgers') {
    el.innerHTML = buildBreakdownHtml()
  } else {
    el.innerHTML = ''
  }
}

function buildBreakdownHtml() {
  /* ── WPA Data (LAD win probability — away team — after each play) ── */
  /* Real 2025 WS Game 7: LAD 5, TOR 4 (11 inn) at Rogers Centre */
  const wpa = [48,48,47,47,48,49,48,47,46,47,46,47,49,48,47,46,45,15,14,14,15,14,14,16,20,18,19,18,19,18,17,18,19,18,17,18,19,28,26,25,18,17,18,17,16,17,18,17,16,17,18,17,30,32,31,32,33,32,31,30,55,53,52,51,52,50,48,50,49,50,88,85,90,92,88,90,92,95,98,100]
  const N = wpa.length
  const CW = 800, CH = 250, CL = 48, CR = 785, CT = 22, CB = 225
  const cw = CR - CL, ch = CB - CT
  const wx = i => CL + (i / (N - 1)) * cw
  const wy = v => CT + ((100 - v) / 100) * ch
  const y50 = wy(50)

  const pts = wpa.map((v, i) => `${wx(i).toFixed(1)},${wy(v).toFixed(1)}`)
  const linePath = `M${pts.join(' L')}`
  const areaAbove = `M${pts.join(' L')} L${wx(N-1).toFixed(1)},${y50.toFixed(1)} L${wx(0).toFixed(1)},${y50.toFixed(1)} Z`

  const gridLines = [25, 50, 75].map(v => {
    const yy = wy(v)
    const mid = v === 50
    return `<line x1="${CL}" y1="${yy.toFixed(1)}" x2="${CR}" y2="${yy.toFixed(1)}" stroke="rgba(255,255,255,${mid ? 0.15 : 0.06})" stroke-width="${mid ? 1 : 0.5}" ${!mid ? 'stroke-dasharray="4,4"' : ''}/>`
  }).join('')
  const yLabels = [0, 25, 50, 75, 100].map(v =>
    `<text x="${CL - 8}" y="${(wy(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.22)">${v}%</text>`
  ).join('')
  const innStarts = [0, 7, 15, 23, 30, 37, 43, 50, 58, 66, 73]
  const innLabels = innStarts.map((pi, idx) =>
    `<text x="${wx(pi).toFixed(1)}" y="${(CB + 16).toFixed(1)}" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.22)">${idx + 1}</text>
     <line x1="${wx(pi).toFixed(1)}" y1="${CT}" x2="${wx(pi).toFixed(1)}" y2="${CB}" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`
  ).join('')

  const keyMoments = [
    { i: 17, lbl: 'Bichette 3-Run HR', c: '#ef5350' },
    { i: 24, lbl: 'Hern\u00e1ndez Sac Fly', c: '#42a5f5' },
    { i: 37, lbl: 'Edman Sac Fly', c: '#42a5f5' },
    { i: 40, lbl: 'Gim\u00e9nez RBI 2B', c: '#ef5350' },
    { i: 52, lbl: 'Muncy HR', c: '#42a5f5' },
    { i: 60, lbl: 'Rojas ties it!', c: '#66bb6a' },
    { i: 70, lbl: 'Smith HR!', c: '#66bb6a' },
  ]
  const annots = keyMoments.map(k => {
    const cx = wx(k.i), cy = wy(wpa[k.i])
    const above = wpa[k.i] > 50
    const ly = above ? cy - 14 : cy + 16
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${k.c}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/>
      <text x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="7" font-family="Inter,sans-serif" font-weight="700" fill="rgba(255,255,255,0.55)">${k.lbl}</text>`
  }).join('')

  const wpaSvg = `<svg class="gbc-wpa-svg" viewBox="0 0 ${CW} ${CH + 20}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1565c0"/><stop offset="45%" stop-color="#43a047"/><stop offset="55%" stop-color="#43a047"/><stop offset="100%" stop-color="#1565c0"/></linearGradient>
      <linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(66,165,245,0.12)"/><stop offset="100%" stop-color="rgba(66,165,245,0)"/></linearGradient>
    </defs>
    ${gridLines}${yLabels}${innLabels}
    <path d="${areaAbove}" fill="url(#wf)"/>
    <path d="${linePath}" fill="none" stroke="url(#wg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${annots}
    <text x="${CL}" y="${CH + 17}" font-size="7.5" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.18)" letter-spacing="0.15em">INNING</text>
    <text x="${CL - 8}" y="${CT - 6}" font-size="7.5" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.18)" text-anchor="end">LAD WIN %</text>
  </svg>`

  /* ── Turning Points ── */
  const turns = [
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
  ]
  const turnsHtml = turns.map(t => `
    <div class="gbc-tp-card">
      <div class="gbc-tp-rank">${t.rank}</div>
      <div class="gbc-tp-body">
        <div class="gbc-tp-title">${t.title}</div>
        <div class="gbc-tp-inn">${t.inn}</div>
        <div class="gbc-tp-desc">${t.desc}</div>
      </div>
      <div class="gbc-tp-delta ${t.cls}">${t.delta}</div>
    </div>`).join('')

  /* ── Best At-Bats ── */
  const bestABs = [
    { batter: 'Will Smith', inn: '\u25b2 11th', pitches: 3, result: 'Solo HR', wpa: '+38%', cls: 'pos',
      note: 'Jumped on a 2\u20130 fastball from Shane Bieber and drove it 366 feet into the Toronto bullpen. Go-ahead run in extras.' },
    { batter: 'Miguel Rojas', inn: '\u25b2 9th', pitches: 4, result: 'Solo HR', wpa: '+25%', cls: 'pos',
      note: 'Crushed a hanging slider from closer Jeff Hoffman 387 feet to left. Game-tying blast that forced extras.' },
    { batter: 'Max Muncy', inn: '\u25b2 8th', pitches: 5, result: 'Solo HR', wpa: '+12%', cls: 'pos',
      note: 'Launched a 373-foot solo shot to right off Trey Yesavage. Cut the deficit to 4\u20133 and kept the comeback alive.' },
    { batter: 'Bo Bichette', inn: '\u25bc 3rd', pitches: 4, result: '3-Run HR', wpa: '\u221230%', cls: 'neg',
      note: 'Hammered a 442-foot moonshot to deep center off Ohtani, scoring Springer and Guerrero Jr. Gave Toronto a commanding 3\u20130 lead.' },
  ]
  const bestABHtml = bestABs.map((ab, i) => `
    <div class="gbc-ab-card">
      <div class="gbc-ab-rank">${i + 1}</div>
      <div class="gbc-ab-body">
        <div class="gbc-ab-top">
          <span class="gbc-ab-name">${ab.batter}</span>
          <span class="gbc-ab-result">${ab.result}</span>
        </div>
        <div class="gbc-ab-meta">${ab.inn} \u00b7 ${ab.pitches} pitches \u00b7 <span class="gbc-ab-wpa ${ab.cls}">${ab.wpa} WPA</span></div>
        <div class="gbc-ab-note">${ab.note}</div>
      </div>
    </div>`).join('')

  /* ── Pitch Sequencing ── */
  const pitchData = [
    { type: 'Four-Seam Fastball', pct: 35, velo: '95.8', color: '#ef5350' },
    { type: 'Slider', pct: 22, velo: '86.9', color: '#42a5f5' },
    { type: 'Splitter', pct: 14, velo: '88.2', color: '#66bb6a' },
    { type: 'Curveball', pct: 12, velo: '80.1', color: '#ab47bc' },
    { type: 'Changeup', pct: 10, velo: '84.5', color: '#ffa726' },
    { type: 'Sinker', pct: 7, velo: '93.4', color: '#78909c' },
  ]
  const pitchHtml = `
    <div class="gbc-pitch-label">Both Teams Combined \u00b7 364 Total Pitches</div>
    ${pitchData.map(p => `
      <div class="gbc-pitch-bar">
        <span class="gbc-pitch-type">${p.type}</span>
        <div class="gbc-pitch-track"><div class="gbc-pitch-fill" style="width:${p.pct}%;background:${p.color}"></div></div>
        <span class="gbc-pitch-pct">${p.pct}%</span>
        <span class="gbc-pitch-velo">${p.velo}</span>
      </div>`).join('')}`

  /* ── Bullpen Usage ── */
  const bullpenAway = [
    { name: 'Shohei Ohtani', role: 'SP', ip: '2.1', p: 51, k: 3, bb: 2, er: 3, grade: 'C+', gcls: 'c' },
    { name: 'Justin Wrobleski', role: 'RP', ip: '1.1', p: 21, k: 2, bb: 0, er: 0, grade: 'A', gcls: 'a' },
    { name: 'Tyler Glasnow', role: 'RP', ip: '2.1', p: 38, k: 2, bb: 0, er: 1, grade: 'B+', gcls: 'b' },
    { name: 'Emmet Sheehan', role: 'RP', ip: '1.0', p: 20, k: 2, bb: 0, er: 0, grade: 'A', gcls: 'a' },
    { name: 'Blake Snell', role: 'RP', ip: '1.1', p: 28, k: 2, bb: 1, er: 0, grade: 'A\u2212', gcls: 'a' },
    { name: 'Yoshinobu Yamamoto', role: 'W', ip: '2.2', p: 34, k: 1, bb: 1, er: 0, grade: 'A+', gcls: 'a' },
  ]
  const bullpenHome = [
    { name: 'Max Scherzer', role: 'SP', ip: '4.1', p: 54, k: 3, bb: 1, er: 1, grade: 'B+', gcls: 'b' },
    { name: 'Louis Varland', role: 'RP', ip: '0.2', p: 9, k: 0, bb: 0, er: 0, grade: 'B', gcls: 'b' },
    { name: 'Chris Bassitt', role: 'RP', ip: '1.0', p: 26, k: 0, bb: 1, er: 1, grade: 'C+', gcls: 'c' },
    { name: 'Trey Yesavage', role: 'RP', ip: '1.2', p: 21, k: 0, bb: 1, er: 1, grade: 'C+', gcls: 'c' },
    { name: 'Jeff Hoffman', role: 'RP', ip: '1.1', p: 22, k: 2, bb: 0, er: 1, grade: 'C', gcls: 'c' },
    { name: 'Seranthony Dom\u00ednguez', role: 'RP', ip: '1.0', p: 27, k: 0, bb: 2, er: 0, grade: 'B\u2212', gcls: 'b' },
    { name: 'Shane Bieber', role: 'L', ip: '1.0', p: 13, k: 0, bb: 0, er: 1, grade: 'D+', gcls: 'd' },
  ]
  const bpRow = p => `<tr>
    <td class="gbc-bp-name">${p.name}<span class="gbc-bp-role">${p.role}</span></td>
    <td>${p.ip}</td><td>${p.p}</td><td>${p.k}</td><td>${p.bb}</td><td>${p.er}</td>
    <td><span class="gbc-grade ${p.gcls}">${p.grade}</span></td>
  </tr>`
  const bpTable = (team, rows) => `
    <div class="gbc-bp-team">${team}</div>
    <table class="gbc-bp-table">
      <thead><tr><th>Pitcher</th><th>IP</th><th>P</th><th>K</th><th>BB</th><th>ER</th><th></th></tr></thead>
      <tbody>${rows.map(bpRow).join('')}</tbody>
    </table>`

  /* ── Manager Decisions ── */
  const decisions = [
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
  ]
  const decsHtml = decisions.map(d => `
    <div class="gbc-dec-card">
      <span class="gbc-grade ${d.gcls} gbc-dec-badge">${d.grade}</span>
      <div class="gbc-dec-body">
        <div class="gbc-dec-title">${d.title}</div>
        <div class="gbc-dec-impact">${d.impact}</div>
      </div>
    </div>`).join('')

  /* ── Assemble ── */
  return `
    <div class="gbc">
      <div class="gbc-header">
        <div class="gbc-header-tag">FILM STUDY</div>
        <div class="gbc-header-title">Game Breakdown Center</div>
        <div class="gbc-header-sub">2025 World Series \u00b7 Game 7 \u00b7 LAD 5, TOR 4 (11) \u00b7 Rogers Centre</div>
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Win Probability</div>
        <div class="gbc-wpa">${wpaSvg}</div>
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Turning Points</div>
        <div class="gbc-turns">${turnsHtml}</div>
      </div>
      <div class="gbc-grid2">
        <div class="gbc-section">
          <div class="gbc-section-title">Best At-Bats</div>
          <div class="gbc-abs">${bestABHtml}</div>
        </div>
        <div class="gbc-section">
          <div class="gbc-section-title">Pitch Sequencing</div>
          <div class="gbc-pitches">${pitchHtml}</div>
        </div>
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Bullpen Usage</div>
        <div class="gbc-bullpen">
          ${bpTable('Los Angeles Dodgers', bullpenAway)}
          ${bpTable('Toronto Blue Jays', bullpenHome)}
        </div>
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Manager Decisions</div>
        <div class="gbc-decs">${decsHtml}</div>
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
