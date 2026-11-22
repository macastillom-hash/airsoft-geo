import {headingTo,validCoordinate} from './navigationUtils.js';
import {distanceMeters,routeGuidance} from './navigationGuide.js';
import {nextTurn} from './turnGuidance.js';

export const wrap360=value=>((value%360)+360)%360;
export const signedBearing=(bearing,heading)=>((wrap360(bearing)-wrap360(heading)+540)%360)-180;

// Solo rumbos referidos al norte: un alpha relativo no sirve para orientar flechas.
export function compassFromEvent(event,screenAngle=0){
 if(Number.isFinite(event?.webkitCompassHeading) &&
    (event?.webkitCompassAccuracy===undefined ||
     !Number.isFinite(event.webkitCompassAccuracy) || event.webkitCompassAccuracy<=35))
  return wrap360(event.webkitCompassHeading);
 if(event?.absolute===true && Number.isFinite(event.alpha))
  return wrap360(360-event.alpha+screenAngle);
 return null;
}
export function cameraNavigation(me,destination,route,heading,now=Date.now()){
 const fresh=!!me&&validCoordinate(me.lat,me.lng)&&Number.isFinite(me.observedAt)&&
  Math.abs(now-me.observedAt)<=30000;
 const goal=destination&&validCoordinate(destination.lat,destination.lng)?destination:null;
 if(!goal)return {state:'no-destination'};
 if(!fresh)return {state:'stale-gps'};
 const accuracy=Number.isFinite(me.accuracy)?me.accuracy:Infinity;
 if(accuracy>35)return {state:'inaccurate-gps',accuracy};
 const guide=route?.points?.length>1?routeGuidance(me,route):null;
 if(guide?.offRoute)return {state:'off-route',distanceM:Math.round(distanceMeters(me,goal))};
 const target=guide&&!guide.arrived?guide.lookahead:goal;
 const bearing=headingTo(me,target);
 const relative=Number.isFinite(heading)?signedBearing(bearing,heading):null;
 const turn=guide?nextTurn(me,route):null;
 return {state:'ready',bearing,relative,distanceM:Math.round(distanceMeters(me,goal)),
  instruction:turn?.nextInstruction||'Orientación aproximada hacia el objetivo',
  remainingM:guide?.remainingMeters??null,arrived:!!guide?.arrived,
  headingAvailable:relative!==null,metersToManeuver:turn?.metersToManeuver??null};
}
