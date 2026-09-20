/* Build-time placeholders are replaced by build-webapp.mjs. No user data is cached here. */
const version = __VERSION__;
const files = __FILES__;
const scope = new URL(self.registration.scope);
const prefix = 'mi-nomina-webapp:' + scope.pathname + ':';
const cacheName = prefix + version;
const urls = files.map(file => new URL(file, scope).href);
const allowed = new Set(urls);
const index = new URL('index.html', scope).href;
let repair;

function restoreCache(cache) {
  if (!repair) repair = cache.addAll(urls.map(url => new Request(url, {cache: 'reload'})))
    .finally(() => { repair = undefined; });
  return repair;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(urls.map(url => new Request(url, {cache: 'reload'})));
  })());
  // Let open tabs finish with their current version; never interrupt unsaved edits.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin) return;
  const home = request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(index).pathname);
  const key = home ? index : url.href;
  if (!allowed.has(key)) return;
  let recovery;
  const response = (async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(key);
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(key, fresh.clone());
      // Cache eviction can leave this worker registered: refill lazy modules too.
      recovery = restoreCache(cache).catch(() => undefined);
    }
    return fresh;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => recovery).catch(() => undefined));
});
