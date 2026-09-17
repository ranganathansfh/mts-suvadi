const CACHE_NAME="mts-suvadi-spa-v12";
const APP_SHELL=["./","./index.html","./styles.css","./firebase-config.js","./data.js","./app.js","./admin.js","./spa.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png","./icons/mts-logo.png","./icons/suvadi-loading.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});