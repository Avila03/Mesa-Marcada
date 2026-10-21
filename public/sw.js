/* Mesa Marcada: offline shell only. No personal data, sessions, Supabase or
   authenticated Next.js pages are ever cached. */
const CACHE_NAME="mesa-static-v1-4";
const STATIC=["/offline.html","/mesa-marcada-logo.webp"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith("mesa-static-")&&k!==CACHE_NAME).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).catch(()=>caches.match("/offline.html")));
  }
  // All other requests—including auth and financial data—pass through untouched.
});
