/* Service worker: делает сайт устанавливаемым приложением и даёт работу без сети.
   Стратегия «сначала сеть, при её отсутствии — кэш»: онлайн всегда видна свежая версия,
   офлайн открывается последняя загруженная. Все пути относительные, поэтому работает
   и в корне домена, и в подпапке (например, на GitHub Pages). */
'use strict';

var CACHE = 'cfop-v1';
var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/tabs.js',
  'js/cube-core.js',
  'js/data-algs.js',
  'js/cube3d.js',
  'js/viewer.js',
  'js/diagrams.js',
  'js/app.js',
  'js/pwa.js',
  'icons/icon.svg',
  'icons/icon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // cache: 'reload' — не брать копию из HTTP-кэша браузера, а скачать свежую
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' }));
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // внешние ссылки и шрифты не трогаем

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
