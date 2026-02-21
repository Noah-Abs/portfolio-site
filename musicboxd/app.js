/* ═══════════════════════════════════════════
   MUSICBOXD — Core App Logic
   View switching, DOM rendering, search,
   star ratings, modals — localStorage only
   ═══════════════════════════════════════════ */

// ─── State ───────────────────────────────────

let _currentView = 'home';
let _searchTimer = null;
let _modalAlbum = null;
let _modalExistingLog = null;
let _modalRating = 0;
let _modalLiked = false;
let _listEditAlbums = [];
let _listEditId = null;

// Popular album IDs for homepage (curated)
const POPULAR_IDS = [
  '1440857781',  // Igor - Tyler, the Creator
  '1443049285',  // Blonde - Frank Ocean
  '1422648512',  // DAMN. - Kendrick Lamar
  '1440833098',  // Currents - Tame Impala
  '1440890906',  // Channel Orange - Frank Ocean
  '1440935467',  // In Rainbows - Radiohead
  '1440783045',  // Abbey Road - The Beatles
  '1443155066',  // My Beautiful Dark Twisted Fantasy - Kanye West
  '1440829460',  // OK Computer - Radiohead
  '1440857804',  // Flower Boy - Tyler, the Creator
  '1440879525',  // To Pimp a Butterfly - Kendrick Lamar
  '1441164495',  // The Dark Side of the Moon - Pink Floyd
];


// ─── Star SVG Helper ─────────────────────────

function starSVG(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}

function heartSVG(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function renderStars(rating, size = 14) {
  if (!rating) return '';
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      html += `<span class="star-svg filled">${starSVG(size)}</span>`;
    } else if (rating >= i - 0.5) {
      html += `<span class="star-half-wrap" style="position:relative;display:inline-flex;width:${size}px;height:${size}px">
        <span class="star-svg filled" style="position:absolute;clip-path:inset(0 50% 0 0)">${starSVG(size)}</span>
        <span class="star-svg" style="position:absolute;clip-path:inset(0 0 0 50%)">${starSVG(size)}</span>
      </span>`;
    } else {
      html += `<span class="star-svg">${starSVG(size)}</span>`;
    }
  }
  html += '</span>';
  return html;
}

