const CACHE_NAME = 'hotel-clean-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install event - Cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Cache addAll failed, caching individually:', err);
        // Gracefully cache what we can
        for (const asset of ASSETS_TO_CACHE) {
          cache.add(asset).catch(e => console.log('Could not cache asset:', asset, e));
        }
      });
    })
  );
  self.skipWaiting();
});

// Activate event - Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local origin requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle service worker scripts, dev server websocket, and hot updates - do not cache
  if (
    event.request.url.includes('sw.js') || 
    event.request.url.includes('@vite') || 
    event.request.url.includes('hmr') ||
    event.request.url.includes('node_modules')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the newly retrieved response if it is valid
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // SPA fallback for HTML navigation
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html').then((htmlResponse) => {
              if (htmlResponse) return htmlResponse;
              return caches.match('/').then((rootResponse) => {
                if (rootResponse) return rootResponse;
                return new Response('Network error. Offline fallback not found.', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                });
              });
            });
          }
          return new Response('Network error', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});
