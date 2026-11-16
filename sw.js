// Offline support: cache the app shell so it opens with no signal (the gym!).
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'practice-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/db.js', './js/dates.js', './js/calc.js', './js/plan.js', './js/store.js', './js/ui.js', './js/sync.js', './js/config.js', './js/foodsearch.js',
  './js/data/foods.js', './js/data/recipes.js', './js/data/exercises.js', './js/data/daily.js',
  './js/views/today.js', './js/views/train.js', './js/views/workout.js', './js/views/change.js', './js/views/eat.js', './js/views/addfood.js',
  './js/views/portion.js', './js/views/recipes.js', './js/views/progress.js', './js/views/settings.js', './js/views/onboarding.js', './js/views/quicklog.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Same-origin app files: network first (so updates arrive), cache as fallback when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
    return;
  }
  // Google Fonts: cache after first load.
  if (url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })));
  }
  // Everything else (Supabase, USDA, Open Food Facts) goes straight to the network.
});
