import React,{useCallback,useEffect,useRef,useState} from 'react';
import {MapContainer,TileLayer,Marker,Popup,Circle,useMap} from 'react-leaflet';
import L from 'leaflet';
import {MapPin,Users,MessagesSquare,Shield,Radio,LogOut,Plus,Copy,Send,Upload,Navigation,RefreshCw,Eye,EyeOff,Settings,CalendarDays,ShieldCheck,Wifi,WifiOff,Lock,Image,FileText,AlertTriangle,CheckCircle,Menu,X,Bell} from 'lucide-react';
import {supabase,configured} from './supabase';
import {distanceLabel,metersBetween,isValidLocation} from './geo';
import VoiceRecorder from './VoiceRecorder';
import DirectChat from './DirectChat';
import TeamAdmin from './TeamAdmin';
import Activities from './Activities';
import AdminPanel from './AdminPanel';
import UnifiedMap from './UnifiedMap';
import ProfileEditor from './ProfileEditor';
import {NotificationCenter,NotificationSettings} from './NotificationCenter';
import {loadNotificationSettings,saveNotificationSettings,vibratePattern,playNotificationSound,patterns} from './notificationUtils';

const icon=(color)=>L.divIcon({className:'agent-marker',html:`<div style="width:20px;height:20px;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 2px 12px #0005"></div>`,iconSize:[20,20],iconAnchor:[10,10]});
const ownIcon=icon('#147cf5'),teamIcon=icon('#20bca9'),publicIcon=icon('#f59e0b');
function MoveMap({position}){const map=useMap();useEffect(()=>{if(position)map.setView([position.lat,position.lng],16)},[position?.lat,position?.lng,map]);return null}
const sqlError=(error)=>error?.message || 'No se pudo completar la operación';
function Notice({message,onClose}){if(!message)return null;return <div className={'notice '+(message.type||'')} role="alert"><span>{message.text}</span><button aria-label="Cerrar aviso" onClick={onClose}><X size={17}/></button></div>}

