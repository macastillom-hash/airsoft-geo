import React,{useEffect,useMemo,useState} from 'react';
import {Clock3,Pause,Play,TimerReset,AlertTriangle,WifiOff} from 'lucide-react';
import {supabase} from './supabase';
import './activity-timer.css';

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
export default function ActivityTimer({activity,isOrganizer,connection,refresh,notify}){
 const [now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false);
 useEffect(()=>{
  setNow(Date.now());
  if(!activity||!['active','finished','cancelled'].includes(activity.status))return;
  const id=setInterval(()=>{if(document.visibilityState==='visible')setNow(Date.now())},1000);
  const visible=()=>setNow(Date.now());
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(id);document.removeEventListener('visibilitychange',visible)};
 },[activity?.id,activity?.status]);
 const time=useMemo(()=>timerSnapshot(activity,now),[activity,now]);
 const enabled=connection?.state!=='offline';
 const active=activity?.status==='active';
 async function action(kind){
  if(!active||busy||!isOrganizer||!enabled)return;
  setBusy(true);
  try{
   const {error}=await supabase.rpc('f52_timer_action',{p_activity:activity.id,p_action:kind});
   if(error)throw error;
   await refresh();
   setNow(Date.now());
   notify(kind==='pause'?'Cronómetro pausado':kind==='resume'?'Cronómetro reanudado':'Cronómetro iniciado.','success');
  }catch(error){notify('El cambio no se guardó: '+(error.message||'Fallo de conexión')+'. Comprueba el estado en línea.','error')}
  finally{setBusy(false)}
 }
 if(!activity)return null;
 return <section className="tile v52-timer">
  <div className="v52-timer-title"><h3><Clock3 size={18}/> Cronómetro de actividad</h3>
   <span className={'v52-timer-tag '+(time.paused?'paused':active?'running':'stopped')}>
    {time.paused?'Pausado':active?'En curso':activity.status==='scheduled'?'Programada':activity.status==='draft'?'Sin iniciar':'Finalizado'}
   </span>
  </div>
  {!time.started?<div className="v52-timer-empty">
   <p className="muted small">{active?'Esta actividad comenzó antes de instalar el cronómetro. Puedes iniciarlo ahora sin reiniciar la actividad.':
    'El cronómetro comenzará automáticamente cuando el organizador inicie la actividad.'}</p>
   {active&&isOrganizer&&<button className="btn primary" disabled={busy||!enabled} onClick={()=>action('initialize')}><TimerReset size={16}/> Iniciar cronómetro ahora</button>}
  </div>:<>
   <div className="v52-timer-clock" role="timer" aria-label="Tiempo restante">
    <strong className={time.expired?'expired':time.remaining<=300?'warning':''}>{timerText(time.remaining)}</strong>
    <span>Restante · duración prevista {activity.duration_minutes} min</span>
   </div>
   <div className="v52-timer-stats">
    <span>Transcurrido: <b>{timerText(time.elapsed)}</b></span>
    {time.paused&&<span><Pause size={13}/> Pausado por el organizador</span>}
    {time.expired&&active&&<span className="v52-timer-warning"><AlertTriangle size={14}/> Tiempo agotado. La actividad continúa hasta que se finalice manualmente.</span>}
   </div>
   {active&&isOrganizer&&<div className="v52-timer-controls">
    <button className={'btn '+(time.paused?'primary':'outline')} disabled={busy||!enabled} onClick={()=>action(time.paused?'resume':'pause')}>
     {time.paused?<Play size={16}/>:<Pause size={16}/>} {time.paused?'Reanudar':'Pausar cronómetro'}
    </button>
    <span className="muted small">El tiempo se conserva al cambiar de pantalla.</span>
   </div>}
  </>}
  {!enabled&&<p className="v52-timer-offline"><WifiOff size={15}/> Sin Internet: el contador es estimado; los cambios se bloquean hasta reconectar.</p>}
  <p className="muted small v52-timer-footnote">Hora inicial y pausas registradas en Supabase; la visualización utiliza el reloj del dispositivo. No cambia resultados ni finaliza automáticamente la actividad.</p>
 </section>;
}