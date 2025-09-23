/* service-worker.js */
const CACHE_VERSION = 'v12';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const STATIC_ASSETS = ['/', '/index.html', '/tailwind.build.css'];

// Install & sofort aktiv
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: 'reload' })));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== STATIC_CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Share Target: POST /share-target -> /?url=...
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

 if ((url.pathname==='/share'||url.pathname==='/share-target') && event.request.method==='POST')
 {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const link = form.get('link') || form.get('url') || form.get('text') || '';
        const target = link ? `/?url=${encodeURIComponent(link)}&shared=1` : '/?shared=1';
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientsList.length) {
          const client = clientsList[0];
          client.postMessage({ type: 'share', url: link });
          client.navigate(target);
        } else {
          await self.clients.openWindow(target);
        }
        return Response.redirect(target, 303);
      } catch {
        return Response.redirect('/', 303);
      }
    })());
    return;
  }

  // Navigations-Requests: network-first, Fallback Shell
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(event.request); }
      catch {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Assets: stale-while-revalidate
  if (['style', 'script', 'image'].includes(event.request.destination) ||
      url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(event.request);
      const network = fetch(event.request).then(resp => {
        if (resp && resp.ok) cache.put(event.request, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || network;
    })());
  }
});
