import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MapContainer,TileLayer,Marker,Popup,Circle,useMap} from 'react-leaflet';
import L from 'leaflet';
import {MapPin,Users,Radio,RefreshCw,Navigation,Eye,EyeOff,ArrowLeft,ArrowRight,AlertTriangle,
  ShieldAlert,HeartPulse,Flag,Undo2,Skull,MoreHorizontal,MessagesSquare,CheckCircle,Clock3} from 'lucide-react';
import {supabase} from './supabase';
import {metersBetween,distanceLabel} from './geo';
import {ProfileAvatar,useAvatarUrl} from './ProfileEditor';
import {vibratePattern} from './notificationUtils';
import './unified-map.css';

export const quickSignals=[
 {id:'rival_left',label:'Rival izquierda',short:'Izquierda',icon:ArrowLeft,group:'rival'},
 {id:'rival_right',label:'Rival derecha',short:'Derecha',icon:ArrowRight,group:'rival'},
 {id:'rival_near',label:'Rival cerca',short:'Cerca',icon:Eye,group:'rival'},
 {id:'need_help',label:'Necesito apoyo',short:'Apoyo',icon:ShieldAlert,group:'status'},
 {id:'in_position',label:'En posición',short:'En posición',icon:MapPin,group:'status'},
 {id:'medical',label:'Herido / médico',short:'Médico',icon:HeartPulse,group:'more'},
 {id:'withdrawing',label:'Me retiro',short:'Me retiro',icon:Undo2,group:'more'},
 {id:'eliminated',label:'Eliminado',short:'Eliminado',icon:Skull,group:'more'}
];
const signalById=Object.fromEntries(quickSignals.map(x=>[x.id,x]));
const initial=(alias)=>String(alias||'?').trim().slice(0,1).replace(/[<>&"']/g,'')||'?';
function avatarIcon(url,alias,kind){
 if(url)return L.icon({iconUrl:url,iconSize:[46,46],iconAnchor:[23,23],popupAnchor:[0,-24],className:'v5-map-photo '+kind});
 return L.divIcon({
  className:'v5-map-marker '+kind,
  html:'<span>'+initial(alias).toUpperCase()+'</span>',
  iconSize:[44,44],iconAnchor:[22,22],popupAnchor:[0,-23]
 });
}
function Pin({position,profile,kind,children}){
 const avatar=useAvatarUrl(kind==='nearby'?null:profile.avatar_path);
 const marker=useMemo(()=>avatarIcon(avatar,profile.alias,kind),[avatar,profile.alias,kind]);
 return <Marker position={position} icon={marker}><Popup minWidth={230} maxWidth={300}>{children}</Popup></Marker>;
}
function FollowCurrent({me,focus}){
 const map=useMap(),first=useRef(false);
 useEffect(()=>{if(me&&!first.current){map.setView([me.lat,me.lng],16);first.current=true}},[Boolean(me),map]);
 useEffect(()=>{if(me&&focus>0)map.setView([me.lat,me.lng],16)},[focus,map]);
 return null;
}
function SignalMarker({signal,alias}){
 const marker=useMemo(()=>L.divIcon({
  className:'v5-map-alert-marker',
  html:'<span>!</span>',iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-16]
 }),[]);
 return <Marker position={[signal.latitude,signal.longitude]} icon={marker}>
  <Popup><div className="v5-signal-popup"><strong>{signalById[signal.kind]?.label||'Aviso del equipo'}</strong>
   <p>Reportado por {alias}. Esta es la posición aproximada del informante, <strong>no del rival</strong>.</p>
   <small>{new Date(signal.created_at).toLocaleTimeString('es-CO')}</small>
  </div></Popup>
 </Marker>;
}
function QuickButton({type,send,disabled,compact=false}){
 const cfg=signalById[type],Icon=cfg.icon;
 return <button type="button" disabled={disabled} className={'v5-quick v5-'+type+' '+(compact?'compact':'')}
  title={cfg.label} aria-label={'Aviso rápido: '+cfg.label} onClick={()=>send(type)}>
  <Icon size={compact?18:20} aria-hidden="true"/><span>{compact?cfg.short:cfg.label}</span>
 </button>;
}
function PlayerCard({person,type,me,sharing,team,onSignal,onOpenChat,onTestVibration,busy}){
 const isMine=type==='mine',isNearby=type==='nearby',role=person.operationalRole||
  (person.adminRole==='owner'?'Propietario':person.adminRole==='admin'?'Administrador':
  person.adminRole==='coordinator'?'Coordinador':'Participante');
 const seconds=person.updated_at?Math.max(0,Math.floor((Date.now()-new Date(person.updated_at).getTime())/1000)):0;
 return <div className="v5-player-card">
  <div className="v5-player-head">
   <ProfileAvatar avatarPath={isNearby?'':person.avatar_path} alias={person.alias} size="lg"/>
   <div className="v5-player-id"><strong>{person.alias}{isMine?' (tú)':''}</strong>
    <span>{role}</span><small>{team?.name||'Airsoft Geo'}</small>
   </div>
  </div>
  <div className="v5-player-stats">
   <div><small>Distancia</small><b>{isMine?'0 m':isNearby?distanceLabel(person.distance_m):
    me?distanceLabel(metersBetween(me,{lat:person.latitude,lng:person.longitude})):'—'}</b></div>
   <div><small>Última señal</small><b>{isMine?'Ahora':isNearby?'Reciente':seconds<=10?'Ahora':seconds+' s'}</b></div>
   <div><small>Precisión</small><b>{isNearby?'Aprox.':Number.isFinite(person.accuracy_m??person.accuracy)?
    '±'+Math.round(person.accuracy_m??person.accuracy)+' m':'—'}</b></div>
  </div>
  {isNearby?<p className="small muted">Usuario cercano que autorizó aparecer. Su coordenada está redondeada. No puedes ver su posición exacta.</p>:
   <><p className="small muted">Acciones emitidas <strong>desde tu propio usuario y tu equipo</strong>; no modifican el estado de este compañero. El GPS solo se adjunta si está compartido.</p>
    <div className="v5-card-actions">
     {['need_help','rival_near','medical','in_position','withdrawing','eliminated'].map(id=><QuickButton key={id} type={id} send={onSignal} disabled={busy||!team} compact/>)}
    </div>
    <div className="v5-player-footer"><button className="v5-open-chat" type="button" onClick={onOpenChat}><MessagesSquare size={15}/> Abrir chat</button><button className="v5-open-chat" type="button" onClick={onTestVibration}><Radio size={15}/> Probar vibración</button></div>
   </>}
 </div>;
}
export default function UnifiedMap({user,profile,team,teams,members,me,sharing,busy,onToggleSharing,
 onToggleDiscoverable,onTeamSwitch,onRefresh,onOpenChat,onNearbyVisibility,nearby,teammates,notify}){
 const [layer,setLayer]=useState('team'),[more,setMore]=useState(false),[sending,setSending]=useState(false);
 const [focus,setFocus]=useState(0),[signals,setSignals]=useState([]),[tick,setTick]=useState(Date.now());
 const liveTeam=!!team,teamId=team?.id;
 useEffect(()=>{onNearbyVisibility(layer!=='team');return()=>onNearbyVisibility(false)},[layer,onNearbyVisibility]);
 const loadSignals=useCallback(async()=>{
  if(!teamId){setSignals([]);return;}
  const {data,error}=await supabase.from('team_signals').select('*').eq('team_id',teamId)
   .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(70);
  if(!error)setSignals(data||[]);
 },[teamId]);
 useEffect(()=>{
  loadSignals();
  if(!teamId)return;
  const chan=supabase.channel('v5-team-signals-'+teamId)
   .on('postgres_changes',{event:'*',schema:'public',table:'team_signals',filter:'team_id=eq.'+teamId},loadSignals)
   .subscribe();
  const interval=setInterval(()=>{setTick(Date.now());if(document.visibilityState==='visible')loadSignals()},10000);
  return()=>{clearInterval(interval);supabase.removeChannel(chan)};
 },[teamId,loadSignals]);
 async function sendSignal(kind){
  if(!teamId||sending)return;
  if(['withdrawing','eliminated'].includes(kind)&&!window.confirm('¿Enviar al equipo el aviso "'+signalById[kind].label+'"?'))return;
  setSending(true);
  try{
   const {error}=await supabase.rpc('f5_send_quick_signal',{p_team:teamId,p_kind:kind});
   if(error)throw error;
   notify('Aviso enviado a '+team.name+'. La ubicación solo se adjunta si tu GPS está compartido y reciente.','success');
   await loadSignals();
  }catch(e){notify('No se pudo enviar el aviso: '+(e?.message||'Error desconocido'),'error')}
  finally{setSending(false)}
 }
 const visibleTeammates=teammates.filter(p=>tick-new Date(p.updated_at).getTime()<=25000);
 const visibleNearby=nearby.filter(p=>!teammates.some(t=>t.user_id===p.user_id));
 const showTeammates=layer==='team'||layer==='both',showNear=layer==='nearby'||layer==='both';
 const activeSignals=signals.filter(s=>new Date(s.expires_at).getTime()>tick);
 const aliasFor=id=>id===user.id?profile?.alias:members.find(m=>m.user_id===id)?.alias||'Compañero';
 const meProfile={alias:profile?.alias||'Tú',avatar_path:profile?.avatar_path,
  operationalRole:members.find(m=>m.user_id===user.id)?.operationalRole||'',
  adminRole:team?.owner_id===user.id?'owner':members.find(m=>m.user_id===user.id)?.administrative_role||'participant',
  accuracy:me?.accuracy};
 return <div className="stack v5-map-panel">
  <div className="section-head"><div><h2>Mapa GPS</h2>
   <p className="muted">Un solo mapa para compañeros y usuarios que aceptaron ser descubiertos. Los avisos son observaciones manuales.</p></div>
   <button className="btn outline" onClick={onRefresh}><RefreshCw size={16}/> Actualizar</button>
  </div>
  <div className="v5-map-toolbar">
   <div className="v5-map-layers" role="group" aria-label="Personas visibles en el mapa">
    {[['team','Mi equipo',Users],['nearby','Cercanos',Radio],['both','Ambos',MapPin]].map(([id,label,Icon])=>
     <button key={id} type="button" className={layer===id?'selected':''} onClick={()=>setLayer(id)}>
      <Icon size={16}/>{label}</button>)}
   </div>
   {teams.length>0&&<select className="select-team" value={teamId||''}
    aria-label="Equipo para los avisos y el mapa" onChange={e=>onTeamSwitch(e.target.value)}>
    {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select>}
  </div>
  <div className="v5-status-bar">
   <span><Navigation size={14}/> GPS {me?'disponible':'sin señal'}</span>
   <span><span className={'v5-status-dot '+(sharing?'live':'')}/>{sharing?'Compartido':'Solo local'}</span>
   <span><Users size={14}/> {visibleTeammates.length} compañeros recientes</span>
  </div>
  <div className="v5-map-shell">
   <MapContainer center={me?[me.lat,me.lng]:[4.65,-74.1]} zoom={me?16:6} className="v5-map-canvas" scrollWheelZoom={false}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <FollowCurrent me={me} focus={focus}/>
    {me&&<><Circle center={[me.lat,me.lng]} radius={Math.max(15,me.accuracy||20)}
      pathOptions={{color:'#227ff3',fillOpacity:.06,weight:1}}/>
     <Pin kind="mine" profile={meProfile} position={[me.lat,me.lng]}>
      <PlayerCard person={meProfile} type="mine" me={me} sharing={sharing}
       team={team} onSignal={sendSignal} busy={sending} onOpenChat={onOpenChat} onTestVibration={()=>notify(vibratePattern('team_alert')?'Se solicitó una vibración.':'La vibración no está disponible en este dispositivo.','info')}/>
     </Pin></>}
    {showTeammates&&visibleTeammates.map(p=><Pin key={p.user_id} kind="teammate" profile={p}
      position={[p.latitude,p.longitude]}>
      <PlayerCard person={p} type="teammate" me={me} sharing={sharing} team={team}
       onSignal={sendSignal} busy={sending} onOpenChat={onOpenChat} onTestVibration={()=>notify(vibratePattern('team_alert')?'Se solicitó una vibración.':'La vibración no está disponible en este dispositivo.','info')}/>
     </Pin>)}
    {showNear&&visibleNearby.map(p=><Pin key={'near-'+p.user_id} kind="nearby" profile={p}
      position={[p.latitude,p.longitude]}>
      <PlayerCard person={p} type="nearby" me={me} sharing={sharing} team={team}
       onSignal={sendSignal} busy={sending} onOpenChat={onOpenChat} onTestVibration={()=>notify(vibratePattern('team_alert')?'Se solicitó una vibración.':'La vibración no está disponible en este dispositivo.','info')}/>
     </Pin>)}
    {showTeammates&&activeSignals.filter(s=>s.latitude!==null&&s.longitude!==null)
      .map(s=><SignalMarker key={s.id} signal={s} alias={aliasFor(s.sender_id)}/>)}
   </MapContainer>
   <div className="v5-map-rail" aria-label="Accesos rápidos del mapa">
    {quickSignals.filter(q=>q.group==='rival').map(q=><QuickButton key={q.id} type={q.id}
      send={sendSignal} disabled={sending||!liveTeam} compact/>)}
    <button className={'v5-quick v5-more-toggle '+(more?'open':'')} type="button"
      onClick={()=>setMore(o=>!o)} aria-expanded={more} title="Más acciones"><MoreHorizontal size={20}/><span>Más</span></button>
   </div>
   <div className="v5-map-rail-bottom" aria-label="Avisos de situación">
    {['need_help','in_position'].map(id=><QuickButton key={id} type={id} send={sendSignal}
      disabled={sending||!liveTeam} compact/>)}
   </div>
   {more&&<div className="v5-more-panel">
    {['medical','withdrawing','eliminated'].map(id=><QuickButton key={id} type={id} send={sendSignal} disabled={sending||!liveTeam} compact/>)}
   </div>}
   <button className="v5-recenter" type="button" disabled={!me} onClick={()=>setFocus(v=>v+1)}
    aria-label="Centrar mapa en mi ubicación" title="Centrar en mí"><Navigation size={18}/></button>
  </div>
  <div className="v5-map-legend"><span><i className="v5-legend-dot blue"/> Tú</span>
   {showTeammates&&<span><i className="v5-legend-dot green"/> Equipo</span>}
   {showNear&&<span><i className="v5-legend-dot orange"/> Cercanos aproximados</span>}
   {showTeammates&&<span><i className="v5-legend-dot red"/> Avisos temporales</span>}
  </div>
  <div className="v5-map-details">
   <section className="tile"><h3><ShieldAlert size={17}/> Avisos rápidos</h3>
    <p className="muted small">Los botones del mapa envían un aviso al equipo seleccionado. «Izquierda» y «derecha» son referencias informadas por ti; no indican la coordenada del rival. Duración del marcador: 3 minutos; apoyo y médico: 8 minutos.</p>
    {!team&&<p className="small muted">Crea o selecciona un equipo para enviar avisos.</p>}
    {activeSignals.length>0&&<div className="v5-alert-feed">
     {activeSignals.slice(0,8).map(s=><div key={s.id} className="v5-alert-line">
      <AlertTriangle size={15}/><div><b>{signalById[s.kind]?.label||'Aviso'}</b>
       <small>{aliasFor(s.sender_id)} · {new Date(s.created_at).toLocaleTimeString('es-CO')}
       {s.latitude===null?' · Sin GPS compartido':''}</small></div></div>)}
    </div>}
   </section>
   <section className="tile"><h3><Eye size={17}/> Privacidad y conexiones</h3>
    <p className="muted small">Consultar Cercanos no activa la publicación de tu ubicación. Para aparecer ante otros usuarios debes compartir GPS y autorizar expresamente que te encuentren.</p>
    <div className="v5-privacy-buttons">
     <button className={'btn '+(sharing?'danger':'primary')} disabled={busy} onClick={onToggleSharing}>
      {sharing?<EyeOff size={16}/>:<Navigation size={16}/>} {sharing?'Dejar de compartir GPS':'Compartir GPS'}</button>
     <button className="btn outline" onClick={onToggleDiscoverable}>
      <Radio size={16}/>{profile?.discoverable?'Dejar de aparecer en Cercanos':'Permitir que me encuentren'}</button>
    </div>
   </section>
  </div>
 </div>;
}