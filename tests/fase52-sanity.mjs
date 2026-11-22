import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timerSnapshot,timerText} from '../src/activityTimerUtils.js';
import {validCoordinate,headingTo,bearingLabel,externalWalkingDirections} from '../src/navigationUtils.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const started='2026-11-21T20:00:00.000Z';
const timer={status:'active',actual_started_at:started,timer_paused_at:null,timer_paused_seconds:0,
 duration_minutes:10,timer_stopped_at:null};
const base=Date.parse(started);
let state=timerSnapshot(timer,base+3*60*1000);
assert.deepEqual([state.elapsed,state.remaining,state.paused],[180,420,false]);
state=timerSnapshot({...timer,timer_paused_at:new Date(base+120000).toISOString()},base+500000);
assert.deepEqual([state.elapsed,state.remaining,state.paused],[120,480,true],'Paused time must freeze');
state=timerSnapshot({...timer,timer_paused_seconds:180},base+7*60000);
assert.deepEqual([state.elapsed,state.remaining],[240,360],'Accumulated paused time must be subtracted');
state=timerSnapshot({...timer,timer_paused_seconds:180,timer_stopped_at:new Date(base+9*60000).toISOString(),status:'finished'},base+6000000);
assert.deepEqual([state.elapsed,state.remaining],[360,240],'Completed time must stay frozen');
state=timerSnapshot(timer,base+11*60000);
assert.equal(state.expired,true);
assert.equal(state.remaining,0);
assert.equal(timerSnapshot({status:'active'},base).started,false,'Legacy activity should not invent start time');
assert.equal(timerText(59),'00:59');
assert.equal(timerText(3661),'1:01:01');
assert.equal(validCoordinate(4.44,-75.24),true);
assert.equal(validCoordinate(999,-75.24),false);
assert.equal(headingTo({lat:0,lng:0},{lat:1,lng:0}),0);
assert.ok(Math.abs(headingTo({lat:0,lng:0},{lat:0,lng:1})-90)<0.00001);
assert.equal(bearingLabel(90),'E');
assert.equal(bearingLabel(225),'SO');
const link=externalWalkingDirections({lat:4.45,lng:-75.25});
assert.ok(link.startsWith('https://www.google.com/maps/dir/?api=1&'));
assert.ok(link.includes('travelmode=walking'));
assert.ok(link.includes('destination='));
assert.ok(!link.includes('origin='),'No origin or teammates should be sent to external Maps');
assert.equal(externalWalkingDirections({lat:100,lng:0}),'');

const app=read('src/App.jsx'),map=read('src/UnifiedMap.jsx'),
 nav=read('src/MapNavigation.jsx'),activities=read('src/Activities.jsx'),
 timerUI=read('src/ActivityTimer.jsx'),hook=read('src/useConnectivity.js'),
 sql=read('supabase/migracion_fase52.sql'),style=read('src/unified-map.css');
for(const x of ['v52-map-workspace','v52-map-content','v52-connection-banner','connection={connection}',
 'pendingGPSRevoke','Compartir GPS','onToggleDiscoverable']){
 assert.ok(app.includes(x),'Missing app integration: '+x);
}
for(const x of ["mapStyle==='satellite'","NavigationControls","NavigationLayers","v52-map-topcontrols",
 'v5-map-rail','v5-map-rail-bottom','v52-map-offline','requestFullscreen','connection?.state===']){
 assert.ok(map.includes(x),'Missing map control: '+x);
}
for(const x of ['useAuthorizedObjectives','activity_zones','onPick','externalWalkingDirections','window.open']){
 assert.ok(nav.includes(x),'Missing navigation feature '+x);
}
for(const x of ['ActivityTimer activity={activity}','connection?.state','loadDetails']){
 assert.ok(activities.includes(x),'Missing activity timer integration '+x);
}
for(const x of ['f52_timer_action','timerSnapshot','timer_paused_at']){
 assert.ok(timerUI.includes(x),'Missing timer logic '+x);
}
for(const x of ["window.addEventListener('offline'","document.addEventListener('visibilitychange'","cache:'no-store'"]){
 assert.ok(hook.includes(x),'Missing connectivity recovery '+x);
}
for(const x of ['f52_timer_action','actual_started_at','timer_paused_at','timer_paused_seconds',
 'f52_activity_timer_transition','REVOKE UPDATE ON public.activities FROM authenticated']){
 assert.ok(sql.includes(x),'Missing server timer security '+x);
}
assert.ok(!sql.includes('DROP TABLE public.'),'Migration cannot remove old tables');
assert.ok(style.includes('height:calc(100dvh - 191px)'),'Map should fill screen');
console.log('Fase 5.2: timer, bearings, navigation URLs, offline guards and layout checks passed');
