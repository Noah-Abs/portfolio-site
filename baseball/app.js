/* ── App Logic ── */

let _appTeam = localStorage.getItem('defaultTeam') || localStorage.getItem('selectedTeam') || 'dodgers'
if (!APP_TEAMS[_appTeam]) _appTeam = 'dodgers'
let _accentIdx = parseInt(localStorage.getItem('accentIdx')) || 0

/* ── Scroll fade-in observer ── */
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
  { threshold: 0.12 }
)
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el))

/* ── Render Team (static metadata) ── */
function renderAppTeam(key) {
  const t = APP_TEAMS[key]
  if (!t) return
  _appTeam = key

  document.getElementById('app-team-logo').src = t.logoSrc
  document.getElementById('app-team-city').textContent = t.cityShort
  document.getElementById('app-team-name').textContent = t.nameShort
  document.getElementById('app-team-champs').textContent = t.wsLabel || ''

  document.getElementById('app-ws-banners').innerHTML = (t.wsTitles || []).map(yr =>
    `<div class="team-banner"><span class="team-banner-year">${yr}</span></div>`
  ).join('')

  // Show loading skeletons for stats
  document.getElementById('app-team-stats').innerHTML = Array(6).fill(0).map(() => `
    <div class="team-stat">
      <span class="team-stat-val loading"></span>
      <span class="team-stat-lbl">Loading</span>
    </div>`).join('')

  document.getElementById('app-next-game').innerHTML = '<div class="next-game-details">Loading...</div>'
  document.getElementById('app-last-game').innerHTML = '<div class="last-game-date">Loading...</div>'
}

/* ── Render Stats (from API data) ── */
function renderStats(stats) {
  document.getElementById('app-team-stats').innerHTML = stats.map(s => `
    <div class="team-stat">
      <span class="team-stat-val">${s.val}</span>
      <span class="team-stat-lbl">${s.lbl}</span>
      ${s.rank ? `<span class="team-stat-rank">${s.rank}</span>` : ''}
    </div>`).join('')
}

function renderNextGame(t, game) {
  const el = document.getElementById('app-next-game')
  if (!game) { el.innerHTML = '<div class="next-game-details">No upcoming games</div>'; return }
  const myLogo  = t.logoSrc
  const oppLogo = `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${game.logoId}.svg`
  const isHome  = game.atVs === 'vs'
  el.innerHTML = `
    ${game.tag ? `<span class="next-game-tag">${game.tag}</span>` : ''}
    <div class="next-game-matchup">
      <img class="next-game-logo" src="${isHome ? myLogo : oppLogo}" alt="">
      <span class="next-game-sep">${game.atVs}</span>
      <img class="next-game-logo" src="${isHome ? oppLogo : myLogo}" alt="">
      <span class="next-game-opp">${game.opponent}</span>
    </div>
    <div class="next-game-details">${game.date} · ${game.time}</div>
    <div class="next-game-details">${game.venue || ''}</div>`
}

function renderLastGame(data) {
  const el = document.getElementById('app-last-game')
  if (!data) { el.innerHTML = '<div class="last-game-date">No recent games</div>'; return }
  el.innerHTML = `
    <div class="last-game-score">${data.score}</div>
    <div class="last-game-date">${data.date}</div>
    <div class="performers-label">Top Performers</div>
    ${data.performers.map(p => `
      <div class="performer-row">
        <span class="performer-name">${p.name}</span>
        <span class="performer-line">${p.line}</span>
      </div>`).join('')}`
}

/* ── News ── */
async function loadAppNews(espnId) {
  const grid = document.getElementById('app-news-grid')
  if (!grid) return
  grid.innerHTML = '<div class="news-empty">Loading news...</div>'
  try {
    const articles = await fetchNews(espnId)
    if (!articles.length) { grid.innerHTML = '<div class="news-empty">No articles found</div>'; return }
    grid.innerHTML = articles.map(a => `
      <a class="news-item fade-in visible" href="${a.href}" target="_blank" rel="noopener">
        ${a.image ? `<img class="news-img" src="${a.image}" alt="" loading="lazy">` : ''}
        <div class="news-body">
          <div class="news-headline">${a.headline}</div>
          <div class="news-meta">${timeAgo(a.published)}</div>
        </div>
      </a>`).join('')
  } catch (e) {
    grid.innerHTML = '<div class="news-empty">Could not load news</div>'
  }
}

