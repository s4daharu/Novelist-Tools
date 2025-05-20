// Novelist-Tools-main/service-worker.js
const CACHE_VERSION = 'novelist-tools-v1.1'; // Or a newer version if you've made other changes
const ASSETS = [
  './', // Represents the root path, often serves index.html
  './index.html',
  './css/style.css',
  './manifest.json',

  // Icons
  './icons/icon-192.png',
  './icons/icon-512.png',

  // JavaScript files from the js/ directory
  './js/main.js',
  './js/ui-helpers.js',
  './js/pwa-handler.js',
  './js/epub-splitter.js',
  './js/backup-utility.js',
  './js/zip-to-epub.js',
  './js/epub-to-zip.js',

  // External CDN libraries (like JSZip)
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('Service Worker: Caching app shell files');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Skip waiting on install');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Caching failed during install', error);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_VERSION) {
            console.log('Service Worker: Deleting old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Cache hit - return response
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache - go to network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !event.request.url.startsWith('https://cdnjs.cloudflare.com')) {
               // Don't cache opaque responses (like from CDNs without CORS if not handled carefully)
               // or error responses. For CDN, if it's in ASSETS, it should be cached during install.
               // Here we are just returning the network response if it's not to be cached dynamically.
              return networkResponse;
            }

            // IMPORTANT: Only cache GET requests from your origin or explicitly trusted CDNs.
            // This example is simplified; for dynamic caching, you'd be more selective.
            // Since all assets are in ASSETS, dynamic caching here might be redundant for them,
            // but this structure is common.
            if (event.request.method === 'GET' &&
                (event.request.url.startsWith(self.location.origin) || ASSETS.includes(event.request.url))
            ) {
              // Clone the response because it's a stream and can only be consumed once.
              // We need one for the browser and one for the cache.
              const responseToCache = networkResponse.clone();

              caches.open(CACHE_VERSION)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('Service Worker: Fetch failed; returning offline fallback or error for', event.request.url, error);
          // Optional: You could return a custom offline page here for navigation requests
          // if (event.request.mode === 'navigate') {
          //   return caches.match('./offline.html'); // You'd need to create and cache offline.html
          // }
          // For other assets, failing here means the asset is truly unavailable.
        });
      })
  );
});