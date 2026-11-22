import {distanceMeters,routeGuidance} from './navigationGuide.js';

/** Orden de giros: valores oficiales Valhalla, independientes del texto de la vía. */
export function maneuverKind(type){
 if([2,9,10,11,18,20,23].includes(type))return 'right';
 if([3,14,15,16,19,21,24].includes(type))return 'left';
 if([12,13].includes(type))return 'uturn';
 if([4,5,6].includes(type))return 'destination';
 if([26,27].includes(type))return 'roundabout';
 return 'straight';
}
export function turnNavigation(me,route){
 const gps=routeGuidance(me,route);
 if(!gps)return null;
 const points=route?.points;
 const lengths=[],totals=[0];
 for(let i=1;i<points.length;i++){
  const prev={lat:points[i-1][0],lng:points[i-1][1]};
  const current={lat:points[i][0],lng:points[i][1]};
  const d=distanceMeters(prev,current);
  lengths.push(d);totals.push(totals.at(-1)+d);
 }
 const turns=(route.maneuvers||[]).filter(m=>{
  const index=Number(m.begin_shape_index);
  return Number.isInteger(index)&&index>0&&index<points.length&&typeof m.instruction==='string'&&m.instruction.trim().length>0;
 }).sort((a,b)=>a.begin_shape_index-b.begin_shape_index);
 const next=turns.find(m=>totals[m.begin_shape_index]-gps.progressMeters>=-12);
 const distanceToTurn=next?Math.max(0,Math.round(totals[next.begin_shape_index]-gps.progressMeters)):null;
 const kind=next?maneuverKind(next.type):'straight';
 const instruction=gps.arrived?'Llegaste al destino':
  gps.offRoute?'Estás fuera de la ruta. Puedes recalcular desde tu ubicación.':
  next?next.instruction:'Continúa hasta el destino';
 const distanceRemaining=gps.remainingMeters;
 return {...gps,maneuver:next||null,maneuverKind:kind,
  distanceToTurn,instruction, distanceRemaining,
  // Lenguaje enviado por Valhalla (usualmente español, según su respuesta).
  speechInstruction:next?.verbal_pre_transition_instruction||next?.instruction||instruction,
  totalMeters:Math.round(totals.at(-1))};
}
/** Anuncia como máximo una aproximación por tramo y distancia; no inventa pasos. */
export function voiceCueKey(guide){
 if(!guide||guide.arrived)return guide?.arrived?'arrival':null;
 if(guide.offRoute)return 'offroute';
 const m=guide.maneuver;if(!m)return null;
 const threshold=guide.distanceToTurn<=20?'near':guide.distanceToTurn<=85?'approaching':null;
 return threshold?m.begin_shape_index+':'+threshold:null;
}
export function voiceCueText(guide){
 if(guide.arrived)return 'Llegaste al destino.';
 if(guide.offRoute)return 'Te has alejado de la ruta. Detente en un lugar seguro y revisa el recorrido.';
 const instruction=guide.speechInstruction||guide.instruction;
 if(guide.distanceToTurn>20)return 'En aproximadamente '+guide.distanceToTurn+' metros. '+instruction;
 return instruction;
}
