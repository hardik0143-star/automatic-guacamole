/* Tiny Tiffin v2.4 recovery service worker: intentionally disabled. */
self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.includes("tiny-tiffin")).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", () => {});
