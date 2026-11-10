// Netzwerk zuerst (immer neueste Version), bei fehlender Verbindung aus dem Zwischenspeicher.
const C='heimatinventur-v1';
const PRE=['./','index.html','backend.js','manifest.json','lib/supabase.js','lib/zxing.min.js','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(PRE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));});
