import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePolyline6,walkingRouteRequest,calculateWalkingRoute} from '../src/routeService.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function encodePoint(lat,lng){
 const vals=[Math.round(lat*1e6),Math.round(lng*1e6)];
 return vals.map(v=>{let n=v<0?~(v<<1):v<<1,result='';
  while(n>=0x20){result+=String.fromCharCode((0x20|(n&0x1f))+63);n>>>=5}
  return result+String.fromCharCode(n+63);
 }).join('');
}
function encodePolyline(points){
 let a=0,b=0,out='';
 for(const [lat,lng] of points){
  const x=Math.round(lat*1e6),y=Math.round(lng*1e6);
  out+=encodePoint((x-a)/1e6,(y-b)/1e6);a=x;b=y;
 }
 return out;
}
const pts=[[4.445,-75.241],[4.4455,-75.2415],[4.446,-75.242]];
const encoded=encodePolyline(pts);
const decoded=decodePolyline6(encoded);
assert.equal(decoded.length,3);
for(let i=0;i<pts.length;i++)for(let j=0;j<2;j++)
 assert.ok(Math.abs(decoded[i][j]-pts[i][j])<0.000002,'Polyline6 must preserve coordinates');
assert.throws(()=>decodePolyline6('!'),/Geometría/);
assert.throws(()=>walkingRouteRequest({lat:100,lng:0},pts[0]),/GPS válidos/);
const from={lat:pts[0][0],lng:pts[0][1]},dest={lat:pts[2][0],lng:pts[2][1]};
const r=walkingRouteRequest(from,dest);
assert.equal(r.costing,'pedestrian');
assert.equal(r.language,'es-ES');
let called=0,calledUrl='';
const priorFetch=globalThis.fetch;
globalThis.fetch=async(url)=>{
 called++;calledUrl=String(url);
 return {ok:true,json:async()=>({trip:{summary:{length:0.31,time:280},
  legs:[{shape:encoded,maneuvers:[{instruction:'Continúa por el camino.'}]}]}})};
};
try{
 assert.equal(called,0,'Must not send GPS before explicit route calculation');
 const result=await calculateWalkingRoute(from,dest,new AbortController().signal);
 assert.equal(called,1);
 assert.equal(result.distanceM,310);
 assert.equal(result.durationSeconds,280);
 assert.equal(result.points.length,3);
 assert.deepEqual(result.steps,['Continúa por el camino.']);
 assert.ok(calledUrl.startsWith('https://valhalla1.openstreetmap.de/route?json='));
 assert.ok(calledUrl.includes('pedestrian'));
 assert.ok(!calledUrl.includes('team_member'));
}finally{globalThis.fetch=priorFetch;}
const nav=read('src/MapNavigation.jsx'),map=read('src/UnifiedMap.jsx'),
 map3d=read('src/Map3D.jsx'),styles=read('src/map-navigation.css'),
 pkg=JSON.parse(read('package.json'));
assert.ok(pkg.dependencies['maplibre-gl'],'3D engine must be installed');
assert.ok(map.includes("lazy(()=>import('./Map3D')"),'MapLibre should load only when requested');
assert.ok(map.includes("mapStyle==='3d'"),'3D switch missing');
assert.ok(map.includes('onCalculateRoute={planRoute}'),'Internal route button disconnected');
assert.ok(map.includes('route={route}'),'Route must be rendered in 2D and 3D');
assert.ok(map.includes('onUnsupported={fallback3D}'),'3D needs 2D fallback');
assert.ok(nav.includes("onClick={onCalculateRoute}"),'Route calculation must stay inside the app');
assert.ok(!nav.includes('window.open('),'Navigation must not launch external app');
assert.ok(nav.includes("Ver mapa 3D"));
assert.ok(map3d.includes("World_Imagery"),"3D must display a reliable satellite basemap");
assert.ok(map3d.includes("https://tiles.openfreemap.org/planet"),"Optional extruded building source retained");
assert.ok(map3d.includes("showTeammates")&&map3d.includes("showNearby"),'3D must preserve group privacy');
assert.ok(map3d.includes("validCoordinate")&&map3d.includes("new maplibregl.Map"));
assert.ok(styles.includes('.v53-route-summary'));
console.log('V5.3 PASS: in-app walking route geometry, explicit GPS request, 3D feature and fallback.');
