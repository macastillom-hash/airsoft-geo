import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Compass,AlertTriangle,Navigation,Volume2,VolumeX,RefreshCw,ArrowLeft,ArrowRight,
 ArrowUp,CornerDownLeft,Flag,RotateCcw,Speech} from 'lucide-react';
import {turnNavigation,voiceCueKey,voiceCueText} from './turnNavigation.js';
import {distanceLabel} from './geo';
import './route-guide.css';

const directionIcons={left:ArrowLeft,right:ArrowRight,uturn:RotateCcw,
 destination:Flag,roundabout:CornerDownLeft,straight:ArrowUp};
function speak(text){
 if(typeof window==='undefined'||!('speechSynthesis' in window)||
  typeof window.SpeechSynthesisUtterance!=='function')return false;
 try{
  const engine=window.speechSynthesis;
  engine.cancel();
  const utterance=new window.SpeechSynthesisUtterance(String(text).slice(0,280));
  utterance.lang='es-CO';utterance.rate=0.96;utterance.pitch=1;
  const voices=engine.getVoices?.()||[];
  const voice=voices.find(v=>v.lang?.toLowerCase().startsWith('es'));
  if(voice)utterance.voice=voice;
  engine.speak(utterance);
  return true;
 }catch{return false}
}
/**
 * Guía GPS dentro de Airsoft Geo. La narración es OPT-IN, requiere clic del
 * usuario y nunca comparte micrófono/posición con servicios de voz del sitio.
 */
export default function RouteGuideHud({me,route,connection,onRecalculate,routeStatus}){
 const [voice,setVoice]=useState(false),[notice,setNotice]=useState('');
 const spoken=useRef(new Set()),routeRef=useRef(null),lastCueTime=useRef(0);
 const recent=me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000;
 const guide=recent&&route?.points?.length?turnNavigation(me,route):null;
 const canSpeak=typeof window!=='undefined'&&'speechSynthesis' in window&&
  typeof window.SpeechSynthesisUtterance==='function';
 const Icon=directionIcons[guide?.maneuverKind]||Navigation;
 useEffect(()=>{
  if(routeRef.current!==route){
   routeRef.current=route;spoken.current.clear();lastCueTime.current=0;
  }
 },[route]);
 useEffect(()=>()=>{
  if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();
 },[]);
 const active=voice&&recent&&guide&&document.visibilityState==='visible'&&connection?.state!=='offline';
 const cue=active?voiceCueKey(guide):null;
 useEffect(()=>{
  if(!cue||!route)return;
  const key=String(route.calculatedAt||'route')+':'+cue;
  if(spoken.current.has(key))return;
  const now=Date.now();
  if(now-lastCueTime.current<7000)return;
  if(speak(voiceCueText(guide))){
   spoken.current.add(key);lastCueTime.current=now;
  }
 },[cue,route,guide?.distanceToTurn,voice,recent,connection?.state]);
 const toggleVoice=useCallback(()=>{
  if(voice){
   setVoice(false);window.speechSynthesis?.cancel();setNotice('Indicaciones por voz desactivadas.');
   return;
  }
  if(!canSpeak){setNotice('Este navegador no permite indicaciones por voz.');return}
  setVoice(true);
  // El primer mensaje se emite directamente desde el botón, respetando
  // restricciones de reproducción de audio en Android.
  const said=speak('Guía por voz activada. Verifica el terreno antes de seguir una ruta.');
  setNotice(said?'Voz activada.':'No fue posible reproducir la voz en este navegador.');
  if(!said)setVoice(false);
 },[voice,canSpeak]);
 function repeat(){
  if(!guide||!recent||!canSpeak)return;
  if(!speak(voiceCueText(guide)))setNotice('La voz no está disponible en este dispositivo.');
 }
 if(!route?.points?.length)return null;
 if(!recent)return <div className="v54-route-hud stale" role="status">
  <Compass size={18}/> GPS desactualizado. Se pausaron las indicaciones.
 </div>;
 if(!guide)return null;
 return <div className={'v54-route-hud v55-guided '+(guide.offRoute?'offroute':'')} role="status"
  aria-label="Guía de orientación peatonal">
  <div className="v55-guide-main">
   <div className="v54-route-arrow-wrap">
    <span className="v54-route-arrow-head" style={{
     transform:'rotate('+((guide.headingAvailable?guide.relativeTurn:guide.bearing)-90)+'deg)'
    }}>➤</span>
   </div>
   <div className="v54-route-label">
    <strong>{guide.offRoute?guide.instruction:
     guide.arrived?'Llegaste al destino':guide.maneuver?guide.maneuver.instruction:guide.instruction}</strong>
    <small><Navigation size={12}/> {guide.arrived?'Destino cercano':distanceLabel(guide.remainingMeters)+' restantes'}</small>
    {!guide.headingAvailable&&!guide.arrived&&
     <small>Orientación referida al norte</small>}
    {guide.offRoute&&<small className="v54-deviation"><AlertTriangle size={12}/>
     Desvío de unos {guide.routeDeviationMeters} m</small>}
   </div>
  </div>
  {!guide.offRoute&&!guide.arrived&&guide.maneuver&&
   <div className="v55-next-turn">
    <Icon size={19}/><div>
     <span>Próxima indicación</span>
     <strong>{distanceLabel(guide.distanceToTurn)} · {guide.maneuver.instruction}</strong>
    </div>
   </div>}
  <div className="v55-guide-actions">
   <button type="button" aria-pressed={voice} onClick={toggleVoice}
    className={voice?'on':''} title={voice?'Silenciar indicaciones':'Activar instrucciones por voz'}>
    {voice?<Volume2 size={15}/>:<VolumeX size={15}/>}
    {voice?'Voz activa':'Activar voz'}
   </button>
   {voice&&<button type="button" onClick={repeat} title="Repetir indicación"><Volume2 size={15}/> Repetir</button>}
   {guide.offRoute&&
    <button type="button" disabled={routeStatus==='calculating'||connection?.state==='offline'}
     onClick={onRecalculate} title="Volver a calcular ruta desde mi ubicación">
     <RefreshCw size={15}/> {routeStatus==='calculating'?'Calculando…':'Recalcular'}
    </button>}
  </div>
  {notice&&<small className="v55-voice-notice">{notice}</small>}
  <small className="v55-guide-caution">Orientación aproximada. Prioriza las señales del terreno y el camino permitido.</small>
 </div>;
}
