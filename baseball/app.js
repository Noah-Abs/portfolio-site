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
  if (_currentTeamKey !== key) { _advData = null; _advDataOriginal = null; _advLoaded = false; _vaLoaded = false; _vaFeeds = null; _vaData = null; _advGameType = null }
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
  if (_currentView === 'breakdown') loadBreakdownView()
  if (_currentView === 'hub') loadHub()

  _depthLoaded = false
  rosterLoaded = false
  _contractsLoaded = false

  const centerLogo = document.getElementById('mob-center-logo')
  if (centerLogo) { centerLogo.src = t.logoSrc; centerLogo.alt = t.logoAlt }

  renderMobHomeCards(t, null, null, null)
  loadLiveData()
  loadNews()
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
    nextGame = games.find(g => !g.isFinal) || games[games.length - 1]
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
    const espnId = APP_TEAMS[_currentTeamKey]?.espnId
    const [teamArticles, mlbArticles] = await Promise.all([
      espnId ? fetchNews(espnId) : Promise.resolve([]),
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
  // Show record summary at top
  const finalGames = _filteredGames.filter(g => g.isFinal)
  let recordHtml = ''
  if (finalGames.length > 0) {
    const wins = finalGames.filter(g => g.won).length
    const losses = finalGames.filter(g => g.lost).length
    const types = [...new Set(finalGames.map(g => g.gameType))]
    const isAllPreseason = types.every(t => t === 'S' || t === 'E')
    const label = isAllPreseason ? 'Spring Training' : types.includes('R') ? 'Season' : 'Preseason'
    recordHtml = `<div class="sr-record-bar"><span class="sr-record-label">${label} Record</span><span class="sr-record-val">${wins}\u2013${losses}</span></div>`
  }

  let lastType = ''
  list.innerHTML = recordHtml + _filteredGames.map((g, i) => {
    let header = ''
    if (g.gameTypeLabel !== lastType) {
      lastType = g.gameTypeLabel
      header = `<div class="sr-type-header">${g.gameTypeLabel}</div>`
    }
    const scoreHtml = g.isFinal
      ? `<span class="sr-score ${g.won ? 'sr-win' : g.lost ? 'sr-loss' : ''}">${g.won ? 'W' : g.lost ? 'L' : 'T'} ${g.myScore}\u2013${g.oppScore}</span>`
      : g.isLive
      ? `<span class="sr-score sr-live">${g.inningHalf ? g.inningHalf.slice(0,3) : ''} ${g.inning || ''} · ${g.myScore}\u2013${g.oppScore}</span>`
      : `<span class="sr-time">${g.time}</span>`
    return header + `
    <div class="schedule-row${g.isLive ? ' sr-live-row' : ''}" onclick="openGameDetail(${i})">
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
      ${scoreHtml}
      <span class="sr-chevron">\u203a</span>
    </div>`
  }).join('')
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

  const homeScore = g.isHome ? g.myScore : g.oppScore
  const awayScore = g.isHome ? g.oppScore : g.myScore
  const scoreSection = g.isFinal ? `
    <div class="gd-score-final">
      <span class="gd-score-num${!g.isHome && g.won || g.isHome && g.lost ? ' gd-score-hi' : ''}">${awayScore}</span>
      <span class="gd-score-label">Final</span>
      <span class="gd-score-num${g.isHome && g.won || !g.isHome && g.lost ? ' gd-score-hi' : ''}">${homeScore}</span>
    </div>` : g.isLive ? `
    <div class="gd-score-final gd-score-live">
      <span class="gd-score-num">${awayScore}</span>
      <span class="gd-score-label">${g.inningHalf ? g.inningHalf.slice(0,3) : ''} ${g.inning || 'Live'}</span>
      <span class="gd-score-num">${homeScore}</span>
    </div>` : ''

  const typeTag = g.gameTypeLabel && g.gameTypeLabel !== 'Regular Season' ? `<div class="gd-type-tag">${g.gameTypeLabel}</div>` : ''

  document.getElementById('gd-scroll').innerHTML = `
    <div class="gd-date-label">${g.fullDate}</div>
    ${typeTag}
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
    ${scoreSection}
    <div class="gd-info-grid">
      <div class="gd-info-row">
        <span class="gd-info-label">${g.isFinal ? 'Game Time' : 'First Pitch'}</span>
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
    <a class="gd-tickets-btn" href="${gameUrl}" target="_blank" rel="noopener">${g.isFinal ? 'View on MLB.com' : 'Get Tickets'}</a>`
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

    // Async: load radar chart from advanced data or sabermetrics
    _loadPlayerRadar(playerId, posType)
  } catch (e) {
    document.getElementById('po-stats').innerHTML = '<div class="pd-loading">Could not load stats</div>'
  }
}

async function _loadPlayerRadar(playerId, posType) {
  try {
    const isPit = posType === 'Pitcher'
    const group = isPit ? 'pitching' : 'hitting'
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[${group}],type=[season,sabermetrics,seasonAdvanced],season=${SEASON})`
    const res = await fetch(url)
    const data = await res.json()
    const p = data.people?.[0]
    if (!p?.stats) return

    const _s = (type, grp) => p.stats.find(s => s.type?.displayName === type && s.group?.displayName === grp)?.splits?.[0]?.stat || {}
    const season = _s('season', group)
    const saber = _s('sabermetrics', group)
    const adv = _s('seasonAdvanced', group)

    const playerData = isPit
      ? { k9: +adv.strikeoutsPer9Inn || 0, bb9: +adv.walksPer9Inn || 0, strikePct: +adv.strikePercentage || 0, ip: parseFloat(season.inningsPitched) || 0, war: +saber.war || 0 }
      : {
          iso: +adv.iso || 0, kPct: +adv.strikeoutsPerPlateAppearance || 0,
          bbPct: +adv.walksPerPlateAppearance || 0, spd: +saber.spd || 0,
          war: +saber.war || 0, fielding: +saber.fielding || 0
        }

    const radarSvg = buildRadarChart(playerData, group)
    const statsEl = document.getElementById('po-stats')
    if (statsEl) {
      const paceHtml = _buildPaceProjection(season, group)
      statsEl.insertAdjacentHTML('beforeend', `
        <div class="pd-section">
          <div class="pd-section-title">Player Profile</div>
          <div class="po-radar-wrap">${radarSvg}</div>
        </div>
        ${paceHtml}
      `)
    }
  } catch {}
}

function _buildPaceProjection(season, group) {
  const g = +season.gamesPlayed || 0
  if (g < 5) return ''
  const pace = v => Math.round(v / g * 162)
  if (group === 'hitting') {
    const items = [
      { lbl: 'HR', val: pace(+season.homeRuns || 0) },
      { lbl: 'RBI', val: pace(+season.rbi || 0) },
      { lbl: 'Runs', val: pace(+season.runs || 0) },
      { lbl: 'SB', val: pace(+season.stolenBases || 0) },
      { lbl: 'Hits', val: pace(+season.hits || 0) },
      { lbl: 'BB', val: pace(+season.baseOnBalls || 0) },
    ]
    return `<div class="pd-section">
      <div class="pd-section-title">162-Game Pace</div>
      <div class="pd-stat-grid">${items.map(i => pdStat(i.val, i.lbl)).join('')}</div>
    </div>`
  } else {
    const ip = parseFloat(season.inningsPitched) || 0
    const gs = +season.gamesStarted || 0
    const starts162 = gs > 0 ? Math.round(gs / g * 162) : 0
    const ipPace = gs > 0 ? Math.round(ip / gs * starts162) : Math.round(ip / g * 162)
    const items = [
      { lbl: 'IP', val: ipPace },
      { lbl: 'K', val: pace(+season.strikeOuts || 0) },
      { lbl: 'W', val: pace(+season.wins || 0) },
      { lbl: 'Starts', val: starts162 },
    ]
    return `<div class="pd-section">
      <div class="pd-section-title">162-Game Pace</div>
      <div class="pd-stat-grid">${items.map(i => pdStat(i.val, i.lbl)).join('')}</div>
    </div>`
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
  const teams = Object.entries(APP_TEAMS)
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
  if (view === 'home' && _currentView === 'home') {
    renderTeam(_currentTeamKey)
    return
  }
  _currentView = view
  /* always start on home - no view persistence */
  closePanel()
  document.body.classList.toggle('no-left-sidebar', view !== 'home')
  const allViews = ['home', 'hub', 'depth', 'contracts', 'news', 'breakdown', 'prospects', 'statsai', 'settings', 'advanced', 'analytics']
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`)
    if (el) el.classList.toggle('active', v === view)
  })
  if (view === 'hub') loadHub()
  if (view === 'depth') loadDepthChart()
  if (view === 'contracts') loadContracts(_currentTeamKey)
  if (view === 'news') renderNewsPage()
  if (view === 'breakdown') loadBreakdownView()
  if (view === 'prospects') loadProspects()
  if (view === 'settings') renderSettingsTeams()
  if (view === 'advanced') loadAdvancedStats()
  if (view === 'analytics') loadVisualAnalytics()
  document.querySelectorAll('.rn-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view)
  })
  _setMobTab(view)
}

function _setMobTab(view) {
  document.querySelectorAll('.mob-tab, .mob-tab-center').forEach(b => b.classList.remove('active'))
  if (view === 'hub') {
    const t = document.getElementById('mobtab-hub')
    if (t) t.classList.add('active')
  } else if (view === 'home') {
    const t = document.getElementById('mobtab-home')
    if (t) t.classList.add('active')
  } else {
    const t = document.getElementById('mobtab-more')
    if (t) t.classList.add('active')
  }
}

/* ── Hub View ── */
function loadHub() {
  const sub = document.getElementById('hub-sub')
  if (sub) sub.textContent = APP_TEAMS[_currentTeamKey]?.name ?? ''
}

/* ── Prospects ── */
function loadProspects() {
  const el = document.getElementById('prospects-list')
  if (!el) return

  const t = APP_TEAMS[_currentTeamKey]
  const sub = document.getElementById('prospects-sub')
  const data = PROSPECTS[_currentTeamKey]

  if (sub && t) sub.textContent = `${t.name} · ${data?.source ?? 'Pipeline'} · ${data?.updated ?? ''}`

  if (!data?.players?.length) {
    el.innerHTML = '<div class="dc-loading">No prospect data available.</div>'
    return
  }

  el.innerHTML = `
    <div class="prospect-header-row">
      <span class="prospect-hdr-rank">#</span>
      <span class="prospect-hdr-name">Player</span>
      <span class="prospect-hdr-pos">Pos</span>
      <span class="prospect-hdr-ovr">Overall</span>
      <span class="prospect-hdr-eta">ETA</span>
    </div>` +
    data.players.map(p => `
      <div class="prospect-row">
        <span class="prospect-rank">${p.rank}</span>
        <span class="prospect-name">${p.name}</span>
        <span class="prospect-pos">${p.pos}</span>
        <span class="prospect-ovr">${p.ovr ? '#' + p.ovr : '—'}</span>
        <span class="prospect-eta">${p.eta}</span>
      </div>`).join('')
}

