// Service Worker untuk Toko Berkah Sekar - 100% Offline Ready (Network First for fresh data)
const CACHE_NAME = 'tokoku-pos-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './test.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './css/pos.css',
  './css/receipt.css',
  './js/app.js',
  './js/db.js',
  './js/pos.js',
  './js/products.js',
  './js/reports.js',
  './js/expenses.js',
  './js/debts.js',
  './js/auth.js',
  './js/notifications.js',
  './js/thermal-printer.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some assets could not be cached on install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
