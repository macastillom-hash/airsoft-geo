import {routeGuidance,distanceMeters} from './navigationGuide.js';

const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const pos=p=>({lat:p[0],lng:p[1]});
export function routeDistanceToIndex(points,progress,target){
 if(!Array.isArray(points)||points.length<2||!Number.isFinite(progress)||!Number.isInteger(target))return null;
 if(target<0||target>=points.length)return null;
 if(target<=progress)return 0;
 const start=Math.floor(progress),fraction=Math.max(0,Math.min(1,progress-start));
 if(start>=points.length-1)return 0;
 let result=0;
 for(let i=start;i<target;i++){
  if(!valid(points[i])||!valid(points[i+1]))return null;
  result+=distanceMeters(pos(points[i]),pos(points[i+1]))*(i===start?1-fraction:1);
 }
 return Math.max(0,Math.round(result));
}
export function turnKind(type){
 if([9,10,11,12,18,19,20,24,26].includes(type))return 'right';
 if([13,14,15,16,21,22,23,25,27].includes(type))return 'left';
 if([4,5,6].includes(type))return 'arrival';
 return 'straight';
}
export function nextTurn(me,route){
 const guidance=routeGuidance(me,route);
 if(!guidance)return null;
 if(guidance.arrived)return {...guidance,maneuver:null,kind:'arrival',
  nextInstruction:'Llegaste al destino',metersToManeuver:0,maneuverIndex:-1};
 if(guidance.offRoute)return {...guidance,maneuver:null,kind:'offroute',
  nextInstruction:'Fuera de la ruta: comprueba el terreno y recalcula',metersToManeuver:null,maneuverIndex:-1};
 const maneuvers=Array.isArray(route?.maneuvers)?route.maneuvers:[];
 const candidate=maneuvers.map((m,i)=>({m,i}))
  .filter(({m})=>Number.isInteger(m.beginShapeIndex)&&m.beginShapeIndex>guidance.progressIndex+0.002)
  .sort((a,b)=>a.m.beginShapeIndex-b.m.beginShapeIndex)[0];
 if(!candidate)return {...guidance,maneuver:null,kind:'straight',
  nextInstruction:'Continúa hacia el destino',metersToManeuver:null,maneuverIndex:-1};
 const distance=routeDistanceToIndex(route.points,guidance.progressIndex,candidate.m.beginShapeIndex);
 return {...guidance,maneuver:candidate.m,kind:turnKind(candidate.m.type),
  nextInstruction:candidate.m.instruction||'Sigue el camino indicado',
  metersToManeuver:distance,maneuverIndex:candidate.i};
}
export function cueKey(route,turn,level){
 return String(route?.calculatedAt||'route')+'-'+turn.maneuverIndex+'-'+level;
}
export function announceTurn(turn,meters){
 if(!turn?.maneuver)return '';
 const instruction=String(turn.maneuver.verbal||turn.nextInstruction||'').trim();
 if(!instruction)return '';
 if(meters>35)return 'En aproximadamente '+Math.max(10,Math.round(meters/10)*10)+' metros, '+instruction;
 return instruction;
}
