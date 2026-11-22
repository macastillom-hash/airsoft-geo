import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextTurnGuidance,routeProgress,maneuverDirection,turnAnnouncementKey} from '../src/turnNavigation.js';
import {calculateWalkingRoute} from '../src/routeService.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const origin={lat:4.445,lng:-75.24,accuracy:10,heading:0,observedAt:Date.now(),speed:1.2};
const points=[[4.445,-75.24],[4.4455,-75.24],[4.446,-75.24],
 [4.446,-75.2395],[4.446,-75.239]];
const route={points,distanceM:224,durationSeconds:195,
 maneuvers:[
  {id:0,type:1,beginIndex:0,instruction:'Sal hacia el norte.',spokenInstruction:'Sal hacia el norte.'},
  {id:1,type:10,beginIndex:2,instruction:'Gira a la derecha.',spokenInstruction:'Gira a la derecha.'},
  {id:2,type:4,beginIndex:4,instruction:'Llegaste al destino.',spokenInstruction:'Llegaste al destino.'}
 ]};
let state=nextTurnGuidance(origin,route);
assert.equal(state.maneuverId,1,'Skip departure maneuver and show true next turn');
assert.equal(state.direction,'right');
assert.ok(state.distanceToTurn>105&&state.distanceToTurn<125);
assert.ok(state.remainingMeters>205&&state.etaSeconds>150);
assert.equal(turnAnnouncementKey(state),null,'No premature voice alert from far away');
const nearTurn={...origin,lat:4.44565};
state=nextTurnGuidance(nearTurn,route);
assert.equal(state.maneuverId,1);
assert.ok(state.distanceToTurn<70&&state.distanceToTurn>25);
assert.equal(turnAnnouncementKey(state),'1:approach');
const imminent={...origin,lat:4.44589};
state=nextTurnGuidance(imminent,route);
assert.equal(turnAnnouncementKey(state),'1:now');
assert.equal(turnAnnouncementKey({...state,qualityPoor:true}),null);
assert.equal(nextTurnGuidance({...origin,lat:4.46},route).offRoute,true);
assert.equal(turnAnnouncementKey(nextTurnGuidance({...origin,lat:4.46},route)),null);
state=nextTurnGuidance({...origin,lat:4.446,lng:-75.2397},route);
assert.equal(state.maneuverId,2,'Next maneuver should advance after completed turn');
assert.equal(maneuverDirection(15),'left');
assert.equal(maneuverDirection(12),'uturn');
assert.equal(maneuverDirection(4),'destination');
assert.equal(maneuverDirection(8),'straight');
assert.equal(nextTurnGuidance(null,route),null);
assert.equal(routeProgress(origin,[]),null);

function encode(points){
 let a=0,b=0,out='';
 for(const [lat,lng] of points){
  const x=Math.round(lat*1e6),y=Math.round(lng*1e6);
  for(let n of [x-a,y-b]){
   let v=n<0?~(n<<1):n<<1;
   while(v>=32){out+=String.fromCharCode(((v&31)|32)+63);v>>>=5}
   out+=String.fromCharCode(v+63);
  }
  a=x;b=y;
 }
 return out;
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,json:async()=>({trip:{summary:{length:0.224,time:195},
 legs:[{shape:encode(points),maneuvers:[
 {type:1,begin_shape_index:0,end_shape_index:2,instruction:'Sal hacia el norte.'},
 {type:10,begin_shape_index:2,end_shape_index:4,instruction:'Gira a la derecha.',
  verbal_pre_transition_instruction:'Gira a la derecha en la vía peatonal.'},
 {type:4,begin_shape_index:4,end_shape_index:4,instruction:'Llegaste al destino.'}
 ]}]}})});
try{
 const result=await calculateWalkingRoute(origin,{lat:4.446,lng:-75.239});
 assert.equal(result.maneuvers.length,3);
 assert.equal(result.maneuvers[1].beginIndex,2);
 assert.equal(result.maneuvers[1].type,10);
 assert.equal(result.maneuvers[1].spokenInstruction,'Gira a la derecha en la vía peatonal.');
 assert.equal(result.steps.length,3);
}finally{globalThis.fetch=originalFetch}

const ui=read('src/TurnNavigationHud.jsx'),map=read('src/UnifiedMap.jsx'),
 nav=read('src/MapNavigation.jsx'),map3d=read('src/Map3D.jsx');
assert.ok(ui.includes('SpeechSynthesisUtterance'),'Voice must be opt-in and local');
assert.ok(ui.includes('onRecalculate'),'Voice navigation needs manual off-route recalc');
assert.ok(ui.includes('setVoice(false)'),'No automatic voice consent');
assert.ok(ui.includes('GPS sin actualización reciente'));
assert.ok(map.includes('navigationActive?<TurnNavigationHud'),'Guided HUD must replace compass HUD when active');
assert.ok(map.includes('onStartNavigation'),'Start guide in same app');
assert.ok(map.includes('onStopNavigation'),'Stop guide in same app');
assert.ok(nav.includes('Iniciar navegación guiada')&&nav.includes('Detener navegación guiada'));
assert.ok(map3d.includes('navigationActive?70'),'3D guided follow must use immersive pitch');
assert.ok(!nav.includes('window.open('),'Navigation must remain in app');
console.log('V5.4 PASS: real Valhalla maneuvers, upcoming turn, ETA, voice thresholds, controls and 3D camera');
