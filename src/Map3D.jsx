import React,{useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {validCoordinate} from './navigationUtils';
import './map3d.css';

/**
 * Vista 3D opcional: conserva la misma ubicación/permisos que Leaflet 2D.
 * No crea usuarios, no modifica GPS ni activa compartir ubicación.
 * Los marcadores se renderizan con textContent para impedir HTML de terceros.
 */
export default function Map3D({me,teammates,nearby,objectives,signals,destination,
 route,showTeammates,showNearby,follow,focus,picking,onPick,onChoose,onMember,onUnsupported}){
 const container=useRef(null),mapRef=useRef(null),pinsRef=useRef([]);
 const controls=useRef({picking,onPick,onChoose,onMember,onUnsupported});
 controls.current={picking,onPick,onChoose,onMember,onUnsupported};
 const [ready,setReady]=useState(false);
 const [info,setInfo]=useState('');
 useEffect(()=>{
  let live=true;
  const canvas=document.createElement('canvas');
  if(!canvas.getContext('webgl2')){
   onUnsupported('Tu dispositivo no admite WebGL 2. Se mantiene el mapa 2D.');
   return;
  }
  let map;
  try{
   map=new maplibregl.Map({container:container.current,
    style:'https://tiles.openfreemap.org/styles/liberty',
    center:me&&validCoordinate(me.lat,me.lng)?[me.lng,me.lat]:[-74.1,4.65],
    zoom:me?16:6,pitch:62,bearing:0,maxPitch:80,
    antialias:true,attributionControl:true});
   mapRef.current=map;
   map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'bottom-right');
   map.on('click',event=>{if(controls.current.picking)controls.current.onPick(event.lngLat.lat,event.lngLat.lng)});
   map.on('load',()=>{
    if(!live)return;
    setReady(true);
    try{
     const style=map.getStyle();
     const extrusionPresent=style.layers?.some(layer=>layer.type==='fill-extrusion');
     if(!extrusionPresent&&style.sources?.openmaptiles){
      const symbols=style.layers?.find(layer=>layer.type==='symbol')?.id;
      map.addLayer({id:'airsoft-v53-3d-buildings',type:'fill-extrusion',
       source:'openmaptiles','source-layer':'building',minzoom:14,
       paint:{'fill-extrusion-color':'#9aaab7',
        'fill-extrusion-height':['coalesce',['to-number',['get','render_height']],['to-number',['get','height']],12],
        'fill-extrusion-base':['coalesce',['to-number',['get','render_min_height']],['to-number',['get','min_height']],0],
        'fill-extrusion-opacity':0.73}},symbols);
     }
    }catch(error){setInfo('El terreno se muestra inclinado; algunos edificios no tienen altura cartografiada.')}
    map.addSource('airsoft-v53-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'airsoft-v53-route-line',type:'line',source:'airsoft-v53-route',
     paint:{'line-color':'#1673ea','line-width':5,'line-opacity':0.9}});
   });
   map.on('webglcontextlost',()=>{if(live)onUnsupported('Se perdió la aceleración gráfica 3D. Se restauró el mapa 2D.')});
  }catch(error){if(live)onUnsupported('No se pudo iniciar el mapa 3D: '+String(error?.message||'error de gráficos'));return}
  const resize=()=>map.resize();
  window.addEventListener('resize',resize);
  return()=>{
   live=false;
   window.removeEventListener('resize',resize);
   pinsRef.current.forEach(pin=>pin.remove());pinsRef.current=[];
   map.remove();mapRef.current=null;
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
   map.setPaintProperty('airsoft-v53-route-line','line-color',routed?'#176bc7':'#f09b1a');
   map.setPaintProperty('airsoft-v53-route-line','line-dasharray',routed?[1,0.1]:[2,2]);
  }
 },[ready,route,me?.lat,me?.lng,destination?.lat,destination?.lng]);
 useEffect(()=>{
  if(!ready)return;
  const map=mapRef.current;if(!map)return;
  pinsRef.current.forEach(pin=>pin.remove());pinsRef.current=[];
  const add=(coord,label,kind,click)=>{
   if(!coord||!validCoordinate(coord.lat,coord.lng))return;
   const element=document.createElement('button');
   element.type='button';element.className='v53-3d-pin '+kind;
   element.title=label;element.setAttribute('aria-label',label);
   element.textContent=kind==='objective'?'◆':kind==='signal'?'!':label.slice(0,1).toUpperCase();
   element.addEventListener('click',e=>{e.stopPropagation();click?.()});
   const marker=new maplibregl.Marker({element,anchor:'center'}).setLngLat([coord.lng,coord.lat]).addTo(map);
   pinsRef.current.push(marker);
  };
  if(me&&validCoordinate(me.lat,me.lng))add(me,'Mi ubicación','mine',()=>controls.current.onMember?.({kind:'mine'}));
  if(showTeammates)teammates.forEach(p=>add({lat:p.latitude,lng:p.longitude},p.alias||'Compañero','teammate',
   ()=>controls.current.onMember?.({kind:'teammate',person:p})));
  if(showNearby)nearby.forEach(p=>add({lat:p.latitude,lng:p.longitude},p.alias||'Cercano','nearby',
   ()=>controls.current.onMember?.({kind:'nearby',person:p})));
  objectives.forEach(z=>add(z,z.name||'Objetivo','objective',()=>controls.current.onChoose?.(z)));
  if(destination&&validCoordinate(destination.lat,destination.lng))
   add(destination,destination.name||'Destino','destination',()=>{});
  if(showTeammates)signals.filter(s=>s.latitude!==null&&s.longitude!==null)
   .forEach(s=>add({lat:s.latitude,lng:s.longitude},'Aviso del equipo','signal',()=>{}));
 },[ready,me?.lat,me?.lng,teammates,nearby,objectives,signals,destination,
 showTeammates,showNearby]);
 useEffect(()=>{
  const map=mapRef.current;
  if(map&&ready&&me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000&&follow)
   map.easeTo({center:[me.lng,me.lat],duration:450});
 },[ready,me?.lat,me?.lng,me?.observedAt,follow]);
 useEffect(()=>{
  const map=mapRef.current;
  if(map&&ready&&focus&&me&&validCoordinate(me.lat,me.lng))map.flyTo({center:[me.lng,me.lat],zoom:16,pitch:62,duration:500});
 },[focus,ready]);
 return <>
  <div className="v53-3d-canvas" ref={container} aria-label="Mapa tridimensional interactivo"/>
  {info&&<div className="v53-3d-info">{info}</div>}
  <div className="v53-3d-hint">3D · Inclina con dos dedos o gira con los controles. Los edificios dependen de los datos disponibles.</div>
 </>;
}