function renderInteractiveStars(currentRating, large = false) {
  const cls = large ? 'stars-interactive lg' : 'stars-interactive';
  const sz = large ? 28 : 20;
  let html = `<div class="${cls}" id="modal-stars">`;
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star-interactive" data-star="${i}">
      <span class="star-half star-half-left" onclick="setModalRating(${i - 0.5})"></span>
      <span class="star-half star-half-right" onclick="setModalRating(${i})"></span>
      ${_renderSingleStar(i, currentRating, sz)}
    </span>`;
  }
  html += '</div>';
  return html;
}

function _renderSingleStar(starNum, rating, sz) {
  if (rating >= starNum) {
    return `<span class="star-svg filled">${starSVG(sz)}</span>`;
  } else if (rating >= starNum - 0.5) {
    return `<span class="star-half-visual" style="position:relative;display:inline-flex;width:${sz}px;height:${sz}px">
      <span class="star-svg filled" style="position:absolute;clip-path:inset(0 50% 0 0)">${starSVG(sz)}</span>
      <span class="star-svg" style="position:absolute;clip-path:inset(0 0 0 50%)">${starSVG(sz)}</span>
    </span>`;
  }
  return `<span class="star-svg">${starSVG(sz)}</span>`;
}

function setModalRating(val) {
  _modalRating = (_modalRating === val) ? 0 : val;
  const container = document.getElementById('modal-stars');
  if (container) {
    const sz = container.classList.contains('lg') ? 28 : 20;
    container.querySelectorAll('.star-interactive').forEach(el => {
      const starNum = parseInt(el.dataset.star);
      // Remove old visual, keep click zones
      const oldVis = el.querySelector('.star-svg, .star-half-visual');
      if (oldVis) oldVis.remove();
      el.insertAdjacentHTML('beforeend', _renderSingleStar(starNum, _modalRating, sz));
    });
  }
  const label = document.getElementById('rating-label');
  if (label) label.textContent = _modalRating ? _modalRating.toFixed(1) : '—';
}


// ─── View Switching ──────────────────────────

const ALL_VIEWS = ['home','search','album','profile','lists','list-detail','list-edit','stats','settings'];

function switchView(view, data) {
  _currentView = view;
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('active', v === view);
  });

  document.querySelectorAll('.mob-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  window.scrollTo(0, 0);

  switch (view) {
    case 'home':       loadHome(); break;
    case 'search':     renderSearchResults(data); break;
    case 'album':      loadAlbumDetail(data); break;
    case 'profile':    loadProfile(); break;
    case 'lists':      loadLists(); break;
    case 'list-detail':loadListDetail(data); break;
    case 'list-edit':  loadListEditor(data); break;
    case 'stats':      loadStats(); break;
    case 'settings':   loadSettings(); break;
  }
}

function focusSearch() {
  const input = document.getElementById('search-input');
  if (input) input.focus();
}


// ─── Search ──────────────────────────────────

function initSearch() {
  const input = document.getElementById('search-input');

  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideDropdown(); return; }
    _searchTimer = setTimeout(() => doQuickSearch(q), 350);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) doFullSearch(q);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar')) hideDropdown();
  });
}

async function doQuickSearch(query) {
  try {
    const results = await searchAlbums(query, 5);
    renderDropdown(results, query);
  } catch (e) {
    console.error('Search error:', e);
  }
}

function renderDropdown(albums, query) {
  const dropdown = document.getElementById('search-dropdown');
  if (!albums.length) { hideDropdown(); return; }

  let html = '';
  albums.forEach(a => {
    html += `
      <div class="search-dropdown-item" onclick="switchView('album','${a.collectionId}')">
        <img src="${a.artworkSmall}" alt="" loading="lazy" />
        <div class="sdi-info">
          <div class="sdi-name">${esc(a.collectionName)}</div>
          <div class="sdi-artist">${esc(a.artistName)}</div>
        </div>
      </div>`;
  });
  html += `<div class="search-dropdown-footer" onclick="doFullSearch('${esc(query)}')">View all results</div>`;

  dropdown.innerHTML = html;
  dropdown.classList.add('open');
}

function hideDropdown() {
  const d = document.getElementById('search-dropdown');
  if (d) d.classList.remove('open');
}

async function doFullSearch(query) {
  hideDropdown();
  document.getElementById('search-input').value = query;
  switchView('search', { query, results: null });
}

function renderSearchResults(data) {
  if (!data) return;
  const grid = document.getElementById('search-results-grid');
  const label = document.getElementById('search-query-label');
  const empty = document.getElementById('search-empty');

  label.textContent = `Results for "${data.query}"`;

  if (data.results) {
    renderAlbumGrid(grid, data.results);
    empty.style.display = data.results.length ? 'none' : '';
  } else {
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    empty.style.display = 'none';
    searchAlbums(data.query, 30).then(results => {
      renderAlbumGrid(grid, results);
      empty.style.display = results.length ? 'none' : '';
    });
  }
}


// ─── Album Grid Rendering ────────────────────

function renderAlbumGrid(container, albums) {
  container.innerHTML = albums.map(a => `
    <div class="album-card" onclick="switchView('album','${a.collectionId}')">
      <img src="${a.artworkSmall}" alt="${esc(a.collectionName)}" loading="lazy" />
      <div class="album-card-info">
        <div class="album-card-name">${esc(a.collectionName)}</div>
        <div class="album-card-artist">${esc(a.artistName)}</div>
      </div>
    </div>
  `).join('');
}


// ─── Home View ───────────────────────────────

async function loadHome() {
  const recentSection = document.getElementById('recent-section');
  const heroSection = document.getElementById('hero-banner');

  const logs = getUserLogs(8);
  if (logs.length) {
    heroSection.style.display = 'none';
    recentSection.style.display = '';
    loadRecentAlbums(logs);
  } else {
    heroSection.style.display = '';
    recentSection.style.display = 'none';
  }

  loadPopularAlbums();
}

async function loadPopularAlbums() {
  const grid = document.getElementById('popular-grid');
  if (grid.children.length > 0) return;

  grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const results = await Promise.all(
      POPULAR_IDS.map(id => lookupAlbum(id).catch(() => null))
    );
    const albums = results.filter(Boolean);
    renderAlbumGrid(grid, albums);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>Could not load albums.</p></div>';
  }
}

function loadRecentAlbums(logs) {
  const grid = document.getElementById('recent-grid');
  if (!logs.length) {
    grid.innerHTML = '<div class="empty-state"><p>No albums logged yet. Search and log your first!</p></div>';
    return;
  }
  grid.innerHTML = logs.map(l => `
    <div class="album-card" onclick="switchView('album','${l.albumId}')">
      <img src="${(l.artworkUrl || '').replace('600x600','300x300')}" alt="${esc(l.albumName)}" loading="lazy" />
      <div class="album-card-info">
        <div class="album-card-name">${esc(l.albumName)}</div>
        <div class="album-card-artist">${esc(l.artistName)}</div>
        ${l.rating ? `<div class="album-card-rating">${renderStars(l.rating, 11)}</div>` : ''}
      </div>
    </div>
  `).join('');
}


// ─── Album Detail View ──────────────────────

async function loadAlbumDetail(albumId) {
  const wrap = document.getElementById('album-detail');
  wrap.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const album = await lookupAlbum(albumId);
    const stats = getAlbumStats(albumId);
    const myLog = getUserLogForAlbum(albumId);

    if (!album) {
      wrap.innerHTML = '<div class="empty-state"><p>Album not found.</p></div>';
      return;
    }

    const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';
    const avgRating = stats.averageRating ? stats.averageRating.toFixed(1) : '—';

    let html = `
      <div class="album-hero">
        <div class="album-poster">
          <img src="${album.artworkUrl}" alt="${esc(album.collectionName)}" />
        </div>
        <div class="album-info">
          <h1 class="album-title">${esc(album.collectionName)}</h1>
          <p class="album-artist">${esc(album.artistName)}</p>
          <div class="album-meta">
            ${year ? `<span>${year}</span>` : ''}
            ${album.primaryGenreName ? `<span>${esc(album.primaryGenreName)}</span>` : ''}
            ${album.trackCount ? `<span>${album.trackCount} tracks</span>` : ''}
          </div>
          <div class="album-actions">
            ${myLog
              ? `<button class="btn-primary" onclick="openLogModal('${albumId}',true)">Edit Log</button>
                 <button class="btn-danger btn-sm" onclick="confirmDeleteLog('${myLog.id}','${albumId}')">Remove</button>`
              : `<button class="btn-primary" onclick="openLogModal('${albumId}')">Log Album</button>`
            }
            <button class="btn-secondary" onclick="addToList('${albumId}')">+ Add to List</button>
          </div>
        </div>
      </div>`;

    if (myLog) {
      html += `
        <div class="your-log">
          <div class="your-log-header">
            <span class="your-log-label">Your Log</span>
            <div class="your-log-rating">
              ${myLog.rating ? renderStars(myLog.rating, 16) : '<span style="color:var(--text-muted);font-size:.8rem">No rating</span>'}
              ${myLog.liked ? `<span class="liked-badge">${heartSVG(16)}</span>` : ''}
            </div>
          </div>
          ${myLog.reviewText ? `<p class="your-log-text">${esc(myLog.reviewText)}</p>` : ''}
        </div>`;
    }

    wrap.innerHTML = html;

  } catch (e) {
    console.error('Album detail error:', e);
    wrap.innerHTML = '<div class="empty-state"><p>Error loading album.</p></div>';
  }
}

function confirmDeleteLog(logId, albumId) {
  if (!confirm('Remove this log? This cannot be undone.')) return;
  deleteLog(logId);
  loadAlbumDetail(albumId);
}


// ─── Log / Review Modal ─────────────────────

async function openLogModal(albumId, editing = false) {
  const album = await lookupAlbum(albumId);
  if (!album) return;

  _modalAlbum = album;
  _modalRating = 0;
  _modalLiked = false;
  _modalExistingLog = null;

  let dateVal = new Date().toISOString().split('T')[0];

  if (editing) {
    const log = getUserLogForAlbum(albumId);
    if (log) {
      _modalExistingLog = log;
      _modalRating = log.rating || 0;
      _modalLiked = log.liked || false;
      dateVal = log.listenedDate || dateVal;
    }
  }

  document.getElementById('modal-title').textContent = editing ? 'Edit Log' : 'Log Album';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-album-info">
      <img class="modal-album-art" src="${album.artworkSmall}" alt="" />
      <div>
        <div class="modal-album-name">${esc(album.collectionName)}</div>
        <div class="modal-album-artist">${esc(album.artistName)}</div>
      </div>
    </div>

    <div class="form-group">
      <div class="modal-rating-row">
        <label class="form-label" style="margin-bottom:0">Rating</label>
        <span id="rating-label" style="font-size:.85rem;font-weight:700;color:var(--accent)">${_modalRating ? _modalRating.toFixed(1) : '—'}</span>
      </div>
      ${renderInteractiveStars(_modalRating, true)}
    </div>

    <div class="form-group">
      <div class="modal-liked-row">
        <div class="liked-toggle ${_modalLiked ? 'active' : ''}" id="liked-toggle" onclick="toggleLiked()">
          <span style="color:${_modalLiked ? 'var(--liked)' : 'var(--text-muted)'}">${heartSVG(18)}</span>
        </div>
        <span style="font-size:.78rem;color:var(--text-muted)">Like</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Review (optional)</label>
      <textarea class="form-input" id="modal-review" placeholder="What did you think?">${_modalExistingLog ? esc(_modalExistingLog.reviewText || '') : ''}</textarea>
    </div>

    <div class="modal-footer">
      ${editing && _modalExistingLog ? `<button class="btn-danger btn-sm" onclick="confirmDeleteLog('${_modalExistingLog.id}','${albumId}');closeModal()">Delete</button>` : ''}
      <button class="btn-primary" onclick="submitLog()">Save</button>
    </div>
  `;

  openModalUI();
}

