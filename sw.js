/* Tiny Tiffin v2.5 service worker — network-first app updates, offline fallback */
const CACHE_NAME = "tiny-tiffin-v2-15-smartbuy-search-pasta";
const SHELL_FILES = ["./","./index.html","./styles.css?v=2.15","./app.js?v=2.15","./recipes.js?v=2.15","./festival.js?v=2.15","./fasting.js?v=2.15","./regional.js?v=2.15","./content-translator.js?v=2.15","./i18n.js?v=2.15","./site-config.js?v=2.15","./store.js?v=2.15","./manifest.json","./premium-ui.css","./festival-tiffin-hero.svg","./indian-fasting-tiffin-hero.svg","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./smartbuy-vegetable-banner-hd.png?v=2.15"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL_FILES)).catch(()=>{}));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin && url.pathname.startsWith("/api/"))return;
  const sameOrigin=url.origin===self.location.origin;
  if(sameOrigin){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)).catch(()=>{});return response;}).catch(()=>caches.match(event.request).then(x=>x||caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
