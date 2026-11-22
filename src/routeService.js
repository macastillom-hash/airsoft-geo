import {validCoordinate} from './navigationUtils.js';

/** Valhalla entrega trazas peatonales codificadas con precisión 1e6. */
export function decodePolyline6(encoded){
 if(typeof encoded!=='string'||encoded.length<2||encoded.length>350000)throw Error('Geometría de ruta no válida.');
 const result=[];let i=0,lat=0,lng=0;
 const read=()=>{
  let shift=0,value=0,b;
  do{
   if(i>=encoded.length||shift>35)throw Error('Geometría incompleta.');
   b=encoded.charCodeAt(i++)-63;
   if(b<0||b>63)throw Error('Codificación de ruta incorrecta.');
   value|=(b&31)<<shift;shift+=5;
  }while(b>=32);
  return value&1?~(value>>1):value>>1;
 };
 while(i<encoded.length){
  lat+=read();lng+=read();
  const a=lat/1e6,b=lng/1e6;
  if(!validCoordinate(a,b))throw Error('La ruta incluye coordenadas incorrectas.');
  result.push([a,b]);
  if(result.length>20000)throw Error('Ruta demasiado larga.');
 }
 if(result.length<2)throw Error('Ruta incompleta.');
 return result;
}
export function walkingRouteRequest(from,dest){
 if(!from||!dest||!validCoordinate(from.lat,from.lng)||!validCoordinate(dest.lat,dest.lng))
  throw Error('Se necesita un origen y un destino GPS válidos.');
 return {locations:[{lat:from.lat,lon:from.lng},{lat:dest.lat,lon:dest.lng}],
  costing:'pedestrian',units:'kilometers',language:'es-ES',shape_format:'polyline6'};
}
export async function calculateWalkingRoute(from,dest,signal){
 const request=walkingRouteRequest(from,dest);
 // La consulta se ejecuta únicamente por una pulsación voluntaria del usuario.
 const response=await fetch('https://valhalla1.openstreetmap.de/route?json='+
  encodeURIComponent(JSON.stringify(request)),{method:'GET',signal,cache:'no-store'});
 if(!response.ok)throw Error('El servicio de rutas no respondió ('+response.status+').');
 const data=await response.json();
 const leg=data?.trip?.legs?.[0];
 if(!leg?.shape)throw Error('No se encontró una ruta peatonal para ese destino.');
 const points=decodePolyline6(leg.shape);
 const distanceKm=Number(data?.trip?.summary?.length);
 const seconds=Number(data?.trip?.summary?.time);
 return {points,distanceM:Number.isFinite(distanceKm)&&distanceKm>=0?Math.round(distanceKm*1000):null,
  durationSeconds:Number.isFinite(seconds)&&seconds>=0?Math.round(seconds):null,
  steps:(Array.isArray(leg?.maneuvers)?leg.maneuvers:[]).slice(0,15)
   .map(x=>String(x?.instruction||'').trim().slice(0,260)).filter(Boolean),
  maneuvers:(Array.isArray(leg?.maneuvers)?leg.maneuvers:[]).slice(0,100)
   .filter(m=>Number.isInteger(m?.begin_shape_index)&&m.begin_shape_index>=0&&m.begin_shape_index<points.length)
   .map(m=>({
    type:Number.isInteger(m.type)?m.type:0,
    beginShapeIndex:m.begin_shape_index,
    endShapeIndex:Number.isInteger(m.end_shape_index)?m.end_shape_index:m.begin_shape_index,
    instruction:String(m.instruction||'').trim().slice(0,260),
    verbal:String(m.verbal_pre_transition_instruction||m.instruction||'').trim().slice(0,260)
   })),
  origin:{lat:from.lat,lng:from.lng},
  calculatedAt:Date.now(),provider:'Valhalla / OpenStreetMap'};
}