function toggleLiked() {
  _modalLiked = !_modalLiked;
  const el = document.getElementById('liked-toggle');
  el.classList.toggle('active', _modalLiked);
  el.querySelector('span').style.color = _modalLiked ? 'var(--liked)' : 'var(--text-muted)';
}

function submitLog() {
  if (!_modalAlbum) return;

  const review = document.getElementById('modal-review').value.trim();

  const data = {
    albumId:      _modalAlbum.collectionId,
    albumName:    _modalAlbum.collectionName,
    artistName:   _modalAlbum.artistName,
    artworkUrl:   _modalAlbum.artworkUrl,
    genre:        _modalAlbum.primaryGenreName,
    rating:       _modalRating || null,
    reviewText:   review,
    liked:        _modalLiked,
  };

  if (_modalExistingLog) {
    updateLog(_modalExistingLog.id, {
      rating:       data.rating,
      reviewText:   data.reviewText,
      liked:        data.liked,
    });
  } else {
    logAlbum(data);
  }

  closeModal();
  loadAlbumDetail(_modalAlbum.collectionId);
}

function openModalUI() {
  document.getElementById('modal-backdrop').classList.add('open');
  document.getElementById('log-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('log-modal').classList.remove('open');
  document.body.style.overflow = '';
}


// ─── Add to List (quick) ─────────────────────

async function addToList(albumId) {
  const album = await lookupAlbum(albumId);
  if (!album) return;

  const lists = getUserLists();

  if (!lists.length) {
    if (confirm('You have no lists yet. Create one?')) {
      switchView('list-edit', { newWithAlbum: album });
    }
    return;
  }

  const names = lists.map((l, i) => `${i + 1}. ${l.title}`).join('\n');
  const choice = prompt(`Add "${album.collectionName}" to which list?\n\n${names}\n\nEnter number (or 0 to create new):`);
  if (choice === null) return;

  const idx = parseInt(choice) - 1;
  if (choice === '0' || isNaN(idx) || idx < 0) {
    switchView('list-edit', { newWithAlbum: album });
    return;
  }

  if (idx >= lists.length) return;

  const list = lists[idx];
  if (list.albums.some(a => a.collectionId === album.collectionId)) {
    alert('Album already in this list.');
    return;
  }

  list.albums.push({
    collectionId: album.collectionId,
    name: album.collectionName,
    artist: album.artistName,
    artwork: album.artworkSmall,
  });
  updateList(list.id, { albums: list.albums });
  alert(`Added to "${list.title}"!`);
}


// ─── Profile View ────────────────────────────

function loadProfile() {
  const wrap = document.getElementById('profile-wrap');
  const profile = getUserProfile();
  const logs = getUserLogs(200);
  const lists = getUserLists();

  const totalLogged = logs.length;
  const thisYear = logs.filter(l => (l.listenedDate || '').startsWith(String(new Date().getFullYear()))).length;
  const rated = logs.filter(l => l.rating);
  const avgRating = rated.length ? (rated.reduce((s, l) => s + l.rating, 0) / rated.length) : 0;

  const favs = profile.favoriteAlbums || [];
  let favsHtml = '';
  for (let i = 0; i < 4; i++) {
    if (favs[i]) {
      favsHtml += `<img src="${favs[i].artwork}" alt="${esc(favs[i].name)}" onclick="switchView('album','${favs[i].collectionId}')" style="cursor:pointer" />`;
    } else {
      favsHtml += `<div class="fav-placeholder" onclick="editFavorites()">+</div>`;
    }
  }

  wrap.innerHTML = `
    <div class="profile-banner">
      <div class="profile-banner-inner">
        <div class="profile-name-large">${esc(profile.displayName)}</div>
        ${profile.bio ? `<p class="profile-bio-large">${esc(profile.bio)}</p>` : ''}
        <div class="profile-stats-bar">
          <div class="profile-stat-pill">
            <span class="profile-stat-val">${totalLogged}</span>
            <span class="profile-stat-lbl">Albums</span>
          </div>
          <div class="profile-stat-pill">
            <span class="profile-stat-val">${thisYear}</span>
            <span class="profile-stat-lbl">This Year</span>
          </div>
          <div class="profile-stat-pill">
            <span class="profile-stat-val">${avgRating ? avgRating.toFixed(1) : '—'}</span>
            <span class="profile-stat-lbl">Avg Rating</span>
          </div>
          <div class="profile-stat-pill">
            <span class="profile-stat-val">${lists.length}</span>
            <span class="profile-stat-lbl">Lists</span>
          </div>
        </div>
        <div class="profile-actions-bar">
          <button class="btn-secondary btn-sm" onclick="switchView('settings')">Edit Profile</button>
          <button class="btn-secondary btn-sm" onclick="switchView('lists')">My Lists</button>
          <button class="btn-secondary btn-sm" onclick="switchView('stats')">Stats</button>
        </div>
      </div>
    </div>

    <div class="profile-favs-section">
      <div class="favorite-albums-title">Favorite Albums</div>
      <div class="profile-favs-grid">${favsHtml}</div>
    </div>

    <div class="profile-tabs">
      <div class="profile-tab active" onclick="switchProfileTab('diary')">Diary</div>
      <div class="profile-tab" onclick="switchProfileTab('reviews')">Reviews</div>
      <div class="profile-tab" onclick="switchProfileTab('lists')">Lists</div>
    </div>

    <div class="profile-tab-content active" id="ptab-diary">
      ${renderDiary(logs)}
    </div>
    <div class="profile-tab-content" id="ptab-reviews">
      ${renderProfileReviews(logs)}
    </div>
    <div class="profile-tab-content" id="ptab-lists">
      ${renderListsGrid(lists)}
    </div>
  `;
}

function switchProfileTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.toLowerCase() === tab);
  });
  ['diary', 'reviews', 'lists'].forEach(t => {
    const el = document.getElementById('ptab-' + t);
    if (el) el.classList.toggle('active', t === tab);
  });
}