/* ── Home Dashboard ── */
function renderHomeDashboard(key, stats, lastGameData) {
  const t = APP_TEAMS[key]
  if (!t) return
  const dash = document.getElementById('home-dashboard')
  if (!dash) return

  const recStat = stats ? stats.find(s => s.lbl === 'Record') || stats[0] : null
  const perfs = lastGameData ? lastGameData.performers.slice(0, 3) : []

  dash.innerHTML = `
    <div class="home-dash-card">
      <div class="home-dash-header">
        <img src="${t.logoSrc}" alt="">
        <span>Record</span>
      </div>
      <div class="home-dash-big">${recStat ? recStat.val : '...'}</div>
      <div class="home-dash-sub">${recStat ? (recStat.rank || '') : ''}</div>
    </div>
    <div class="home-dash-card">
      <div class="home-dash-header">
        <img src="${t.logoSrc}" alt="">
        <span>Next Game</span>
      </div>
      <div class="home-dash-sub">Loading...</div>
    </div>
    <div class="home-dash-card full-width">
      <div class="home-dash-header">
        <img src="${t.logoSrc}" alt="">
        <span>Last Game</span>
      </div>
      <div class="home-dash-big">${lastGameData ? lastGameData.score : '...'}</div>
      <div class="home-dash-sub">${lastGameData ? lastGameData.date : ''}</div>
      ${perfs.length ? `
        <div class="home-dash-performers">
          ${perfs.map(p => `
            <div class="home-dash-perf">
              <span class="home-dash-perf-name">${p.name}</span>
              <span class="home-dash-perf-line">${p.line}</span>
            </div>`).join('')}
        </div>` : ''}
    </div>`
}

function updateDashNextGame(key, game) {
  const t = APP_TEAMS[key]
  if (!t || _appTeam !== key) return
  const dash = document.getElementById('home-dashboard')
  if (!dash) return
  const cards = dash.querySelectorAll('.home-dash-card')
  if (cards[1] && game) {
    cards[1].innerHTML = `
      <div class="home-dash-header">
        <img src="${t.logoSrc}" alt="">
        <span>Next Game</span>
      </div>
      <div class="home-dash-big" style="font-size:1rem">${game.atVs} ${game.opponent}</div>
      <div class="home-dash-sub">${game.date} · ${game.time}</div>
      ${game.tag ? `<div class="home-dash-sub" style="color:var(--accent2);margin-top:4px">${game.tag}</div>` : ''}`
  }
}

/* ── Load All Live Data ── */
async function loadAllLiveData(key) {
  const t = APP_TEAMS[key]
  if (!t) return

  let stats = null
  let lastGameData = null

  // Fetch stats + last game + next game + news in parallel
  const [statsResult, lastGameResult, nextGameResult] = await Promise.allSettled([
    fetchTeamStats(t.id),
    fetchLastGame(t.id, t.nameShort),
    fetchNextGame(t.id),
  ])

  // Render stats
  if (statsResult.status === 'fulfilled' && statsResult.value && _appTeam === key) {
    stats = statsResult.value
    renderStats(stats)
  }

  // Render last game
  if (lastGameResult.status === 'fulfilled' && lastGameResult.value && _appTeam === key) {
    lastGameData = lastGameResult.value
    renderLastGame(lastGameData)
  } else if (_appTeam === key) {
    document.getElementById('app-last-game').innerHTML = '<div class="last-game-date">No recent games</div>'
  }

  // Render next game
  if (nextGameResult.status === 'fulfilled' && _appTeam === key) {
    renderNextGame(t, nextGameResult.value)
    updateDashNextGame(key, nextGameResult.value)
  }

  // Update home dashboard with live data
  if (_appTeam === key) {
    renderHomeDashboard(key, stats, lastGameData)
    if (nextGameResult.status === 'fulfilled') {
      updateDashNextGame(key, nextGameResult.value)
    }
  }

  // News (non-blocking)
  loadAppNews(t.espnId)
}

/* ── Settings ── */
function openSettings() {
  loadSettingsState()
  renderSettingsTeams()
  document.getElementById('settings').classList.add('open')
}

function closeSettings() {
  document.getElementById('settings').classList.remove('open')
}

function loadSettingsState() {
  ;['pref-live', 'pref-animations', 'pref-scroll-effects'].forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    const saved = localStorage.getItem(id)
    el.checked = saved === null ? true : saved === 'true'
  })
  updateAccentUI()
}

