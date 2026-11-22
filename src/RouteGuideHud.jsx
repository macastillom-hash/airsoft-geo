import React,{useEffect,useRef,useState} from 'react';
import {Compass,AlertTriangle,Navigation,Volume2,VolumeX,ArrowUp,ArrowUpLeft,ArrowUpRight,Flag} from 'lucide-react';
import {nextTurn,announceTurn,cueKey} from './turnGuidance.js';
import {distanceLabel} from './geo';
import './route-guide.css';

const directionIcon={left:ArrowUpLeft,right:ArrowUpRight,straight:ArrowUp,arrival:Flag,offroute:AlertTriangle};
const speechSupported=()=>typeof window!=='undefined'&&
 'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
export default function RouteGuideHud({me,route}){
 const [voice,setVoice]=useState(false),announced=useRef(new Set()),lastVoice=useRef(0);
 const fresh=!!me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000;
 const guide=fresh&&route?.points?.length?nextTurn(me,route):null;
 const Icon=directionIcon[guide?.kind]||Compass;
 useEffect(()=>{announced.current.clear()},[route?.calculatedAt]);
 useEffect(()=>{
  if(!voice||!speechSupported()||document.visibilityState!=='visible'||!fresh||
     !guide?.maneuver||guide.offRoute||guide.arrived)return;
  if((Number(me.accuracy)||0)>35)return;
  const distance=guide.metersToManeuver;
  if(!Number.isFinite(distance)||distance>95)return;
  const level=distance<=28?'now':'soon';
  const key=cueKey(route,guide,level);
  if(announced.current.has(key)||Date.now()-lastVoice.current<3500)return;
  const spoken=announceTurn(guide,distance);
  if(!spoken)return;
  try{
   const utterance=new SpeechSynthesisUtterance(spoken);
   utterance.lang='es-CO';utterance.rate=0.95;utterance.volume=0.95;
   window.speechSynthesis.cancel();
   window.speechSynthesis.speak(utterance);
   announced.current.add(key);lastVoice.current=Date.now();
  }catch{setVoice(false)}
 },[voice,me?.observedAt,me?.accuracy,guide?.maneuverIndex,guide?.metersToManeuver,guide?.offRoute,
  route?.calculatedAt,fresh]);
 useEffect(()=>()=>{if(speechSupported())window.speechSynthesis.cancel()},[]);
 function toggleVoice(){
  if(!speechSupported())return;
  if(voice){setVoice(false);window.speechSynthesis.cancel();return}
  try{
   // Primer sonido bajo la acción explícita del usuario; algunos móviles
   // bloquean voces hasta que se toca un control.
   const utterance=new SpeechSynthesisUtterance('Guía de voz activada.');
   utterance.lang='es-CO';utterance.rate=0.95;
   window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
   lastVoice.current=Date.now();setVoice(true);
  }catch{setVoice(false)}
 }
 if(!route?.points?.length)return null;
 if(!fresh)return <div className="v54-route-hud stale" role="status">
  <Compass size={18}/> GPS desactualizado. La orientación está en pausa.
 </div>;
 if(!guide)return null;
 const IconNext=directionIcon[guide.kind]||Navigation;
 const nextDistance=Number.isFinite(guide.metersToManeuver)?
  distanceLabel(guide.metersToManeuver):null;
 return <div className={'v54-route-hud v55-route-hud '+(guide.offRoute?'offroute':'')}
  aria-label="Guía de orientación peatonal">
  <div className="v54-route-arrow-wrap">
   <span className="v54-route-arrow-head" style={{
    transform:'rotate('+((guide.headingAvailable?guide.relativeTurn:guide.bearing)-90)+'deg)'
   }}>➤</span>
  </div>
  <div className="v54-route-label">
   <strong>{guide.instruction}</strong>
   <small><Navigation size={12}/>{guide.arrived?'Destino cercano':distanceLabel(guide.remainingMeters)+' restantes'}</small>
   {!guide.headingAvailable&&!guide.arrived&&<small>Rumbo respecto al norte</small>}
   {guide.offRoute&&<small className="v54-deviation"><AlertTriangle size={12}/> Desvío aprox. {guide.routeDeviationMeters} m. Recalcula.</small>}
   {!guide.offRoute&&!guide.arrived&&<div className="v55-next-turn">
    <IconNext size={17}/>
    <span><b>{nextDistance?'En '+nextDistance+': ':'Próximo paso: '}</b>{guide.nextInstruction}</span>
   </div>}
   <button type="button" className="v55-voice-toggle" onClick={toggleVoice}
    disabled={!speechSupported()} aria-pressed={voice}
    title={voice?'Desactivar voz':'Activar indicaciones de voz'}>
    {voice?<Volume2 size={15}/>:<VolumeX size={15}/>}
    {voice?'Voz activada':'Escuchar indicaciones'}
   </button>
  </div>
 </div>;
}
