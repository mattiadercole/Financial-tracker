const CACHE = 'ft-v9';
const ASSETS = [
'./', './index.html', './css/app.css',
'./js/config.js', './js/sheets.js', './js/charts.js', './js/app.js',
'./manifest.json', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (['googleapis.com','accounts.google.com','fonts.googleapis.com',
       'fonts.gstatic.com','cloudflare.com','allorigins.win',
       'query1.finance.yahoo.com'].some(d=>url.hostname.includes(d))) return;
  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(res => {
      if (res.ok && e.request.method==='GET') {
        const c = res.clone();
        caches.open(CACHE).then(ca => ca.put(e.request, c));
      }
      return res;
    }).catch(()=>cached);
  }));
});
