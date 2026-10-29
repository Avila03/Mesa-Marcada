/* Mesa Marcada PWA: sem cache de informações privadas ou financeiras. */
const VERSION="mm-pwa-6.4.1";
self.addEventListener("install",e=>{
 e.waitUntil(caches.open(VERSION).then(cache=>cache.add("/offline.html")));
 self.skipWaiting();
});
self.addEventListener("activate",e=>{
 e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("mm-pwa-")&&k!==VERSION).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener("fetch",event=>{
 if(event.request.mode!=="navigate")return;
 event.respondWith(fetch(event.request).catch(async()=>await caches.match("/offline.html")||Response.error()));
});
self.addEventListener("push",e=>{
 if(!e.data)return;
 let data;try{data=e.data.json()}catch{return}
 const valid=typeof data.url==="string"&&/^\/(?:eventos\/[0-9a-f-]{36}(?:\/(?:ao-vivo|resumo))?|ligas\/[0-9a-f-]{36}\/gerenciar)$/.test(data.url);
 e.waitUntil(self.registration.showNotification(
  String(data.title||"Mesa Marcada").slice(0,90),{
   body:String(data.body||"Há novidades no seu evento.").slice(0,160),
   icon:"/mesa-marcada-logo.webp",badge:"/mesa-marcada-logo.webp",
   tag:"mm-event-update",renotify:false,
   data:{url:valid?data.url:"/eventos"}
  }
 ));
});
self.addEventListener("notificationclick",e=>{
 e.notification.close();
 const target=e.notification.data?.url||"/eventos";
 e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
  for(const c of clients){if(new URL(c.url).origin===self.location.origin){
   await c.focus();if("navigate" in c)await c.navigate(target);return;
  }}
  await self.clients.openWindow(target);
 }));
});
