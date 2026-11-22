import React,{useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {validCoordinate} from './navigationUtils.js';
import {routeArrows} from './navigationGuide.js';
import './map3d.css';

const satelliteTiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const streetTiles='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const baseStyle={
 version:8,
 sources:{
  'airsoft-satellite':{type:'raster',tiles:[satelliteTiles],tileSize:256,maxzoom:19,
   attribution:'Imagery © Esri, Maxar, Earthstar Geographics'},
  'airsoft-streets':{type:'raster',tiles:[streetTiles],tileSize:256,maxzoom:19,
   attribution:'© OpenStreetMap contributors'}
 },
 layers:[
  {id:'airsoft-satellite-layer',type:'raster',source:'airsoft-satellite'},
  {id:'airsoft-streets-layer',type:'raster',source:'airsoft-streets',layout:{visibility:'none'}}
 ]
};

export default function Map3D({me,teammates,nearby,objectives,signals,destination,
 route,showTeammates,showNearby,follow,focus,picking,onPick,onChoose,onMember,onUnsupported,navigationActive=false}){
 const container=useRef(null),mapRef=useRef(null),pinsRef=useRef([]),arrowPinsRef=useRef([]);
 const controls=useRef({picking,onPick,onChoose,onMember,onUnsupported});
 controls.current={picking,onPick,onChoose,onMember,onUnsupported};
 const [ready,setReady]=useState(false);
 const [mode,setMode]=useState('loading'),[info,setInfo]=useState('');
 useEffect(()=>{
  let live=true,map=null,watchdog1=null,watchdog2=null;
  const canvas=document.createElement('canvas');
  if(!canvas.getContext('webgl2')){
   controls.current.onUnsupported('No hay aceleración gráfica WebGL 2. Se mantiene el mapa 2D.');
   return;
  }
  let satelliteReady=false,streetReady=false;
  try{
   map=new maplibregl.Map({
    container:container.current,style:baseStyle,
    center:me&&validCoordinate(me.lat,me.lng)?[me.lng,me.lat]:[-74.1,4.65],
    zoom:me?16:6,pitch:65,bearing:0,maxPitch:80,antialias:true,attributionControl:true
   });
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
   map.on('click',event=>{
    if(controls.current.picking)controls.current.onPick(event.lngLat.lat,event.lngLat.lng);
   });
   map.on('sourcedata',event=>{
    if(!live||event.sourceDataType!=='content'||!event.tile)return;
    if(event.sourceId==='airsoft-satellite'){
     satelliteReady=true;
     if(map.getLayer('airsoft-satellite-layer')&&
       map.getLayoutProperty('airsoft-satellite-layer','visibility')==='none'&&!streetReady){
      map.setLayoutProperty('airsoft-satellite-layer','visibility','visible');
      map.setLayoutProperty('airsoft-streets-layer','visibility','none');
     }
     setMode('satellite');setInfo('');
    }else if(event.sourceId==='airsoft-streets'){
     streetReady=true;
     setMode('streets');
    }
   });
   map.on('load',()=>{
    if(!live)return;
    setReady(true);
    try{
     // La cartografía de edificios es opcional. Una falla vectorial nunca debe
     // dejar en blanco la fotografía satelital.
     map.addSource('airsoft-building-vector',{type:'vector',url:'https://tiles.openfreemap.org/planet'});
     map.addLayer({
      id:'airsoft-buildings-3d',type:'fill-extrusion',source:'airsoft-building-vector',
      'source-layer':'building',minzoom:14,
      paint:{
       'fill-extrusion-color':'#b0b9c2',
       'fill-extrusion-height':['coalesce',['to-number',['get','render_height']],['to-number',['get','height']],10],
       'fill-extrusion-base':['coalesce',['to-number',['get','render_min_height']],['to-number',['get','min_height']],0],
       'fill-extrusion-opacity':0.70
      }
     });
    }catch(error){
     if(live)setInfo('La imagen satelital funciona aunque no existan modelos de edificios.');
    }
    map.addSource('airsoft-v53-route',{
     type:'geojson',data:{type:'FeatureCollection',features:[]}
    });
    map.addLayer({id:'airsoft-v53-route-line',type:'line',source:'airsoft-v53-route',
     paint:{'line-color':'#1673ea','line-width':5,'line-opacity':0.95}});
   });
   // WebGL puede funcionar incluso cuando el servidor cartográfico está caído.
   // No confundir una pantalla vacía con un celular incompatible.
   watchdog1=setTimeout(()=>{
    if(!live||satelliteReady)return;
    try{
     if(!map.getLayer('airsoft-streets-layer'))throw Error('La base cartográfica no terminó de inicializarse');
     map.setLayoutProperty('airsoft-satellite-layer','visibility','none');
     map.setLayoutProperty('airsoft-streets-layer','visibility','visible');
     setInfo('No cargó la fotografía satelital. Probando el mapa de calles alternativo.');
     setMode('fallback');
     watchdog2=setTimeout(()=>{
      if(live&&!streetReady&&!satelliteReady)
       controls.current.onUnsupported('No se pudieron descargar los mapas 3D. Se recuperó el mapa 2D; revisa tu conexión.');
     },10000);
    }catch{
     if(live)controls.current.onUnsupported('La cartografía 3D no pudo iniciarse. Se restauró el mapa 2D.');
    }
   },9000);
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
   live=false;clearTimeout(watchdog1);clearTimeout(watchdog2);
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
  arrowPinsRef.current.forEach(pin=>pin.remove());arrowPinsRef.current=[];
  if(routed)for(const item of routeArrows(route.points,85,32)){
   const el=document.createElement('span');
   el.className='v54-route-arrow';
   el.textContent='➤';
   el.setAttribute('aria-hidden','true');
   const pin=new maplibregl.Marker({element:el,anchor:'center',
    rotation:item.bearing-90,rotationAlignment:'map'})
    .setLngLat([item.lng,item.lat]).addTo(map);
   arrowPinsRef.current.push(pin);
  }
 },[ready,route,me?.lat,me?.lng,destination?.lat,destination?.lng]);

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
    zoom:navigationActive?Math.max(16.5,map.getZoom()):map.getZoom(),
    pitch:navigationActive?70:map.getPitch(),
    bearing:Number.isFinite(me.heading)&&me.speed>0.7?me.heading:map.getBearing()});
 },[ready,me?.lat,me?.lng,me?.observedAt,me?.heading,me?.speed,follow,navigationActive]);
 useEffect(()=>{
  const map=mapRef.current;
  if(map&&ready&&focus&&me&&validCoordinate(me.lat,me.lng))
   map.flyTo({center:[me.lng,me.lat],zoom:navigationActive?17:16,pitch:navigationActive?70:65,duration:500});
 },[focus,ready]);
 return <>
  <div className="v53-3d-canvas" ref={container} aria-label="Mapa 3D con imagen satelital y orientación"/>
  {mode==='loading'&&<div className="v54-3d-wait" aria-live="polite">Cargando imagen satelital…</div>}
  {info&&<div className="v53-3d-info" role="status">{info}</div>}
  <div className="v53-3d-hint">Perspectiva 3D · Imagen satelital con edificios donde existan datos. Arrastra con dos dedos para inclinar o girar.</div>
 </>;
}
