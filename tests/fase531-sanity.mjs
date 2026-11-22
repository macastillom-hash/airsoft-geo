import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeGuidance,routeArrows,distanceMeters} from '../src/navigationGuide.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const start={lat:4.445,lng:-75.24,accuracy:12};
const path=[[4.445,-75.24],[4.446,-75.24],[4.447,-75.24]];
const route={points:path};
assert.ok(distanceMeters(start,{lat:4.446,lng:-75.24})>100);
assert.equal(routeGuidance(null,route),null);
const north=routeGuidance({...start,heading:null},route);
assert.ok(north.bearing<5||north.bearing>355);
assert.ok(north.remainingMeters>210&&north.remainingMeters<230);
assert.ok(north.instruction.includes('norte'),'Unknown heading must not invent left/right turns');
const turning=routeGuidance({...start,heading:270},route);
assert.ok(turning.instruction.includes('derecha'),'North is right relative to west-facing user');
const deviated=routeGuidance({lat:4.445,lng:-75.239,accuracy:8},route);
assert.equal(deviated.offRoute,true);
assert.ok(deviated.instruction.includes('Fuera de ruta'));
const arrived=routeGuidance({lat:4.447,lng:-75.24,accuracy:9},route);
assert.equal(arrived.arrived,true);
const arrows=routeArrows(path,50,15);
assert.ok(arrows.length>=4&&arrows.length<=15);
for(const a of arrows)assert.ok(a.bearing<10||a.bearing>350);
assert.deepEqual(routeArrows([]),[]);
assert.deepEqual(routeArrows([path[0]]),[]);

const map3d=read('src/Map3D.jsx'),map=read('src/UnifiedMap.jsx'),
nav=read('src/MapNavigation.jsx'),app=read('src/App.jsx'),
hud=read('src/RouteGuideHud.jsx'),css=read('src/route-guide.css');
for(const token of ["airsoft-satellite","World_Imagery","light3DStyle",
 "watchdog","onUnsupported","light3DStyle","routeArrows"]){
 assert.ok(map3d.includes(token),'Missing robust 3D map feature: '+token);
}
assert.ok(read('src/light3DStyle.js').includes("'source-layer':'building'"),
 'Buildings extrusions retained in the lightweight style.');
assert.ok(map3d.includes("img.onload=()=>finish(true)")&&map3d.includes("img.onerror=()=>finish(false)"),
 'Satellite must be explicitly checked before replacing reliable vector street maps.');
assert.ok(map.includes('<RouteGuideHud me={me} route={route}'));
assert.ok(nav.includes("routeArrows(route?.points"),'2D must show directional route arrows');
assert.ok(hud.includes('GPS desactualizado')&&hud.includes('headingAvailable'));
assert.ok(css.includes('.v54-route-hud'));
assert.ok(app.includes('heading:Number.isFinite(pos.coords.heading)'));
assert.ok(!map3d.includes('VITE_GOOGLE_MAPS_API_KEY'),'Free map must not require unconfigured Google keys');
console.log('V5.3.1 PASS: free vector 3D fallback, on-map route arrows and honest GPS heading guidance');
