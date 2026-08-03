const SHELL_CACHE='jcf-shell-v3';
const OCR_CACHE='jcf-offline-v3';
const SHELL=['./','./index.html','./style.css','./config.js','./crop.js','./ocr.js','./records.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('jcf-shell-')&&k!==SHELL_CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;try{const response=await fetch(event.request);if(response&&response.status===200){const cacheName=new URL(event.request.url).origin===self.location.origin?SHELL_CACHE:OCR_CACHE,cache=await caches.open(cacheName);cache.put(event.request,response.clone()).catch(()=>{})}return response}catch(err){if(event.request.mode==='navigate'){const fallback=await caches.match('./index.html');if(fallback)return fallback}throw err}})())});