/* ── Game Breakdown Center ── */
async function loadBreakdownView() {
  const wrap = document.getElementById('breakdown-wrap')
  if (!wrap) return
  const t = APP_TEAMS[_currentTeamKey] ?? APP_TEAMS.dodgers

  const completed = (_allScheduleGames || []).filter(g => g.isFinal)
  if (completed.length === 0) {
    const cfg = GAME_BREAKDOWN[_currentTeamKey]
    if (cfg) { wrap.innerHTML = buildBreakdownHtml(cfg, '-view'); return }
    wrap.innerHTML = '<div style="padding:3rem 1.5rem;text-align:center;font-size:0.65rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.15)">No completed games yet this season.</div>'
    return
  }

  const reversed = [...completed].reverse()
  wrap.innerHTML = `
    <div class="gbc-game-picker">
      <label class="gbc-picker-label">Select Game</label>
      <select id="breakdown-game-select" onchange="loadBreakdownForGame()">
        ${reversed.map((g,i) => {
          const typeTag = g.gameTypeLabel && g.gameTypeLabel !== 'Regular Season' ? `[${g.gameTypeLabel}] ` : ''
          return `<option value="${g.gamePk}" ${i===0?'selected':''}>${typeTag}${g.monthDay} \u2014 ${g.atVs} ${g.opponent} (${g.won?'W':g.lost?'L':'T'} ${g.myScore}\u2013${g.oppScore})</option>`
        }).join('')}
      </select>
    </div>
    <div id="breakdown-content">
      <div class="gbc-loading">Loading game breakdown\u2026</div>
    </div>`
  loadBreakdownForGame()
}

async function loadBreakdownForGame() {
  const select = document.getElementById('breakdown-game-select')
  const content = document.getElementById('breakdown-content')
  if (!select || !content) return
  const t = APP_TEAMS[_currentTeamKey] ?? APP_TEAMS.dodgers
  content.innerHTML = '<div class="gbc-loading">Loading game breakdown\u2026</div>'
  try {
    const cfg = await fetchGameBreakdown(select.value, t.id)
    if (cfg) { content.innerHTML = buildBreakdownHtml(cfg, '-view') }
    else { content.innerHTML = '<div class="gbc-loading">No data available for this game.</div>' }
  } catch(e) {
    console.error('Breakdown error:', e)
    content.innerHTML = '<div class="gbc-loading">Error loading game data.</div>'
  }
}

function buildLineScoreHtml(ls) {
  if (!ls) return ''
  const innH = ls.innings.map(n => `<th>${n}</th>`).join('')
  const awayR = ls.away.runs.map(r => `<td>${r}</td>`).join('')
  const homeR = ls.home.runs.map(r => `<td>${r}</td>`).join('')
  return `<div class="gbc-linescore">
    <table class="gbc-ls-table">
      <thead><tr><th></th>${innH}<th class="gbc-ls-rhe">R</th><th class="gbc-ls-rhe">H</th><th class="gbc-ls-rhe">E</th></tr></thead>
      <tbody>
        <tr><td class="gbc-ls-team">${ls.away.abbr}</td>${awayR}<td class="gbc-ls-total">${ls.away.R}</td><td class="gbc-ls-total">${ls.away.H}</td><td class="gbc-ls-total">${ls.away.E}</td></tr>
        <tr><td class="gbc-ls-team">${ls.home.abbr}</td>${homeR}<td class="gbc-ls-total">${ls.home.R}</td><td class="gbc-ls-total">${ls.home.H}</td><td class="gbc-ls-total">${ls.home.E}</td></tr>
      </tbody>
    </table>
  </div>`
}

