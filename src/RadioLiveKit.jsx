import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {createLocalAudioTrack,Room,RoomEvent} from 'livekit-client';
import {Radio,Mic,MicOff,Volume2,PhoneOff,AlertTriangle,Users} from 'lucide-react';
import {supabase} from './supabase';
import './radio-diagnostics.css';

// Transporte de audio gestionado por LiveKit. La función radio-token comprueba membresía.
// Micrófono PTT: la pista arranca silenciada y solo se activa al mantener pulsado.
const labels={idle:'Fuera del canal',joining:'Conectando...',connected:'Conectado',error:'Error de conexión'};
export default function RadioLiveKit({user,teams,view='full',selectedTeamId,onTeamChange,mapHost,onOpenRadio}){
 const teamId=selectedTeamId||teams[0]?.id||'';
 const [activeTeamId,setActiveTeamId]=useState(null);
 const [phase,setPhase]=useState('idle');
 const [message,setMessage]=useState('');
 const [talking,setTalking]=useState(false);
 const [participants,setParticipants]=useState(0);
 const [speaker,setSpeaker]=useState('');
 // LiveKit detecta si el navegador permite reproducir audio remoto automáticamente.
 const [audioBlocked,setAudioBlocked]=useState(false);
 const roomRef=useRef(null),trackRef=useRef(null),audioRef=useRef(null),lockedRef=useRef(false),pressRef=useRef(false),generationRef=useRef(0),fabGestureRef=useRef(null);
 const phaseRef=useRef('idle');
 const phaseSet=(v)=>{phaseRef.current=v;setPhase(v)};

 const micOff=useCallback(()=>{
  pressRef.current=false;
  try{trackRef.current?.mute()}catch{}
  setTalking(false);
 },[]);
 const exit=useCallback(async()=>{
  generationRef.current++;
  lockedRef.current=false;
  micOff();
  const room=roomRef.current;roomRef.current=null;
  const track=trackRef.current;trackRef.current=null;
  if(track){try{await track.mute()}catch{}try{track.stop()}catch{}}
  if(room){try{await room.disconnect()}catch{}}
  if(audioRef.current)audioRef.current.replaceChildren();
  setParticipants(0);setSpeaker('');setAudioBlocked(false);setActiveTeamId(null);phaseSet('idle');
 },[micOff]);
 useEffect(()=>()=>{void exit()},[exit]);
 // Al salir de una vista suelta PTT, pero conserva la conexión y recepción.
 useEffect(()=>()=>{if(fabGestureRef.current){clearTimeout(fabGestureRef.current.timer);fabGestureRef.current=null}micOff()},[view,micOff]);
 // Nunca seguir transmitiendo en un canal distinto del equipo elegido en el mapa.
 useEffect(()=>{
  if(activeTeamId && teamId && activeTeamId!==teamId && phaseRef.current!=='idle'){
   void exit();
  }
 },[activeTeamId,teamId,exit]);

 const join=async()=>{
  if(lockedRef.current||phaseRef.current!=='idle'||!teamId)return;
  lockedRef.current=true;phaseSet('joining');setMessage('');setAudioBlocked(false);setActiveTeamId(teamId);
  const gen=++generationRef.current;
  let room=null,track=null;
  try{
   const {data,error}=await supabase.functions.invoke('radio-token',{body:{teamId}});
   if(error){
     let reason='No se pudo obtener autorización. Comprueba que la función radio-token esté desplegada.';
     try{const details=await error.context?.json();if(typeof details?.error==='string')reason=details.error}catch{}
     throw new Error(reason);
   }
   if(!data?.url||!data?.token)throw new Error(data?.error||'El servidor no devolvió un token válido.');
   if(gen!==generationRef.current)return;
   room=new Room({adaptiveStream:true,dynacast:true});
   roomRef.current=room;
   const update=()=>setParticipants(room.remoteParticipants.size+1);
   const attach=(t,p)=>{
    if(t.kind!=='audio'||!audioRef.current)return;
    const el=t.attach();
    el.autoplay=true;el.dataset.participant=p.identity;
    audioRef.current.appendChild(el);
   };
   const detach=(t)=>{for(const el of t.detach())el.remove()};
   // track.attach() inicia audio automáticamente cuando el navegador lo permite.
   // Si el navegador bloquea la reproducción, LiveKit emite este evento.
   room.on(RoomEvent.AudioPlaybackStatusChanged,()=>{
    if(roomRef.current===room&&gen===generationRef.current){
     setAudioBlocked(!room.canPlaybackAudio);
    }
   });
   room.on(RoomEvent.ParticipantConnected,update);
   room.on(RoomEvent.ParticipantDisconnected,update);
   room.on(RoomEvent.TrackSubscribed,attach);
   room.on(RoomEvent.TrackUnsubscribed,detach);
   room.on(RoomEvent.ActiveSpeakersChanged,speakers=>setSpeaker(speakers.filter(x=>x.identity!==room.localParticipant.identity).map(x=>x.name||'Compañero').join(', ')));
   room.on(RoomEvent.Disconnected,(reason)=>{
    // room.disconnect() también emite Disconnected: no reemplazar el error original
    // después de un fallo de micrófono, publicación o salida voluntaria.
    if(roomRef.current!==room || gen!==generationRef.current)return;
    micOff();
    const detail=reason===undefined?'sin código disponible':String(reason);
    setMessage('LiveKit desconectó la radio (motivo: '+detail+'). Pulsa Salir para restablecer el canal.');
    phaseSet('error');
   });
   await room.connect(data.url,data.token);
   if(gen!==generationRef.current){await room.disconnect();return}
   // Autoriza captura al ingresar. No transmite: la pista se publica silenciada.
   track=await createLocalAudioTrack({echoCancellation:true,noiseSuppression:true,autoGainControl:true});
   if(gen!==generationRef.current){track.stop();return}
   await track.mute();
   trackRef.current=track;
   await room.localParticipant.publishTrack(track,{source:'microphone'});
   if(gen!==generationRef.current){await room.disconnect();return}
   // Adjuntar audio ya publicado (si llegó antes del evento).
   for(const p of room.remoteParticipants.values()){
    for(const pub of p.audioTrackPublications.values()){
     if(pub.track)attach(pub.track,p);
    }
   }
   update();setAudioBlocked(!room.canPlaybackAudio);phaseSet('connected');
  }catch(e){
   // Limpiar la referencia ANTES de desconectar para no ocultar este error
   // con el evento Disconnected emitido por una salida programática.
   if(room && roomRef.current===room)roomRef.current=null;
   if(gen===generationRef.current){
    micOff();
    const name=String(e?.name||'');
    const detail=name==='NotAllowedError'?'Permiso del micrófono denegado. Habilítalo en el navegador.':
     name==='NotFoundError'?'No se encontró un micrófono disponible.':
     name==='NotReadableError'?'El micrófono está siendo utilizado o bloqueado por otra aplicación.':
     e?.message||'Error desconocido';
    setAudioBlocked(false);setMessage(detail);phaseSet('error');
   }
   if(track){try{track.stop()}catch{}}
   if(room){try{await room.disconnect()}catch{}}
  }finally{lockedRef.current=false}
 };
 const hold=useCallback(async()=>{
  if(pressRef.current||phaseRef.current!=='connected'||!trackRef.current)return;
  pressRef.current=true;
  try{
   await trackRef.current.unmute();
   if(!pressRef.current){await trackRef.current.mute();return}
   setTalking(true);
  }catch{micOff();setMessage('No se pudo activar el micrófono. Revisa los permisos.')}
 },[micOff]);
 const release=()=>micOff();
 const startPlayback=async()=>{
  const room=roomRef.current;
  if(!room||phaseRef.current!=='connected')return;
  try{
   // Llamar directamente desde onClick: requerido por las políticas de autoplay.
   await room.startAudio();
   if(roomRef.current===room){
    setAudioBlocked(!room.canPlaybackAudio);
    if(room.canPlaybackAudio)setMessage('');
   }
  }catch{
   if(roomRef.current===room){
    setAudioBlocked(true);
    setMessage('El navegador sigue bloqueando el sonido. Revisa el volumen, la salida de audio y los permisos del sitio.');
   }
  }
 };
 useEffect(()=>{
  const onDown=e=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(['Space','KeyV'].includes(e.code)&&!e.repeat){e.preventDefault();void hold()}
  };
  const onUp=e=>{if(['Space','KeyV'].includes(e.code)){e.preventDefault();release()}};
  const onBlur=()=>release();
  window.addEventListener('keydown',onDown);window.addEventListener('keyup',onUp);window.addEventListener('blur',onBlur);
  return()=>{window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur)};
 },[hold]);
 const pttButton=(compact)=>(
  <button type="button" disabled={phase!=='connected'}
   className={'radio-ptt-btn '+(talking?'on ':'')+(compact?'radio-ptt-compact':'')}
   aria-label={talking?'Transmitiendo voz':'Mantener pulsado para hablar'}
   onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture?.(e.pointerId);void hold()}}
   onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
   onContextMenu={e=>e.preventDefault()}>
   {talking?<Mic size={compact?21:32}/>:<MicOff size={compact?21:32}/>}
   <strong>{talking?'TRANSMITIENDO':compact?'MANTENER · HABLAR':'MANTENER PARA HABLAR'}</strong>
  </button>
 );
 // Botón de acción rápida sobre el mapa. Toque corto: conectar o abrir radio.
 // Pulsación sostenida (>= 280 ms) cuando está conectado: hablar hasta soltar.
 // Pointer capture evita dejar el micrófono activo por deslizar fuera del botón.
 const mapQuickTap=()=>{
  if(phaseRef.current==='idle' && teamId)void join();
  else if(phaseRef.current==='connected')onOpenRadio?.();
  else if(phaseRef.current==='error')void exit();
 };
 const fabPointerDown=e=>{
  if(e.pointerType==='mouse' && e.button!==0)return;
  if(fabGestureRef.current)return;
  e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
  const gesture={pointerId:e.pointerId,triggered:false,timer:null};
  fabGestureRef.current=gesture;
  gesture.timer=setTimeout(()=>{
   if(fabGestureRef.current!==gesture)return;
   if(phaseRef.current==='connected'){gesture.triggered=true;void hold()}
  },280);
 };
 const fabEnd=(e,cancelled=false)=>{
  const gesture=fabGestureRef.current;
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  clearTimeout(gesture.timer);
  fabGestureRef.current=null;
  if(gesture.triggered)release();
  else if(!cancelled)mapQuickTap();
 };
 const fabLabel=phase==='connected'
  ?(talking?'Transmitiendo. Suelta para terminar.':'Radio conectada. Mantén pulsado para hablar; toque corto para abrir radio.')
  :phase==='idle'?'Conectar radio del equipo seleccionado'
  :phase==='joining'?'Conectando radio'
  :'Restablecer radio después de un error';
 const mapDock=<button type="button" className={'radio-map-fab '+(talking?'is-talking ':phase==='connected'?'is-connected ':phase==='joining'?'is-joining ':phase==='error'?'is-error ':'is-idle')}
  disabled={phase==='joining'||(phase==='idle'&&!teamId)} aria-label={fabLabel} title={fabLabel}
  onPointerDown={fabPointerDown}
  onPointerUp={e=>fabEnd(e)}
  onPointerCancel={e=>fabEnd(e,true)}
  onLostPointerCapture={e=>fabEnd(e,true)}
  onContextMenu={e=>e.preventDefault()}
  onClick={e=>{if(e.detail===0)mapQuickTap()}}>
  {phase==='connected'?(talking?<Mic size={26}/>:<MicOff size={26}/>):<Radio size={27}/>}
  <span className="radio-map-fab-indicator" aria-hidden="true"/>
 </button>;
 return <React.Fragment>
 <div ref={audioRef} className="radio-audio-sink" aria-label="Audio remoto de la radio"/>
 {view==='map'&&mapHost&&createPortal(mapDock,mapHost)}
 {view==='full'&&<section className="radio-test stack narrow">
  <header><h2><Radio size={23}/> Radio PTT · LiveKit</h2>
   <p className="muted">Canal de voz del equipo con botón digital. Requiere LiveKit Free y la función segura radio-token de Supabase. Esta versión web no garantiza funcionar con pantalla bloqueada.</p></header>
  <div className="tile radio-test-panel">
   <label>Equipo<select value={teamId} onChange={e=>onTeamChange?.(e.target.value)} disabled={phase!=='idle'}>
     <option value="">Selecciona equipo</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select></label>
   <p><strong>Estado:</strong> {labels[phase]||phase} <Users size={16}/> {participants} conectado(s)</p>
   {speaker&&<p className="small">Hablando: {speaker}</p>}
   <div className="inline-actions">
    <button className="btn primary" disabled={!teamId||phase!=='idle'} onClick={join}>Entrar a la radio</button>
    <button className="btn outline" disabled={phase==='idle'} onClick={()=>void exit()}><PhoneOff size={16}/> Salir</button>
    {phase==='connected'&&audioBlocked&&<button className="btn outline" onClick={startPlayback}><Volume2 size={16}/> Activar sonido</button>}
   </div>
   {phase==='connected'&&<p className="small muted" role="status">{audioBlocked?'El navegador bloqueó la recepción de audio. Pulsa Activar sonido para escuchar.':'Recepción automática habilitada cuando el navegador permite reproducir audio.'}</p>}

   {pttButton(false)}
   <p className="small muted">También puedes mantener pulsada la barra espaciadora o V. Se captura audio solo al entrar a la sala con tu permiso; el canal permanece silenciado hasta pulsar PTT.</p>
   <p className="small muted">Para botón físico de manos libres 3,5 mm y pantalla bloqueada falta el componente Android nativo.</p>
   {message&&<p role="alert" className="radio-error"><AlertTriangle size={16}/>{message}</p>}
  </div>
 </section>}
 </React.Fragment>;
}
