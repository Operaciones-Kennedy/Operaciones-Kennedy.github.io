// Service worker de Ruteka: permite instalarla como app y abrirla sin señal.
// - La página se pide siempre a internet primero (así cada cambio publicado llega
//   al tiro) y solo si no hay señal se usa la copia guardada.
// - Las librerías (Firebase, lector de Excel) se guardan para abrir sin señal.
// - Los datos NO pasan por aquí: Firestore los guarda en el teléfono por su cuenta.
const CACHE = 'ruteka-v1';
const APP = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
const LIBRERIAS = ['www.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copia)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if(LIBRERIAS.includes(url.hostname) && /firebasejs|xlsx/.test(url.pathname)){
    e.respondWith(caches.open(CACHE).then(async c => {
      const guardada = await c.match(req);
      const red = fetch(req).then(res => { if(res.ok) c.put(req, res.clone()); return res; }).catch(() => guardada);
      return guardada || red;
    }));
    return;
  }

  if(url.origin === self.location.origin){
    e.respondWith(caches.match(req).then(g => g || fetch(req)));
  }
});
