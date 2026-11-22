import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {turnNavigation,maneuverKind,voiceCueKey,voiceCueText} from '../src/turnNavigation.js';
import {routeGuidance} from '../src/navigationGuide.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const route={
 points:[[4.445,-75.24],[4.446,-75.24],[4.446,-75.239],[4.447,-75.239]],
 calculatedAt:1001,maneuvers:[
  {begin_shape_index:0,type:1,instruction:'Sal hacia el norte'},
  {begin_shape_index:1,type:10,instruction:'Gira a la derecha',verbal_pre_transition_instruction:'Gira a la derecha'},
  {begin_shape_index:2,type:15,instruction:'Gira a la izquierda',verbal_pre_transition_instruction:'Gira a la izquierda'},
  {begin_shape_index:3,type:4,instruction:'Llegaste al destino'}
 ]
};
let g=turnNavigation({lat:4.445,lng:-75.24,accuracy:10},route);
assert.equal(g?.maneuver?.type,10);
assert.equal(g.maneuverKind,'right');
assert.ok(g.distanceToTurn>108&&g.distanceToTurn<115);
assert.ok(g.remainingMeters>300);
assert.equal(voiceCueKey(g),null,'Do not speak long before the maneuver');
assert.equal(maneuverKind(15),'left');
assert.equal(maneuverKind(12),'uturn');
assert.equal(maneuverKind(4),'destination');
assert.equal(maneuverKind(26),'roundabout');
assert.equal(maneuverKind(8),'straight');
g=turnNavigation({lat:4.44542,lng:-75.24,accuracy:8},route);
assert.equal(g.maneuverKind,'right');
assert.equal(voiceCueKey(g),'1:approaching');
assert.ok(voiceCueText(g).includes('Gira a la derecha'));
g=turnNavigation({lat:4.44585,lng:-75.24,accuracy:8},route);
assert.equal(voiceCueKey(g),'1:near');
assert.ok(g.distanceToTurn<=20);
g=turnNavigation({lat:4.446,lng:-75.2398,accuracy:8},route);
assert.equal(g.maneuverKind,'left','Maneuvers must advance based on position, not time');
assert.ok(g.progressMeters>120);
g=turnNavigation({lat:4.447,lng:-75.239,accuracy:8},route);
assert.equal(g.arrived,true);
assert.equal(voiceCueKey(g),'arrival');
assert.equal(voiceCueText(g),'Llegaste al destino.');
g=turnNavigation({lat:4.445,lng:-75.238,accuracy:8},route);
assert.equal(g.offRoute,true);
assert.equal(voiceCueKey(g),'offroute');
assert.ok(voiceCueText(g).includes('alejado'));
assert.equal(turnNavigation(null,route),null);
assert.equal(turnNavigation({lat:4.445,lng:-75.24},{}),null);

const service=read('src/routeService.js'),hud=read('src/RouteGuideHud.jsx'),
 map=read('src/UnifiedMap.jsx'),css=read('src/route-guide.css'),
 browser=read('tests/browser-mobile-smoke.mjs');
assert.ok(service.includes('begin_shape_index')&&service.includes('verbal_pre_transition_instruction'));
assert.ok(service.includes('m.begin_shape_index<points.length'),'Invalid geometry indexes must be rejected');
assert.ok(map.includes('onRecalculate={planRoute}'),'Manual rerouting must be connected');
assert.ok(hud.includes('Activar voz')&&hud.includes('onClick={toggleVoice}'));
assert.ok(hud.includes("document.visibilityState==='visible'"),'No background speech on hidden tab');
assert.ok(hud.includes("connection?.state!=='offline'"),'No auto voice instruction during offline');
assert.ok(hud.includes('GPS desactualizado'),'Do not guide on stale GPS');
assert.ok(hud.includes("speechSynthesis")&&hud.includes('onClick={repeat}'));
assert.ok(!hud.includes('getUserMedia'),'Voice guidance must not request microphone permission');
assert.ok(css.includes('.v55-next-turn')&&css.includes('.v55-guide-actions'));
assert.ok(browser.includes('Run Android Chromium UI smoke')===false,'Browser smoke is a runtime test, not a CI manifest');
console.log('V5.4 PASS: next-turn distance, maneuvers, opt-in voice, offline/stale GPS guards, reroute');
