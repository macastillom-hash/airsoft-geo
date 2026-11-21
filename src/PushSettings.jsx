import React,{useEffect,useState} from 'react';
import {BellRing,Smartphone,ShieldCheck,ShieldOff,RefreshCw} from 'lucide-react';
import {supabase} from './supabase';

const fromBase64Url=value=>{
 const padding='='.repeat((4-value.length%4)%4);
 const b64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
};
const supported=()=>typeof window!=='undefined'&&window.isSecureContext&&
 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const err=e=>e?.message||'Operación de notificaciones no disponible';
export default function PushSettings({userId,notify}){
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [enabled,setEnabled]=useState(false),[key,setKey]=useState(''),[permission,setPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission);
 const [problem,setProblem]=useState('');
 async function refresh(){
  setLoading(true);
  try{
   if(!supported()){setProblem('Este navegador no admite Web Push. En iPhone, instala la web en la pantalla de inicio para habilitarlo.');return;}
   const [{data,error},registration]=await Promise.all([
    supabase.rpc('f4_vapid_public_key'),
    navigator.serviceWorker.ready
   ]);
   if(error)throw error;
   setKey(data||'');
   const current=await registration.pushManager.getSubscription();
   setEnabled(Boolean(current));
   setPermission(Notification.permission);
   setProblem(!data?'El servicio todavía no está configurado con claves VAPID.':'');
  }catch(e){setProblem(err(e))}
  finally{setLoading(false)}
 }
 useEffect(()=>{refresh()},[userId]);
 async function enable(){
  if(!supported()||!key)return;
  setBusy(true);
  try{
   const allowed=await Notification.requestPermission();
   setPermission(allowed);
   if(allowed!=='granted')throw Error('El permiso de notificaciones no fue concedido.');
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:fromBase64Url(key)
   });
   const json=subscription.toJSON();
   if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw Error('Suscripción incompleta del navegador.');
   const {error}=await supabase.from('push_subscriptions').upsert({
    user_id:userId,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_key:json.keys.auth,
    user_agent:(navigator.userAgent||'').slice(0,240),last_seen_at:new Date().toISOString()
   },{onConflict:'endpoint'});
   if(error)throw error;
   setEnabled(true);notify('Este dispositivo se suscribió a las notificaciones push.','success');
  }catch(e){notify(err(e),'error')}
  finally{setBusy(false)}
 }
 async function disable(){
  setBusy(true);
  try{
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.getSubscription();
   if(subscription){
    const {error}=await supabase.from('push_subscriptions').delete().eq('endpoint',subscription.endpoint).eq('user_id',userId);
    if(error)throw error;
    await subscription.unsubscribe();
   }
   setEnabled(false);notify('Notificaciones push desactivadas para este dispositivo.','success');
  }catch(e){notify(err(e),'error')}
  finally{setBusy(false)}
 }
 async function sendTest(){
  setBusy(true);
  try{
   const {error}=await supabase.rpc('f4_test_push');
   if(error)throw error;
   notify('Prueba solicitada: bloquea la pantalla y comprueba la recepción.','success');
  }catch(e){notify(err(e),'error')}
  finally{setBusy(false)}
 }
 return <div className="tile"><h3><BellRing size={18}/> Notificaciones push con la web cerrada</h3>
  <p className="small muted">Activación voluntaria por dispositivo. Los avisos no contienen mensajes privados ni coordenadas GPS. No modifica tu permiso de ubicación.</p>
  <p className="small muted">Compatibilidad: {supported()?'Navegador compatible':'Push no disponible'} · Permiso: {permission} · Servicio: {key?'Configurado':'Pendiente'}</p>
  {problem&&<p className="small muted" role="status">{problem}</p>}
  <div className="inline-actions">
   {enabled?<button className="btn danger" disabled={busy||loading} onClick={disable}><ShieldOff size={16}/> Desactivar en este celular</button>:
    <button className="btn primary" disabled={busy||loading||!supported()||!key} onClick={enable}><ShieldCheck size={16}/> Activar avisos push</button>}
   <button className="btn outline" disabled={busy||loading||!enabled} onClick={sendTest}><Smartphone size={16}/> Enviar prueba</button>
   <button className="btn outline" disabled={busy||loading} onClick={refresh}><RefreshCw size={16}/> Comprobar</button>
  </div>
  <p className="small muted">En iOS 16.4+ es necesario agregar Airsoft Geo a la pantalla de inicio antes de permitir notificaciones. La entrega depende del navegador, la conexión y las restricciones de energía del sistema; no se garantiza el momento de recepción.</p>
 </div>;
}
