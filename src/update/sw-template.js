const BUILD='__BUILD__';
const ASSETS=__ASSETS__;
const CACHE='docscan-assets-'+BUILD;
const urls=new Set(ASSETS.map(path=>new URL(path,self.location).href));
const baseUrl=new URL('./',self.location);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})));
    for(const path of ASSETS)if(!(await cache.match(path)))throw new Error('Missing required asset');
  })());
});
self.addEventListener('activate',event=>{
  // Older version caches are retained so already-open old code remains usable.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    const requestUrl=new URL(event.request.url);
    if(requestUrl.origin!==baseUrl.origin || !requestUrl.pathname.startsWith(baseUrl.pathname))return;
    // Cloudflare Pages redirects *.html to extensionless canonical paths.
    const documents={'':'./index.html','index':'./index.html','index.html':'./index.html',
      'line':'./line.html','line.html':'./line.html','help':'./help.html','help.html':'./help.html'};
    const documentPath=documents[requestUrl.pathname.slice(baseUrl.pathname.length)];
    if(!documentPath)return;
    const documentUrl=new URL(documentPath,self.location).href;
    // Preserve each known HTML route offline. Do not turn help/LINE entry/404
    // into the document app, and never store user-specific query strings.
    if(!urls.has(documentUrl))return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(documentPath);
      // Static hosts may redirect /index.html to /. Navigation requests reject
      // redirected cached responses, so return the same bytes as a fresh response.
      return cached ? new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers}) : fetch(event.request);
    })());return;
  }
  if(urls.has(event.request.url))event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return (await cache.match(event.request)) || fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  const port=event.ports[0];
  if(event.data?.type==='READY')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);let ready=true;
    for(const path of ASSETS)if(!(await cache.match(path))){ready=false;break;}
    port?.postMessage({ready,build:BUILD});
  })());
  if(event.data?.type==='APPLY')event.waitUntil((async()=>{
    const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(tabs.length>1){port?.postMessage({applied:false,reason:'他の画面を閉じてから更新してください。'});return;}
    port?.postMessage({applied:true});await self.skipWaiting();
  })());
});