function buildBreakdownHtml(cfg, idSuffix) {
  if (!cfg) return ''
  const sfx = idSuffix || ''

  /* ── Line Score ── */
  const lineScoreHtml = buildLineScoreHtml(cfg.lineScore)

  /* ── WPA Chart ── */
  const wpa = cfg.wpa?.data || []
  const N = wpa.length
  let wpaSvg = ''
  if (N < 2) { wpaSvg = '<div class="gbc-loading">No play-by-play data available for win probability chart.</div>' }
  else {
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
  const innLabels = cfg.wpa.innStarts.map((pi, idx) =>
    `<text x="${wx(pi).toFixed(1)}" y="${(CB + 16).toFixed(1)}" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.22)">${idx + 1}</text>
     <line x1="${wx(pi).toFixed(1)}" y1="${CT}" x2="${wx(pi).toFixed(1)}" y2="${CB}" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`
  ).join('')

  const annots = (cfg.wpa.keyMoments||[]).map(k => {
    if (k.i >= N) return ''
    const cx = wx(k.i), cy = wy(wpa[k.i])
    const above = wpa[k.i] > 50
    const ly = above ? cy - 14 : cy + 16
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${k.c}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/>
      <text x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="7" font-family="Inter,sans-serif" font-weight="700" fill="rgba(255,255,255,0.55)">${k.lbl}</text>`
  }).join('')

  wpaSvg = `<svg class="gbc-wpa-svg" viewBox="0 0 ${CW} ${CH + 20}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wg${sfx}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1565c0"/><stop offset="45%" stop-color="#43a047"/><stop offset="55%" stop-color="#43a047"/><stop offset="100%" stop-color="#1565c0"/></linearGradient>
      <linearGradient id="wf${sfx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(66,165,245,0.12)"/><stop offset="100%" stop-color="rgba(66,165,245,0)"/></linearGradient>
    </defs>
    ${gridLines}${yLabels}${innLabels}
    <path d="${areaAbove}" fill="url(#wf${sfx})"/>
    <path d="${linePath}" fill="none" stroke="url(#wg${sfx})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${annots}
    <text x="${CL}" y="${CH + 17}" font-size="7.5" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.18)" letter-spacing="0.15em">INNING</text>
    <text x="${CL - 8}" y="${CT - 6}" font-size="7.5" font-family="Inter,sans-serif" fill="rgba(255,255,255,0.18)" text-anchor="end">${cfg.wpa?.label || ''}</text>
  </svg>`
  } // end else (N >= 2)

  /* ── Turning Points ── */
  const turnsHtml = (cfg.turningPoints||[]).map(t => `
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
  const bestABHtml = (cfg.bestAtBats||[]).map((ab, i) => `
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
  const pSeq = cfg.pitchSequencing
  const pitchHtml = pSeq?.pitches?.length ? `
    <div class="gbc-pitch-label">${pSeq.label}</div>
    ${pSeq.pitches.map(p => `
      <div class="gbc-pitch-bar">
        <span class="gbc-pitch-type">${p.type}</span>
        <div class="gbc-pitch-track"><div class="gbc-pitch-fill" style="width:${p.pct}%;background:${p.color}"></div></div>
        <span class="gbc-pitch-pct">${p.pct}%</span>
        <span class="gbc-pitch-velo">${p.velo}</span>
      </div>`).join('')}` : '<div class="gbc-loading">No pitch data available.</div>'

  /* ── Bullpen Usage ── */
  const bpRow = p => `<tr>
    <td class="gbc-bp-name">${p.name}<span class="gbc-bp-role">${p.role}</span></td>
    <td>${p.ip}</td><td>${p.p}</td><td>${p.k}</td><td>${p.bb}</td><td>${p.er}</td>
    <td><span class="gbc-grade ${p.gcls}">${p.grade}</span></td>
  </tr>`
  const bpTable = (team, rows) => rows.length ? `
    <div class="gbc-bp-team">${team}</div>
    <table class="gbc-bp-table">
      <thead><tr><th>Pitcher</th><th>IP</th><th>P</th><th>K</th><th>BB</th><th>ER</th><th></th></tr></thead>
      <tbody>${rows.map(bpRow).join('')}</tbody>
    </table>` : ''

  /* ── Manager Decisions (optional) ── */
  const decs = cfg.managerDecisions || []
  const decsSection = decs.length ? `
      <div class="gbc-section">
        <div class="gbc-section-title">Manager Decisions</div>
        <div class="gbc-decs">${decs.map(d => `
          <div class="gbc-dec-card">
            <span class="gbc-grade ${d.gcls} gbc-dec-badge">${d.grade}</span>
            <div class="gbc-dec-body">
              <div class="gbc-dec-title">${d.title}</div>
              <div class="gbc-dec-impact">${d.impact}</div>
            </div>
          </div>`).join('')}</div>
      </div>` : ''

  /* ── Header ── */
  const headerSub = `${cfg.seriesLabel} \u00b7 ${cfg.gameLabel} \u00b7 ${cfg.scoreLabel} \u00b7 ${cfg.venue}`

  /* ── Assemble ── */
  return `
    <div class="gbc">
      <div class="gbc-header">
        <div class="gbc-header-tag">${cfg.tag}</div>
        <div class="gbc-header-title">${cfg.title}</div>
        <div class="gbc-header-sub">${headerSub}</div>
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Line Score</div>
        ${lineScoreHtml}
      </div>
      <div class="gbc-section">
        <div class="gbc-section-title">Win Probability</div>
        <div class="gbc-wpa">${wpaSvg}</div>
      </div>
      ${turnsHtml ? `<div class="gbc-section">
        <div class="gbc-section-title">Scoring Plays</div>
        <div class="gbc-turns">${turnsHtml}</div>
      </div>` : ''}
      <div class="gbc-grid2">
        ${bestABHtml ? `<div class="gbc-section">
          <div class="gbc-section-title">Key At-Bats</div>
          <div class="gbc-abs">${bestABHtml}</div>
        </div>` : ''}
        <div class="gbc-section">
          <div class="gbc-section-title">Pitch Mix</div>
          <div class="gbc-pitches">${pitchHtml}</div>
        </div>
      </div>
      ${cfg.bullpen ? `<div class="gbc-section">
        <div class="gbc-section-title">Pitcher Breakdown</div>
        <div class="gbc-bullpen">
          ${bpTable(cfg.bullpen.away.name, cfg.bullpen.away.pitchers)}
          ${bpTable(cfg.bullpen.home.name, cfg.bullpen.home.pitchers)}
        </div>
      </div>` : ''}
      ${decsSection}
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
        ${yearLabels.map(y => `<span class="ct-year-label">'${y.toString().slice(-2)}</span>`).join('')}
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

/* ── Live Scoreboard Ticker ── */
async function loadScoreboard() {
  try {
    const games = await fetchTodayScoreboard()
    const ticker = document.getElementById('scoreboard-ticker')
    if (!ticker) return
    if (!games.length) { ticker.style.display = 'none'; return }
    ticker.style.display = ''
    const myTeamId = (APP_TEAMS[_currentTeamKey] ?? APP_TEAMS.dodgers).id
    ticker.innerHTML = games.map(g => {
      const isMy = g.awayId === myTeamId || g.homeId === myTeamId
      let statusHtml
      if (g.isLive) {
        const half = g.inningHalf === 'Top' ? '\u25b2' : g.inningHalf === 'Bottom' ? '\u25bc' : ''
        statusHtml = `<span class="st-status st-live">${half}${g.inning}</span>`
      } else if (g.isFinal) {
        statusHtml = `<span class="st-status st-final">Final</span>`
      } else {
        statusHtml = `<span class="st-status">${g.time}</span>`
      }
      return `<div class="st-game${isMy ? ' st-my' : ''}${g.isLive ? ' st-game-live' : ''}">
        <div class="st-team${g.isFinal && g.awayScore > g.homeScore ? ' st-winner' : ''}">
          <img class="st-logo" src="${LOGO}/${g.awayId}.svg" alt="${g.awayAbbr}">
          <span class="st-abbr">${g.awayAbbr}</span>
          <span class="st-score">${g.isPre ? '' : g.awayScore}</span>
        </div>
        <div class="st-team${g.isFinal && g.homeScore > g.awayScore ? ' st-winner' : ''}">
          <img class="st-logo" src="${LOGO}/${g.homeId}.svg" alt="${g.homeAbbr}">
          <span class="st-abbr">${g.homeAbbr}</span>
          <span class="st-score">${g.isPre ? '' : g.homeScore}</span>
        </div>
        ${statusHtml}
      </div>`
    }).join('')
  } catch(e) { console.error('Scoreboard error:', e) }
}

/* ── Auto-refresh for live games (every 30s) ── */
let _refreshTimer = null
function startAutoRefresh() {
  stopAutoRefresh()
  _refreshTimer = setInterval(() => {
    if (document.hidden) return
    loadLiveData()
    loadScoreboard()
  }, 30000)
}
function stopAutoRefresh() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAutoRefresh()
  else { startAutoRefresh(); loadScoreboard() }
})

/* ── Initialize ── */
const _urlTeam = window.__TEAM_KEY__ || null
const _initTeam = _urlTeam && APP_TEAMS[_urlTeam] ? _urlTeam : 'dodgers'
renderTeam(_initTeam)
loadScoreboard()
startAutoRefresh()

/* ── Stats AI ── */
const SAI_SYSTEM_PROMPT = `You are an expert statistics and probability AI assistant. You specialize in:
- Baseball statistics (traditional and sabermetrics: WAR, wRC+, FIP, xFIP, BABIP, OPS+, ERA+, etc.)
- Probability calculations and statistical modeling
- Data interpretation and analysis
- Historical baseball data and comparisons
- Predictive modeling concepts (playoff odds, MVP races, etc.)

Guidelines:
- Provide precise, well-reasoned statistical analysis
- Show your mathematical work when doing probability calculations
- Reference specific stats and data when available
- Explain complex sabermetric concepts in accessible terms
- When uncertain, clearly state assumptions
- Use markdown formatting for clarity (tables, bold, headers)
- Keep responses concise but thorough`

let _saiMessages = []
let _saiStreaming = false

function saveAiKey() {
  const input = document.getElementById('sai-key-input')
  if (!input) return
  const key = input.value.trim()
  if (!key) return
  localStorage.setItem('sai_gemini_key', key)
  input.value = ''
  document.getElementById('sai-key-bar').classList.add('sai-key-saved')
}

function _getAiKey() {
  return localStorage.getItem('sai_gemini_key') || ''
}

function askExample(btn) {
  const text = btn.textContent.trim()
  const input = document.getElementById('sai-input')
  if (input) { input.value = text; input.focus() }
}

function _renderSaiMessages() {
  const el = document.getElementById('sai-messages')
  if (!el) return
  if (_saiMessages.length === 0) return // keep welcome screen
  el.innerHTML = _saiMessages.map(m => {
    const cls = m.role === 'user' ? 'sai-msg sai-msg-user' : 'sai-msg sai-msg-ai'
    const content = m.role === 'user' ? _escHtml(m.content) : _renderMarkdown(m.content)
    return `<div class="${cls}"><div class="sai-msg-bubble">${content}</div></div>`
  }).join('')
  el.scrollTop = el.scrollHeight
}

function _escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function _renderMarkdown(text) {
  // Simple markdown: bold, headers, code blocks, inline code, lists
  let html = _escHtml(text)
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="sai-code"><code>$2</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="sai-inline-code">$1</code>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Headers
  html = html.replace(/^### (.+)$/gm, '<div class="sai-h3">$1</div>')
  html = html.replace(/^## (.+)$/gm, '<div class="sai-h2">$1</div>')
  html = html.replace(/^# (.+)$/gm, '<div class="sai-h1">$1</div>')
  // Lists
  html = html.replace(/^- (.+)$/gm, '<div class="sai-li">\u2022 $1</div>')
  // Paragraphs
  html = html.replace(/\n\n/g, '<br><br>')
  html = html.replace(/\n/g, '<br>')
  return html
}

async function sendAiMessage() {
  if (_saiStreaming) return
  const input = document.getElementById('sai-input')
  if (!input) return
  const text = input.value.trim()
  if (!text) return

  const key = _getAiKey()
  if (!key) {
    document.getElementById('sai-key-bar')?.classList.add('sai-key-needed')
    document.getElementById('sai-key-input')?.focus()
    setTimeout(() => document.getElementById('sai-key-bar')?.classList.remove('sai-key-needed'), 1500)
    return
  }

  // Add user message
  _saiMessages.push({ role: 'user', content: text })
  input.value = ''
  input.style.height = 'auto'
  _renderSaiMessages()

  // Add placeholder for AI response
  _saiMessages.push({ role: 'assistant', content: '' })
  _saiStreaming = true
  document.getElementById('sai-send')?.classList.add('sai-loading')

  try {
    // Build Gemini message history (role: user/model)
    const contents = _saiMessages.filter(m => m.content).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SAI_SYSTEM_PROMPT }] },
          contents,
        })
      }
    )

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error?.message || `API error ${resp.status}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const aiMsg = _saiMessages[_saiMessages.length - 1]

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data) continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (delta) {
            aiMsg.content += delta
            _renderSaiMessages()
          }
        } catch {}
      }
    }

    if (!aiMsg.content) {
      aiMsg.content = 'No response received.'
    }
  } catch (e) {
    const aiMsg = _saiMessages[_saiMessages.length - 1]
    aiMsg.content = `Error: ${e.message}`
  }

  _saiStreaming = false
  document.getElementById('sai-send')?.classList.remove('sai-loading')
  _renderSaiMessages()
}

/* ══════════════════════════════════════════════
   ADVANCED STATS DASHBOARD
   ══════════════════════════════════════════════ */

let _advData = null   // { hitters, pitchers, overview }
let _advDataOriginal = null // backup of original stats before filter mutations
let _advLoaded = false
let _advTab = 'overview'
let _advSortCol = 'war'
let _advSortAsc = false
let _advFilter = 'all' // all, vl, vr, h, a
let _advSplitsCache = {}
let _advGameLogCache = {}

async function loadAdvancedStats() {
  const team = APP_TEAMS[_currentTeamKey]
  if (!team) return

  if (_advLoaded) {
    _renderAdvTab()
    return
  }

  const el = document.getElementById('adv-content')
  el.innerHTML = '<div class="adv-loading">Loading advanced stats\u2026</div>'

  try {
    const [roster, overview] = await Promise.all([
      fetchAdvancedRoster(team.id),
      fetchAdvancedTeamOverview(team.id),
    ])
    const isSpring = _advGameType === 'S'
    const label = isSpring ? `${SEASON} Spring Training` : `${SEASON} Season`
    document.getElementById('adv-page-sub').textContent = `${team.name} · ${label}`
    _advData = { hitters: roster.hitters, pitchers: roster.pitchers, overview, isSpring }
    _advDataOriginal = { hitters: roster.hitters.map(h => ({...h})), pitchers: roster.pitchers.map(p => ({...p})) }
    _advLoaded = true
    _renderAdvTab()
  } catch (e) {
    el.innerHTML = `<div class="adv-loading">Error loading stats: ${e.message}</div>`
  }
}

function switchAdvTab(tab) {
  _advTab = tab
  document.querySelectorAll('.adv-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  _renderAdvTab()
}

function _renderAdvTab() {
  const el = document.getElementById('adv-content')
  if (!_advData) return
  switch (_advTab) {
    case 'overview':  renderAdvOverview(el); break
    case 'hitting':   renderAdvHitting(el); break
    case 'pitching':  renderAdvPitching(el); break
    case 'charts':    renderAdvCharts(el); break
  }
}

/* ── Overview Tab ── */
function renderAdvOverview(el) {
  const o = _advData.overview
  const h = o.teamHit, p = o.teamPit
  const rk = o.ranks

  function card(label, val, rank, suffix = '') {
    if (rank === '' || rank === undefined) {
      return `<div class="adv-stat-card">
        <div class="adv-stat-val">${val}${suffix}</div>
        <div class="adv-stat-label">${label}</div>
      </div>`
    }
    const rkColor = rank <= 5 ? 'adv-rank-elite' : rank <= 10 ? 'adv-rank-good' : rank <= 20 ? 'adv-rank-mid' : 'adv-rank-bad'
    return `<div class="adv-stat-card">
      <div class="adv-stat-val">${val}${suffix}</div>
      <div class="adv-stat-label">${label}</div>
      <span class="adv-rank ${rkColor}">#${rank} MLB</span>
    </div>`
  }

  const teamPA = +h.plateAppearances || 1
  const kPct = ((+h.strikeOuts || 0) / teamPA * 100).toFixed(1)
  const bbPct = ((+h.baseOnBalls || 0) / teamPA * 100).toFixed(1)

  el.innerHTML = `
    <div class="adv-section-title">Team Overview</div>
    <div class="adv-overview-grid">
      ${card('Team AVG', h.avg || '.000', rk.avg)}
      ${card('Team OPS', h.ops || '.000', rk.ops)}
      ${card('Home Runs', h.homeRuns || 0, rk.hr)}
      ${card('Runs Scored', h.runs || 0, rk.runs)}
      ${card('Team ERA', p.era || '0.00', rk.era)}
      ${card('Team WHIP', p.whip || '0.00', rk.whip)}
      ${card('Strikeouts', p.strikeOuts || 0, rk.k)}
      ${card('Run Differential', (o.runDiff >= 0 ? '+' : '') + o.runDiff, '')}
      ${card('Pythagorean Record', o.pythRecord, '')}
    </div>

    <div class="adv-section-title" style="margin-top:2rem">Rate Stats</div>
    <div class="adv-overview-grid adv-grid-4">
      <div class="adv-stat-card">
        <div class="adv-stat-val">${kPct}%</div>
        <div class="adv-stat-label">K%</div>
      </div>
      <div class="adv-stat-card">
        <div class="adv-stat-val">${bbPct}%</div>
        <div class="adv-stat-label">BB%</div>
      </div>
      <div class="adv-stat-card">
        <div class="adv-stat-val">${o.kbbPct}%</div>
        <div class="adv-stat-label">K-BB%</div>
      </div>
      <div class="adv-stat-card">
        <div class="adv-stat-val">${h.babip || '.000'}</div>
        <div class="adv-stat-label">BABIP</div>
      </div>
    </div>

    <div class="adv-section-title" style="margin-top:2rem">Run Production</div>
    <div class="adv-era-compare">
      <div class="adv-era-side">
        <div class="adv-era-val">${o.runsScored}</div>
        <div class="adv-era-lbl">Runs Scored</div>
      </div>
      <div class="adv-era-bar-wrap">
        <div class="adv-era-bar adv-era-bar-scored" style="width:${o.runsScored / Math.max(o.runsScored, o.runsAllowed, 1) * 100}%"></div>
        <div class="adv-era-bar adv-era-bar-allowed" style="width:${o.runsAllowed / Math.max(o.runsScored, o.runsAllowed, 1) * 100}%"></div>
      </div>
      <div class="adv-era-side">
        <div class="adv-era-val">${o.runsAllowed}</div>
        <div class="adv-era-lbl">Runs Allowed</div>
      </div>
    </div>
  `
}

/* ── Hitting Tab ── */
function renderAdvHitting(el) {
  const rows = _advData.hitters.sort((a, b) => {
    if (_advSortCol === 'name') return _advSortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const av = a[_advSortCol] ?? 0, bv = b[_advSortCol] ?? 0
    return _advSortAsc ? av - bv : bv - av
  })

  const isSpring = _advData.isSpring
  const _n = v => (v == null || isNaN(v)) ? 0 : v
  const _f3 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(3) }
  const _f2 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(2) }
  const _f1 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(1) }
  const _pct = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : (n * 100).toFixed(1) + '%' }
  // Sabermetrics (WAR, wRC+, wOBA, xAVG, xSLG) not available in spring training
  const cols = [
    { key: 'name', label: 'Player', fmt: v => v || '—' },
    { key: 'pa', label: 'PA', fmt: v => _n(v) },
    ...(!isSpring ? [
      { key: 'war', label: 'WAR', fmt: _f1 },
      { key: 'wrc', label: 'wRC+', fmt: v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : Math.round(n) } },
      { key: 'woba', label: 'wOBA', fmt: _f3 },
    ] : []),
    { key: 'ops', label: 'OPS', fmt: _f3 },
    { key: 'avg', label: 'AVG', fmt: _f3 },
    { key: 'slg', label: 'SLG', fmt: _f3 },
    { key: 'iso', label: 'ISO', fmt: _f3 },
    { key: 'babip', label: 'BABIP', fmt: _f3 },
    { key: 'kPct', label: 'K%', fmt: _pct },
    { key: 'bbPct', label: 'BB%', fmt: _pct },
    { key: 'hr', label: 'HR', fmt: v => _n(v) },
    { key: 'sb', label: 'SB', fmt: v => _n(v) },
    ...(!isSpring ? [
      { key: 'xAvg', label: 'xAVG', fmt: v => { const n = parseFloat(v); return (n > 0 && !isNaN(n)) ? n.toFixed(3) : '—' } },
      { key: 'xSlg', label: 'xSLG', fmt: v => { const n = parseFloat(v); return (n > 0 && !isNaN(n)) ? n.toFixed(3) : '—' } },
    ] : []),
  ]

  el.innerHTML = `
    <div class="adv-filter-bar">
      <button class="adv-filter-pill ${_advFilter === 'all' ? 'active' : ''}" onclick="setAdvFilter('all')">All</button>
      <button class="adv-filter-pill ${_advFilter === 'vl' ? 'active' : ''}" onclick="setAdvFilter('vl')">vs LHP</button>
      <button class="adv-filter-pill ${_advFilter === 'vr' ? 'active' : ''}" onclick="setAdvFilter('vr')">vs RHP</button>
      <button class="adv-filter-pill ${_advFilter === 'h' ? 'active' : ''}" onclick="setAdvFilter('h')">Home</button>
      <button class="adv-filter-pill ${_advFilter === 'a' ? 'active' : ''}" onclick="setAdvFilter('a')">Away</button>
    </div>
    <div class="adv-table-wrap">
      <table class="adv-table">
        <thead><tr>
          ${cols.map(c => {
            const arrow = _advSortCol === c.key ? (_advSortAsc ? ' ↑' : ' ↓') : ''
            return `<th class="${c.key === 'name' ? 'adv-th-name' : 'adv-th-num'}" onclick="advSort('${c.key}')">${c.label}${arrow}</th>`
          }).join('')}
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            ${cols.map(c => {
              const v = r[c.key] ?? 0
              const cls = c.key === 'name' ? 'adv-td-name' : 'adv-td-num'
              let color = ''
              if (c.key === 'war' && v != null) color = v >= 4 ? ' adv-cell-elite' : v >= 2 ? ' adv-cell-good' : v < 0 ? ' adv-cell-bad' : ''
              if (c.key === 'wrc' && v != null) color = v >= 130 ? ' adv-cell-elite' : v >= 100 ? ' adv-cell-good' : v < 80 ? ' adv-cell-bad' : ''
              if (c.key === 'woba' && v != null) color = v >= .370 ? ' adv-cell-elite' : v >= .320 ? ' adv-cell-good' : v < .290 ? ' adv-cell-bad' : ''
              return `<td class="${cls}${color}">${c.fmt(r[c.key])}</td>`
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
}

function advSort(col) {
  if (_advSortCol === col) _advSortAsc = !_advSortAsc
  else { _advSortCol = col; _advSortAsc = col === 'name' }
  _renderAdvTab()
}

async function setAdvFilter(f) {
  _advFilter = f
  if (f === 'all') {
    // Restore original stats
    if (_advDataOriginal) {
      _advData.hitters = _advDataOriginal.hitters.map(h => ({...h}))
      _advData.pitchers = _advDataOriginal.pitchers.map(p => ({...p}))
    }
    _renderAdvTab()
    return
  }
  // Fetch splits for all players if not cached
  const el = document.getElementById('adv-content')
  const group = _advTab === 'pitching' ? 'pitching' : 'hitting'
  const players = _advTab === 'pitching' ? _advData.pitchers : _advData.hitters
  const uncached = players.filter(p => !_advSplitsCache[`${p.id}_${group}_${f}`])

  if (uncached.length > 0) {
    el.insertAdjacentHTML('afterbegin', '<div class="adv-loading adv-loading-overlay">Loading splits\u2026</div>')
    const batches = []
    for (let i = 0; i < uncached.length; i += 5) batches.push(uncached.slice(i, i + 5))
    for (const batch of batches) {
      await Promise.all(batch.map(async p => {
        try {
          const splits = await fetchPlayerSplits(p.id, group)
          for (const code of Object.keys(splits)) {
            _advSplitsCache[`${p.id}_${group}_${code}`] = splits[code]
          }
        } catch {}
      }))
    }
    document.querySelector('.adv-loading-overlay')?.remove()
  }

  // Apply split data over the base stats
  for (const p of players) {
    const split = _advSplitsCache[`${p.id}_${group}_${f}`]
    if (split) {
      if (group === 'hitting') {
        p.avg = +split.avg || 0; p.obp = +split.obp || 0; p.slg = +split.slg || 0
        p.ops = +split.ops || 0; p.hr = +split.homeRuns || 0; p.k = +split.strikeOuts || 0
        p.bb = +split.baseOnBalls || 0; p.pa = +split.plateAppearances || 0
        p.babip = +split.babip || 0
        if (p.pa > 0) {
          p.kPct = p.k / p.pa; p.bbPct = p.bb / p.pa
          p.iso = p.slg - p.avg
        }
      } else {
        p.era = +split.era || 0; p.whip = +split.whip || 0
        p.ip = parseFloat(split.inningsPitched) || 0
        p.k = +split.strikeOuts || 0; p.bb = +split.baseOnBalls || 0
        p.wl = `${split.wins || 0}-${split.losses || 0}`
      }
    }
  }
  _renderAdvTab()
}

/* ── Pitching Tab ── */
function renderAdvPitching(el) {
  const rows = _advData.pitchers.sort((a, b) => {
    if (_advSortCol === 'name' || _advSortCol === 'wl') {
      const av = String(a[_advSortCol] ?? ''), bv = String(b[_advSortCol] ?? '')
      return _advSortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const av = a[_advSortCol] ?? 0, bv = b[_advSortCol] ?? 0
    return _advSortAsc ? av - bv : bv - av
  })

  const isSpring = _advData.isSpring
  const _f3 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(3) }
  const _f2 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(2) }
  const _f1 = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : n.toFixed(1) }
  const _pct = v => { const n = parseFloat(v); return (v == null || isNaN(n)) ? '—' : (n * 100).toFixed(1) + '%' }
  const cols = [
    { key: 'name', label: 'Player', fmt: v => v || '—' },
    { key: 'ip', label: 'IP', fmt: _f1 },
    ...(!isSpring ? [
      { key: 'war', label: 'WAR', fmt: _f1 },
    ] : []),
    { key: 'era', label: 'ERA', fmt: _f2 },
    ...(!isSpring ? [
      { key: 'fip', label: 'FIP', fmt: _f2 },
      { key: 'xfip', label: 'xFIP', fmt: _f2 },
    ] : []),
    { key: 'whip', label: 'WHIP', fmt: _f2 },
    { key: 'k9', label: 'K/9', fmt: _f1 },
    { key: 'bb9', label: 'BB/9', fmt: _f1 },
    { key: 'kbbPct', label: 'K-BB%', fmt: _pct },
    { key: 'babip', label: 'BABIP', fmt: _f3 },
    { key: 'hr9', label: 'HR/9', fmt: _f2 },
    { key: 'wl', label: 'W-L', fmt: v => v || '—' },
  ]

  el.innerHTML = `
    <div class="adv-filter-bar">
      <button class="adv-filter-pill ${_advFilter === 'all' ? 'active' : ''}" onclick="setAdvFilter('all')">All</button>
      <button class="adv-filter-pill ${_advFilter === 'vl' ? 'active' : ''}" onclick="setAdvFilter('vl')">vs LHB</button>
      <button class="adv-filter-pill ${_advFilter === 'vr' ? 'active' : ''}" onclick="setAdvFilter('vr')">vs RHB</button>
      <button class="adv-filter-pill ${_advFilter === 'h' ? 'active' : ''}" onclick="setAdvFilter('h')">Home</button>
      <button class="adv-filter-pill ${_advFilter === 'a' ? 'active' : ''}" onclick="setAdvFilter('a')">Away</button>
    </div>
    <div class="adv-table-wrap">
      <table class="adv-table">
        <thead><tr>
          ${cols.map(c => {
            const arrow = _advSortCol === c.key ? (_advSortAsc ? ' ↑' : ' ↓') : ''
            return `<th class="${c.key === 'name' ? 'adv-th-name' : 'adv-th-num'}" onclick="advSort('${c.key}')">${c.label}${arrow}</th>`
          }).join('')}
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            ${cols.map(c => {
              const v = r[c.key] ?? 0
              const cls = c.key === 'name' ? 'adv-td-name' : 'adv-td-num'
              let color = ''
              if (c.key === 'war' && v != null) color = v >= 3 ? ' adv-cell-elite' : v >= 1.5 ? ' adv-cell-good' : v < 0 ? ' adv-cell-bad' : ''
              if (c.key === 'era' && v != null) color = v <= 2.50 ? ' adv-cell-elite' : v <= 3.50 ? ' adv-cell-good' : v > 5.00 ? ' adv-cell-bad' : ''
              if (c.key === 'fip' && v != null) color = v <= 3.00 ? ' adv-cell-elite' : v <= 3.80 ? ' adv-cell-good' : v > 5.00 ? ' adv-cell-bad' : ''
              return `<td class="${cls}${color}">${c.fmt(r[c.key])}</td>`
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
}

/* ── Charts Tab ── */
async function renderAdvCharts(el) {
  el.innerHTML = '<div class="adv-loading">Loading chart data\u2026</div>'

  try {
    // Get top 5 hitters by WAR (or PA for spring) for rolling OPS
    const topHitters = [..._advData.hitters].sort((a, b) => (b.war || 0) - (a.war || 0) || (b.pa || 0) - (a.pa || 0)).slice(0, 5)
    const topPitchers = [..._advData.pitchers].sort((a, b) => (b.war || 0) - (a.war || 0) || (b.ip || 0) - (a.ip || 0)).slice(0, 5)

    if (topHitters.length === 0 && topPitchers.length === 0) {
      el.innerHTML = '<div class="adv-loading">No player data available for charts.</div>'
      return
    }

    // Fetch game logs
    const [hitLogs, pitLogs] = await Promise.all([
      Promise.all(topHitters.map(async p => {
        try {
          if (!_advGameLogCache[`${p.id}_hit`]) _advGameLogCache[`${p.id}_hit`] = await fetchPlayerGameLog(p.id, 'hitting')
        } catch { _advGameLogCache[`${p.id}_hit`] = [] }
        return { name: p.name, logs: _advGameLogCache[`${p.id}_hit`] || [] }
      })),
      Promise.all(topPitchers.map(async p => {
        try {
          if (!_advGameLogCache[`${p.id}_pit`]) _advGameLogCache[`${p.id}_pit`] = await fetchPlayerGameLog(p.id, 'pitching')
        } catch { _advGameLogCache[`${p.id}_pit`] = [] }
        return { name: p.name, logs: _advGameLogCache[`${p.id}_pit`] || [] }
      })),
    ])

    const chartColors = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8']

    // Rolling OPS chart — use smaller window for spring training
    const opsWindow = _advData.isSpring ? 5 : 15
    function rollingOps(logs, window = opsWindow) {
      if (!logs || logs.length < window) return []
      const pts = []
      for (let i = window - 1; i < logs.length; i++) {
        let ab = 0, h = 0, bb = 0, hbp = 0, sf = 0, tb = 0, pa = 0
        for (let j = i - window + 1; j <= i; j++) {
          const s = logs[j]?.stat
          if (!s) continue
          ab += +s.atBats || 0; h += +s.hits || 0; bb += +s.baseOnBalls || 0
          hbp += +s.hitByPitch || 0; sf += +s.sacFlies || 0; tb += +s.totalBases || 0
          pa += +s.plateAppearances || 0
        }
        const obp = pa > 0 ? (h + bb + hbp) / pa : 0
        const slg = ab > 0 ? tb / ab : 0
        pts.push(obp + slg)
      }
      return pts
    }

    // Build OPS SVG
    const W = 700, H = 200, PAD = 40
    let opsSvg = ''
    let maxPts = 0
    const opsData = hitLogs.map(h => {
      const pts = rollingOps(h.logs)
      maxPts = Math.max(maxPts, pts.length)
      return { name: h.name, pts }
    })

    if (maxPts > 1) {
      let maxOps = 0, minOps = 2
      opsData.forEach(d => d.pts.forEach(v => { maxOps = Math.max(maxOps, v); minOps = Math.min(minOps, v) }))
      const range = Math.max(maxOps - minOps, 0.1)

      opsSvg += `<svg class="adv-chart-svg" viewBox="0 0 ${W} ${H + 20}">`
      for (let i = 0; i <= 4; i++) {
        const y = PAD + (H - PAD * 2) * i / 4
        const val = (maxOps - range * i / 4).toFixed(3)
        opsSvg += `<line x1="${PAD}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.06)" />`
        opsSvg += `<text x="${PAD - 4}" y="${y + 3}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`
      }
      opsData.forEach((d, ci) => {
        if (d.pts.length < 2) return
        const path = d.pts.map((v, i) => {
          const x = PAD + (W - PAD - 10) * i / Math.max(maxPts - 1, 1)
          const y = PAD + (H - PAD * 2) * (1 - (v - minOps) / range)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        opsSvg += `<path d="${path}" fill="none" stroke="${chartColors[ci]}" stroke-width="2" opacity="0.85"/>`
      })
      opsSvg += `</svg>`
    }

    // Rolling ERA chart for pitchers
    const eraWindow = _advData.isSpring ? 3 : 5
    function rollingEra(logs, window = eraWindow) {
      if (!logs || logs.length < window) return []
      const pts = []
      for (let i = window - 1; i < logs.length; i++) {
        let ip = 0, er = 0
        for (let j = i - window + 1; j <= i; j++) {
          const s = logs[j]?.stat
          if (!s) continue
          ip += parseFloat(s.inningsPitched) || 0
          er += +s.earnedRuns || 0
        }
        pts.push(ip > 0 ? (er / ip) * 9 : 0)
      }
      return pts
    }

    let eraSvg = ''
    let maxEraPts = 0
    const eraData = pitLogs.map(p => {
      const pts = rollingEra(p.logs)
      maxEraPts = Math.max(maxEraPts, pts.length)
      return { name: p.name, pts }
    })

    if (maxEraPts > 1) {
      let maxEra = 0, minEra = 20
      eraData.forEach(d => d.pts.forEach(v => { maxEra = Math.max(maxEra, v); minEra = Math.min(minEra, v) }))
      minEra = Math.max(0, minEra - 0.5)
      maxEra += 0.5
      const range = Math.max(maxEra - minEra, 0.5)

      eraSvg += `<svg class="adv-chart-svg" viewBox="0 0 ${W} ${H + 20}">`
      for (let i = 0; i <= 4; i++) {
        const y = PAD + (H - PAD * 2) * i / 4
        const val = (maxEra - range * i / 4).toFixed(2)
        eraSvg += `<line x1="${PAD}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.06)" />`
        eraSvg += `<text x="${PAD - 4}" y="${y + 3}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`
      }
      eraData.forEach((d, ci) => {
        if (d.pts.length < 2) return
        const path = d.pts.map((v, i) => {
          const x = PAD + (W - PAD - 10) * i / Math.max(maxEraPts - 1, 1)
          const y = PAD + (H - PAD * 2) * ((v - minEra) / range)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        eraSvg += `<path d="${path}" fill="none" stroke="${chartColors[ci]}" stroke-width="2" opacity="0.85"/>`
      })
      eraSvg += `</svg>`
    }

    function legendHtml(data) {
      return `<div class="adv-chart-legend">${data.map((d, i) =>
        `<span class="adv-legend-item"><span class="adv-legend-dot" style="background:${chartColors[i]}"></span>${d.name.split(' ').pop()}</span>`
      ).join('')}</div>`
    }

    const opsLabel = _advData.isSpring ? `Rolling ${opsWindow}-Game OPS` : 'Rolling 15-Game OPS (Top 5 by WAR)'
    const eraLabel = _advData.isSpring ? `Rolling ${eraWindow}-Start ERA` : 'Rolling 5-Start ERA (Top 5 by WAR)'

    el.innerHTML = `
      <div class="adv-chart-section">
        <div class="adv-section-title">${opsLabel}</div>
        ${legendHtml(opsData)}
        <div class="adv-chart-wrap">${opsSvg || '<div class="adv-loading">Not enough games yet for rolling chart</div>'}</div>
      </div>
      <div class="adv-chart-section">
        <div class="adv-section-title">${eraLabel}</div>
        ${legendHtml(eraData)}
        <div class="adv-chart-wrap">${eraSvg || '<div class="adv-loading">Not enough games yet for rolling chart</div>'}</div>
      </div>
    `
  } catch (e) {
    el.innerHTML = `<div class="adv-loading">Error loading charts: ${e.message}</div>`
  }
}

/* ── Radar Chart (Player Overlay Integration) ── */
function buildRadarChart(player, group) {
  const axes = group === 'pitching'
    ? [
        { label: 'Strikeouts', val: Math.min((player.k9 || 0) / 12 * 100, 100) },
        { label: 'Control', val: Math.min((1 - Math.min((player.bb9 || 0) / 6, 1)) * 100, 100) },
        { label: 'Ground Ball', val: Math.min(((player.strikePct || 0)) * 100 * 1.5, 100) },
        { label: 'Durability', val: Math.min((player.ip || 0) / 200 * 100, 100) },
        { label: 'WAR', val: Math.min((player.war || 0) / 6 * 100, 100) },
      ]
    : [
        { label: 'Power', val: Math.min((player.iso || 0) / 0.300 * 100, 100) },
        { label: 'Contact', val: Math.min((1 - (player.kPct || 0)) * 100 * 1.3, 100) },
        { label: 'Discipline', val: Math.min((player.bbPct || 0) / 0.18 * 100, 100) },
        { label: 'Speed', val: Math.min((player.spd || 0) / 10 * 100, 100) },
        { label: 'WAR', val: Math.min((player.war || 0) / 8 * 100, 100) },
      ]

  const cx = 90, cy = 90, r = 70, n = axes.length
  const angles = axes.map((_, i) => (Math.PI * 2 * i / n) - Math.PI / 2)

  // Grid rings
  let svg = `<svg class="po-radar-svg" viewBox="0 0 180 195">`
  for (let ring = 1; ring <= 4; ring++) {
    const rr = r * ring / 4
    const pts = angles.map(a => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`).join(' ')
    svg += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>`
  }

  // Axis lines
  for (const a of angles) {
    svg += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`
  }

  // Data polygon
  const dataPts = axes.map((ax, i) => {
    const v = Math.max(ax.val, 0) / 100
    return `${cx + r * v * Math.cos(angles[i])},${cy + r * v * Math.sin(angles[i])}`
  }).join(' ')
  svg += `<polygon points="${dataPts}" fill="rgba(0,120,255,0.15)" stroke="rgba(0,150,255,0.7)" stroke-width="1.5"/>`

  // Dots + labels
  axes.forEach((ax, i) => {
    const v = Math.max(ax.val, 0) / 100
    const dx = cx + r * v * Math.cos(angles[i])
    const dy = cy + r * v * Math.sin(angles[i])
    svg += `<circle cx="${dx}" cy="${dy}" r="3" fill="rgba(0,150,255,0.9)"/>`

    const lx = cx + (r + 16) * Math.cos(angles[i])
    const ly = cy + (r + 16) * Math.sin(angles[i])
    const anchor = Math.abs(Math.cos(angles[i])) < 0.3 ? 'middle' : Math.cos(angles[i]) > 0 ? 'start' : 'end'
    svg += `<text x="${lx}" y="${ly + 3}" fill="rgba(255,255,255,0.4)" font-size="8" font-family="Inter" text-anchor="${anchor}" font-weight="600">${ax.label}</text>`
  })

  svg += `</svg>`
  return svg
}

/* ══════════════════════════════════════════════
   Visual Analytics
   ══════════════════════════════════════════════ */

let _vaLoaded = false
let _vaTab = 'spray'
let _vaFeeds = null
let _vaData = null
let _vaPlayerFilter = null
let _vaGameCount = 10

async function loadVisualAnalytics() {
  const team = APP_TEAMS[_currentTeamKey]
  if (!team) return
  if (_vaLoaded) { _renderVaTab(); return }

  const el = document.getElementById('va-content')
  el.innerHTML = '<div class="va-loading">Loading play-by-play data\u2026</div>'

  const isSpring = (_advGameType || await _detectGameType()) === 'S'
  const label = isSpring ? `${SEASON} Spring Training` : `${SEASON} Season`
  document.getElementById('va-page-sub').textContent = `${team.name} \u00b7 ${label}`

  try {
    _vaGameCount = isSpring ? 5 : 10
    _vaFeeds = await fetchRecentGameFeeds(team.id, _vaGameCount)
    if (!_vaFeeds || _vaFeeds.length === 0) {
      el.innerHTML = '<div class="va-loading">No completed games with play-by-play data available yet.</div>'
      return
    }
    _vaData = extractPlayByPlayData(_vaFeeds, team.id)
    _vaLoaded = true
    _vaTab = 'spray'
    document.querySelectorAll('.va-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'spray'))
    _renderVaTab()
  } catch (e) {
    el.innerHTML = `<div class="va-loading">Error loading analytics: ${e.message}</div>`
  }
}

function switchVaTab(tab) {
  _vaTab = tab
  _vaPlayerFilter = null
  document.querySelectorAll('.va-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  _renderVaTab()
}

function _renderVaTab() {
  const el = document.getElementById('va-content')
  if (!_vaData && _vaTab !== 'ops' && _vaTab !== 'era' && _vaTab !== 'rematrix') {
    el.innerHTML = '<div class="va-loading">Loading data\u2026</div>'
    return
  }
  switch (_vaTab) {
    case 'spray':    renderVaSpray(el); break
    case 'heatmap':  renderVaHeatmap(el); break
    case 'ops':      renderVaRollingOps(el); break
    case 'era':      renderVaRollingEra(el); break
    case 'velocity': renderVaVelocity(el); break
    case 'whiff':    renderVaWhiff(el); break
    case 'wpa':      renderVaWpa(el); break
    case 'rematrix': renderVaRunExpectancy(el); break
  }
}

/* ── Player Toggle Helper ── */
function _vaPlayerToggle(playerList, label) {
  const opts = [`<option value="">Team-wide (${label || 'All'})</option>`]
  for (const p of playerList) {
    opts.push(`<option value="${p.id}" ${_vaPlayerFilter == p.id ? 'selected' : ''}>${p.name}</option>`)
  }
  return `<div class="va-filter-bar"><select class="va-player-select" onchange="_vaPlayerFilter=this.value||null; _renderVaTab()">${opts.join('')}</select></div>`
}

function _getVaBatterList() {
  const seen = new Map()
  for (const b of (_vaData?.battedBalls || [])) {
    if (b.isMyBatter && !seen.has(b.batterId)) seen.set(b.batterId, b.batterName)
  }
  for (const p of (_vaData?.pitches || [])) {
    if (p.isMyBatter && !seen.has(p.batterId)) seen.set(p.batterId, p.batterName)
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

function _getVaPitcherList() {
  const seen = new Map()
  for (const p of (_vaData?.pitches || [])) {
    if (p.isMyPitcher && !seen.has(p.pitcherId)) seen.set(p.pitcherId, p.pitcherName)
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

const VA_CHART_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8']

/* ── 1. Spray Chart ── */
function renderVaSpray(el) {
  const balls = _vaData.battedBalls.filter(b => _vaPlayerFilter ? b.batterId == _vaPlayerFilter : b.isMyBatter)

  const eventColors = {
    'Single': '#81c784', 'Double': '#ffb74d', 'Triple': '#ff8a65',
    'Home Run': '#ef5350', 'Sac Fly': '#4fc3f7',
    'Flyout': 'rgba(255,255,255,0.18)', 'Pop Out': 'rgba(255,255,255,0.12)',
    'Groundout': 'rgba(255,255,255,0.15)', 'Lineout': 'rgba(255,255,255,0.22)',
    'Field Error': '#ce93d8', 'Forceout': 'rgba(255,255,255,0.12)',
    'Grounded Into DP': 'rgba(255,255,255,0.1)', 'Double Play': 'rgba(255,255,255,0.1)',
    'Fielders Choice': 'rgba(255,255,255,0.12)',
  }

  let svg = `<svg class="va-chart-svg va-spray-svg" viewBox="0 0 250 250">`
  // Field shape
  svg += `<path d="M125,220 L30,130 Q125,15 220,130 Z" fill="rgba(76,175,80,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>`
  svg += `<path d="M125,220 L85,180 L125,140 L165,180 Z" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>` // infield diamond
  svg += `<circle cx="125" cy="220" r="3" fill="rgba(255,255,255,0.25)"/>` // home plate

  for (const b of balls) {
    const color = eventColors[b.event] || 'rgba(255,255,255,0.12)'
    const r = b.launchSpeed ? Math.max(2, Math.min(5.5, b.launchSpeed / 28)) : 3
    svg += `<circle cx="${b.coordX}" cy="${b.coordY}" r="${r}" fill="${color}" opacity="0.75"><title>${b.event || 'Out'}: ${b.launchSpeed ? b.launchSpeed.toFixed(0) + ' mph' : '?'}, ${b.launchAngle != null ? b.launchAngle.toFixed(0) + '\u00b0' : '?'}</title></circle>`
  }
  svg += '</svg>'

  const legendItems = ['Single', 'Double', 'Triple', 'Home Run', 'Out'].map(name => {
    const c = name === 'Out' ? 'rgba(255,255,255,0.18)' : eventColors[name]
    return `<span class="adv-legend-item"><span class="adv-legend-dot" style="background:${c}"></span>${name}</span>`
  }).join('')

  el.innerHTML = `
    ${_vaPlayerToggle(_getVaBatterList(), 'Batters')}
    <div class="va-chart-section">
      <div class="adv-section-title">Spray Chart (Last ${_vaGameCount} Games)</div>
      <div class="adv-chart-legend">${legendItems}</div>
      <div class="adv-chart-wrap">${balls.length > 0 ? svg : '<div class="va-loading">No batted ball data available.</div>'}</div>
      <div class="va-chart-meta">${balls.length} batted balls</div>
    </div>`
}

/* ── 2. Pitch Heat Map ── */
function renderVaHeatmap(el) {
  const allPitches = _vaData.pitches.filter(p => _vaPlayerFilter ? (p.pitcherId == _vaPlayerFilter || p.batterId == _vaPlayerFilter) : p.isMyPitcher)

  const zoneLeft = -1.8, zoneRight = 1.8, zoneBot = 0.8, zoneTop = 4.2
  const GRID = 7
  const cellW = (zoneRight - zoneLeft) / GRID
  const cellH = (zoneTop - zoneBot) / GRID
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(0))

  for (const p of allPitches) {
    const col = Math.floor((p.pX - zoneLeft) / cellW)
    const row = Math.floor((zoneTop - p.pZ) / cellH)
    if (col >= 0 && col < GRID && row >= 0 && row < GRID) grid[row][col]++
  }
  const maxCount = Math.max(1, ...grid.flat())

  const W = 340, H = 380, PAD = 50
  const szL = PAD, szR = W - PAD, szT = PAD, szB = H - PAD

  let svg = `<svg class="va-chart-svg" viewBox="0 0 ${W} ${H}" style="max-width:400px;margin:0 auto">`
  // Strike zone outline (inner box)
  const szInL = szL + (szR - szL) * ((-0.83 - zoneLeft) / (zoneRight - zoneLeft))
  const szInR = szL + (szR - szL) * ((0.83 - zoneLeft) / (zoneRight - zoneLeft))
  const szInT = szT + (szB - szT) * ((zoneTop - 3.5) / (zoneTop - zoneBot))
  const szInB = szT + (szB - szT) * ((zoneTop - 1.5) / (zoneTop - zoneBot))
  svg += `<rect x="${szInL}" y="${szInT}" width="${szInR - szInL}" height="${szInB - szInT}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4"/>`

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const intensity = grid[r][c] / maxCount
      if (intensity < 0.02) continue
      const x = szL + (c / GRID) * (szR - szL)
      const y = szT + (r / GRID) * (szB - szT)
      const w = (szR - szL) / GRID
      const h = (szB - szT) / GRID
      const red = Math.round(40 + intensity * 200)
      const green = Math.round(60 * (1 - intensity * 0.7))
      const blue = Math.round(180 * (1 - intensity) + 30)
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(${red},${green},${blue},${0.12 + intensity * 0.55})" rx="3"><title>${grid[r][c]} pitches</title></rect>`
    }
  }

  // Home plate
  svg += `<path d="M${W / 2 - 10},${szB + 20} L${W / 2 - 6},${szB + 15} L${W / 2 + 6},${szB + 15} L${W / 2 + 10},${szB + 20} L${W / 2},${szB + 26} Z" fill="rgba(255,255,255,0.15)"/>`
  svg += `<text x="${W / 2}" y="${H - 4}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="middle" font-family="Inter">Catcher's Perspective</text>`
  svg += '</svg>'

  el.innerHTML = `
    ${_vaPlayerToggle(_getVaPitcherList(), 'Pitchers')}
    <div class="va-chart-section">
      <div class="adv-section-title">Pitch Location Heat Map (Last ${_vaGameCount} Games)</div>
      <div class="adv-chart-wrap">${allPitches.length > 0 ? svg : '<div class="va-loading">No pitch data available.</div>'}</div>
      <div class="va-chart-meta">${allPitches.length} pitches mapped</div>
    </div>`
}

