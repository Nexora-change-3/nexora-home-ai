const CACHE = 'nexora-home-ai-v057';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './assets/styles/japandi.webp',
  './assets/styles/modern.webp',
  './assets/styles/warm-minimal.webp',
  './assets/styles/modern-classic.webp',
  './assets/styles/organic-modern.webp',
  './assets/styles/mid-century.webp',
  './assets/styles/loft.webp',
  './assets/styles/mediterranean.webp',
  './assets/styles/art-deco.webp',
  './assets/styles/luxury.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API traffic must always go directly to Pages Functions; never consult Cache API.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(error => new Response(JSON.stringify({
        error: 'Сетевая ошибка при обращении к API через Service Worker: ' + String(error && error.message || error)
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      }))
    );
    return;
  }

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request) || await caches.match('./index.html') || await caches.match('./');
          return cached || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});