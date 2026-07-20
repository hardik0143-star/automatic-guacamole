/* Tiny Tiffin — minimal offline cache.
   Caches the app shell on install so it opens without a network
   connection after the first visit. Bump CACHE_NAME when you
   change any of the cached files so users get the update. */
const CACHE_NAME = "tiny-tiffin-v3-3";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./admin.html",
  "./styles.css",
  "./app.js",
  "./admin.js",
  "./recipes.js",
  "./i18n.js",
  "./site-config.js",
  "./store.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
