importScripts('core.js');
const V='expenses-v7';
const FILES=['./','index.html','styles.css','app.js','core.js','manifest.json','icon-192.png','icon-512.png','apple-touch-icon.png'];

self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));

// Network-first (3s timeout) so updates always arrive; falls back to cache when offline.
self.addEventListener('fetch',e=>{
  const rq=e.request,url=new URL(rq.url);
  if(rq.method!=='GET'||url.origin!==location.origin)return;
  if(url.searchParams.has('ping'))return; // connectivity checks always hit the network
  e.respondWith((async()=>{
    const c=await caches.open(V);
    const net=fetch(rq).then(res=>{if(res.ok)c.put(rq,res.clone());return res});
    e.waitUntil(net.catch(()=>{}));
    try{
      const res=await Promise.race([net,new Promise(r=>setTimeout(()=>r(null),3000))]);
      if(res)return res;
    }catch(_){}
    const hit=await c.match(rq,{ignoreSearch:true});
    if(hit)return hit;
    try{return await net}catch(_){return (await c.match('index.html'))||new Response('Offline',{status:503})}
  })());
});

self.addEventListener('periodicsync',e=>{if(e.tag==='month-end')e.waitUntil(runCheck(self.registration))});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():clients.openWindow('./?v=stat')));
});
