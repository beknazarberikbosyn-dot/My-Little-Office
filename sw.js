/* Офлайн-кэш: после первого запуска игра открывается без интернета.
   При обновлении игры меняйте VERSION — установленные копии подтянут новые файлы. */
const VERSION = 'mlo-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'favicon.svg',
  'manifest.webmanifest',
  'js/audio.js',
  'js/board.js',
  'js/content.js',
  'js/data.js',
  'js/font.js',
  'js/hire.js',
  'js/install.js',
  'js/main.js',
  'js/map.js',
  'js/market.js',
  'js/news.js',
  'js/npc.js',
  'js/saves.js',
  'js/sim.js',
  'js/sprites.js',
  'js/ui.js',
  'js/util.js',
  'js/world.js',
  'fonts/Nunito.woff',
  'fonts/Oswald.woff',
  'fonts/PTSerif-Bold.woff',
  'fonts/PTSerif-Italic.woff',
  'fonts/PTSerif.woff',
  'fonts/RussoOne.woff',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-32.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* сначала сеть (чтобы получать обновления), без сети — из кэша */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
