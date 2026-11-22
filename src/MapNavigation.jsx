import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Marker,Popup,Circle,Polyline,useMapEvents} from 'react-leaflet';
import L from 'leaflet';
import {MapPinned,LocateFixed,Navigation,Route,Target,Flag,Copy,X,
  Compass,MousePointer2,RefreshCw,Satellite,Map as MapIcon, Box, Footprints, AlertCircle} from 'lucide-react';
import {supabase} from './supabase';
import {metersBetween,distanceLabel} from './geo';
import {validCoordinate,headingTo,bearingLabel} from './navigationUtils';
import {routeArrows} from './navigationGuide.js';
import './map-navigation.css';

const markerIcon=type=>L.divIcon({
 className:'v52-destination-marker '+type,
 html:'<span>'+ (type==='selected'?'★':'●') +'</span>',
 iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-18]
});
function DestinationClick({picking,onPick}){
 useMapEvents({click:e=>{if(picking)onPick(e.latlng.lat,e.latlng.lng)}});
 return null;
}
export function NavigationLayers({objectives,destination,onChoose,me,picking,onPick,route}){
 const destIcon=useMemo(()=>markerIcon('selected'),[]);
 const zoneIcon=useMemo(()=>markerIcon('zone'),[]);
 const fresh=me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000;
 const arrows=useMemo(()=>routeArrows(route?.points,85,28),[route?.points]);
 const point=destination&&validCoordinate(destination.lat,destination.lng)?[destination.lat,destination.lng]:null;
 return <>
  <DestinationClick picking={picking} onPick={onPick}/>
  {objectives.map(zone=><Marker key={zone.id} position={[zone.lat,zone.lng]} icon={zoneIcon}>
   <Popup minWidth={180}><div className="v52-goal-popup"><strong>{zone.name}</strong>
    <small>{zone.activityTitle} · {zone.type}</small>
    <button type="button" className="v52-nav-button" onClick={()=>onChoose(zone)}>
     <Target size={14}/> Elegir como destino</button>
   </div></Popup>
  </Marker>)}
  {point&&<><Marker position={point} icon={destIcon}>
   <Popup><strong>{destination.name}</strong><p className="v52-nav-hint">Destino seleccionado. Consulta el panel de orientación.</p></Popup>
  </Marker>
   {Number.isFinite(destination.radius_m)&&destination.radius_m>0&&
     <Circle center={point} radius={destination.radius_m} pathOptions={{color:'#a86b08',weight:2,fillOpacity:0.04}}/>}
   {fresh&&!route&&<Polyline positions={[[me.lat,me.lng],point]} pathOptions={{
    color:'#e79421',dashArray:'7 8',weight:3,opacity:0.9
   }}/>}
   {route?.points?.length>1&&<><Polyline positions={route.points} pathOptions={{color:'#1b70d8',weight:5,opacity:0.95}}/>
    {arrows.map((arrow,i)=><Marker key={'arr-'+i} interactive={false} position={[arrow.lat,arrow.lng]}
     icon={L.divIcon({className:'v54-leaflet-route-arrow',html:'<span style="transform:rotate('+(arrow.bearing-90)+'deg)">➤</span>',iconSize:[28,28],iconAnchor:[14,14]})}/>)}
   </>}
  </>}
 </>;
}
export function useAuthorizedObjectives(teamId,reconnectedAt,online=true){
 const [zones,setZones]=useState([]),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  if(!teamId||!online){if(!teamId)setZones([]);return;}
  try{
   const {data:activities,error:activityError}=await supabase.from('activities')
    .select('id,title,status').in('status',['scheduled','active']).limit(100);
   if(activityError)throw activityError;
   const ids=(activities||[]).map(a=>a.id);
   if(!ids.length){setZones([]);setError('');return;}
   const {data,error:zoneError}=await supabase.from('activity_zones')
    .select('id,activity_id,team_id,name,zone_type,latitude,longitude,radius_m')
    .in('activity_id',ids).limit(200);
   if(zoneError)throw zoneError;
   const indexed=new Map((activities||[]).map(a=>[a.id,a]));
   setZones((data||[]).filter(z=>validCoordinate(z.latitude,z.longitude)).map(z=>({
    id:z.id,activity_id:z.activity_id,team_id:z.team_id,
    name:z.name,type:z.zone_type,lat:z.latitude,lng:z.longitude,radius_m:z.radius_m,
    activityTitle:indexed.get(z.activity_id)?.title||'Actividad'
   })));
   setError('');
  }catch(e){setError('No se pudieron actualizar los objetivos. Revisa la conexión.')}
 },[teamId,online]);
 useEffect(()=>{reload();if(!online)return;const interval=setInterval(()=>{
  if(document.visibilityState==='visible')reload();
 },30000);return()=>clearInterval(interval)},[reload,online,reconnectedAt]);
 return {zones,error,reload};
}
export default function NavigationControls({me,destination,onDestination,objectives,picking,setPicking,
 mapStyle,setMapStyle,follow,setFollow,onRecenter,connection,route,routeStatus,routeError,
 onCalculateRoute,onClearRoute}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{if(destination?.id)setExpanded(true)},[destination?.id]);
 const fresh=me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000;
 const distance=fresh&&destination?metersBetween(me,destination):null;
 const bearing=fresh&&destination?headingTo(me,destination):null;
 const routeReady=route?.points?.length>1;
 const chooseZone=event=>{
  const zone=objectives.find(z=>z.id===event.target.value);
  if(zone)onDestination(zone);
 };
 const selectedId=objectives.some(z=>z.id===destination?.id)?destination.id:'';
 async function copyCoords(){
  if(!destination)return;
  try{await navigator.clipboard.writeText(destination.lat.toFixed(6)+', '+destination.lng.toFixed(6))}
  catch{/* La selección textual también permite copiar la coordenada manualmente. */}
 }
 return <div className="v52-nav-panel">
  <div className="v52-nav-top">
   <button type="button" className="v52-nav-title" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-label="Abrir o cerrar navegación"><Target size={17}/><strong>{destination?'Destino: '+destination.name:'Objetivos y navegación'}</strong><span>{expanded?'−':'+'}</span></button>
   <div className="v52-nav-view">
    <button type="button" className={mapStyle==='3d'?'active':''} onClick={()=>setMapStyle('3d')}
     title="Vista tridimensional dentro de Airsoft Geo" aria-label="Ver mapa 3D"><Box size={16}/><span>3D</span></button>
    <button type="button" className={mapStyle==='street'?'active':''} onClick={()=>setMapStyle('street')}
     title="Mapa de calles" aria-label="Ver calles"><MapIcon size={16}/></button>
    <button type="button" className={mapStyle==='satellite'?'active':''} onClick={()=>setMapStyle('satellite')}
     title="Vista satélite" aria-label="Ver satélite"><Satellite size={16}/></button>
   </div>
  </div>
  {expanded&&<>
  <div className="v52-nav-selector">
   <select aria-label="Objetivos de las actividades" value={selectedId} onChange={chooseZone}>
    <option value="">Selecciona un objetivo autorizado</option>
    {objectives.map(zone=><option key={zone.id} value={zone.id}>{zone.name} · {zone.activityTitle}</option>)}
   </select>
   <button type="button" className={picking?'active':''} onClick={()=>setPicking(v=>!v)}
    title="Toca en el mapa para fijar un destino temporal"><MousePointer2 size={16}/> {picking?'Toca mapa…':'Elegir en mapa'}</button>
  </div>
  {destination&&<div className="v52-destination-line">
   <div><strong><Flag size={14}/> {destination.name}</strong>
    <small>{fresh?(distanceLabel(distance)+' · '+bearingLabel(bearing)+' ('+Math.round(bearing)+'°)'):'GPS reciente necesario para distancia y orientación'}</small>
    <small className="v52-coordinate">{destination.lat.toFixed(6)}, {destination.lng.toFixed(6)}</small>
   </div>
   <div className="v52-destination-buttons">
    <button type="button" title="Copiar coordenadas" aria-label="Copiar coordenadas" onClick={copyCoords}><Copy size={15}/></button>
    <button type="button" title="Limpiar destino" aria-label="Limpiar destino" onClick={()=>onDestination(null)}><X size={16}/></button>
    <button type="button" className="v52-navigate-external" onClick={onCalculateRoute}
     disabled={!fresh||connection?.state==='offline'||routeStatus==='calculating'}
     title="Calcular ruta a pie dentro de Airsoft Geo">
     <Footprints size={15}/> {routeStatus==='calculating'?'Calculando…':routeReady?'Recalcular ruta':'Cómo llegar aquí'}
    </button>
    {routeReady&&<button type="button" onClick={onClearRoute} title="Quitar ruta del mapa"><X size={15}/> Quitar ruta</button>}
   </div>
  </div>}
  {routeReady&&<div className="v53-route-summary"><strong>Ruta a pie:</strong> {route.distanceM===null?'—':distanceLabel(route.distanceM)} · {route.durationSeconds===null?'—':Math.max(1,Math.round(route.durationSeconds/60))+' min aproximados'}
    {route.steps.length>0&&<details><summary>Ver indicaciones ({route.steps.length})</summary><ol>{route.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></details>}
   </div>}
  {routeError&&<p className="v53-route-error" role="alert"><AlertCircle size={14}/>{routeError} La línea directa sigue disponible solo como referencia.</p>}
  <div className="v52-nav-secondary">
   <button type="button" onClick={()=>{setFollow(v=>!v);if(!follow)onRecenter()}}>
    <LocateFixed size={15}/> {follow?'GPS sígueme activo':'Seguir mi GPS'}</button>
   <button type="button" onClick={onRecenter}><Navigation size={15}/> Centrar</button>
  </div>
  <p className="v52-nav-hint">El rumbo directo no es un sendero. «Cómo llegar aquí» calcula y muestra la ruta dentro de Airsoft Geo. Al pulsarlo, se envían únicamente tu origen y el destino seleccionado al servicio público Valhalla/OpenStreetMap. Su cobertura no es garantizada: verifica el terreno y los caminos permitidos.</p>
  </>}
 </div>;
}
