/* ═══════════════════════════════════════════
   MUSICBOXD — API Layer
   iTunes Search API + localStorage persistence
   ═══════════════════════════════════════════ */

// ─── iTunes Search API ───────────────────────

const _albumCache = {};

async function searchAlbums(query, limit = 20) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  const albums = (data.results || []).map(_parseAlbum);
  albums.forEach(a => { _albumCache[a.collectionId] = a; });
  return albums;
}

async function lookupAlbum(collectionId) {
  if (_albumCache[collectionId]) return _albumCache[collectionId];
  const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=album`);
  const data = await res.json();
  if (!data.results || !data.results.length) return null;
  const album = _parseAlbum(data.results[0]);
  _albumCache[collectionId] = album;
  return album;
}

function _parseAlbum(a) {
  return {
    collectionId:    String(a.collectionId),
    collectionName:  a.collectionName,
    artistName:      a.artistName,
    artworkUrl:      (a.artworkUrl100 || '').replace('100x100', '600x600'),
    artworkSmall:    (a.artworkUrl100 || '').replace('100x100', '300x300'),
    primaryGenreName:a.primaryGenreName || '',
    releaseDate:     a.releaseDate || '',
    trackCount:      a.trackCount || 0,
  };
}


// ─── localStorage helpers ────────────────────

const LS_LOGS    = 'musicboxd_logs';
const LS_LISTS   = 'musicboxd_lists';
const LS_PROFILE = 'musicboxd_profile';

function _getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function _setJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


// ─── User Profile ────────────────────────────

function getUserProfile() {
  return _getJSON(LS_PROFILE, {
    displayName: 'User',
    username:    'user',
    bio:         '',
    favoriteAlbums: [],
  });
}

function updateUserProfile(data) {
  const profile = getUserProfile();
  Object.assign(profile, data);
  _setJSON(LS_PROFILE, profile);
}


// ─── Album Logging ───────────────────────────

function logAlbum(data) {
  const logs = _getJSON(LS_LOGS, []);
  const entry = {
    id:           _genId(),
    albumId:      data.albumId,
    albumName:    data.albumName,
    artistName:   data.artistName,
    artworkUrl:   data.artworkUrl,
    genre:        data.genre || '',
    rating:       data.rating || null,
    reviewText:   data.reviewText || '',
    listenedDate: data.listenedDate || new Date().toISOString().split('T')[0],
    loggedAt:     new Date().toISOString(),
    liked:        data.liked || false,
  };
  logs.unshift(entry);
  _setJSON(LS_LOGS, logs);
  return entry.id;
}

function updateLog(logId, data) {
  const logs = _getJSON(LS_LOGS, []);
  const idx = logs.findIndex(l => l.id === logId);
  if (idx === -1) return;
  Object.assign(logs[idx], data);
  _setJSON(LS_LOGS, logs);
}

function deleteLog(logId) {
  const logs = _getJSON(LS_LOGS, []);
  _setJSON(LS_LOGS, logs.filter(l => l.id !== logId));
}

function getUserLogs(limit = 100) {
  const logs = _getJSON(LS_LOGS, []);
  return logs.slice(0, limit);
}

function getUserLogForAlbum(albumId) {
  const logs = _getJSON(LS_LOGS, []);
  return logs.find(l => l.albumId === albumId) || null;
}

function getAlbumLogs(albumId) {
  const logs = _getJSON(LS_LOGS, []);
  return logs.filter(l => l.albumId === albumId);
}

function getAlbumStats(albumId) {
  const logs = getAlbumLogs(albumId);
  const rated = logs.filter(l => l.rating);
  return {
    totalLogs:     logs.length,
    averageRating: rated.length ? rated.reduce((s, l) => s + l.rating, 0) / rated.length : 0,
    ratingCount:   rated.length,
  };
}


// ─── Lists ───────────────────────────────────

function createList(data) {
  const lists = _getJSON(LS_LISTS, []);
  const entry = {
    id:          _genId(),
    title:       data.title,
    description: data.description || '',
    albums:      data.albums || [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  lists.unshift(entry);
  _setJSON(LS_LISTS, lists);
  return entry.id;
}

function updateList(listId, data) {
  const lists = _getJSON(LS_LISTS, []);
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) return;
  Object.assign(lists[idx], data, { updatedAt: new Date().toISOString() });
  _setJSON(LS_LISTS, lists);
}

function deleteList(listId) {
  const lists = _getJSON(LS_LISTS, []);
  _setJSON(LS_LISTS, lists.filter(l => l.id !== listId));
}

function getUserLists() {
  return _getJSON(LS_LISTS, []);
}

function getListById(listId) {
  const lists = _getJSON(LS_LISTS, []);
  return lists.find(l => l.id === listId) || null;
}


// ─── Stats (computed from logs) ──────────────

function computeUserStats() {
  const logs = _getJSON(LS_LOGS, []);
  if (!logs.length) {
    return {
      totalLogged: 0, totalReviews: 0, averageRating: 0,
      thisYear: 0, genreBreakdown: [], monthlyBreakdown: [],
      ratingDist: {}, highestRated: null,
    };
  }

  const thisYear = new Date().getFullYear();
  let ratingSum = 0, ratingCount = 0, reviewCount = 0, thisYearCount = 0;
  const genres = {};
  const months = {};
  const ratingDist = {};

  for (const log of logs) {
    if (log.reviewText) reviewCount++;
    if (log.rating) {
      ratingSum += log.rating;
      ratingCount++;
      const rKey = String(log.rating);
      ratingDist[rKey] = (ratingDist[rKey] || 0) + 1;
    }

    const date = log.listenedDate || '';
    if (date.startsWith(String(thisYear))) thisYearCount++;

    const monthKey = date.slice(0, 7);
    if (monthKey) months[monthKey] = (months[monthKey] || 0) + 1;

    const genre = log.genre || (_albumCache[log.albumId] && _albumCache[log.albumId].primaryGenreName);
    if (genre) {
      genres[genre] = (genres[genre] || 0) + 1;
    }
  }

  const genreBreakdown = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const monthlyBreakdown = Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  const highestRated = logs
    .filter(l => l.rating)
    .sort((a, b) => b.rating - a.rating)[0] || null;

  return {
    totalLogged:  logs.length,
    totalReviews: reviewCount,
    averageRating: ratingCount > 0 ? (ratingSum / ratingCount) : 0,
    thisYear:     thisYearCount,
    genreBreakdown,
    monthlyBreakdown,
    ratingDist,
    highestRated,
  };
}
