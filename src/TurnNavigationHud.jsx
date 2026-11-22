import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,CornerUpLeft,CornerUpRight,Flag,RotateCcw,Volume2,VolumeX,
 AlertTriangle,Compass,X,RefreshCw} from 'lucide-react';
import {nextTurnGuidance,turnAnnouncementKey} from './turnNavigation.js';
import {distanceLabel} from './geo';
import './turn-navigation.css';

function TurnIcon({direction}){
 if(['left','slight-left','sharp-left'].includes(direction))return <CornerUpLeft size={27}/>;
 if(['right','slight-right','sharp-right'].includes(direction))return <CornerUpRight size={27}/>;
 if(direction==='uturn')return <RotateCcw size={27}/>;
 if(direction==='destination')return <Flag size={27}/>;
 return <ArrowUp size={27}/>;
}

/** Guía local, solo con una ruta explícitamente calculada por el usuario. */
export default function TurnNavigationHud({me,route,active,onStop,onRecalculate,online=true}){
 const [tick,setTick]=useState(Date.now());
 const [voice,setVoice]=useState(false);
 const spoken=useRef(new Set()),routeRef=useRef(route),speechError=useRef(false);
 useEffect(()=>{
  if(routeRef.current!==route){
   routeRef.current=route;spoken.current.clear();
   if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();
  }
 },[route]);
 useEffect(()=>{
  if(!active)return;
  const id=setInterval(()=>{if(document.visibilityState==='visible')setTick(Date.now())},3000);
  return()=>clearInterval(id);
 },[active]);
 useEffect(()=>()=>{if(typeof window!=='undefined'&&'speechSynthesis' in window)
  window.speechSynthesis.cancel()},[]);
 const fresh=me&&Number.isFinite(me.observedAt)&&tick-me.observedAt<=30000;
 const guide=useMemo(()=>fresh?nextTurnGuidance(me,route):null,[fresh,me,route,tick]);
 useEffect(()=>{
  if(!active||!voice||!guide||!fresh||document.visibilityState!=='visible'||!('speechSynthesis' in window))return;
  const key=turnAnnouncementKey(guide);
  if(!key||spoken.current.has(key))return;
  spoken.current.add(key);
  try{
   window.speechSynthesis.cancel();
   const utter=new SpeechSynthesisUtterance((guide.distanceToTurn<=20?'Ahora: ':'En '+
    distanceLabel(guide.distanceToTurn)+': ')+guide.spokenInstruction);
   utter.lang='es-ES';utter.rate=0.95;utter.volume=0.9;
   window.speechSynthesis.speak(utter);
  }catch{speechError.current=true;setVoice(false)}
 },[active,voice,guide?.maneuverId,guide?.distanceToTurn,guide?.offRoute,guide?.qualityPoor,fresh]);
 if(!active||!route?.points?.length)return null;
 const canSpeak=typeof window!=='undefined'&&'speechSynthesis' in window&&
  typeof SpeechSynthesisUtterance!=='undefined';
 function toggleVoice(){
  if(voice){setVoice(false);window.speechSynthesis?.cancel();return}
  if(!canSpeak)return;
  setVoice(true);
  try{
   const message=new SpeechSynthesisUtterance('Guía de voz activada.');
   message.lang='es-ES';message.rate=0.95;
   window.speechSynthesis.speak(message);
  }catch{setVoice(false);speechError.current=true}
 }
 function stop(){if('speechSynthesis' in window)window.speechSynthesis.cancel();onStop()}
 return <section className={'v54-turn-panel '+(guide?.offRoute?'offroute':'')} role="region" aria-label="Navegación GPS en curso">
  <div className="v54-turn-heading">
   <div className="v54-turn-direction">
    {guide&&!guide.offRoute&&<TurnIcon direction={guide.direction}/>}
    {!fresh?<Compass size={27}/>:guide?.offRoute?<AlertTriangle size={27}/>:null}
   </div>
   <div className="v54-turn-instruction">
    <strong>{!fresh?'GPS sin actualización reciente':guide?.instruction||'Esperando señal GPS'}</strong>
    <small>{fresh&&guide?(guide.arrived?'Destino alcanzado':guide.offRoute?
      'Revisa tu ubicación y recalcula manualmente':
      guide.distanceToTurn!==null?'Próximo giro en '+distanceLabel(guide.distanceToTurn):
      'Sigue la ruta señalada'):'No se muestran giros sin GPS reciente'}</small>
   </div>
  </div>
  {fresh&&guide&&<div className="v54-turn-progress">
   <span>{distanceLabel(guide.remainingMeters)} restantes</span>
   {guide.etaSeconds!==null&&<span>{Math.max(1,Math.ceil(guide.etaSeconds/60))} min estimados</span>}
  </div>}
  {fresh&&guide?.qualityPoor&&<p className="v54-turn-caution"><AlertTriangle size={13}/> Precisión GPS limitada: evita tomar decisiones solo con esta indicación.</p>}
  {fresh&&guide?.offRoute&&<button className="v54-turn-recalculate" onClick={onRecalculate} disabled={!online}>
   <RefreshCw size={15}/> Recalcular ruta</button>}
  <div className="v54-turn-actions">
   <button type="button" onClick={toggleVoice} disabled={!canSpeak} title="Activar o desactivar guía hablada">
    {voice?<Volume2 size={15}/>:<VolumeX size={15}/>} {voice?'Voz activa':canSpeak?'Voz apagada':'Sin voz'}
   </button>
   <button type="button" onClick={stop}><X size={15}/> Finalizar guía</button>
  </div>
  <p className="v54-turn-disclaimer">Indicaciones orientativas. Comprueba caminos, obstáculos y accesos permitidos.</p>
 </section>;
}
