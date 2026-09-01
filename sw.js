/* lzc.app service worker
   Strategy:
   - navigations (documents): network-first, fallback to cache / cached index
   - same-origin static assets: cache-first with background refresh
   - cross-origin (static.lzc.app, fonts, status): pass through untouched
   Bump VERSION to invalidate the whole cache.
*/
'use strict';

const VERSION = 'v4.0.0';
const CACHE_NAME = 'lzc-app-' + VERSION;

const CORE_ASSETS = [
    './assets/css/style.css?v=4',
    './assets/css/fonts.css?v=4',
    './assets/js/script.js?v=4',
    './assets/js/punycode.js?v=4',
    './assets/images/my-avatar.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('lzc-app-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // cross-origin: default behaviour

    // Documents: network-first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then(
                        (cached) => cached || caches.match('./')
                    )
                )
        );
        return;
    }

    // Static assets: cache-first, refresh in background
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || network;
        })
    );
});
