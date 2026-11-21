import React from 'react';
import {Bell,CheckCheck,Volume2,Smartphone} from 'lucide-react';

export function NotificationCenter({items,loading,onRead,onReadAll,onRefresh}){
 const unread=items.filter(n=>!n.read_at).length;
 return <div className="stack"><div className="section-head"><div><h2>Alertas y notificaciones</h2><p className="muted">Mensajes y avisos de los equipos a los que perteneces.</p></div><div className="inline-actions"><button className="btn outline" onClick={onRefresh}>Actualizar</button><button className="btn primary" onClick={onReadAll} disabled={!unread}><CheckCheck size={17}/> Marcar leídas</button></div></div>
  <div className="tile notifications-list">{loading?<p className="muted">Cargando notificaciones…</p>:items.length===0?<div className="empty compact"><Bell size={25}/><p>Aún no hay notificaciones.</p></div>:items.map(n=><div className={'notification-entry '+(!n.read_at?'unread':'')} key={n.id}>
   <div className="notification-symbol"><Bell size={18}/></div><div className="notification-description"><strong>{n.title}</strong><p>{n.detail}</p><small>{new Date(n.created_at).toLocaleString('es-CO')}</small></div>
   {!n.read_at&&<button className="btn outline" onClick={()=>onRead(n.id)}>Marcar leída</button>}
  </div>)}</div>
  <p className="small muted">Estas alertas quedan almacenadas en Supabase. La vibración y las alertas del navegador dependen del soporte y los permisos del teléfono.</p>
 </div>
}

export function NotificationSettings({settings,onChange,onTest,notify}){
 const vibrationSupported=typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
 const browserSupported=typeof Notification!=='undefined';
 const permission=browserSupported?Notification.permission:'unsupported';
 async function enableSystem(){
  if(!browserSupported){notify('Tu navegador no permite notificaciones de sistema.','error');return;}
  try{const value=await Notification.requestPermission();
   notify(value==='granted'?'Notificaciones de sistema permitidas.':value==='denied'?'Notificaciones bloqueadas; modifica el permiso en los ajustes del navegador.':'No se concedió el permiso.',value==='granted'?'success':'info');
  }catch(e){notify('No se pudieron habilitar las notificaciones: '+e.message,'error')}
 }
 return <div className="tile"><h3><Bell size={17}/> Alertas y vibración</h3><p className="muted small">Configura las alertas solo para este dispositivo. Ningún aviso activa automáticamente tu GPS.</p>
  <label className="switchline"><input type="checkbox" checked={settings.vibration} onChange={e=>onChange({...settings,vibration:e.target.checked})}/> Vibrar al recibir mensajes y alertas</label>
  <label className="switchline"><input type="checkbox" checked={settings.sound} onChange={e=>onChange({...settings,sound:e.target.checked})}/> Emitir sonido suave (cuando el navegador lo permita)</label>
  <label className="switchline"><input type="checkbox" checked={settings.system} onChange={e=>onChange({...settings,system:e.target.checked})}/> Mostrar notificación de sistema si la pestaña está en segundo plano</label>
  <p className="small muted">Vibración por API: {vibrationSupported?'Disponible en este navegador (depende del sistema operativo)':'No disponible en este navegador'}. Permiso de notificaciones: {permission}.</p>
  <div className="inline-actions"><button type="button" className="btn outline" onClick={()=>onTest('direct_message')}><Smartphone size={16}/> Probar vibración</button><button type="button" className="btn outline" onClick={()=>onTest('team_message')}><Volume2 size={16}/> Probar aviso</button><button type="button" className="btn primary" onClick={enableSystem} disabled={!browserSupported||permission==='granted'}>Permitir notificaciones</button></div>
  <p className="small muted">Esta versión detecta mensajes mientras la web está abierta y conectada. Para recibir avisos con la aplicación totalmente cerrada se necesita Web Push con suscripciones y un servicio de envío.</p>
 </div>
}
