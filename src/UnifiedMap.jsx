import React,{lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MapContainer,TileLayer,Marker,Popup,Circle,useMap} from 'react-leaflet';
import L from 'leaflet';
import {MapPin,Users,Radio,RefreshCw,Navigation,Eye,EyeOff,ArrowLeft,ArrowRight,AlertTriangle,
  ShieldAlert,HeartPulse,Flag,Undo2,Skull,MoreHorizontal,MessagesSquare,CheckCircle,Clock3,Maximize2,Minimize2,WifiOff} from 'lucide-react';
import {supabase} from './supabase';
import {metersBetween,distanceLabel} from './geo';
import {ProfileAvatar,useAvatarUrl} from './ProfileEditor';
import {vibratePattern} from './notificationUtils';
import NavigationControls,{NavigationLayers,useAuthorizedObjectives} from './MapNavigation';
import {calculateWalkingRoute} from './routeService';
import {routeGuidance} from './navigationGuide.js';
import {reliableOffRouteFix,canRetryAutoRoute} from './reroutePolicy.js';
import RouteGuideHud from './RouteGuideHud';
const CameraNavigation=lazy(()=>import('./CameraNavigation.jsx'));
const Map3D=lazy(()=>import('./Map3D').catch(()=>({default:function Unsupported3D({onUnsupported}){
 React.useEffect(()=>onUnsupported('No se pudo cargar la vista 3D. Continúa disponible el mapa 2D.'),[onUnsupported]);return null;
}})));
class Map3DBoundary extends React.Component{
 constructor(props){super(props);this.state={failed:false}}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error){console.error('Vista 3D no disponible:',error);this.props.onFailure('El navegador no pudo dibujar 3D. Se restauró el mapa 2D.')}
 render(){return this.state.failed?null:this.props.children}
}
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
function FollowCurrent({me,focus,follow}){
 const map=useMap(),first=useRef(false);
 useEffect(()=>{if(me&&!first.current){map.setView([me.lat,me.lng],16);first.current=true}},[Boolean(me),map]);
 useEffect(()=>{if(me&&focus>0)map.flyTo([me.lat,me.lng],Math.max(15,map.getZoom()))},[focus,map]);
 useEffect(()=>{if(follow&&me&&me.observedAt&&Date.now()-me.observedAt<=30000&&first.current)map.panTo([me.lat,me.lng],{animate:false})},[follow,me?.lat,me?.lng,me?.observedAt,map]);
 useEffect(()=>{const redraw=()=>setTimeout(()=>map.invalidateSize(),120);document.addEventListener('fullscreenchange',redraw);return()=>document.removeEventListener('fullscreenchange',redraw)},[map]);
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
 onToggleDiscoverable,onTeamSwitch,onRefresh,onOpenChat,onNearbyVisibility,nearby,teammates,notify,connection}){
 const [layer,setLayer]=useState('team'),[more,setMore]=useState(false),[sending,setSending]=useState(false);
 const [focus,setFocus]=useState(0),[signals,setSignals]=useState([]),[tick,setTick]=useState(Date.now());
 const [destination,setDestination]=useState(null),[picking,setPicking]=useState(false);
 const [route,setRoute]=useState(null),[routeStatus,setRouteStatus]=useState('idle'),[routeError,setRouteError]=useState('');
 const [autoReroute,setAutoReroute]=useState(false),rerouteTracker=useRef({lastFix:0,count:0,lastRequest:0});
 const routeAbort=useRef(null),[selected3DPerson,setSelected3DPerson]=useState(null);
 const [mapStyle,setMapStyle]=useState('street'),[follow,setFollow]=useState(false);
 const [cameraOpen,setCameraOpen]=useState(false);
 const openCamera=useCallback(()=>setCameraOpen(true),[]);
 const closeCamera=useCallback(()=>setCameraOpen(false),[]);
 const shell=useRef(null),[fullscreen,setFullscreen]=useState(false);
 useEffect(()=>{const onChange=()=>setFullscreen(document.fullscreenElement===shell.current);document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[]);
 async function toggleFullscreen(){try{if(document.fullscreenElement===shell.current)await document.exitFullscreen();else if(shell.current?.requestFullscreen)await shell.current.requestFullscreen();else notify('Pantalla completa no disponible en este navegador. El mapa ya ocupa la mayor parte de la vista.','info');}catch(e){notify('Pantalla completa no disponible.','error')}}
 const {zones:objectives,error:objectiveError,reload:reloadObjectives}=useAuthorizedObjectives(team?.id,connection?.reconnectedAt,connection?.state!=='offline');
 function chooseDestination(next){setCameraOpen(false);routeAbort.current?.abort();routeAbort.current=null;setAutoReroute(false);rerouteTracker.current.count=0;setRoute(null);setRouteError('');setRouteStatus('idle');setDestination(next);setPicking(false);}
 useEffect(()=>{chooseDestination(null);setSelected3DPerson(null)},[team?.id]);
 useEffect(()=>()=>routeAbort.current?.abort(),[]);
 async function planRoute(){
  if(!destination||routeStatus==='calculating')return;
  if(connection?.state==='offline'){setRouteError('Sin Internet; no se puede calcular una ruta.');return}
  if(!me||!Number.isFinite(me.observedAt)||Date.now()-me.observedAt>30000){setRouteError('Se necesita una ubicación GPS reciente.');return}
  if(metersBetween(me,destination)>30000){setRouteError('El destino está a más de 30 km; el servicio público de rutas no permite esta búsqueda.');return}
  routeAbort.current?.abort();const controller=new AbortController();routeAbort.current=controller;
  const timeout=setTimeout(()=>controller.abort(),12000);
  setRouteStatus('calculating');setRoute(null);setRouteError('');
  try{
   const result=await calculateWalkingRoute(me,destination,controller.signal);
   if(controller.signal.aborted)return;
   setRoute(result);setRouteStatus('ready');rerouteTracker.current.count=0;
   notify('Ruta peatonal calculada dentro de Airsoft Geo. Verifica la seguridad y acceso de los caminos.','success');
  }catch(error){
   if(routeAbort.current!==controller)return;
   if(controller.signal.aborted){setRouteError('No se pudo calcular la ruta a tiempo.');}
   else setRouteError('No se pudo obtener un recorrido peatonal de la zona.');
   setRouteStatus('error');setAutoReroute(false);
  }finally{clearTimeout(timeout);if(routeAbort.current===controller)routeAbort.current=null}
 }
 useEffect(()=>{
  const tracker=rerouteTracker.current;
  if(!autoReroute||!route?.points?.length||routeStatus!=='ready'||!destination||
     connection?.state==='offline'||document.visibilityState!=='visible'){
   tracker.count=0;return;
  }
  if(!me){tracker.count=0;return;}
  if(tracker.lastFix===me.observedAt)return;
  tracker.lastFix=me.observedAt;
  const guidance=routeGuidance(me,route);
  if(!reliableOffRouteFix({enabled:autoReroute,routeReady:routeStatus==='ready',
      online:connection?.state!=='offline',visible:document.visibilityState==='visible',
      me,guide:guidance})){
   tracker.count=0;return;
  }
  tracker.count+=1;
  if(canRetryAutoRoute(tracker.count,tracker.lastRequest)){
   tracker.count=0;tracker.lastRequest=Date.now();
   notify('Te alejaste de la ruta: consultando un nuevo recorrido dentro de Airsoft Geo.','info');
   planRoute();
  }
 },[me?.observedAt,autoReroute,route?.calculatedAt,routeStatus,
  destination?.id,connection?.state]);
 function fallback3D(reason){setMapStyle('street');notify(reason||'Vista 3D no disponible; mapa 2D restaurado.','error')}

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
  if(connection?.state==='offline'){notify('SIN CONEXIÓN: no se envió el aviso. Comprueba Internet y vuelve a intentarlo.','error');return;}
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
  <div className="v52-map-topcontrols"><strong>Mapa GPS</strong><div className="v52-map-topactions">
   <button type="button" className={sharing?'v52-toggle on':'v52-toggle'} disabled={busy} onClick={onToggleSharing} title="Compartir GPS solo con tus equipos"><Navigation size={15}/>{sharing?'GPS compartido':'Compartir GPS'}</button>
   <button type="button" className={profile?.discoverable?'v52-toggle on':'v52-toggle'} onClick={onToggleDiscoverable} title="Permitir que otros usuarios registrados te encuentren de forma aproximada"><Radio size={15}/>{profile?.discoverable?'Visible en Cercanos':'Permitir que me encuentren'}</button>
   <button type="button" className="v52-map-refresh" onClick={()=>{onRefresh();reloadObjectives()}} aria-label="Actualizar mapa" title="Actualizar mapa"><RefreshCw size={16}/></button>
   <button type="button" className="v52-map-refresh" onClick={toggleFullscreen} aria-label="Expandir mapa" title="Pantalla completa"><Maximize2 size={16}/></button>
  </div></div>
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
  <div className="v5-map-shell" ref={shell}>
   {mapStyle==='3d'?
    <Map3DBoundary onFailure={fallback3D}><Suspense fallback={<div className="v53-3d-loading">Preparando mapa 3D…</div>}>
     <Map3D me={me} teammates={visibleTeammates} nearby={visibleNearby}
      objectives={objectives} signals={activeSignals} destination={destination} route={route}
      showTeammates={showTeammates} showNearby={showNear} follow={follow} focus={focus} picking={picking}
      onPick={(lat,lng)=>{chooseDestination({id:'manual',name:'Punto elegido en mapa',lat,lng});setFollow(false)}}
      onChoose={chooseDestination} onMember={setSelected3DPerson} onUnsupported={fallback3D}/>
    </Suspense></Map3DBoundary>:
    <MapContainer center={me?[me.lat,me.lng]:[4.65,-74.1]} zoom={me?16:6} className="v5-map-canvas" scrollWheelZoom={false}>
    {mapStyle==='satellite'?<TileLayer key="satellite" attribution='Imagery &copy; Esri, Maxar, Earthstar Geographics' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>:
     <TileLayer key="street" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>}
    <FollowCurrent me={me} focus={focus} follow={follow}/>
    <NavigationLayers objectives={objectives} destination={destination} route={route} onChoose={chooseDestination} me={me} picking={picking}
     onPick={(lat,lng)=>{chooseDestination({id:'manual',name:'Punto elegido en mapa',lat,lng});setFollow(false)}}/>
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
   </MapContainer>}
   <RouteGuideHud me={me} route={route}/>
   <NavigationControls me={me} destination={destination} onDestination={chooseDestination}
    objectives={objectives} picking={picking} setPicking={setPicking}
    mapStyle={mapStyle} setMapStyle={setMapStyle} follow={follow} setFollow={setFollow}
    onRecenter={()=>setFocus(v=>v+1)} connection={connection} route={route} routeStatus={routeStatus}
    routeError={routeError} onCalculateRoute={planRoute} onOpenCamera={openCamera} autoReroute={autoReroute}
    onToggleAutoReroute={setAutoReroute}
    onClearRoute={()=>{setRoute(null);setRouteStatus('idle');setRouteError('')}}/>
   {mapStyle==='3d'&&selected3DPerson&&<div className="v53-3d-player-panel">
    <button type="button" aria-label="Cerrar tarjeta GPS" onClick={()=>setSelected3DPerson(null)}>×</button>
    <PlayerCard person={selected3DPerson.kind==='mine'?meProfile:selected3DPerson.person}
     type={selected3DPerson.kind} me={me} sharing={sharing} team={team} onSignal={sendSignal}
     busy={sending} onOpenChat={onOpenChat}
     onTestVibration={()=>notify(vibratePattern('team_alert')?'Se solicitó vibración.':'Vibración no disponible.','info')}/>
   </div>}
   {picking&&<div className="v52-map-press-hint">Toca un lugar del mapa para elegir tu destino.</div>}
   {connection?.state==='offline'&&<div className="v52-map-offline"><WifiOff size={16}/> Sin conexión: avisos deshabilitados. Los puntos visibles pueden estar desactualizados.</div>}
   {fullscreen&&<div className="v52-fullscreen-privacy">
    <button type="button" onClick={onToggleSharing} disabled={busy}>{sharing?'Detener GPS':'Compartir GPS'}</button>
    <button type="button" onClick={onToggleDiscoverable}>{profile?.discoverable?'Ocultar de Cercanos':'Permitir que me encuentren'}</button>
    <button type="button" onClick={toggleFullscreen} aria-label="Salir de pantalla completa"><Minimize2 size={17}/></button>
   </div>}
   {cameraOpen&&destination&&<Suspense fallback={<div className="v56-camera-starting">Cargando modo cámara…</div>}>
    <CameraNavigation me={me} destination={destination} route={route} onClose={closeCamera}/>
   </Suspense>}
   <div className="v5-map-rail" aria-label="Accesos rápidos del mapa">
    {quickSignals.filter(q=>q.group==='rival').map(q=><QuickButton key={q.id} type={q.id}
      send={sendSignal} disabled={sending||!liveTeam||connection?.state==='offline'} compact/>)}
    <button className={'v5-quick v5-more-toggle '+(more?'open':'')} type="button"
      onClick={()=>setMore(o=>!o)} aria-expanded={more} title="Más acciones"><MoreHorizontal size={20}/><span>Más</span></button>
   </div>
   <div className="v5-map-rail-bottom" aria-label="Avisos de situación">
    {['need_help','in_position'].map(id=><QuickButton key={id} type={id} send={sendSignal}
      disabled={sending||!liveTeam||connection?.state==='offline'} compact/>)}
   </div>
   {more&&<div className="v5-more-panel">
    {['medical','withdrawing','eliminated'].map(id=><QuickButton key={id} type={id} send={sendSignal} disabled={sending||!liveTeam||connection?.state==='offline'} compact/>)}
   </div>}
   <button className="v5-recenter" type="button" disabled={!me} onClick={()=>setFocus(v=>v+1)}
    aria-label="Centrar mapa en mi ubicación" title="Centrar en mí"><Navigation size={18}/></button>
  </div>
  <div className="v5-map-legend"><span><i className="v5-legend-dot blue"/> Tú</span>
   {showTeammates&&<span><i className="v5-legend-dot green"/> Equipo</span>}
   {showNear&&<span><i className="v5-legend-dot orange"/> Cercanos aproximados</span>}
   {showTeammates&&<span><i className="v5-legend-dot red"/> Avisos temporales</span>}
  </div>
  <details className="v52-map-extras">
   <summary>Detalles, avisos y privacidad</summary>
   <div className="v5-map-details">
    <section className="tile"><h3><ShieldAlert size={17}/> Avisos recientes</h3>
     <p className="muted small">Los avisos de rival indican la posición del informante, no la del rival. Caducan automáticamente.</p>
     {activeSignals.length>0?<div className="v5-alert-feed">{activeSignals.slice(0,12).map(item=>
      <div key={item.id} className="v5-alert-line"><AlertTriangle size={15}/><div>
       <b>{signalById[item.kind]?.label||'Aviso'}</b><small>{aliasFor(item.sender_id)} · {new Date(item.created_at).toLocaleTimeString('es-CO')}</small>
      </div></div>)}</div>:<p className="muted small">Sin avisos vigentes de tu equipo.</p>}
    </section>
    <section className="tile"><h3><Eye size={17}/> Información GPS</h3>
     <p className="muted small">Compartir GPS y permitir que te encuentren son controles independientes, siempre accesibles en la parte superior del mapa. Un objetivo puede elegirse entre las zonas autorizadas o tocando el mapa.</p>
     <p className="muted small">{objectiveError||'El mapa permite orientación directa y apertura voluntaria de indicaciones peatonales externas.'}</p>
    </section>
   </div>
  </details>
 </div>;
}