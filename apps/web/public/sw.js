// Offline fallback only. Pages and API calls always go to the network (fresh data, no stale UI);
// when a page navigation fails because there's no connection, the branded offline page is shown.
const CACHE = "np-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return; // assets and /api/* untouched
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    }),
  );
});
