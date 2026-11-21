const CACHE = 'village-guide-c1fc6b7a3be157c8';
const PAGES = new Set(["/","/about/","/privacy/","/contact/","/terms/"]);
const ASSETS = new Set(["/dig-out-the-village-digging.webp","/dig-out-the-village-homes.webp","/dig-out-the-village-icon-192.png","/dig-out-the-village-icon-512.png","/dig-out-the-village-logo.svg","/dig-out-the-village-logo.webp","/dig-out-the-village-snow-layers.webp","/dig-out-the-village-village.webp","/dig-out-the-village-workshop.webp","/manifest.webmanifest","/site.css?v=3fb1533c48e75bce","/site.js?v=3e9f7cfc333b203a"]);
const OFFLINE = '/offline/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...PAGES, ...ASSETS, OFFLINE])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('village-guide-') && key !== CACHE).map((key) => caches.delete(key))
  )));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.search) return;
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const page = PAGES.has(url.pathname) && await cache.match(url.pathname);
        return page || await cache.match(OFFLINE) || Response.error();
      }
    })());
  } else if (ASSETS.has(url.pathname + url.search)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => await cache.match(request) || fetch(request)));
  }
});