function saveSetting(id, value) {
  localStorage.setItem(id, value)
  applySetting(id, value)
}

function toggleSettingsSwitch(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.checked = !el.checked
  saveSetting(id, el.checked)
}

function applySetting(id, value) {
  if (id === 'pref-animations') {
    document.querySelectorAll('.orb').forEach(o => { o.style.display = value ? '' : 'none' })
  }
  if (id === 'pref-scroll-effects') {
    if (!value) document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'))
  }
}

function applyAllSettings() {
  ;['pref-animations', 'pref-scroll-effects'].forEach(id => {
    const saved = localStorage.getItem(id)
    const value = saved === null ? true : saved === 'true'
    applySetting(id, value)
  })
  const savedIdx = parseInt(localStorage.getItem('accentIdx'))
  if (!isNaN(savedIdx) && ACCENT_COLORS[savedIdx]) {
    _accentIdx = savedIdx
    document.documentElement.style.setProperty('--accent', ACCENT_COLORS[_accentIdx].value)
  }
}

function cycleAccent() {
  _accentIdx = (_accentIdx + 1) % ACCENT_COLORS.length
  const c = ACCENT_COLORS[_accentIdx]
  document.documentElement.style.setProperty('--accent', c.value)
  localStorage.setItem('accentIdx', _accentIdx)
  updateAccentUI()
}

function updateAccentUI() {
  const c = ACCENT_COLORS[_accentIdx]
  const icon = document.getElementById('accent-preview-icon')
  const label = document.getElementById('accent-label')
  if (icon) icon.style.background = c.value
  if (label) label.textContent = c.name
}

function renderSettingsTeams() {
  const list = document.getElementById('settings-team-list')
  list.innerHTML = Object.entries(APP_TEAMS).map(([key, t]) => `
    <div class="settings-team-row ${key === _appTeam ? 'active' : ''}" onclick="settingsPick('${key}')">
      <img src="${t.logoSrc}" alt="${t.nameShort}">
      <div class="settings-team-row-info">
        <div class="settings-team-row-name">${t.name}</div>
        <div class="settings-team-row-div">${t.nameShort}</div>
      </div>
      <span class="settings-team-check">&#x2713;</span>
    </div>`).join('')
}

function settingsPick(key) {
  _appTeam = key
  localStorage.setItem('defaultTeam', _appTeam)
  localStorage.setItem('selectedTeam', _appTeam)
  renderAppTeam(key)
  renderSettingsTeams()
  renderHomeDashboard(key, null, null)
  loadAllLiveData(key)
}

function clearAllData() {
  if (!confirm('Reset all settings to defaults?')) return
  localStorage.removeItem('defaultTeam')
  localStorage.removeItem('selectedTeam')
  localStorage.removeItem('accentIdx')
  localStorage.removeItem('pref-live')
  localStorage.removeItem('pref-animations')
  localStorage.removeItem('pref-scroll-effects')
  _accentIdx = 0
  document.documentElement.style.setProperty('--accent', ACCENT_COLORS[0].value)
  _appTeam = 'dodgers'
  renderAppTeam(_appTeam)
  renderHomeDashboard(_appTeam, null, null)
  loadAllLiveData(_appTeam)
  loadSettingsState()
  renderSettingsTeams()
  applyAllSettings()
}

/* ── Mobile Tab Bar ── */
function setAppTab(el) {
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
}

function scrollToTop(el) {
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const _tabSections = ['team', 'news', 'about', 'projects']
window.addEventListener('scroll', () => {
  if (document.getElementById('settings').classList.contains('open')) return
  const tabs = document.querySelectorAll('.app-tab')
  if (!tabs.length || window.innerWidth > 768) return
  const scrollY = window.scrollY + 120
  let activeIdx = 0
  for (let i = 0; i < _tabSections.length; i++) {
    const sec = document.getElementById(_tabSections[i])
    if (sec && sec.offsetTop <= scrollY) activeIdx = i + 1
  }
  let tabIdx = 0
  if (activeIdx === 1) tabIdx = 1
  else if (activeIdx === 2) tabIdx = 2
  else if (activeIdx >= 3) tabIdx = 3
  tabs.forEach((t, i) => t.classList.toggle('active', i === tabIdx))
}, { passive: true })

/* ── Initialize ── */
applyAllSettings()
renderAppTeam(_appTeam)
renderHomeDashboard(_appTeam, null, null)
loadAllLiveData(_appTeam)