function Auth({notify}){
 const [register,setRegister]=useState(false),[alias,setAlias]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e){e.preventDefault();setLoading(true);try{
  const result=register?await supabase.auth.signUp({email:email.trim(),password,options:{data:{alias:alias.trim()}}}):await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(result.error)throw result.error;
  notify(register?(result.data.session?'Cuenta creada correctamente.':'Revisa tu correo y confirma tu cuenta antes de ingresar.'):'Sesión iniciada.','success');
 }catch(err){notify(sqlError(err),'error')}finally{setLoading(false)}}
 return <div className="auth-screen"><div className="auth-intro"><div className="brand-mark"><Navigation size={28}/></div><p className="eyebrow">PLATAFORMA DE COORDINACIÓN GPS</p><h1>Operación<br/><span>Sombra.</span></h1><p>Personas conectadas. Equipos coordinados. Información compartida con privacidad.</p><div className="intro-chips"><span>GPS en tiempo real</span><span>Equipos</span><span>Comunicación multimedia</span></div></div><form onSubmit={submit} className="auth-box"><div className="eyebrow">ACCESO SEGURO</div><h2>{register?'Crear una cuenta':'Bienvenido de nuevo'}</h2><p className="muted">{register?'Regístrate para comenzar a colaborar.':'Inicia sesión para acceder a tu espacio.'}</p>{register&&<label>Alias público<input required minLength={3} maxLength={40} value={alias} onChange={e=>setAlias(e.target.value)} placeholder="Ej. Agente Cóndor"/></label>}<label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label><label>Contraseña<input type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label><button disabled={loading} className="btn primary full">{loading?'Procesando...':register?'Crear cuenta':'Ingresar'}</button><button type="button" className="linkbutton" onClick={()=>setRegister(!register)}>{register?'¿Ya tienes cuenta? Inicia sesión':'¿No tienes cuenta? Regístrate'}</button><p className="small muted">Al registrarte no compartes automáticamente tu GPS. Tú decides cuándo hacerlo.</p></form></div>
}
function TeamManager({teams,onRefresh,notify,user}){
 const [name,setName]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[roleMap,setRoleMap]=useState({});
  useEffect(()=>{let live=true;supabase.from('team_members').select('team_id,administrative_role').eq('user_id',user.id).then(({data,error})=>{if(live&&!error)setRoleMap(Object.fromEntries((data||[]).map(x=>[x.team_id,x.administrative_role])))});return()=>{live=false}},[user.id,teams]);
 async function create(e){e.preventDefault();setBusy(true);try{const {error}=await supabase.from('teams').insert({name:name.trim(),owner_id:(await supabase.auth.getUser()).data.user.id});if(error)throw error;setName('');notify('Equipo creado. Comparte su código de invitación.','success');await onRefresh()}catch(e){notify(sqlError(e),'error')}finally{setBusy(false)}}
 async function join(e){e.preventDefault();setBusy(true);try{const {error}=await supabase.rpc('join_team',{code:code.trim()});if(error)throw error;setCode('');notify('Te has unido al equipo.','success');await onRefresh()}catch(e){notify(sqlError(e),'error')}finally{setBusy(false)}}
 return <div className="stack"><div><h2>Mis equipos</h2><p className="muted">Organiza a tus compañeros mediante un código privado de invitación.</p></div><div className="cards two">{teams.map(t=><div className="tile" key={t.id}><div className="tile-icon"><Users size={21}/></div><h3>{t.name}</h3><span className="small muted">Código de invitación</span><div className="copy-code"><code>{t.invite_code}</code><button title="Copiar código" onClick={()=>{navigator.clipboard?.writeText(t.invite_code);notify('Código copiado.','success')}}><Copy size={16}/></button></div></div>)}</div><div className="cards two"><form className="tile" onSubmit={create}><h3><Plus size={17}/> Crear equipo</h3><label>Nombre del equipo<input value={name} minLength={3} maxLength={60} required onChange={e=>setName(e.target.value)} placeholder="Ej. Equipo Alfa"/></label><button className="btn primary" disabled={busy}>Crear equipo</button></form><form className="tile" onSubmit={join}><h3><Users size={17}/> Unirse a un equipo</h3><label>Código de invitación<input value={code} required onChange={e=>setCode(e.target.value)} placeholder="Código de 10 caracteres"/></label><button className="btn outline" disabled={busy}>Unirme</button></form></div>{teams.filter(t=>t.owner_id===user.id||['admin','coordinator'].includes(roleMap[t.id])).map(t=><TeamAdmin key={t.id} team={t} user={user} notify={notify} onRefresh={onRefresh} managementRole={roleMap[t.id]}/>)}</div>
}
function MediaItem({message}){
 const [url,setUrl]=useState(''),[problem,setProblem]=useState(false);
 useEffect(()=>{let valid=true;if(!message.file_path)return;supabase.storage.from('team-media').createSignedUrl(message.file_path,120).then(({data,error})=>{if(!valid)return;if(error)setProblem(true);else setUrl(data.signedUrl)});return()=>{valid=false}},[message.file_path]);
 if(!message.file_path)return null;
 if(problem)return <span className="small">Archivo no disponible o acceso denegado</span>;
 if(!url)return <span className="small">Cargando adjunto…</span>;
 const mime=message.mime_type||'';
 return <div className="media-item">{mime.startsWith('image/')?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={message.file_name||'Fotografía adjunta'}/></a>:mime.startsWith('audio/')?<audio controls preload="none" src={url}/>:mime.startsWith('video/')?<video controls preload="metadata" src={url}/>:<a href={url} target="_blank" rel="noreferrer"><FileText size={18}/> {message.file_name||'Abrir documento'}</a>}</div>;
}
function Chat({team,user,profiles,notify}){
 const [messages,setMessages]=useState([]),[text,setText]=useState(''),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);const bottom=useRef(),fileRef=useRef(null);
 const load=useCallback(async()=>{const {data,error}=await supabase.from('messages').select('*').eq('team_id',team.id).order('created_at',{ascending:false}).limit(100);if(error)notify(sqlError(error),'error');else setMessages((data||[]).reverse());setLoading(false)},[team.id]);
 useEffect(()=>{load();const ch=supabase.channel('chat-'+team.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`team_id=eq.${team.id}`},()=>load()).subscribe();return()=>{supabase.removeChannel(ch)}},[team.id,load]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages.length]);
 async function submit(e){e.preventDefault();if(!text.trim()&&!file)return;setBusy(true);let path=null;try{
  if(file){if(file.size>10*1024*1024)throw Error('Archivo demasiado grande: máximo 10 MB.');const allowed=['image/jpeg','image/png','image/webp','audio/webm','audio/mpeg','audio/mp4','audio/ogg','video/mp4','video/webm','application/pdf'];if(!allowed.includes(file.type))throw Error('Formato no permitido. Usa JPG, PNG, WEBP, MP3, OGG, WEBM, MP4 o PDF.');path=`${team.id}/${user.id}/${crypto.randomUUID()}`;const {error}=await supabase.storage.from('team-media').upload(path,file,{contentType:file.type});if(error)throw error;}
  const {error}=await supabase.from('messages').insert({team_id:team.id,sender_id:user.id,content:text.trim()||null,file_path:path,file_name:file?.name||null,mime_type:file?.type||null});if(error)throw error;
  setText('');setFile(null);if(fileRef.current)fileRef.current.value='';await load();
 }catch(err){notify(sqlError(err),'error');if(path)await supabase.storage.from('team-media').remove([path])}finally{setBusy(false)}}
 return <div className="chat-panel"><div className="chat-header"><div className="tile-icon"><MessagesSquare size={20}/></div><div><h3>Comunicación del equipo</h3><div className="small muted">{team.name} · archivos privados · últimos 100 mensajes</div></div></div><div className="message-list">{loading?<div className="empty">Cargando mensajes…</div>:messages.length===0?<div className="empty"><MessagesSquare size={30}/><h3>No hay mensajes todavía</h3><p>Comparte la primera actualización con tu equipo.</p></div>:messages.map(m=><div className={'message '+(m.sender_id===user.id?'mine':'')} key={m.id}><div className="msg-meta">{m.sender_id===user.id?'Tú':profiles[m.sender_id]?.alias||'Compañero'} · {new Date(m.created_at).toLocaleString('es-CO')}</div>{m.content&&<div className="msg-text">{m.content}</div>}<MediaItem message={m}/></div>)}<div ref={bottom}/></div><form className="send-panel" onSubmit={submit}><label className="attachment" title="Adjuntar imagen, video, audio o PDF"><Upload size={19}/><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,audio/webm,audio/mpeg,audio/mp4,audio/ogg,video/mp4,video/webm,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><VoiceRecorder onRecorded={setFile} notify={notify} disabled={busy}/><input className="send-input" aria-label="Mensaje de equipo" value={text} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder={file?`Adjunto: ${file.name}`:'Escribe un mensaje al equipo…'}/><button className="btn primary" disabled={busy||(!text.trim()&&!file)}><Send size={18}/><span>{busy?'Enviando':'Enviar'}</span></button></form><div className="hint">Archivos: hasta 10 MB; notas de voz: hasta 60 segundos. Los enlaces multimedia expiran y están restringidos a integrantes del equipo.</div></div>
}
function MapView({me,teammates,nearby,shared,showNearby}){
 const center=me?[me.lat,me.lng]:[4.65,-74.1];
 return <div className="map-wrap"><MapContainer center={center} zoom={me?16:6} scrollWheelZoom className="mapbox"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{me&&<><MoveMap position={me}/><Circle center={[me.lat,me.lng]} radius={Math.max(me.accuracy||20,15)} pathOptions={{color:'#147cf5',weight:1,fillOpacity:.08}}/><Marker position={[me.lat,me.lng]} icon={ownIcon}><Popup>Tu posición · precisión aprox. {Math.round(me.accuracy||0)} m {shared?'· Compartiendo':'· Solo local'}</Popup></Marker></>}{teammates.map(p=><Marker key={p.user_id} position={[p.latitude,p.longitude]} icon={teamIcon}><Popup><strong>{p.alias}</strong><br/>Compañero · {me?distanceLabel(metersBetween(me,{lat:p.latitude,lng:p.longitude})):'—'}<br/>Actualizado: {new Date(p.updated_at).toLocaleTimeString('es-CO')}</Popup></Marker>)}{showNearby&&nearby.map(p=><Marker key={p.user_id} position={[p.latitude,p.longitude]} icon={publicIcon}><Popup><strong>{p.alias}</strong><br/>Posición aproximada · {distanceLabel(p.distance_m)}<br/>Marcador redondeado por privacidad</Popup></Marker>)}</MapContainer><div className="map-legend"><span><i className="dot blue"/> Tú</span><span><i className="dot teal"/> Equipo</span>{showNearby&&<span><i className="dot amber"/> Cercanos (aprox.)</span>}</div></div>
}
function Dashboard({user,notify}){
 const [profile,setProfile]=useState(null),[teams,setTeams]=useState([]),[selectedTeam,setSelectedTeam]=useState(''),[members,setMembers]=useState([]),[positions,setPositions]=useState([]),[nearby,setNearby]=useState([]),[me,setMe]=useState(null),[sharing,setSharing]=useState(false),[tab,setTab]=useState('map'),[showNearby,setShowNearby]=useState(false),[busy,setBusy]=useState(false),[mobileMenu,setMobileMenu]=useState(false);
 const [chatMode,setChatMode]=useState('team'),[selectedPeer,setSelectedPeer]=useState('');
 const [notifications,setNotifications]=useState([]),[loadingNotifications,setLoadingNotifications]=useState(true);
 const [alertSettings,setAlertSettings]=useState(()=>loadNotificationSettings(user.id));
 const seenNotificationIds=useRef(new Set()),notificationsInitialized=useRef(false);
 const watcher=useRef(null),current=useRef(null),sharingRef=useRef(false),teamRef=useRef('');
  const lastUploadedGps=useRef(0),gpsUploading=useRef(false),activeTab=useRef('map');
  useEffect(()=>{activeTab.current=tab},[tab]);
 const currentTeam=teams.find(t=>t.id===selectedTeam);
 const directPeers=members.filter(m=>m.user_id!==user.id);
 const directPeer=directPeers.find(m=>m.user_id===selectedPeer)||directPeers[0];
 const unreadCount=notifications.filter(n=>!n.read_at).length;
 const teammateIds=new Set(members.filter(x=>x.user_id!==user.id).map(x=>x.user_id));
 const teammates=positions.filter(p=>teammateIds.has(p.user_id)&&Date.now()-new Date(p.updated_at).getTime()<25000).map(p=>({...p,...(members.find(x=>x.user_id===p.user_id)||{}),alias:members.find(x=>x.user_id===p.user_id)?.alias||'Compañero'}));
 const profiles=Object.fromEntries(members.map(m=>[m.user_id,{alias:m.alias}]));
 const refreshTeams=useCallback(async()=>{const {data:memberships,error}=await supabase.from('team_members').select('team_id').eq('user_id',user.id);if(error){notify(sqlError(error),'error');return;}const ids=(memberships||[]).map(x=>x.team_id);if(!ids.length){setTeams([]);setSelectedTeam('');return;}const {data,error:e2}=await supabase.from('teams').select('*').in('id',ids).order('created_at',{ascending:false});if(e2)notify(sqlError(e2),'error');else{setTeams(data||[]);setSelectedTeam(old=>ids.includes(old)?old:ids[0]);}},[user.id]);
 const loadRoster=useCallback(async()=>{if(!selectedTeam){setMembers([]);setPositions([]);return;}const {data:m,error:e}=await supabase.from('team_members').select('user_id,administrative_role,operational_role_id').eq('team_id',selectedTeam);if(e){notify(sqlError(e),'error');return;}const ids=(m||[]).map(x=>x.user_id);const [profilesResult,rolesResult]=await Promise.all([supabase.from('profiles').select('id,alias,avatar_path,display_name').in('id',ids),supabase.from('team_roles').select('id,name').eq('team_id',selectedTeam)]);const p=profilesResult.data||[],roles=rolesResult.data||[];if(profilesResult.error||rolesResult.error)notify(sqlError(profilesResult.error||rolesResult.error),'error');setMembers((m||[]).map(member=>{const pr=p.find(x=>x.id===member.user_id)||{};return {...member,user_id:member.user_id,alias:pr.alias||'Compañero',avatar_path:pr.avatar_path||null,display_name:pr.display_name||'',operationalRole:roles.find(x=>x.id===member.operational_role_id)?.name||'',adminRole:member.administrative_role};}));},[selectedTeam]);
 const loadPositions=useCallback(async()=>{const {data,error}=await supabase.from('positions').select('*');if(!error)setPositions(data||[])},[]);
 const loadNearby=useCallback(async()=>{if(!current.current||!showNearby)return;const {data,error}=await supabase.rpc('nearby_people',{my_lat:current.current.lat,my_lng:current.current.lng});if(!error)setNearby(data||[])},[showNearby]);
 useEffect(()=>{supabase.from('profiles').select('*').eq('id',user.id).single().then(({data,error})=>{if(error)notify(sqlError(error),'error');else setProfile(data)});refreshTeams();},[user.id,refreshTeams]);
 useEffect(()=>{teamRef.current=selectedTeam;loadRoster();},[selectedTeam,loadRoster]);
 useEffect(()=>{loadPositions();const ch=supabase.channel('team-positions').on('postgres_changes',{event:'*',schema:'public',table:'positions'},()=>loadPositions()).subscribe();const id=setInterval(()=>{loadPositions();loadNearby()},12000);return()=>{clearInterval(id);supabase.removeChannel(ch)}},[loadPositions,loadNearby]);
 useEffect(()=>{loadNearby()},[me?.lat,me?.lng,showNearby]);
 // La lectura local NO transmite GPS. Solo se transmite al activar el control explícito.
 const startLocation=useCallback(()=>{if(!navigator.geolocation){notify('Este navegador no admite geolocalización.','error');return;}if(watcher.current!==null)return;watcher.current=navigator.geolocation.watchPosition(async pos=>{
  const p={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};if(!isValidLocation(p))return;
  current.current=p;setMe(p);
  if(sharingRef.current){const {error}=await supabase.from('positions').upsert({user_id:user.id,latitude:p.lat,longitude:p.lng,accuracy_m:p.accuracy,updated_at:new Date().toISOString()});if(error)notify(sqlError(error),'error')}
 },err=>notify('GPS: '+err.message,'error'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000})},[user.id]);
 useEffect(()=>{startLocation();return()=>{if(watcher.current!==null){navigator.geolocation.clearWatch(watcher.current);watcher.current=null;}sharingRef.current=false;supabase.from('positions').delete().eq('user_id',user.id).then(()=>{})}},[startLocation,user.id]);
 async function toggleSharing(){if(sharing){sharingRef.current=false;setSharing(false);const {error}=await supabase.from('positions').delete().eq('user_id',user.id);if(error)notify('No se pudo borrar la última ubicación: '+sqlError(error),'error');else notify('Dejaste de compartir ubicación.','success');return;}if(!me){startLocation();notify('Primero autoriza el GPS y espera a recibir una ubicación.','error');return;}setBusy(true);const {error}=await supabase.from('positions').upsert({user_id:user.id,latitude:me.lat,longitude:me.lng,accuracy_m:me.accuracy,updated_at:new Date().toISOString()});setBusy(false);if(error){notify(sqlError(error),'error');return;}sharingRef.current=true;setSharing(true);notify('Tu ubicación ahora es visible para tus compañeros de equipo.','success')}
 // Refresco incluso si el móvil está quieto. No garantiza ejecución con navegador suspendido.
 useEffect(()=>{if(!sharing)return;const id=setInterval(async()=>{if(current.current&&sharingRef.current){const p=current.current;await supabase.from('positions').upsert({user_id:user.id,latitude:p.lat,longitude:p.lng,accuracy_m:p.accuracy,updated_at:new Date().toISOString()})}},12000);return()=>clearInterval(id)},[sharing,user.id]);
 async function toggleDiscoverable(){if(!profile)return;const next=!profile.discoverable;const {error}=await supabase.from('profiles').update({discoverable:next}).eq('id',user.id);if(error)notify(sqlError(error),'error');else{setProfile({...profile,discoverable:next});notify(next?'Aparecerás de forma aproximada en «Cercanos» mientras compartas GPS.':'Ya no aparecerás en la búsqueda de usuarios cercanos.','success')}}
 async function updateAlias(e){e.preventDefault();const next=new FormData(e.currentTarget).get('alias')?.trim();if(!next||next.length<3||next.length>40)return;const {error}=await supabase.from('profiles').update({alias:next}).eq('id',user.id);if(error)notify(sqlError(error),'error');else{setProfile({...profile,alias:next});notify('Perfil actualizado.','success');loadRoster()}}
 async function logout(){sharingRef.current=false;await supabase.from('positions').delete().eq('user_id',user.id);const {error}=await supabase.auth.signOut();if(error)notify(sqlError(error),'error')}
 const loadNotifications=useCallback(async()=>{
  const {data,error}=await supabase.from('app_notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(75);
  if(error){notify('No se pudieron obtener notificaciones: '+sqlError(error),'error');setLoadingNotifications(false);return;}
  (data||[]).forEach(n=>seenNotificationIds.current.add(n.id));
  setNotifications(data||[]);notificationsInitialized.current=true;setLoadingNotifications(false);
 },[user.id,notify]);
 useEffect(()=>{loadNotifications();},[loadNotifications]);
 // Al volver a la pestaña, recupera avisos que Realtime no pudo entregar mientras
 // el navegador estuvo suspendido. No genera vibraciones retroactivas.
 useEffect(()=>{
  const refreshOnReturn=()=>{if(document.visibilityState==='visible')loadNotifications()};
  document.addEventListener('visibilitychange',refreshOnReturn);
  window.addEventListener('focus',refreshOnReturn);
  return()=>{document.removeEventListener('visibilitychange',refreshOnReturn);window.removeEventListener('focus',refreshOnReturn)};
 },[loadNotifications]);
 useEffect(()=>{
  const channel=supabase.channel('user-alerts-'+user.id).on('postgres_changes',{
   event:'INSERT',schema:'public',table:'app_notifications',filter:`user_id=eq.${user.id}`
  },payload=>{
   const n=payload.new;if(!n||seenNotificationIds.current.has(n.id))return;
   seenNotificationIds.current.add(n.id);
   setNotifications(old=>[n,...old].slice(0,75));
   if(!notificationsInitialized.current)return;
   if(alertSettings.vibration)vibratePattern(n.category);
   if(alertSettings.sound)playNotificationSound();
   if(document.visibilityState==='visible')notify(n.title,'success');
   if(alertSettings.system&&document.visibilityState!=='visible'&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
    navigator.serviceWorker?.ready.then(reg=>reg.showNotification(n.title,{
     body:n.detail||'Abre Airsoft Geo para revisar.',tag:'airsoft-geo-'+n.id,vibrate:patterns[n.category]||patterns.team_message,
     data:{url:'/'},silent:!alertSettings.sound
    })).catch(()=>{});
   }
  }).subscribe();
  return()=>{supabase.removeChannel(channel)};
 },[user.id,notify,alertSettings]);
 function changeAlertSettings(next){setAlertSettings(next);saveNotificationSettings(user.id,next)}
 function testAlert(category){const vibrated=vibratePattern(category);
  if(alertSettings.sound)playNotificationSound();
  notify(vibrated?'Se solicitó una vibración al dispositivo (puede bloquearla el sistema).':'Tu navegador no permitió vibrar; las alertas visuales sí funcionarán.',vibrated?'success':'info');
 }
 async function markNotificationRead(id){const {error}=await supabase.from('app_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);
  if(error)notify(sqlError(error),'error');else setNotifications(old=>old.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));}
 async function markAllRead(){const ids=notifications.filter(n=>!n.read_at).map(n=>n.id);if(!ids.length)return;
  const at=new Date().toISOString();const {error}=await supabase.from('app_notifications').update({read_at:at}).in('id',ids).eq('user_id',user.id);
  if(error)notify(sqlError(error),'error');else setNotifications(old=>old.map(n=>({...n,read_at:n.read_at||at})));}
 const nav=[['map','Mapa GPS',MapPin],['chat','Mensajes',MessagesSquare],['alerts','Notificaciones',Bell],['teams','Equipos',Users],['activities','Actividades',CalendarDays],...(teams.some(t=>t.owner_id===user.id)?[['admin','Administración',ShieldCheck]]:[]),['settings','Mi perfil',Settings]];
 return <div className="shell"><aside className={'sidebar '+(mobileMenu?'open':'')}><div className="logo"><span className="brand-mark"><Navigation size={22}/></span><span>OPERACIÓN<br/><b>SOMBRA</b></span></div><div className="sidebar-label">ESPACIO DE TRABAJO</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setMobileMenu(false)}}><Icon size={19}/>{label}{id==='alerts'&&unreadCount>0&&<span className="nav-count">{unreadCount>99?'99+':unreadCount}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="account"><div className="avatar">{(profile?.alias||'A').slice(0,1).toUpperCase()}</div><div><strong>{profile?.alias||'Mi cuenta'}</strong><small>Usuario registrado</small></div></div><button className="logout" onClick={logout}><LogOut size={18}/> Cerrar sesión</button></div></aside>{mobileMenu&&<button className="mobile-backdrop" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)}/>}<div className="workspace"><header className="topbar"><button className="hamburger" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú"><Menu/></button><div><div className="eyebrow">PANEL PRINCIPAL</div><h1>{nav.find(v=>v[0]===tab)?.[1]}</h1></div><div className="top-status">{me?<span className="status"><Wifi size={16}/> GPS disponible</span>:<span className="status pending"><WifiOff size={16}/> Esperando GPS</span>}</div></header><main className="content">{tab==='admin'?<AdminPanel user={user} teams={teams} notify={notify}/>:tab==='activities'?<Activities user={user} teams={teams} me={me} sharing={sharing} positions={positions} alias={profile?.alias} notify={notify} onOpenChat={()=>setTab('chat')} onToggleSharing={toggleSharing}/>:tab==='teams'?<TeamManager teams={teams} onRefresh={refreshTeams} notify={notify} user={user}/>:tab==='settings'?<div className="stack narrow"><h2>Mi perfil y privacidad</h2><ProfileEditor user={user} profile={profile} onChange={p=>{setProfile(p);loadRoster()}} notify={notify}/><div className="tile"><h3>Permisos de ubicación</h3><p className="muted">Tu GPS solo se sube al servidor cuando activas «Compartir GPS». Quienes comparten un equipo contigo podrán ver tu posición. Nunca publiques códigos de equipo.</p><button className={'btn '+(sharing?'danger':'primary')} disabled={busy} onClick={toggleSharing}>{sharing?'Detener ubicación compartida':'Compartir GPS con mi equipo'}</button><div className="divider"/><h3>Permitir que me descubran cerca</h3><p className="muted">Permite a otros usuarios registrados ver tu alias, distancia aproximada y una coordenada redondeada cuando estés compartiendo GPS, aunque no sean de tu equipo.</p><button className="btn outline" onClick={toggleDiscoverable}>{profile?.discoverable?<><EyeOff size={17}/> Desactivar búsqueda cercana</>:<><Eye size={17}/> Activar búsqueda cercana</>}</button></div><NotificationSettings userId={user.id} settings={alertSettings} onChange={changeAlertSettings} onTest={testAlert} notify={notify}/></div>:tab==='alerts'?<NotificationCenter items={notifications} loading={loadingNotifications} onRefresh={loadNotifications} onRead={markNotificationRead} onReadAll={markAllRead}/>:tab==='chat'?<div className="stack"><div className="section-head"><div><h2>Mensajes y multimedia</h2><p className="muted">Comunicación privada con los integrantes de tu equipo.</p></div><select className="select-team" aria-label="Seleccionar equipo" value={selectedTeam} onChange={e=>setSelectedTeam(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>{currentTeam?<><div className="inline-actions"><button className={'btn '+(chatMode==='team'?'primary':'outline')} onClick={()=>setChatMode('team')}>Chat del equipo</button><button className={'btn '+(chatMode==='direct'?'primary':'outline')} onClick={()=>setChatMode('direct')}>Mensajes privados</button></div>{chatMode==='team'?<Chat key={currentTeam.id} team={currentTeam} user={user} profiles={profiles} notify={notify}/>:directPeers.length?<><label className="direct-peer-label">Conversar con: <select className="select-team" value={directPeer?.user_id||''} onChange={e=>setSelectedPeer(e.target.value)}>{directPeers.map(m=><option key={m.user_id} value={m.user_id}>{m.alias}</option>)}</select></label><DirectChat key={user.id+'-'+directPeer.user_id} user={user} peer={directPeer} notify={notify}/></>:<div className="empty tile">Para escribir mensajes privados, primero otro participante debe unirse a este equipo.</div>}</>:<div className="empty tile">Primero crea un equipo o únete a uno desde «Equipos».</div>}</div>:<UnifiedMap user={user} profile={profile} team={currentTeam} teams={teams} members={members} me={me} sharing={sharing} busy={busy} onToggleSharing={toggleSharing} onToggleDiscoverable={toggleDiscoverable} onTeamSwitch={setSelectedTeam} onRefresh={()=>{loadRoster();loadPositions();loadNearby()}} onOpenChat={()=>setTab('chat')} onNearbyVisibility={setShowNearby} nearby={nearby} teammates={teammates} notify={notify}/>}</main></div></div>
}
export default function App(){const [session,setSession]=useState(undefined),[notice,setNotice]=useState(null);
 const notify=useCallback((text,type='info')=>setNotice({text,type}),[]);
 useEffect(()=>{if(!supabase){setSession(null);return;}supabase.auth.getSession().then(({data})=>setSession(data.session)).catch(()=>setSession(null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 if(!configured)return <div className="config-screen"><Lock size={36}/><h1>Configuración pendiente</h1><p>Antes de iniciar, crea el archivo <code>.env</code> copiando <code>.env.example</code> y coloca la URL y clave pública de tu proyecto Supabase. Consulta <code>GUIA_INSTALACION.md</code>.</p></div>;
 return <><Notice message={notice} onClose={()=>setNotice(null)}/>{session===undefined?<div className="config-screen">Iniciando plataforma…</div>:session?<Dashboard key={session.user.id} user={session.user} notify={notify}/>:<Auth notify={notify}/>}</>;
}
