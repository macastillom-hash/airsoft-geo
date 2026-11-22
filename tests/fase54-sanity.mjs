import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeDistanceToIndex,nextTurn,turnKind,announceTurn,cueKey} from '../src/turnGuidance.js';
import {reliableOffRouteFix,canRetryAutoRoute,REROUTE_COOLDOWN_MS} from '../src/reroutePolicy.js';
import {calculateWalkingRoute} from '../src/routeService.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const points=[[4.445,-75.24],[4.446,-75.24],[4.447,-75.24]];
const route={points,calculatedAt:100000,maneuvers:[
 {type:1,beginShapeIndex:0,instruction:'Comienza por el sendero.'},
 {type:10,beginShapeIndex:1,instruction:'Gira a la derecha.',verbal:'Gira a la derecha.'},
 {type:4,beginShapeIndex:2,instruction:'Llegaste.'}
]};
const me={lat:4.445,lng:-75.24,accuracy:8,heading:0,observedAt:Date.now()};
assert.ok(routeDistanceToIndex(points,0,1)>100);
assert.ok(Math.abs(routeDistanceToIndex(points,0.5,1)-55.6)<3);
assert.equal(routeDistanceToIndex(points,0,99),null);
let g=nextTurn(me,route);
assert.equal(g.kind,'right');
assert.equal(g.nextInstruction,'Gira a la derecha.');
assert.equal(g.maneuverIndex,1);
assert.ok(g.metersToManeuver>100&&g.metersToManeuver<115);
assert.equal(turnKind(15),'left');
assert.equal(turnKind(8),'straight');
assert.equal(turnKind(4),'arrival');
assert.ok(announceTurn(g,90).includes('aproximadamente 90 metros'));
assert.equal(announceTurn(g,20),'Gira a la derecha.');
assert.equal(cueKey(route,g,'soon'),'100000-1-soon');
g=nextTurn({lat:4.44615,lng:-75.24,accuracy:8},route);
assert.equal(g.kind,'arrival');
assert.equal(g.maneuverIndex,2);
const deviated=nextTurn({lat:4.445,lng:-75.239,accuracy:9},route);
assert.equal(deviated.kind,'offroute');
assert.equal(deviated.maneuver,null);
const time=Date.now();
assert.equal(reliableOffRouteFix({enabled:false,routeReady:true,online:true,visible:true,me,guide:deviated,now:time}),false);
const badAccuracy={...me,accuracy:68};
const good={...me,observedAt:time,accuracy:10};
assert.equal(reliableOffRouteFix({enabled:true,routeReady:true,online:true,visible:true,
 me:badAccuracy,guide:deviated,now:time}),false);
assert.equal(reliableOffRouteFix({enabled:true,routeReady:true,online:true,visible:true,
 me:{...good,observedAt:time-31000},guide:deviated,now:time}),false);
assert.equal(reliableOffRouteFix({enabled:true,routeReady:true,online:false,visible:true,
 me:good,guide:deviated,now:time}),false);
assert.equal(reliableOffRouteFix({enabled:true,routeReady:true,online:true,visible:false,
 me:good,guide:deviated,now:time}),false);
assert.equal(reliableOffRouteFix({enabled:true,routeReady:true,online:true,visible:true,
 me:good,guide:deviated,now:time}),true);
assert.equal(canRetryAutoRoute(2,0,time),false);
assert.equal(canRetryAutoRoute(3,time-30000,time),false);
assert.equal(canRetryAutoRoute(3,time-REROUTE_COOLDOWN_MS-10,time),true);
assert.equal(canRetryAutoRoute(3,time-30000,time),false);

const encoded=(()=>{
 let pLat=0,pLng=0,res='';
 const enc=n=>{let v=n<0?~(n<<1):n<<1,out='';
  while(v>=0x20){out+=String.fromCharCode((0x20|(v&0x1f))+63);v>>>=5}
  return out+String.fromCharCode(v+63);
 };
 for(const [lat,lng] of points){
  const i=Math.round(lat*1e6),j=Math.round(lng*1e6);
  res+=enc(i-pLat)+enc(j-pLng);pLat=i;pLng=j;
 }
 return res;
})();
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,json:async()=>({
 trip:{summary:{length:.222,time:205},legs:[{shape:encoded,maneuvers:[
  {type:1,begin_shape_index:0,instruction:'Inicia.'},
  {type:10,begin_shape_index:1,end_shape_index:1,instruction:'Derecha.',verbal_pre_transition_instruction:'Gira a la derecha.'},
  {type:4,begin_shape_index:2,instruction:'Llegada.'}
 ]}]}
})});
try{
 const result=await calculateWalkingRoute(me,{lat:4.447,lng:-75.24},new AbortController().signal);
 assert.equal(result.points.length,3);
 assert.equal(result.maneuvers.length,3);
 assert.equal(result.maneuvers[1].type,10);
 assert.equal(result.maneuvers[1].beginShapeIndex,1);
 assert.equal(result.maneuvers[1].verbal,'Gira a la derecha.');
}finally{globalThis.fetch=oldFetch}

const map=read('src/UnifiedMap.jsx'),nav=read('src/MapNavigation.jsx'),
 hud=read('src/RouteGuideHud.jsx'),speech=read('src/turnGuidance.js'),
 css=read('src/route-guide.css'),routeParser=read('src/routeService.js');
for(const value of ['autoReroute','reliableOffRouteFix','canRetryAutoRoute',
 'onToggleAutoReroute={setAutoReroute}','<RouteGuideHud me={me} route={route}/>']){
 assert.ok(map.includes(value),'Map integration missing: '+value);
}
assert.ok(nav.includes('Recalcular automáticamente al desviarme'));
assert.ok(nav.includes('onCalculateRoute')&&!nav.includes('window.open('));
assert.ok(hud.includes('speechSynthesis')&&hud.includes('onClick={toggleVoice}'));
assert.ok(hud.includes("document.addEventListener('visibilitychange',stopWhenHidden)"),'Voice must stop if app becomes hidden');
assert.ok(hud.includes('onClick={repeatInstruction}'),'Voice replay must require a user click');
assert.ok(hud.includes("document.visibilityState!=='visible'"),'Do not speak on background');
assert.ok(hud.includes("(Number(me.accuracy)||0)>35"),'Do not speak on imprecise GPS');
assert.ok(css.includes('.v55-voice-toggle'));
assert.ok(routeParser.includes('begin_shape_index')&&speech.includes('maneuverIndex'));
assert.ok(!map.includes('GOOGLE_MAPS_API_KEY'),'No unapproved billed provider');
console.log('V5.4 PASS: next turn, distances, speech gating, opt-in rerouting, privacy and parser.');
