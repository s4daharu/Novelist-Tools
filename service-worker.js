// service-worker.js
const CACHE_NAME = 'novelist-tools-v1';
const ASSETS = [
  '/',                   // index.html
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // your CSS & JS bundles (if any), e.g.:
  // '/styles.css',
  // '/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js'
];

// Install: cache core assets
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(response => {
        // optional: cache new resources
        return response;
      });
    })
  );
});
