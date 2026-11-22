/**
 * Servidor registra marcas temporales; la interfaz calcula un contador estimado
 * usando únicamente dichos valores. Se conserva pausa y estado entre sesiones.
 */
export function timerSnapshot(activity,now=Date.now()){
 const started=Date.parse(activity?.actual_started_at||'');
 if(!Number.isFinite(started))return {started:false,elapsed:0,remaining:null,paused:false,expired:false};
 const paused=activity?.status==='active'&&!!activity.timer_paused_at;
 const freezeAt=paused?Date.parse(activity.timer_paused_at):
  activity?.timer_stopped_at?Date.parse(activity.timer_stopped_at):now;
 const elapsed=Math.max(0,Math.floor((Math.max(started,Number.isFinite(freezeAt)?freezeAt:now)-started)/1000)
  -(activity.timer_paused_seconds||0));
 const duration=Math.max(0,Math.round(Number(activity.duration_minutes)||0)*60);
 const remaining=Math.max(0,duration-elapsed);
 return {started:true,elapsed,remaining,paused,expired:elapsed>=duration};
}
export function timerText(seconds){
 const secs=Math.max(0,Math.floor(Number(seconds)||0));
 const h=Math.floor(secs/3600),m=Math.floor(secs%3600/60),s=secs%60;
 return h?String(h)+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):
  String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
