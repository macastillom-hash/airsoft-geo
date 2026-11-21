/* Service Worker de avisos con la web activa. NO incluye PushManager aún. */
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL('/',self.location.origin).href;
 event.waitUntil((async()=>{
  const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clientsList){if(new URL(client.url).origin===self.location.origin){await client.focus();return;}}
  return self.clients.openWindow(url);
 })());
});
