/** Consent- and accuracy-gated rerouting. No network operations here. */
export const REROUTE_COOLDOWN_MS=120000;
export const REROUTE_MIN_FIXES=3;
export function reliableOffRouteFix({enabled,routeReady,online,visible,me,guide,now=Date.now()}){
 if(!enabled||!routeReady||!online||!visible||!me||!guide||guide.arrived||!guide.offRoute)return false;
 if(!Number.isFinite(me.observedAt)||now-me.observedAt>15000||me.observedAt>now+5000)return false;
 const accuracy=Number(me.accuracy);
 if(!Number.isFinite(accuracy)||accuracy<0||accuracy>30)return false;
 return Number.isFinite(guide.routeDeviationMeters)&&
  guide.routeDeviationMeters>=Math.max(75,3*accuracy);
}
export function canRetryAutoRoute(count,lastRequest,now=Date.now()){
 return count>=REROUTE_MIN_FIXES&&now-lastRequest>=REROUTE_COOLDOWN_MS;
}
