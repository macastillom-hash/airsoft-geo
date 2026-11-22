import {headingTo,validCoordinate,bearingLabel} from './navigationUtils.js';

const R=Math.PI/180;
export function distanceMeters(a,b){
 const dLat=(b.lat-a.lat)*R,dLon=(b.lng-a.lng)*R;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*R)*Math.cos(b.lat*R)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
const validPoint=p=>Array.isArray(p)&&p.length>=2&&validCoordinate(p[0],p[1]);
const asCoord=p=>({lat:p[0],lng:p[1]});
function nearestOnSegment(me,a,b){
 // Proyección local para distancias peatonales cortas (el límite de la app es 30 km).
 const latRad=me.lat*R;
 const ax=(a.lng-me.lng)*111320*Math.cos(latRad),ay=(a.lat-me.lat)*111320;
 const bx=(b.lng-me.lng)*111320*Math.cos(latRad),by=(b.lat-me.lat)*111320;
 const dx=bx-ax,dy=by-ay;
 const t=Math.max(0,Math.min(1,(dx*dx+dy*dy)?(-ax*dx-ay*dy)/(dx*dx+dy*dy):0));
 const x=ax+dx*t,y=ay+dy*t;
 return {t,offset:Math.hypot(x,y),point:{lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t}};
}
export function routeGuidance(me,route){
 if(!me||!validCoordinate(me.lat,me.lng)||!Array.isArray(route?.points)||route.points.length<2)return null;
 const coords=route.points.filter(validPoint).map(asCoord);
 if(coords.length<2)return null;
 const lengths=coords.slice(1).map((p,i)=>distanceMeters(coords[i],p));
 let nearest={offset:Infinity,index:0,t:0,point:coords[0]};
 for(let i=0;i<lengths.length;i++){
  const p=nearestOnSegment(me,coords[i],coords[i+1]);
  if(p.offset<nearest.offset)nearest={...p,index:i};
 }
 let remaining=lengths[nearest.index]*(1-nearest.t);
 for(let i=nearest.index+1;i<lengths.length;i++)remaining+=lengths[i];
 let goal=nearest.point,lookAhead=25;
 let available=lengths[nearest.index]*(1-nearest.t);
 if(available>=lookAhead&&lengths[nearest.index]>0){
  const t=nearest.t+lookAhead/lengths[nearest.index];
  goal={lat:coords[nearest.index].lat+(coords[nearest.index+1].lat-coords[nearest.index].lat)*t,
        lng:coords[nearest.index].lng+(coords[nearest.index+1].lng-coords[nearest.index].lng)*t};
 }else{
  goal=coords[nearest.index+1];lookAhead-=available;
  for(let i=nearest.index+1;i<lengths.length&&lookAhead>0;i++){
   if(lengths[i]>lookAhead){
    const t=lookAhead/lengths[i];
    goal={lat:coords[i].lat+(coords[i+1].lat-coords[i].lat)*t,
          lng:coords[i].lng+(coords[i+1].lng-coords[i].lng)*t};
    break;
   }
   goal=coords[i+1];lookAhead-=lengths[i];
  }
 }
 const bearing=headingTo(me,goal);
 const heading=Number.isFinite(me.heading)&&me.heading>=0&&me.heading<=360?me.heading:null;
 const turn=heading===null?null:((bearing-heading+540)%360)-180;
 const offRoute=nearest.offset>Math.max(45,2*(Number(me.accuracy)||0));
 const arrived=distanceMeters(me,coords.at(-1))<18;
 const instruction=arrived?'Llegaste al destino':offRoute?'Fuera de ruta: recalcula el recorrido':
  heading===null?'Rumbo '+bearingLabel(bearing)+' (referido al norte)':
  Math.abs(turn)<=30?'Continúa de frente':turn>0?'Orienta tu marcha a la derecha':'Orienta tu marcha a la izquierda';
 return {bearing,relativeTurn:turn,headingAvailable:heading!==null,direction:bearingLabel(bearing),
  remainingMeters:Math.round(remaining),offRoute,arrived,instruction,
  routeDeviationMeters:Math.round(nearest.offset),lookahead:goal};
}
export function routeArrows(points,spacing=85,maxArrows=35){
 if(!Array.isArray(points)||points.length<2)return [];
 const coords=points.filter(validPoint).map(asCoord),result=[];
 if(coords.length<2)return [];
 let distanceTravelled=0,next=spacing;
 for(let i=0;i<coords.length-1;i++){
  const a=coords[i],b=coords[i+1],length=distanceMeters(a,b);
  if(length<0.5)continue;
  while(distanceTravelled+length>=next&&result.length<maxArrows){
   const t=(next-distanceTravelled)/length;
   result.push({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t,bearing:headingTo(a,b)});
   next+=spacing;
  }
  distanceTravelled+=length;
  if(result.length>=maxArrows)break;
 }
 return result;
}
