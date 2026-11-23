import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createLocalAudioTrack,Room,RoomEvent} from 'livekit-client';
import {Radio,Mic,MicOff,Volume2,PhoneOff,AlertTriangle,Users} from 'lucide-react';
import {supabase} from './supabase';
import './radio-diagnostics.css';

// Transporte de audio gestionado por LiveKit. La función radio-token comprueba membresía.
// Micrófono PTT: la pista arranca silenciada y solo se activa al mantener pulsado.
const labels={idle:'Fuera del canal',joining:'Conectando...',connected:'Conectado',error:'Error de conexión'};
export default function RadioLiveKit({user,teams}){
 const [teamId,setTeamId]=useState('');
 const [phase,setPhase]=useState('idle');
 const [message,setMessage]=useState('');
 const [talking,setTalking]=useState(false);
 const [participants,setParticipants]=useState(0);
 const [speaker,setSpeaker]=useState('');
 const roomRef=useRef(null),trackRef=useRef(null),audioRef=useRef(null),lockedRef=useRef(false),pressRef=useRef(false),generationRef=useRef(0);
 const phaseRef=useRef('idle');
 const phaseSet=(v)=>{phaseRef.current=v;setPhase(v)};
 useEffect(()=>{if(!teamId&&teams.length)setTeamId(teams[0].id)},[teams,teamId]);
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
  setParticipants(0);setSpeaker('');phaseSet('idle');
 },[micOff]);
 useEffect(()=>()=>{void exit()},[exit]);

 const join=async()=>{
  if(lockedRef.current||phaseRef.current!=='idle'||!teamId)return;
  lockedRef.current=true;phaseSet('joining');setMessage('');
  const gen=++generationRef.current;
  let room=null,track=null;
  try{
   const {data,error}=await supabase.functions.invoke('radio-token',{body:{teamId}});
   if(error)throw new Error('No se pudo obtener autorización. Comprueba que la función radio-token esté desplegada.');
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
   room.on(RoomEvent.ParticipantConnected,update);
   room.on(RoomEvent.ParticipantDisconnected,update);
   room.on(RoomEvent.TrackSubscribed,attach);
   room.on(RoomEvent.TrackUnsubscribed,detach);
   room.on(RoomEvent.ActiveSpeakersChanged,speakers=>setSpeaker(speakers.filter(x=>x.identity!==user.id).map(x=>x.name||'Compañero').join(', ')));
   room.on(RoomEvent.Disconnected,()=>{micOff();setMessage('Se perdió la conexión de radio. Sal y vuelve a entrar.');phaseSet('error')});
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
   update();phaseSet('connected');
  }catch(e){
   if(gen===generationRef.current){setMessage(e?.message||'Error desconocido');phaseSet('error')}
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
  try{await roomRef.current?.startAudio();setMessage('')}
  catch{setMessage('El navegador bloquea el audio; activa el sonido del dispositivo.')}
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
 return <section className="radio-test stack narrow">
  <header><h2><Radio size={23}/> Radio PTT · LiveKit</h2>
   <p className="muted">Canal de voz del equipo con botón digital. Requiere LiveKit Free y la función segura radio-token de Supabase. Esta versión web no garantiza funcionar con pantalla bloqueada.</p></header>
  <div className="tile radio-test-panel">
   <label>Equipo<select value={teamId} onChange={e=>setTeamId(e.target.value)} disabled={phase!=='idle'}>
     <option value="">Selecciona equipo</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select></label>
   <p><strong>Estado:</strong> {labels[phase]||phase} <Users size={16}/> {participants} conectado(s)</p>
   {speaker&&<p className="small">Hablando: {speaker}</p>}
   <div className="inline-actions">
    <button className="btn primary" disabled={!teamId||phase!=='idle'} onClick={join}>Entrar a la radio</button>
    <button className="btn outline" disabled={phase==='idle'} onClick={()=>void exit()}><PhoneOff size={16}/> Salir</button>
    <button className="btn outline" disabled={phase!=='connected'} onClick={startPlayback}><Volume2 size={16}/> Activar sonido</button>
   </div>
   <div ref={audioRef} aria-label="Audio remoto del equipo"/>
   <button type="button" disabled={phase!=='connected'} className={'radio-ptt-btn '+(talking?'on':'')}
    onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture?.(e.pointerId);void hold()}}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onContextMenu={e=>e.preventDefault()}>
    {talking?<Mic size={32}/>:<MicOff size={32}/>}
    <strong>{talking?'TRANSMITIENDO':'MANTENER PARA HABLAR'}</strong>
   </button>
   <p className="small muted">También puedes mantener pulsada la barra espaciadora o V. Se captura audio solo al entrar a la sala con tu permiso; el canal permanece silenciado hasta pulsar PTT.</p>
   <p className="small muted">Para botón físico de manos libres 3,5 mm y pantalla bloqueada falta el componente Android nativo.</p>
   {message&&<p role="alert" className="radio-error"><AlertTriangle size={16}/>{message}</p>}
  </div>
 </section>;
}
