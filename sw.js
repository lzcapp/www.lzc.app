/* lzc.app service worker
   Strategy:
   - navigations (documents): network-first, fallback to cache / cached index
   - same-origin static assets, has ?v= : cache-first, never revalidated
       （带版本号就是不可变契约：内容变了 URL 就变，没必要每次回源）
   - same-origin static assets, no ?v= : cache-first, 后台刷新最多每 7 天一次
   - cross-origin (static.lzc.app, status, …): pass through untouched
   Bump VERSION to invalidate the whole cache.
*/
'use strict';

const VERSION = 'v6.0.0';
const CACHE_NAME = 'lzc-app-' + VERSION;

// 未带版本号资源的最长信任期；过期后先给旧内容，再在后台刷新
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const CORE_ASSETS = [
    './assets/css/style.css?v=5',
    './assets/css/fonts.css?v=6',
    './assets/fonts/noto-sans-sc-var.woff2',
    './assets/fonts/noto-serif-sc-var.woff2',
    './assets/fonts/noto-sans-display-var.woff2',
    './assets/fonts/noto-sans-mono-var.woff2',
    './assets/js/i18n.js?v=7',
    './assets/js/script.js?v=5',
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

// 缓存响应自带的 Date 头决定“旧不旧”；拿不到就当作新鲜，避免无谓回源
function isStale(cached) {
    const date = cached.headers.get('date');
    if (!date) return false;
    const at = Date.parse(date);
    return Number.isFinite(at) && Date.now() - at > MAX_AGE_MS;
}

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

    // Static assets: cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            // 带版本号 = 不可变，命中即用，绝不回源（旧实现每次都重下图标和字体）
            if (cached && url.searchParams.has('v')) return cached;

            // 未带版本号且仍在信任期内，同样直接用缓存
            if (cached && !isStale(cached)) return cached;

            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);

            // 有旧版本时先给旧的，后台刷新（真正的 stale-while-revalidate）
            return cached || network;
        })
    );
});
