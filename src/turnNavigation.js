import {validCoordinate} from './navigationUtils.js';
import {distanceMeters,routeGuidance} from './navigationGuide.js';

export function maneuverDirection(type){
 if([5,6].includes(type))return 'destination';
 if([4].includes(type))return 'destination';
 if([9,18,20,23,37].includes(type))return 'slight-right';
 if([10].includes(type))return 'right';
 if([11].includes(type))return 'sharp-right';
 if([16,19,21,24,38].includes(type))return 'slight-left';
 if([15].includes(type))return 'left';
 if([14].includes(type))return 'sharp-left';
 if([12,13].includes(type))return 'uturn';
 if([26,27].includes(type))return 'roundabout';
 return 'straight';
}
const toObject=p=>({lat:p[0],lng:p[1]});
function project(me,a,b){
 const latrad=me.lat*Math.PI/180;
 const ax=(a.lng-me.lng)*111320*Math.cos(latrad),ay=(a.lat-me.lat)*111320;
 const bx=(b.lng-me.lng)*111320*Math.cos(latrad),by=(b.lat-me.lat)*111320;
 const dx=bx-ax,dy=by-ay;
 const t=Math.max(0,Math.min(1,(dx*dx+dy*dy)?(-ax*dx-ay*dy)/(dx*dx+dy*dy):0));
 return {t,offset:Math.hypot(ax+dx*t,ay+dy*t)};
}
export function routeProgress(me,points){
 if(!me||!validCoordinate(me.lat,me.lng)||!Array.isArray(points)||points.length<2||
  points.some(p=>!Array.isArray(p)||!validCoordinate(p[0],p[1])))return null;
 const arr=points.map(toObject);
 const cumulative=[0],segmentLengths=[];
 for(let i=0;i<arr.length-1;i++){
  const len=distanceMeters(arr[i],arr[i+1]);
  segmentLengths.push(len);
  cumulative.push(cumulative[i]+len);
 }
 let nearest={index:0,t:0,offset:Infinity};
 for(let i=0;i<segmentLengths.length;i++){
  const p=project(me,arr[i],arr[i+1]);
  if(p.offset<nearest.offset)nearest={index:i,t:p.t,offset:p.offset};
 }
 const traveled=cumulative[nearest.index]+nearest.t*segmentLengths[nearest.index];
 return {index:nearest.index,fraction:nearest.t,traveledMeters:traveled,
  totalMeters:cumulative.at(-1),remainingMeters:Math.max(0,cumulative.at(-1)-traveled),
  deviationMeters:nearest.offset,cumulative};
}
export function nextTurnGuidance(me,route){
 const progress=routeProgress(me,route?.points);
 if(!progress)return null;
 const fallback=routeGuidance(me,route);
 if(!fallback)return null;
 const arrived=fallback.arrived;
 const offRoute=fallback.offRoute;
 const candidates=(Array.isArray(route.maneuvers)?route.maneuvers:[])
  .filter(m=>Number.isInteger(m.beginIndex)&&m.beginIndex>=0&&m.beginIndex<progress.cumulative.length&&m.type!==0&&
   ![1,2,3].includes(m.type)&&typeof m.instruction==='string'&&m.instruction.trim())
  .map(m=>({...m,targetMeters:progress.cumulative[m.beginIndex]}))
  .sort((a,b)=>a.targetMeters-b.targetMeters||a.id-b.id);
 const next=candidates.find(m=>m.targetMeters>=progress.traveledMeters-7)||null;
 const toTurn=next?Math.max(0,Math.round(next.targetMeters-progress.traveledMeters)):null;
 const remainingMeters=Math.round(progress.remainingMeters);
 const routeTotal=Number.isFinite(route?.distanceM)&&route.distanceM>0?route.distanceM:progress.totalMeters;
 const etaSeconds=Number.isFinite(route?.durationSeconds)&&route.durationSeconds>0?
  Math.max(0,Math.round(route.durationSeconds*remainingMeters/routeTotal)):null;
 return {
  arrived,offRoute,deviationMeters:Math.round(progress.deviationMeters),
  remainingMeters,etaSeconds,
  direction:next?maneuverDirection(next.type):'straight',
  maneuverId:next?.id??null,
  maneuverType:next?.type??null,
  distanceToTurn:toTurn,
  instruction:arrived?'Llegaste a tu destino':
   offRoute?'Te alejaste de la ruta; revisa el recorrido antes de continuar':
   next?.instruction||'Continúa por el recorrido azul hasta el destino',
  spokenInstruction:next?.spokenInstruction||next?.instruction||'',
  headingAvailable:fallback.headingAvailable,
  qualityPoor:Number.isFinite(me.accuracy)&&me.accuracy>70
 };
}
export function turnAnnouncementKey(info){
 if(!info||info.arrived||info.offRoute||info.qualityPoor||info.maneuverId===null||
  info.distanceToTurn===null)return null;
 const distance=info.distanceToTurn;
 const stage=distance<=20?'now':distance<=70?'approach':null;
 return stage?info.maneuverId+':'+stage:null;
}
