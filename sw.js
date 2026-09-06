/* TaskFlow · Bruce — service worker
   Guarda la app para abrirla sin conexión y que se instale como aplicación. */
const CACHE = 'taskflow-v4';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* al tocar una notificación, abre o enfoca la app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(lista => {
      for(const c of lista){ if('focus' in c) return c.focus(); }
      if(self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  /* nunca cachear la sincronización ni recursos de otros dominios */
  if(url.origin !== location.origin) return;

  /* red primero para el HTML: así siempre tienes la última versión si hay señal */
  if(req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')){
    e.respondWith(
      fetch(req)
        .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* el resto: caché primero */
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copia));
      return resp;
    }).catch(() => r))
  );
});