/* ── 3. Rolling OPS ── */
async function renderVaRollingOps(el) {
  el.innerHTML = '<div class="va-loading">Loading game logs\u2026</div>'
  try {
    if (!_advData) {
      const team = APP_TEAMS[_currentTeamKey]
      const roster = await fetchAdvancedRoster(team.id)
      _advData = { hitters: roster.hitters, pitchers: roster.pitchers, overview: roster.overview, isSpring: (_advGameType || await _detectGameType()) === 'S' }
    }
    const topHitters = [..._advData.hitters].sort((a, b) => (b.war || 0) - (a.war || 0) || (b.pa || 0) - (a.pa || 0)).slice(0, 5)
    const hitLogs = await Promise.all(topHitters.map(async p => {
      try { if (!_advGameLogCache[`${p.id}_hit`]) _advGameLogCache[`${p.id}_hit`] = await fetchPlayerGameLog(p.id, 'hitting') } catch { _advGameLogCache[`${p.id}_hit`] = [] }
      return { name: p.name, logs: _advGameLogCache[`${p.id}_hit`] || [] }
    }))

    const opsWindow = _advData.isSpring ? 5 : 15
    function rollingOps(logs) {
      if (!logs || logs.length < opsWindow) return []
      const pts = []
      for (let i = opsWindow - 1; i < logs.length; i++) {
        let ab = 0, h = 0, bb = 0, hbp = 0, sf = 0, tb = 0, pa = 0
        for (let j = i - opsWindow + 1; j <= i; j++) {
          const s = logs[j]?.stat; if (!s) continue
          ab += +s.atBats || 0; h += +s.hits || 0; bb += +s.baseOnBalls || 0
          hbp += +s.hitByPitch || 0; sf += +s.sacFlies || 0; tb += +s.totalBases || 0; pa += +s.plateAppearances || 0
        }
        const obp = pa > 0 ? (h + bb + hbp) / pa : 0
        const slg = ab > 0 ? tb / ab : 0
        pts.push(obp + slg)
      }
      return pts
    }

    const W = 700, H = 200, PAD = 40
    let maxPts = 0
    const opsData = hitLogs.map(h => { const pts = rollingOps(h.logs); maxPts = Math.max(maxPts, pts.length); return { name: h.name, pts } })
    let opsSvg = ''
    if (maxPts > 1) {
      let maxOps = 0, minOps = 2
      opsData.forEach(d => d.pts.forEach(v => { maxOps = Math.max(maxOps, v); minOps = Math.min(minOps, v) }))
      const range = Math.max(maxOps - minOps, 0.1)
      opsSvg = `<svg class="adv-chart-svg" viewBox="0 0 ${W} ${H + 20}">`
      for (let i = 0; i <= 4; i++) {
        const y = PAD + (H - PAD * 2) * i / 4, val = (maxOps - range * i / 4).toFixed(3)
        opsSvg += `<line x1="${PAD}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.06)"/>`
        opsSvg += `<text x="${PAD - 4}" y="${y + 3}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`
      }
      opsData.forEach((d, ci) => {
        if (d.pts.length < 2) return
        const path = d.pts.map((v, i) => {
          const x = PAD + (W - PAD - 10) * i / Math.max(maxPts - 1, 1)
          const y = PAD + (H - PAD * 2) * (1 - (v - minOps) / range)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        opsSvg += `<path d="${path}" fill="none" stroke="${VA_CHART_COLORS[ci]}" stroke-width="2" opacity="0.85"/>`
      })
      opsSvg += `</svg>`
    }
    const legend = opsData.map((d, i) => `<span class="adv-legend-item"><span class="adv-legend-dot" style="background:${VA_CHART_COLORS[i]}"></span>${d.name.split(' ').pop()}</span>`).join('')
    el.innerHTML = `<div class="va-chart-section">
      <div class="adv-section-title">Rolling ${opsWindow}-Game OPS (Top 5 by WAR)</div>
      <div class="adv-chart-legend">${legend}</div>
      <div class="adv-chart-wrap">${opsSvg || '<div class="va-loading">Not enough games yet for rolling chart</div>'}</div>
    </div>`
  } catch (e) { el.innerHTML = `<div class="va-loading">Error: ${e.message}</div>` }
}

/* ── 4. Rolling ERA ── */
async function renderVaRollingEra(el) {
  el.innerHTML = '<div class="va-loading">Loading game logs\u2026</div>'
  try {
    if (!_advData) {
      const team = APP_TEAMS[_currentTeamKey]
      const roster = await fetchAdvancedRoster(team.id)
      _advData = { hitters: roster.hitters, pitchers: roster.pitchers, overview: roster.overview, isSpring: (_advGameType || await _detectGameType()) === 'S' }
    }
    const topPitchers = [..._advData.pitchers].sort((a, b) => (b.war || 0) - (a.war || 0) || (b.ip || 0) - (a.ip || 0)).slice(0, 5)
    const pitLogs = await Promise.all(topPitchers.map(async p => {
      try { if (!_advGameLogCache[`${p.id}_pit`]) _advGameLogCache[`${p.id}_pit`] = await fetchPlayerGameLog(p.id, 'pitching') } catch { _advGameLogCache[`${p.id}_pit`] = [] }
      return { name: p.name, logs: _advGameLogCache[`${p.id}_pit`] || [] }
    }))

    const eraWindow = _advData.isSpring ? 3 : 5
    function rollingEra(logs) {
      if (!logs || logs.length < eraWindow) return []
      const pts = []
      for (let i = eraWindow - 1; i < logs.length; i++) {
        let ip = 0, er = 0
        for (let j = i - eraWindow + 1; j <= i; j++) {
          const s = logs[j]?.stat; if (!s) continue
          ip += parseFloat(s.inningsPitched) || 0; er += +s.earnedRuns || 0
        }
        pts.push(ip > 0 ? (er / ip) * 9 : 0)
      }
      return pts
    }

    const W = 700, H = 200, PAD = 40
    let maxEraPts = 0
    const eraData = pitLogs.map(p => { const pts = rollingEra(p.logs); maxEraPts = Math.max(maxEraPts, pts.length); return { name: p.name, pts } })
    let eraSvg = ''
    if (maxEraPts > 1) {
      let maxEra = 0, minEra = 20
      eraData.forEach(d => d.pts.forEach(v => { maxEra = Math.max(maxEra, v); minEra = Math.min(minEra, v) }))
      minEra = Math.max(0, minEra - 0.5); maxEra += 0.5
      const range = Math.max(maxEra - minEra, 0.5)
      eraSvg = `<svg class="adv-chart-svg" viewBox="0 0 ${W} ${H + 20}">`
      for (let i = 0; i <= 4; i++) {
        const y = PAD + (H - PAD * 2) * i / 4, val = (maxEra - range * i / 4).toFixed(2)
        eraSvg += `<line x1="${PAD}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.06)"/>`
        eraSvg += `<text x="${PAD - 4}" y="${y + 3}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`
      }
      eraData.forEach((d, ci) => {
        if (d.pts.length < 2) return
        const path = d.pts.map((v, i) => {
          const x = PAD + (W - PAD - 10) * i / Math.max(maxEraPts - 1, 1)
          const y = PAD + (H - PAD * 2) * ((v - minEra) / range)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        eraSvg += `<path d="${path}" fill="none" stroke="${VA_CHART_COLORS[ci]}" stroke-width="2" opacity="0.85"/>`
      })
      eraSvg += `</svg>`
    }
    const legend = eraData.map((d, i) => `<span class="adv-legend-item"><span class="adv-legend-dot" style="background:${VA_CHART_COLORS[i]}"></span>${d.name.split(' ').pop()}</span>`).join('')
    el.innerHTML = `<div class="va-chart-section">
      <div class="adv-section-title">Rolling ${eraWindow}-Start ERA (Top 5 by WAR)</div>
      <div class="adv-chart-legend">${legend}</div>
      <div class="adv-chart-wrap">${eraSvg || '<div class="va-loading">Not enough starts yet for rolling chart</div>'}</div>
    </div>`
  } catch (e) { el.innerHTML = `<div class="va-loading">Error: ${e.message}</div>` }
}

/* ── 5. Velocity Trends ── */
function renderVaVelocity(el) {
  const pitches = _vaData.pitches.filter(p => _vaPlayerFilter ? p.pitcherId == _vaPlayerFilter : p.isMyPitcher).filter(p => p.startSpeed)

  // Group by pitch type, compute per-game average velocity
  const byTypeGame = {}
  for (const p of pitches) {
    const key = p.pitchType
    if (!byTypeGame[key]) byTypeGame[key] = {}
    if (!byTypeGame[key][p.gamePk]) byTypeGame[key][p.gamePk] = { total: 0, count: 0 }
    byTypeGame[key][p.gamePk].total += p.startSpeed
    byTypeGame[key][p.gamePk].count++
  }

  const gameOrder = [...new Set(pitches.map(p => p.gamePk))]
  const types = Object.entries(byTypeGame).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length).slice(0, 6)

  if (types.length === 0) {
    el.innerHTML = `${_vaPlayerToggle(_getVaPitcherList(), 'Pitchers')}<div class="va-loading">No velocity data available.</div>`
    return
  }

  let allVelos = []
  const lineData = types.map(([type, games]) => {
    const pts = gameOrder.map(gk => games[gk] ? games[gk].total / games[gk].count : null)
    pts.forEach(v => { if (v) allVelos.push(v) })
    return { type, pts }
  })

  const maxV = Math.max(...allVelos) + 2, minV = Math.min(...allVelos) - 2
  const W = 700, H = 220, PAD = 45

  let svg = `<svg class="adv-chart-svg" viewBox="0 0 ${W} ${H + 20}">`
  for (let i = 0; i <= 4; i++) {
    const y = PAD + (H - PAD * 2) * i / 4
    const val = (maxV - (maxV - minV) * i / 4).toFixed(0)
    svg += `<line x1="${PAD}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.06)"/>`
    svg += `<text x="${PAD - 4}" y="${y + 3}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`
  }
  // Game labels on x-axis
  gameOrder.forEach((_, i) => {
    const x = PAD + (W - PAD - 10) * i / Math.max(gameOrder.length - 1, 1)
    svg += `<text x="${x}" y="${H + 12}" fill="rgba(255,255,255,0.2)" font-size="8" text-anchor="middle" font-family="Inter">G${i + 1}</text>`
  })

  lineData.forEach(({ type, pts }) => {
    const color = PITCH_COLORS[type] || '#90a4ae'
    let path = ''
    pts.forEach((v, i) => {
      if (v == null) return
      const x = PAD + (W - PAD - 10) * i / Math.max(gameOrder.length - 1, 1)
      const y = PAD + (H - PAD * 2) * (1 - (v - minV) / (maxV - minV))
      path += `${path === '' ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    if (path) svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>`
    // Add dots at each game point
    pts.forEach((v, i) => {
      if (v == null) return
      const x = PAD + (W - PAD - 10) * i / Math.max(gameOrder.length - 1, 1)
      const y = PAD + (H - PAD * 2) * (1 - (v - minV) / (maxV - minV))
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" opacity="0.9"><title>${type}: ${v.toFixed(1)} mph</title></circle>`
    })
  })
  svg += '</svg>'

  const legend = lineData.map(d => {
    const c = PITCH_COLORS[d.type] || '#90a4ae'
    return `<span class="adv-legend-item"><span class="adv-legend-dot" style="background:${c}"></span>${d.type}</span>`
  }).join('')

  el.innerHTML = `
    ${_vaPlayerToggle(_getVaPitcherList(), 'Pitchers')}
    <div class="va-chart-section">
      <div class="adv-section-title">Pitch Velocity Trends (Last ${_vaGameCount} Games)</div>
      <div class="va-chart-desc">Average velocity per game by pitch type</div>
      <div class="adv-chart-legend">${legend}</div>
      <div class="adv-chart-wrap">${svg}</div>
    </div>`
}

/* ── 6. Whiff Map ── */
function renderVaWhiff(el) {
  const allPitches = _vaData.pitches.filter(p => _vaPlayerFilter ? p.pitcherId == _vaPlayerFilter : p.isMyPitcher)

  const zoneLeft = -1.8, zoneRight = 1.8, zoneBot = 0.8, zoneTop = 4.2
  const GRID = 5
  const cellW = (zoneRight - zoneLeft) / GRID
  const cellH = (zoneTop - zoneBot) / GRID
  const swings = Array.from({ length: GRID }, () => Array(GRID).fill(0))
  const whiffs = Array.from({ length: GRID }, () => Array(GRID).fill(0))

  for (const p of allPitches) {
    const isSwing = p.isSwingingStrike || p.isInPlay
    if (!isSwing) continue
    const col = Math.floor((p.pX - zoneLeft) / cellW)
    const row = Math.floor((zoneTop - p.pZ) / cellH)
    if (col >= 0 && col < GRID && row >= 0 && row < GRID) {
      swings[row][col]++
      if (p.isSwingingStrike) whiffs[row][col]++
    }
  }

  const W = 340, H = 380, PAD = 50
  const szL = PAD, szR = W - PAD, szT = PAD, szB = H - PAD
  const szInL = szL + (szR - szL) * ((-0.83 - zoneLeft) / (zoneRight - zoneLeft))
  const szInR = szL + (szR - szL) * ((0.83 - zoneLeft) / (zoneRight - zoneLeft))
  const szInT = szT + (szB - szT) * ((zoneTop - 3.5) / (zoneTop - zoneBot))
  const szInB = szT + (szB - szT) * ((zoneTop - 1.5) / (zoneTop - zoneBot))

  let svg = `<svg class="va-chart-svg" viewBox="0 0 ${W} ${H}" style="max-width:400px;margin:0 auto">`
  svg += `<rect x="${szInL}" y="${szInT}" width="${szInR - szInL}" height="${szInB - szInT}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4"/>`

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (swings[r][c] < 2) continue
      const rate = whiffs[r][c] / swings[r][c]
      const x = szL + (c / GRID) * (szR - szL)
      const y = szT + (r / GRID) * (szB - szT)
      const w = (szR - szL) / GRID
      const h = (szB - szT) / GRID
      const red = Math.round(50 + rate * 200)
      const green = Math.round(180 * (1 - rate))
      const blue = Math.round(60 * (1 - rate))
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(${red},${green},${blue},${0.2 + rate * 0.5})" rx="3"/>`
      svg += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" fill="rgba(255,255,255,${0.4 + rate * 0.4})" font-size="10" font-weight="700" text-anchor="middle" font-family="Inter">${(rate * 100).toFixed(0)}%</text>`
    }
  }
  svg += `<text x="${W / 2}" y="${H - 4}" fill="rgba(255,255,255,0.25)" font-size="9" text-anchor="middle" font-family="Inter">Whiff Rate by Zone \u00b7 Catcher's View</text>`
  svg += '</svg>'

  const totalSwings = swings.flat().reduce((a, b) => a + b, 0)
  const totalWhiffs = whiffs.flat().reduce((a, b) => a + b, 0)
  const overallRate = totalSwings > 0 ? ((totalWhiffs / totalSwings) * 100).toFixed(1) : '0.0'

  el.innerHTML = `
    ${_vaPlayerToggle(_getVaPitcherList(), 'Pitchers')}
    <div class="va-chart-section">
      <div class="adv-section-title">Strike Zone Whiff Map (Last ${_vaGameCount} Games)</div>
      <div class="va-chart-desc">Swing-and-miss rate per zone. Red = high whiff rate, green = low. Min 2 swings per zone.</div>
      <div class="adv-chart-wrap">${totalSwings > 0 ? svg : '<div class="va-loading">No swing data available.</div>'}</div>
      <div class="va-chart-meta">Overall whiff rate: ${overallRate}% (${totalWhiffs}/${totalSwings} swings)</div>
    </div>`
}

/* ── 7. WPA Chart ── */
function renderVaWpa(el) {
  if (!_vaFeeds || _vaFeeds.length === 0) {
    el.innerHTML = '<div class="va-loading">No game data available.</div>'
    return
  }

  const team = APP_TEAMS[_currentTeamKey]
  const games = _vaFeeds.slice(0, 5)
  let html = ''

  for (const feed of games) {
    if (!feed) continue
    const gd = feed.gameData, ld = feed.liveData
    if (!ld?.plays?.allPlays) continue
    const isHome = gd?.teams?.home?.id === team.id
    const homeAbbr = gd?.teams?.home?.abbreviation || 'HOME'
    const awayAbbr = gd?.teams?.away?.abbreviation || 'AWAY'
    const gameDate = gd?.datetime?.dateTime ? new Date(gd.datetime.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

    // Collect score progression for WPA-like chart
    const points = [{ inning: 0, homeScore: 0, awayScore: 0 }]
    for (const play of ld.plays.allPlays) {
      if (!play.about?.isComplete) continue
      const hs = play.result?.homeScore ?? points[points.length - 1].homeScore
      const as = play.result?.awayScore ?? points[points.length - 1].awayScore
      if (hs !== points[points.length - 1].homeScore || as !== points[points.length - 1].awayScore) {
        points.push({ inning: play.about?.inning || 0, half: play.about?.halfInning, homeScore: hs, awayScore: as, desc: play.result?.description || '' })
      }
    }

    const finalHome = points[points.length - 1].homeScore
    const finalAway = points[points.length - 1].awayScore
    const CW = 600, CH = 140, CL = 40, CR = CW - 20, CT = 20, CB = CH - 20
    const maxRuns = Math.max(finalHome, finalAway, ...points.map(p => Math.max(p.homeScore, p.awayScore)), 3) + 1

    let wpaSvg = `<svg class="adv-chart-svg" viewBox="0 0 ${CW} ${CH + 20}">`
    // Grid
    for (let i = 0; i <= maxRuns; i++) {
      const y = CB - (i / maxRuns) * (CB - CT)
      wpaSvg += `<line x1="${CL}" y1="${y}" x2="${CR}" y2="${y}" stroke="rgba(255,255,255,0.05)"/>`
      wpaSvg += `<text x="${CL - 4}" y="${y + 3}" fill="rgba(255,255,255,0.2)" font-size="8" text-anchor="end" font-family="Inter">${i}</text>`
    }

    // Home and away score lines
    const homePath = points.map((p, i) => {
      const x = CL + (CR - CL) * i / Math.max(points.length - 1, 1)
      const y = CB - (p.homeScore / maxRuns) * (CB - CT)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    const awayPath = points.map((p, i) => {
      const x = CL + (CR - CL) * i / Math.max(points.length - 1, 1)
      const y = CB - (p.awayScore / maxRuns) * (CB - CT)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    wpaSvg += `<path d="${homePath}" fill="none" stroke="#4fc3f7" stroke-width="2.5" opacity="0.9"/>`
    wpaSvg += `<path d="${awayPath}" fill="none" stroke="#e57373" stroke-width="2.5" opacity="0.9"/>`

    // Scoring play dots
    points.forEach((p, i) => {
      if (i === 0) return
      const x = CL + (CR - CL) * i / Math.max(points.length - 1, 1)
      const yH = CB - (p.homeScore / maxRuns) * (CB - CT)
      const yA = CB - (p.awayScore / maxRuns) * (CB - CT)
      wpaSvg += `<circle cx="${x.toFixed(1)}" cy="${yH.toFixed(1)}" r="3" fill="#4fc3f7"><title>${p.desc}</title></circle>`
      wpaSvg += `<circle cx="${x.toFixed(1)}" cy="${yA.toFixed(1)}" r="3" fill="#e57373"><title>${p.desc}</title></circle>`
    })
    wpaSvg += '</svg>'

    const legend = `<div class="adv-chart-legend"><span class="adv-legend-item"><span class="adv-legend-dot" style="background:#4fc3f7"></span>${homeAbbr} (Home)</span><span class="adv-legend-item"><span class="adv-legend-dot" style="background:#e57373"></span>${awayAbbr} (Away)</span></div>`

    const winner = finalHome > finalAway ? homeAbbr : awayAbbr
    html += `<div class="va-wpa-game">
      <div class="va-wpa-game-label">${gameDate} \u2014 ${awayAbbr} ${finalAway}, ${homeAbbr} ${finalHome} (${isHome ? (finalHome > finalAway ? 'W' : 'L') : (finalAway > finalHome ? 'W' : 'L')})</div>
      ${legend}
      <div class="adv-chart-wrap">${wpaSvg}</div>
    </div>`
  }

  el.innerHTML = `<div class="va-chart-section">
    <div class="adv-section-title">Score Progression (Last ${games.length} Games)</div>
    <div class="va-chart-desc">Run scoring over time per game. Blue = home team, red = away.</div>
    ${html || '<div class="va-loading">No game data available.</div>'}
  </div>`
}

/* ── 8. Run Expectancy Matrix ── */
function renderVaRunExpectancy(el) {
  const RE24 = {
    '---': [0.481, 0.254, 0.098],
    '1--': [0.859, 0.509, 0.224],
    '-2-': [1.100, 0.664, 0.319],
    '12-': [1.437, 0.884, 0.429],
    '--3': [1.350, 0.950, 0.353],
    '1-3': [1.784, 1.130, 0.478],
    '-23': [1.964, 1.376, 0.580],
    '123': [2.282, 1.520, 0.752],
  }
  const baseLabels = ['Bases Empty', '1B', '2B', '1B 2B', '3B', '1B 3B', '2B 3B', 'Loaded']
  const baseKeys = ['---', '1--', '-2-', '12-', '--3', '1-3', '-23', '123']

  const W = 460, H = 380, PAD = 90
  const cellW = (W - PAD - 20) / 3
  const cellH = (H - PAD - 20) / 8
  const maxVal = 2.3

  let svg = `<svg class="va-chart-svg" viewBox="0 0 ${W} ${H}" style="max-width:520px;margin:0 auto">`
  ;['0 Outs', '1 Out', '2 Outs'].forEach((label, c) => {
    svg += `<text x="${PAD + c * cellW + cellW / 2}" y="${PAD - 12}" fill="rgba(255,255,255,0.5)" font-size="11" font-weight="700" text-anchor="middle" font-family="Inter">${label}</text>`
  })

  baseKeys.forEach((key, r) => {
    svg += `<text x="${PAD - 8}" y="${PAD + r * cellH + cellH / 2 + 4}" fill="rgba(255,255,255,0.5)" font-size="9.5" font-weight="600" text-anchor="end" font-family="Inter">${baseLabels[r]}</text>`
    RE24[key].forEach((val, c) => {
      const intensity = val / maxVal
      const x = PAD + c * cellW, y = PAD + r * cellH
      const red = Math.round(30 + intensity * 190)
      const green = Math.round(70 * (1 - intensity * 0.6))
      const blue = Math.round(200 * (1 - intensity) + 30)
      svg += `<rect x="${x + 2}" y="${y + 2}" width="${cellW - 4}" height="${cellH - 4}" fill="rgba(${red},${green},${blue},0.45)" rx="6"/>`
      svg += `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 5}" fill="#fff" font-size="13" font-weight="800" text-anchor="middle" font-family="Inter">${val.toFixed(3)}</text>`
    })
  })
  svg += '</svg>'

  el.innerHTML = `<div class="va-chart-section">
    <div class="adv-section-title">Run Expectancy Matrix (RE24)</div>
    <div class="va-chart-desc">Expected runs scored from each base/out state based on MLB historical averages. Higher values (red) indicate more advantageous situations.</div>
    <div class="adv-chart-wrap">${svg}</div>
  </div>`
}

/* ── End Visual Analytics ── */
const _VA_PLACEHOLDER = null // marker for end of VA block


/* Always start on home */
