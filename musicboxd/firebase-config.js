/* ═══════════════════════════════════════════
   MUSICBOXD — Firebase Configuration
   ═══════════════════════════════════════════

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create a new project (e.g. "musicboxd")
   3. Enable Authentication > Sign-in method > Google
   4. Create Firestore Database (start in test mode)
   5. Go to Project Settings > Your Apps > Web (</>)
   6. Copy your config object below
   7. Add your domain to Authentication > Settings > Authorized Domains
*/

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Check if Firebase is loaded and config is set
const _firebaseReady = firebaseConfig.apiKey !== "YOUR_API_KEY";

let db = null;
let auth = null;
let googleProvider = null;
let currentUser = null;

if (_firebaseReady) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  googleProvider = new firebase.auth.GoogleAuthProvider();

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (typeof onAuthChanged === 'function') {
      onAuthChanged(user);
    }
  });
} else {
  console.warn(
    '%c[Musicboxd] Firebase not configured. ' +
    'Edit firebase-config.js with your Firebase project credentials to enable auth & data sync.',
    'color: #00E054; font-weight: bold;'
  );
}
