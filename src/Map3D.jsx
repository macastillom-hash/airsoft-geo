import React,{useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {validCoordinate} from './navigationUtils.js';
import {routeArrows} from './navigationGuide.js';
import {light3DStyle} from './light3DStyle.js';
import './map3d.css';

const satelliteTiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// Cartografía ligera incorporada localmente (ver light3DStyle.js).

export default function Map3D({me,teammates,nearby,objectives,signals,destination,
 route,showTeammates,showNearby,follow,focus,picking,onPick,onChoose,onMember,onUnsupported}){
 const container=useRef(null),mapRef=useRef(null),pinsRef=useRef([]),arrowPinsRef=useRef([]);
 const controls=useRef({picking,onPick,onChoose,onMember,onUnsupported});
 controls.current={picking,onPick,onChoose,onMember,onUnsupported};
 const [ready,setReady]=useState(false);
 const [mode,setMode]=useState('loading'),[info,setInfo]=useState('');
 const [satellite,setSatellite]=useState(false),[checkingSatellite,setCheckingSatellite]=useState(false);
 function toggleSatellite(){
  const map=mapRef.current;
  if(!map||!ready||checkingSatellite)return;
  const layer='airsoft-satellite-layer';
  if(!map.getLayer(layer)){setInfo('La capa satelital no está preparada. Usa calles 3D.');return;}
  if(satellite){
   map.setLayoutProperty(layer,'visibility','none');
   setSatellite(false);setInfo('');return;
  }
  // Una sola prueba previa evita tapar el vectorial con imágenes que no llegan.
  setCheckingSatellite(true);
  setInfo('Comprobando imagen satelital…');
  const center=map.getCenter(),z=Math.max(1,Math.min(16,Math.floor(map.getZoom())));
  const n=2**z,x=Math.min(n-1,Math.max(0,Math.floor((center.lng+180)/360*n)));
  const lat=Math.max(-85,Math.min(85,center.lat))*Math.PI/180;
  const y=Math.min(n-1,Math.max(0,Math.floor((1-Math.asinh(Math.tan(lat))/Math.PI)/2*n)));
  const img=new Image();
  let done=false;
  const finish=ok=>{
   if(done)return;done=true;clearTimeout(timeout);
   if(mapRef.current!==map)return;
   setCheckingSatellite(false);
   if(ok){
    try{
     map.setLayoutProperty(layer,'visibility','visible');
     setSatellite(true);setInfo('');
    }catch{
     setSatellite(false);
     setInfo('No se pudo mostrar el satélite. Las calles 3D permanecen disponibles.');
    }
   }else{
    setSatellite(false);
    setInfo('El satélite no está disponible ahora. Puedes reintentar sin perder las calles 3D.');
   }
  };
  const timeout=setTimeout(()=>finish(false),7000);
  img.onload=()=>finish(true);
  img.onerror=()=>finish(false);
  img.src='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+y+'/'+x;
 }
 const [terrainEnabled,setTerrainEnabled]=useState(false);
 const [buildingsEnabled,setBuildingsEnabled]=useState(true);
 function toggleBuildings(){
  const map=mapRef.current;
  if(!map||!ready||!map.getLayer('airsoft-buildings-3d'))return;
  const next=!buildingsEnabled;
  map.setLayoutProperty('airsoft-buildings-3d','visibility',next?'visible':'none');
  setBuildingsEnabled(next);
  setInfo(next?'Edificios visibles donde existen datos cartográficos.':
   'Edificios desactivados para liberar recursos gráficos.');
 }
 function toggleTerrain(){
  const current=mapRef.current;
  if(!current||!ready)return;
  try{
   if(terrainEnabled){
    current.setTerrain(null);
    setTerrainEnabled(false);
    setInfo('');
   }else{
    if(!current.getSource('airsoft-terrain-dem'))current.addSource('airsoft-terrain-dem',{
     type:'raster-dem',
     tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
     tileSize:256,maxzoom:14,encoding:'terrarium',
     attribution:'Terreno: Mapzen / AWS Open Data'
    });
    current.setTerrain({source:'airsoft-terrain-dem',exaggeration:1});
    setTerrainEnabled(true);
    setInfo('Relieve activado. Su disponibilidad depende de la conexión y los datos de elevación.');
   }
  }catch{
   setTerrainEnabled(false);
   setInfo('El relieve no está disponible. Puedes seguir usando la vista 3D y el GPS.');
  }
 }
 function togglePitch(){
  const current=mapRef.current;
  if(!current||!ready)return;
  current.easeTo({pitch:current.getPitch()<25?48:0,duration:250});
 }
 useEffect(()=>{
  let live=true,map=null,watchdog=null,stutterMonitor=null,styleReady=false;
  let lastCheck=performance.now(),vectorErrors=0;
  const canvas=document.createElement('canvas');
  const probe=canvas.getContext('webgl2',{powerPreference:'low-power'});
  if(!probe){
   controls.current.onUnsupported('El teléfono no ofrece WebGL 2. Se mantiene el mapa 2D.');
   return;
  }
  // Evitar mantener un segundo contexto WebGL en memoria.
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  try{
   map=new maplibregl.Map({
    container:container.current,style:light3DStyle,
    center:me&&validCoordinate(me.lat,me.lng)?[me.lng,me.lat]:[-74.1,4.65],
    zoom:me?15:6,pitch:48,bearing:0,maxPitch:65,antialias:false,
    attributionControl:true,renderWorldCopies:false,fadeDuration:0,
    pixelRatio:Math.min(window.devicePixelRatio||1,1.25),
    maxCanvasSize:[1280,1280],maxTileCacheSize:16
   });
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
   map.on('click',event=>{
    if(controls.current.picking)controls.current.onPick(event.lngLat.lat,event.lngLat.lng);
   });
   map.on('load',()=>{
    if(!live)return;
    styleReady=true;clearTimeout(watchdog);
    setReady(true);setMode('streets');
    try{
     map.addSource('airsoft-satellite',{type:'raster',tiles:[satelliteTiles],
      tileSize:256,maxzoom:19,attribution:'Imagery © Esri, Maxar, Earthstar Geographics'});
     map.addLayer({id:'airsoft-satellite-layer',type:'raster',source:'airsoft-satellite',
      layout:{visibility:'none'}});
    }catch(error){
     if(live)setInfo('Calles 3D disponibles. No se pudo preparar la fotografía satelital.');
    }
    // Las extrusiones comparten la única fuente vectorial del estilo ligero.
    map.addSource('airsoft-v53-route',{
     type:'geojson',data:{type:'FeatureCollection',features:[]}
    });
    map.addLayer({id:'airsoft-v53-route-line',type:'line',source:'airsoft-v53-route',
     paint:{'line-color':'#1673ea','line-width':5,'line-opacity':0.95}});
   });
   // Si tampoco responde la cartografía vectorial, volver a 2D.
    watchdog=setTimeout(()=>{
     if(live&&!styleReady)
      controls.current.onUnsupported('No cargó el 3D ligero. Se recuperó el mapa 2D.');
    },10000);
    // Restauración segura si el navegador se detiene varios segundos.
    stutterMonitor=setInterval(()=>{
     const now=performance.now(),delta=now-lastCheck;lastCheck=now;
     if(!live)return;
     if(document.visibilityState!=='visible'){lastCheck=now;return;}
     if(delta>4500)controls.current.onUnsupported(
      'El 3D saturó la pantalla del teléfono. Se recuperó el mapa 2D.');
    },1000);
    map.on('error',event=>{
     if(!live)return;
     const message=String(event?.error?.message||'');
     if(/tiles\.openfreemap\.org|airsoft-vector|vector tile/i.test(message)){
      vectorErrors++;
      if(vectorErrors>=3)controls.current.onUnsupported(
       'La cartografía 3D no respondió. Se mantiene el GPS en el mapa 2D.');
     }
     if(/server\.arcgisonline\.com|airsoft-satellite|World_Imagery/i.test(message)){
      console.warn('Airsoft Geo 3D: error de satélite:',message);
      if(map.getLayer('airsoft-satellite-layer')&&
         map.getLayoutProperty('airsoft-satellite-layer','visibility')==='visible'){
       map.setLayoutProperty('airsoft-satellite-layer','visibility','none');
       setSatellite(false);setInfo('Sin fotografía satelital: recuperadas las calles 3D.');
      }
     }else if(/elevation-tiles-prod|airsoft-terrain-dem/i.test(message)){
      console.warn('Airsoft Geo 3D: error de relieve:',message);
     }
    });
    map.on('webglcontextlost',()=>{
    if(live)controls.current.onUnsupported('Se perdió la aceleración gráfica. Se restauró el mapa 2D.');
   });
  }catch(error){
   if(live)controls.current.onUnsupported('No se pudo iniciar la vista 3D: '+String(error?.message||'error de gráficos'));
   return;
  }
  const resize=()=>map?.resize();
  const visibility=()=>{if(document.visibilityState==='visible')map?.resize()};
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('fullscreenchange',resize);
  return()=>{
   live=false;clearTimeout(watchdog);clearInterval(stutterMonitor);
   window.removeEventListener('resize',resize);
   document.removeEventListener('visibilitychange',visibility);
   document.removeEventListener('fullscreenchange',resize);
   pinsRef.current.forEach(pin=>pin.remove());pinsRef.current=[];
   arrowPinsRef.current.forEach(pin=>pin.remove());arrowPinsRef.current=[];
   map?.remove();mapRef.current=null;
  };
 },[]);

 useEffect(()=>{
  const map=mapRef.current;if(!map||!ready)return;
  const routed=route?.points?.length>1;
  const direct=!routed&&me&&destination&&validCoordinate(me.lat,me.lng)&&validCoordinate(destination.lat,destination.lng);
  const coordinates=routed?route.points.map(p=>[p[1],p[0]]):
   direct?[[me.lng,me.lat],[destination.lng,destination.lat]]:[];
  const feature=coordinates.length>=2?{type:'Feature',
   geometry:{type:'LineString',coordinates},properties:{}}:null;
  const source=map.getSource('airsoft-v53-route');
  if(source)source.setData({type:'FeatureCollection',features:feature?[feature]:[]});
  if(map.getLayer('airsoft-v53-route-line')){
   map.setPaintProperty('airsoft-v53-route-line','line-color',routed?'#136be1':'#ffac26');
   map.setPaintProperty('airsoft-v53-route-line','line-dasharray',routed?[1,0.1]:[2,2]);
  }
 },[ready,route,me?.lat,me?.lng,destination?.lat,destination?.lng]);

 useEffect(()=>{
  const map=mapRef.current;if(!map||!ready)return;
  const routed=route?.points?.length>1;
  arrowPinsRef.current.forEach(pin=>pin.remove());arrowPinsRef.current=[];
  if(routed)for(const item of routeArrows(route.points,120,16)){
   const el=document.createElement('span');
   el.className='v54-route-arrow';
   el.textContent='➤';
   el.setAttribute('aria-hidden','true');
   const pin=new maplibregl.Marker({element:el,anchor:'center',
    rotation:item.bearing-90,rotationAlignment:'map'})
    .setLngLat([item.lng,item.lat]).addTo(map);
   arrowPinsRef.current.push(pin);
  }

 },[ready,route?.points]);

 useEffect(()=>{
  const map=mapRef.current;if(!map||!ready)return;
  pinsRef.current.forEach(pin=>pin.remove());pinsRef.current=[];
  const add=(coord,label,kind,click,heading=null)=>{
   if(!coord||!validCoordinate(coord.lat,coord.lng))return;
   const element=document.createElement('button');
   element.type='button';element.className='v53-3d-pin '+kind;
   element.title=label;element.setAttribute('aria-label',label);
   element.textContent=kind==='objective'?'◆':kind==='signal'?'!':kind==='mine'?'▲':label.slice(0,1).toUpperCase();
   element.addEventListener('click',e=>{e.stopPropagation();click?.()});
   const rotation=kind==='mine'&&Number.isFinite(heading)?heading:0;
   const marker=new maplibregl.Marker({element,anchor:'center',rotation,
    rotationAlignment:'map'}).setLngLat([coord.lng,coord.lat]).addTo(map);
   pinsRef.current.push(marker);
  };
  if(me&&validCoordinate(me.lat,me.lng))
   add(me,'Mi ubicación','mine',()=>controls.current.onMember?.({kind:'mine'}),me.heading);
  if(showTeammates)teammates.forEach(p=>add({lat:p.latitude,lng:p.longitude},
   p.alias||'Compañero','teammate',()=>controls.current.onMember?.({kind:'teammate',person:p})));
  if(showNearby)nearby.forEach(p=>add({lat:p.latitude,lng:p.longitude},
   p.alias||'Cercano','nearby',()=>controls.current.onMember?.({kind:'nearby',person:p})));
  objectives.forEach(z=>add(z,z.name||'Objetivo','objective',()=>controls.current.onChoose?.(z)));
  if(destination&&validCoordinate(destination.lat,destination.lng))
   add(destination,destination.name||'Destino','destination',()=>{});
  if(showTeammates)signals.filter(s=>s.latitude!==null&&s.longitude!==null)
   .forEach(s=>add({lat:s.latitude,lng:s.longitude},'Aviso del equipo','signal',()=>{}));
 },[ready,me?.lat,me?.lng,me?.heading,teammates,nearby,objectives,signals,
  destination,showTeammates,showNearby]);
 useEffect(()=>{
  const map=mapRef.current;
  if(map&&ready&&me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000&&follow)
   map.easeTo({center:[me.lng,me.lat],duration:350,
    bearing:Number.isFinite(me.heading)?me.heading:map.getBearing()});
 },[ready,me?.lat,me?.lng,me?.observedAt,me?.heading,follow]);
 useEffect(()=>{
  const map=mapRef.current;
  if(map&&ready&&focus&&me&&validCoordinate(me.lat,me.lng))
   map.easeTo({center:[me.lng,me.lat],zoom:15,pitch:48,duration:300});
 },[focus,ready]);
 return <>
  <div className="v53-3d-canvas" ref={container} aria-label="Mapa de calles 3D con fotografía satelital opcional"/>
  <div className="v56-3d-tools" role="group" aria-label="Opciones adicionales de vista 3D">
   <button type="button" onClick={toggleSatellite} disabled={!ready||checkingSatellite}
    aria-pressed={satellite} title="Fotografía satelital opcional: calles 3D permanece operativa si falla el proveedor">
    {checkingSatellite?'Comprobando…':satellite?'Calles 3D':'Ver satélite'}</button>
   <button type="button" onClick={togglePitch} disabled={!ready} title="Alternar entre vista aérea y perspectiva inclinada">Inclinar</button>
   <button type="button" onClick={toggleBuildings} disabled={!ready} aria-pressed={buildingsEnabled}
    title="Desactivar edificios para mejorar el rendimiento">{buildingsEnabled?'Edificios':'Activar edificios'}</button>
   <button type="button" onClick={toggleTerrain} disabled={!ready} aria-pressed={terrainEnabled}
    title="Relieve del terreno opcional, con datos abiertos">{terrainEnabled?'Relieve activo':'Relieve'}</button>
  </div>
  {mode==='loading'&&<div className="v54-3d-wait" aria-live="polite">Cargando calles 3D…</div>}
  {info&&<div className="v53-3d-info" role="status">{info}</div>}
  <div className="v53-3d-hint">V5.9 · 3D ligero: edificios y rutas, sin efectos pesados. Satélite y relieve opcionales.</div>
 </>;
}
