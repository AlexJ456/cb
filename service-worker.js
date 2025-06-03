const CACHE_NAME = 'coherent-breathing-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => cacheWhitelist.includes(cacheName) ? null : caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request.clone()).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});