function renderDiary(logs) {
  if (!logs.length) return '<div class="empty-state"><p>No albums logged yet.</p></div>';

  return logs.map(l => `
    <div class="diary-entry">
      <img class="diary-art" src="${(l.artworkUrl || '').replace('600x600','300x300')}" alt="" onclick="switchView('album','${l.albumId}')" />
      <div class="diary-info">
        <div class="diary-name" onclick="switchView('album','${l.albumId}')">${esc(l.albumName)}</div>
        <div class="diary-artist">${esc(l.artistName)}</div>
      </div>
      <div class="diary-rating">
        ${l.rating ? renderStars(l.rating, 12) : ''}
        ${l.liked ? `<span class="liked-badge">${heartSVG(14)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderProfileReviews(logs) {
  const reviews = logs.filter(l => l.reviewText);
  if (!reviews.length) return '<div class="empty-state"><p>No reviews written yet.</p></div>';

  return reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <img class="review-avatar" src="${(r.artworkUrl || '').replace('600x600','300x300')}" alt=""
             onclick="switchView('album','${r.albumId}')" style="border-radius:4px" />
        <div>
          <span class="review-user" onclick="switchView('album','${r.albumId}')" style="cursor:pointer">${esc(r.albumName)}</span>
          <div style="font-size:.7rem;color:var(--text-muted)">${esc(r.artistName)}</div>
        </div>
        <div class="review-meta">
          ${r.rating ? renderStars(r.rating, 12) : ''}
        </div>
      </div>
      <p class="review-text">${esc(r.reviewText)}</p>
    </div>
  `).join('');
}

async function editFavorites() {
  const query = prompt('Search for an album to add to favorites:');
  if (!query) return;

  const results = await searchAlbums(query, 5);
  if (!results.length) { alert('No albums found.'); return; }

  const names = results.map((a, i) => `${i + 1}. ${a.collectionName} — ${a.artistName}`).join('\n');
  const choice = prompt(`Pick an album:\n\n${names}\n\nEnter number:`);
  if (!choice) return;

  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= results.length) return;

  const album = results[idx];
  const profile = getUserProfile();
  const favs = profile.favoriteAlbums || [];

  if (favs.length >= 4) {
    alert('Maximum 4 favorite albums. Remove one first from Settings.');
    return;
  }

  favs.push({
    collectionId: album.collectionId,
    name: album.collectionName,
    artist: album.artistName,
    artwork: album.artworkSmall,
  });

  updateUserProfile({ favoriteAlbums: favs });
  loadProfile();
}


// ─── Lists Views ─────────────────────────────

function loadLists() {
  const wrap = document.getElementById('lists-wrap');
  const lists = getUserLists();

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
      <h2 class="page-title" style="margin:0">Your Lists</h2>
      <button class="btn-primary btn-sm" onclick="switchView('list-edit')">+ New List</button>
    </div>
  `;

  if (!lists.length) {
    html += '<div class="empty-state"><p>No lists yet. Create your first ranked list!</p></div>';
  } else {
    html += renderListsGrid(lists);
  }

  wrap.innerHTML = html;
}

function renderListsGrid(lists) {
  if (!lists.length) return '<div class="empty-state"><p>No lists.</p></div>';

  return `<div class="lists-grid">${lists.map(l => {
    const thumbs = (l.albums || []).slice(0, 4);
    let thumbsHtml = thumbs.map(a => `<img src="${a.artwork}" alt="" />`).join('');
    for (let i = thumbs.length; i < 4; i++) {
      thumbsHtml += '<div style="aspect-ratio:1;background:var(--bg-secondary);border-radius:3px"></div>';
    }

    return `
      <div class="list-card" onclick="switchView('list-detail','${l.id}')">
        <div class="list-card-thumbs">${thumbsHtml}</div>
        <div class="list-card-title">${esc(l.title)}</div>
        <div class="list-card-meta">${(l.albums || []).length} albums</div>
      </div>`;
  }).join('')}</div>`;
}

function loadListDetail(listId) {
  const wrap = document.getElementById('list-detail-wrap');
  const list = getListById(listId);

  if (!list) {
    wrap.innerHTML = '<div class="empty-state"><p>List not found.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="list-header">
      <h1 class="list-title">${esc(list.title)}</h1>
      ${list.description ? `<p class="list-desc">${esc(list.description)}</p>` : ''}
      <div style="display:flex;gap:.5rem">
        <button class="btn-secondary btn-sm" onclick="switchView('list-edit','${list.id}')">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDeleteList('${list.id}')">Delete</button>
      </div>
    </div>
    <div class="list-albums">
      ${(list.albums || []).map(a => `
        <div class="list-album-item">
          <div class="list-rank"></div>
          <img class="list-album-art" src="${a.artwork}" alt="" onclick="switchView('album','${a.collectionId}')" />
          <div class="list-album-info">
            <div class="list-album-name" onclick="switchView('album','${a.collectionId}')">${esc(a.name)}</div>
            <div class="list-album-artist">${esc(a.artist)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function confirmDeleteList(listId) {
  if (!confirm('Delete this list? This cannot be undone.')) return;
  deleteList(listId);
  switchView('lists');
}

function loadListEditor(data) {
  const wrap = document.getElementById('list-edit-wrap');

  _listEditAlbums = [];
  _listEditId = null;
  let title = '';
  let desc = '';

  if (data && typeof data === 'string') {
    const list = getListById(data);
    if (list) {
      _listEditId = list.id;
      _listEditAlbums = [...list.albums];
      title = list.title;
      desc = list.description || '';
    }
  }

  if (data && data.newWithAlbum) {
    const a = data.newWithAlbum;
    _listEditAlbums = [{
      collectionId: a.collectionId,
      name: a.collectionName,
      artist: a.artistName,
      artwork: a.artworkSmall,
    }];
  }

  wrap.innerHTML = `
    <h2 class="page-title">${_listEditId ? 'Edit List' : 'New List'}</h2>

    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" id="list-title" value="${esc(title)}" placeholder="Best Albums of 2025..." />
    </div>

    <div class="form-group">
      <label class="form-label">Description (optional)</label>
      <textarea class="form-input" id="list-desc" placeholder="What's this list about?" style="min-height:60px">${esc(desc)}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">Add Albums</label>
      <div class="list-edit-search">
        <input class="form-input" id="list-search-input" placeholder="Search to add albums..." autocomplete="off" />
        <div class="list-edit-results" id="list-search-results"></div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Albums</label>
      <div id="list-edit-items"></div>
    </div>

    <div style="display:flex;gap:.5rem">
      <button class="btn-primary" onclick="saveList()">Save List</button>
      <button class="btn-secondary" onclick="switchView('lists')">Cancel</button>
    </div>
  `;

  renderListEditItems();
  initListSearch();
}

function initListSearch() {
  const input = document.getElementById('list-search-input');
  const results = document.getElementById('list-search-results');
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results.classList.remove('open'); return; }
    timer = setTimeout(async () => {
      const albums = await searchAlbums(q, 6);
      if (!albums.length) { results.classList.remove('open'); return; }
      results.innerHTML = albums.map(a => `
        <div class="search-dropdown-item" onclick="addAlbumToListEdit('${a.collectionId}')">
          <img src="${a.artworkSmall}" alt="" />
          <div class="sdi-info">
            <div class="sdi-name">${esc(a.collectionName)}</div>
            <div class="sdi-artist">${esc(a.artistName)}</div>
          </div>
        </div>
      `).join('');
      results.classList.add('open');
    }, 350);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.list-edit-search')) results.classList.remove('open');
  });
}

function addAlbumToListEdit(collectionId) {
  if (_listEditAlbums.some(a => a.collectionId === collectionId)) return;
  const album = _albumCache[collectionId];
  if (!album) return;

  _listEditAlbums.push({
    collectionId: album.collectionId,
    name: album.collectionName,
    artist: album.artistName,
    artwork: album.artworkSmall,
  });

  renderListEditItems();
  document.getElementById('list-search-input').value = '';
  document.getElementById('list-search-results').classList.remove('open');
}

function renderListEditItems() {
  const container = document.getElementById('list-edit-items');
  if (!container) return;

  if (!_listEditAlbums.length) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem"><p>No albums added yet.</p></div>';
    return;
  }

  container.innerHTML = _listEditAlbums.map((a, i) => `
    <div class="list-edit-item">
      <span style="font-weight:800;color:var(--text-muted);width:24px;text-align:center;flex-shrink:0">${i + 1}</span>
      <img src="${a.artwork}" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0" />
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.name)}</div>
        <div style="font-size:.68rem;color:var(--text-muted)">${esc(a.artist)}</div>
      </div>
      <div class="move-btns">
        ${i > 0 ? `<button class="move-btn" onclick="moveListItem(${i},-1)">&uarr;</button>` : '<div style="width:24px;height:18px"></div>'}
        ${i < _listEditAlbums.length - 1 ? `<button class="move-btn" onclick="moveListItem(${i},1)">&darr;</button>` : '<div style="width:24px;height:18px"></div>'}
      </div>
      <span class="remove-btn" onclick="removeListItem(${i})">&times;</span>
    </div>
  `).join('');
}

function moveListItem(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _listEditAlbums.length) return;
  const temp = _listEditAlbums[idx];
  _listEditAlbums[idx] = _listEditAlbums[newIdx];
  _listEditAlbums[newIdx] = temp;
  renderListEditItems();
}

function removeListItem(idx) {
  _listEditAlbums.splice(idx, 1);
  renderListEditItems();
}

function saveList() {
  const title = document.getElementById('list-title').value.trim();
  if (!title) { alert('Please enter a title.'); return; }

  const desc = document.getElementById('list-desc').value.trim();

  if (_listEditId) {
    updateList(_listEditId, { title, description: desc, albums: _listEditAlbums });
    switchView('list-detail', _listEditId);
  } else {
    const id = createList({ title, description: desc, albums: _listEditAlbums });
    switchView('list-detail', id);
  }
}


// ─── Stats View ──────────────────────────────

function loadStats() {
  const wrap = document.getElementById('stats-wrap');
  const stats = computeUserStats();

  if (!stats.totalLogged) {
    wrap.innerHTML = `
      <h2 class="page-title">Your Stats</h2>
      <div class="empty-state"><p>Log some albums to see your stats!</p></div>
    `;
    return;
  }

  let html = `
    <h2 class="page-title">Your Stats</h2>
    <p class="page-sub">Your listening statistics at a glance</p>

    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-card-val">${stats.totalLogged}</div>
        <div class="stat-card-lbl">Albums</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val">${stats.thisYear}</div>
        <div class="stat-card-lbl">This Year</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val">${stats.averageRating ? stats.averageRating.toFixed(1) : '—'}</div>
        <div class="stat-card-lbl">Avg Rating</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val">${stats.totalReviews}</div>
        <div class="stat-card-lbl">Reviews</div>
      </div>
    </div>
  `;

  // Monthly chart
  if (stats.monthlyBreakdown.length) {
    const maxMonth = Math.max(...stats.monthlyBreakdown.map(m => m.count));
    html += `
      <div class="stats-chart">
        <div class="stats-chart-title">Albums Per Month</div>
        <div class="bar-chart">
          ${stats.monthlyBreakdown.map(m => {
            const pct = maxMonth > 0 ? (m.count / maxMonth) * 100 : 0;
            const label = m.month.slice(5);
            const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthLabel = monthNames[parseInt(label)] || label;
            return `
              <div class="bar-col">
                <div class="bar-fill" style="height:${pct}%"></div>
                <div class="bar-label">${monthLabel}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Genre breakdown
  if (stats.genreBreakdown.length) {
    const maxGenre = stats.genreBreakdown[0].count;
    html += `
      <div class="stats-chart">
        <div class="stats-chart-title">Top Genres</div>
        ${stats.genreBreakdown.map(g => {
          const pct = maxGenre > 0 ? (g.count / maxGenre) * 100 : 0;
          return `
            <div class="h-bar-row">
              <div class="h-bar-label">${esc(g.name)}</div>
              <div class="h-bar-track"><div class="h-bar-fill" style="width:${pct}%"></div></div>
              <div class="h-bar-val">${g.count}</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  // Rating distribution
  const ratingKeys = ['0.5','1','1.5','2','2.5','3','3.5','4','4.5','5'];
  const hasRatings = ratingKeys.some(k => stats.ratingDist[k]);
  if (hasRatings) {
    const maxRating = Math.max(...ratingKeys.map(k => stats.ratingDist[k] || 0));
    html += `
      <div class="stats-chart">
        <div class="stats-chart-title">Rating Distribution</div>
        <div class="rating-dist">
          ${ratingKeys.map(k => {
            const count = stats.ratingDist[k] || 0;
            const pct = maxRating > 0 ? (count / maxRating) * 100 : 0;
            return `
              <div class="rating-dist-row">
                <div class="rating-dist-label">${k}</div>
                <div class="rating-dist-bar"><div class="rating-dist-fill" style="width:${pct}%"></div></div>
                <div class="rating-dist-count">${count}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Highest rated
  if (stats.highestRated) {
    html += `
      <div class="stats-chart">
        <div class="stats-chart-title">Highest Rated</div>
        <div style="display:flex;align-items:center;gap:.85rem;cursor:pointer" onclick="switchView('album','${stats.highestRated.albumId}')">
          <img src="${(stats.highestRated.artworkUrl || '').replace('600x600','300x300')}" alt=""
               style="width:56px;height:56px;border-radius:6px;object-fit:cover" />
          <div>
            <div style="font-weight:700;font-size:.88rem">${esc(stats.highestRated.albumName)}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${esc(stats.highestRated.artistName)}</div>
            <div style="margin-top:.25rem">${renderStars(stats.highestRated.rating, 14)}</div>
          </div>
        </div>
      </div>`;
  }

  wrap.innerHTML = html;
}


// ─── Settings View ───────────────────────────

function loadSettings() {
  const wrap = document.getElementById('settings-wrap');
  const profile = getUserProfile();

  wrap.innerHTML = `
    <h2 class="page-title">Settings</h2>

    <div class="settings-section">
      <div class="settings-section-title">Profile</div>
      <div class="form-group">
        <label class="form-label">Display Name</label>
        <input class="form-input" id="settings-name" value="${esc(profile.displayName || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Bio</label>
        <textarea class="form-input" id="settings-bio" style="min-height:60px">${esc(profile.bio || '')}</textarea>
      </div>
      <button class="btn-primary btn-sm" onclick="saveSettings()">Save Changes</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Favorite Albums</div>
      <div class="favorite-albums-grid" style="margin-bottom:1rem">
        ${(profile.favoriteAlbums || []).map((a, i) => `
          <div style="position:relative">
            <img src="${a.artwork}" alt="${esc(a.name)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px" />
            <button onclick="removeFavorite(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.7);
              color:var(--danger);border:none;border-radius:50%;width:22px;height:22px;font-size:.8rem;cursor:pointer">&times;</button>
          </div>
        `).join('')}
        ${(profile.favoriteAlbums || []).length < 4
          ? `<div class="fav-placeholder" onclick="editFavorites()">+</div>`
          : ''}
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Data</div>
      <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:.75rem">All data is stored locally in your browser.</p>
      <button class="btn-danger btn-sm" onclick="clearAllData()">Clear All Data</button>
    </div>
  `;
}

function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  const bio = document.getElementById('settings-bio').value.trim();
  if (!name) { alert('Display name is required.'); return; }
  updateUserProfile({ displayName: name, bio });
  alert('Settings saved!');
}

function removeFavorite(idx) {
  const profile = getUserProfile();
  const favs = profile.favoriteAlbums || [];
  favs.splice(idx, 1);
  updateUserProfile({ favoriteAlbums: favs });
  loadSettings();
}

function clearAllData() {
  if (!confirm('This will delete all your logged albums, lists, and profile data. Are you sure?')) return;
  localStorage.removeItem('musicboxd_logs');
  localStorage.removeItem('musicboxd_lists');
  localStorage.removeItem('musicboxd_profile');
  alert('All data cleared.');
  switchView('home');
}


// ─── Utilities ───────────────────────────────

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// ─── Initialize ──────────────────────────────

initSearch();
loadHome();
