/* Airsoft Geo V4: Web Push voluntary subscription, no GPS monitoring. */
self.addEventListener('push',event=>{
 let payload={title:'Airsoft Geo',body:'Hay una nueva notificación.',tag:'airsoft-notice',url:'/'};
 try{if(event.data)payload={...payload,...event.data.json()}}catch{}
 event.waitUntil((async()=>{
  // La V2 ya muestra el aviso dentro de la web; evita duplicados cuando está visible.
  const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(clientsList.some(client=>client.visibilityState==='visible'))return;
  await self.registration.showNotification(String(payload.title).slice(0,100),{
   body:String(payload.body||'').slice(0,180),tag:String(payload.tag).slice(0,120),
   icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/'}
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL('/',self.location.origin).href;
  const existing=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of existing){
   if(new URL(c.url).origin===self.location.origin){await c.focus();return;}
  }
  await self.clients.openWindow(url);
 })());
});
