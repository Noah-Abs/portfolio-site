/* ═══════════════════════════════════════════
   MUSICBOXD — API Layer
   iTunes Search API + Firebase Firestore CRUD
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


// ─── Firebase Auth ───────────────────────────

async function signInWithGoogle() {
  if (!_firebaseReady) { alert('Firebase not configured. Edit firebase-config.js first.'); return null; }
  try {
    const result = await auth.signInWithPopup(googleProvider);
    return result.user;
  } catch (e) {
    console.error('Sign-in error:', e);
    return null;
  }
}

function signOutUser() {
  if (!_firebaseReady) return;
  return auth.signOut();
}


// ─── User Profile ────────────────────────────

async function ensureUserProfile(user) {
  if (!_firebaseReady || !user) return null;
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();

  const profile = {
    uid:            user.uid,
    displayName:    user.displayName || 'User',
    photoURL:       user.photoURL || '',
    username:       (user.email || '').split('@')[0] || 'user' + Date.now(),
    bio:            '',
    favoriteAlbums: [],
    following:      [],
    followers:      [],
    joinedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    stats:          { totalLogged: 0, totalReviews: 0, averageRating: 0 }
  };
  await ref.set(profile);
  return profile;
}

async function getUserProfile(uid) {
  if (!_firebaseReady) return null;
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function updateUserProfile(uid, data) {
  if (!_firebaseReady) return;
  await db.collection('users').doc(uid).update(data);
}

async function searchUsers(query) {
  if (!_firebaseReady) return [];
  const snap = await db.collection('users')
    .where('username', '>=', query.toLowerCase())
    .where('username', '<=', query.toLowerCase() + '\uf8ff')
    .limit(10)
    .get();
  return snap.docs.map(d => d.data());
}


// ─── Album Logging ───────────────────────────

async function logAlbum(data) {
  if (!_firebaseReady || !currentUser) return null;

  const logDoc = {
    userId:       currentUser.uid,
    albumId:      data.albumId,
    albumName:    data.albumName,
    artistName:   data.artistName,
    artworkUrl:   data.artworkUrl,
    rating:       data.rating || null,
    reviewText:   data.reviewText || '',
    listenedDate: data.listenedDate || new Date().toISOString().split('T')[0],
    loggedAt:     firebase.firestore.FieldValue.serverTimestamp(),
    liked:        data.liked || false,
  };

  const ref = await db.collection('logs').add(logDoc);

  // Upsert album doc
  const albumRef = db.collection('albums').doc(data.albumId);
  const albumSnap = await albumRef.get();
  if (!albumSnap.exists) {
    await albumRef.set({
      collectionId:    data.albumId,
      collectionName:  data.albumName,
      artistName:      data.artistName,
      artworkUrl:      data.artworkUrl,
      primaryGenreName:data.genre || '',
      totalLogs:       1,
      ratingSum:       data.rating || 0,
      ratingCount:     data.rating ? 1 : 0,
    });
  } else {
    const updates = { totalLogs: firebase.firestore.FieldValue.increment(1) };
    if (data.rating) {
      updates.ratingSum = firebase.firestore.FieldValue.increment(data.rating);
      updates.ratingCount = firebase.firestore.FieldValue.increment(1);
    }
    await albumRef.update(updates);
  }

  // Update user stats
  const statsUpdates = {
    'stats.totalLogged': firebase.firestore.FieldValue.increment(1),
  };
  if (data.reviewText) {
    statsUpdates['stats.totalReviews'] = firebase.firestore.FieldValue.increment(1);
  }
  await db.collection('users').doc(currentUser.uid).update(statsUpdates);

  // Add activity
  await _addActivity('log', {
    albumId:    data.albumId,
    albumName:  data.albumName,
    artistName: data.artistName,
    artworkUrl: data.artworkUrl,
    rating:     data.rating,
  });

  return ref.id;
}

async function updateLog(logId, data) {
  if (!_firebaseReady) return;
  await db.collection('logs').doc(logId).update(data);
}

async function deleteLog(logId) {
  if (!_firebaseReady || !currentUser) return;
  const snap = await db.collection('logs').doc(logId).get();
  if (!snap.exists) return;
  const log = snap.data();

  await db.collection('logs').doc(logId).delete();

  // Update album stats
  const albumRef = db.collection('albums').doc(log.albumId);
  const updates = { totalLogs: firebase.firestore.FieldValue.increment(-1) };
  if (log.rating) {
    updates.ratingSum = firebase.firestore.FieldValue.increment(-log.rating);
    updates.ratingCount = firebase.firestore.FieldValue.increment(-1);
  }
  await albumRef.update(updates);

  // Update user stats
  const userUpdates = {
    'stats.totalLogged': firebase.firestore.FieldValue.increment(-1),
  };
  if (log.reviewText) {
    userUpdates['stats.totalReviews'] = firebase.firestore.FieldValue.increment(-1);
  }
  await db.collection('users').doc(currentUser.uid).update(userUpdates);
}

async function getUserLogs(uid, limit = 100) {
  if (!_firebaseReady) return [];
  const snap = await db.collection('logs')
    .where('userId', '==', uid)
    .orderBy('loggedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getUserLogForAlbum(uid, albumId) {
  if (!_firebaseReady) return null;
  const snap = await db.collection('logs')
    .where('userId', '==', uid)
    .where('albumId', '==', albumId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getAlbumLogs(albumId, limit = 30) {
  if (!_firebaseReady) return [];
  const snap = await db.collection('logs')
    .where('albumId', '==', albumId)
    .orderBy('loggedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAlbumStats(albumId) {
  if (!_firebaseReady) return { totalLogs: 0, averageRating: 0 };
  const snap = await db.collection('albums').doc(albumId).get();
  if (!snap.exists) return { totalLogs: 0, averageRating: 0 };
  const d = snap.data();
  return {
    totalLogs:     d.totalLogs || 0,
    averageRating: d.ratingCount > 0 ? (d.ratingSum / d.ratingCount) : 0,
    ratingCount:   d.ratingCount || 0,
  };
}


// ─── Lists ───────────────────────────────────

async function createList(data) {
  if (!_firebaseReady || !currentUser) return null;
  const doc = {
    userId:      currentUser.uid,
    title:       data.title,
    description: data.description || '',
    albums:      data.albums || [],
    isPublic:    true,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('lists').add(doc);

  await _addActivity('list', {
    listId:    ref.id,
    listTitle: data.title,
  });

  return ref.id;
}

async function updateList(listId, data) {
  if (!_firebaseReady) return;
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection('lists').doc(listId).update(data);
}

async function deleteList(listId) {
  if (!_firebaseReady) return;
  await db.collection('lists').doc(listId).delete();
}

async function getUserLists(uid) {
  if (!_firebaseReady) return [];
  const snap = await db.collection('lists')
    .where('userId', '==', uid)
    .orderBy('updatedAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getListById(listId) {
  if (!_firebaseReady) return null;
  const snap = await db.collection('lists').doc(listId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}


// ─── Social / Following ──────────────────────

async function followUser(targetUid) {
  if (!_firebaseReady || !currentUser || currentUser.uid === targetUid) return;

  await db.collection('users').doc(currentUser.uid).update({
    following: firebase.firestore.FieldValue.arrayUnion(targetUid)
  });
  await db.collection('users').doc(targetUid).update({
    followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
  });

  const targetProfile = await getUserProfile(targetUid);
  await _addActivity('follow', {
    targetUserId:      targetUid,
    targetDisplayName: targetProfile ? targetProfile.displayName : 'User',
  });
}

async function unfollowUser(targetUid) {
  if (!_firebaseReady || !currentUser) return;
  await db.collection('users').doc(currentUser.uid).update({
    following: firebase.firestore.FieldValue.arrayRemove(targetUid)
  });
  await db.collection('users').doc(targetUid).update({
    followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
  });
}


// ─── Activity Feed ───────────────────────────

async function _addActivity(type, payload) {
  if (!_firebaseReady || !currentUser) return;
  const doc = {
    type,
    userId:      currentUser.uid,
    displayName: currentUser.displayName || 'User',
    photoURL:    currentUser.photoURL || '',
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    ...payload,
  };
  await db.collection('activity').add(doc);
}

async function getFollowingActivity(followingUids, limit = 30) {
  if (!_firebaseReady || !followingUids.length) return [];
  // Firestore 'in' supports max 30
  const batch = followingUids.slice(0, 30);
  const snap = await db.collection('activity')
    .where('userId', 'in', batch)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getRecentActivity(limit = 20) {
  if (!_firebaseReady) return [];
  const snap = await db.collection('activity')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ─── Stats (computed client-side) ────────────

async function computeUserStats(uid) {
  const logs = await getUserLogs(uid, 500);
  if (!logs.length) {
    return {
      totalLogged: 0, totalReviews: 0, averageRating: 0,
      thisYear: 0, genreBreakdown: [], monthlyBreakdown: [],
      ratingDist: {}, highestRated: null, mostRecentYear: null,
    };
  }

  const now = new Date();
  const thisYear = now.getFullYear();
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

    const monthKey = date.slice(0, 7); // YYYY-MM
    if (monthKey) months[monthKey] = (months[monthKey] || 0) + 1;

    // Genre from cached album data
    const cached = _albumCache[log.albumId];
    if (cached && cached.primaryGenreName) {
      genres[cached.primaryGenreName] = (genres[cached.primaryGenreName] || 0) + 1;
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
