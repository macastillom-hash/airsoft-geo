import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Radio,Mic,MicOff,Volume2,PhoneOff,AlertTriangle} from 'lucide-react';
import {supabase} from './supabase';
import './radio-diagnostics.css';

// Prueba punto a punto entre DOS dispositivos. Supabase transporta solo señalización;
// el audio es WebRTC cifrado entre pares. Sin servidor TURN, algunas redes fallarán.
// Requiere las políticas RLS del archivo supabase/radio_ptt_v1.sql.
const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const statusText={idle:'Sin conectar',joining:'Solicitando micrófono',waiting:'Esperando a otro participante',connecting:'Conectando audio',connected:'Audio conectado',error:'Error'};
export default function RadioWebRTC({user,teams}){
 const [teamId,setTeamId]=useState('');
 const [status,setStatus]=useState('idle');
 const [error,setError]=useState('');
 const [peerName,setPeerName]=useState('');
 const [transmitting,setTransmitting]=useState(false);
 const [headset,setHeadset]=useState('Sin evento detectado');
 const [networkPath,setNetworkPath]=useState('Sin medir');
 const [networkDelay,setNetworkDelay]=useState('—');
 const teamRef=useRef(''),channelRef=useRef(null),pcRef=useRef(null),streamRef=useRef(null),pressRef=useRef(false),remoteRef=useRef(null);
 const instanceRef=useRef(crypto.randomUUID()),pendingIceRef=useRef([]),peerRef=useRef(null),activeRef=useRef(false),connectingRef=useRef(false);
 const stateRef=useRef('idle');
 const setPhase=s=>{stateRef.current=s;setStatus(s)};
 const setMic=useCallback(on=>{
  const track=streamRef.current?.getAudioTracks()[0];
  if(!track||!activeRef.current||stateRef.current!=='connected'){if(!on){pressRef.current=false;setTransmitting(false)}return}
  track.enabled=on;pressRef.current=on;setTransmitting(on);
 },[]);
 const disconnect=useCallback(()=>{
  setNetworkPath('Sin medir');setNetworkDelay('—');
  activeRef.current=false;setMic(false);pressRef.current=false;
  if(channelRef.current){const channel=channelRef.current;channelRef.current=null;supabase.removeChannel(channel)}
  pcRef.current?.close();pcRef.current=null;peerRef.current=null;pendingIceRef.current=[];
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  if(remoteRef.current)remoteRef.current.srcObject=null;
  connectingRef.current=false;setPeerName('');setTransmitting(false);setPhase('idle');
 },[setMic]);
 useEffect(()=>()=>disconnect(),[disconnect]);
 useEffect(()=>{if(!teamId&&teams.length)setTeamId(teams[0].id)},[teams,teamId]);
 const send=useCallback(async(target,type,data)=>{
  if(!channelRef.current||!target)return;
  await channelRef.current.send({type:'broadcast',event:'rtc',payload:{from:instanceRef.current,to:target,type,data}});
 },[]);
 const createPeer=useCallback(async(peerId)=>{
  if(!activeRef.current||pcRef.current||!streamRef.current||connectingRef.current)return;
  connectingRef.current=true;peerRef.current=peerId;setPhase('connecting');
  const pc=new RTCPeerConnection(RTC_CONFIG);pcRef.current=pc;
  streamRef.current.getAudioTracks().forEach(track=>pc.addTrack(track,streamRef.current));
  pc.ontrack=e=>{if(remoteRef.current){remoteRef.current.srcObject=e.streams[0];remoteRef.current.play().catch(()=>setError('Pulsa «Activar audio» para escuchar en este dispositivo.'))}};
  pc.onicecandidate=e=>{if(e.candidate)send(peerId,'candidate',e.candidate.toJSON()).catch(()=>{})};
  pc.onconnectionstatechange=()=>{
   if(pc!==pcRef.current)return;
   if(pc.connectionState==='connected'){setPhase('connected');setError('')}
   if(['failed','closed'].includes(pc.connectionState)){setMic(false);setPhase('error');setError('Conexión WebRTC interrumpida. Sal de la sala y vuelve a ingresar. Puede requerir TURN.')}
  };
  return pc;
 },[send,setMic]);
 const start=async()=>{
  if(activeRef.current||stateRef.current!=='idle'||!teamId)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){setError('Necesitas HTTPS y un navegador compatible con WebRTC.');return}
  setError('');setPhase('joining');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(!media.getAudioTracks().length)throw Error('No se obtuvo ninguna pista de audio');
   // El permiso queda activo durante la sesión, pero el audio inicia silenciado.
   media.getAudioTracks().forEach(t=>t.enabled=false);
   streamRef.current=media;activeRef.current=true;teamRef.current=teamId;
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error('Debes iniciar sesión');
   await supabase.realtime.setAuth(session.access_token);
   const channel=supabase.channel('airsoft-radio:'+teamId,{config:{private:true,presence:{key:instanceRef.current},broadcast:{ack:true}}});
   channelRef.current=channel;
   const sync=async()=>{
    if(!activeRef.current||pcRef.current)return;
    const peers=Object.values(channel.presenceState()).flat().filter(p=>p.id&&p.id!==instanceRef.current);
    if(peers.length>1){setError('Esta prueba admite máximo dos conexiones.');return}
    if(peers.length===1){
     const p=peers[0];setPeerName(p.alias||'Compañero');
     if(instanceRef.current<p.id&&!connectingRef.current){
      try{const pc=await createPeer(p.id);if(!pc)return;const offer=await pc.createOffer();await pc.setLocalDescription(offer);await send(p.id,'offer',pc.localDescription.toJSON())}
      catch(err){setError('No se pudo iniciar la llamada: '+err.message);setPhase('error')}
     }
    }else{setPeerName('');setPhase('waiting')}
   };
   channel.on('presence',{event:'sync'},sync)
    .on('broadcast',{event:'rtc'},async({payload})=>{
     if(!activeRef.current||payload?.to!==instanceRef.current||!payload.from)return;
     try{
      if(payload.type==='offer'){
       if(pcRef.current&&peerRef.current!==payload.from)return;
       const pc=pcRef.current||await createPeer(payload.from);if(!pc)return;
       await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
       for(const ice of pendingIceRef.current.splice(0))await pc.addIceCandidate(ice);
       const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
       await send(payload.from,'answer',pc.localDescription.toJSON());
      }else if(payload.from===peerRef.current&&payload.type==='answer'&&pcRef.current){
       await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.data));
       for(const ice of pendingIceRef.current.splice(0))await pcRef.current.addIceCandidate(ice);
      }else if(payload.from===peerRef.current&&payload.type==='candidate'&&pcRef.current){
       if(pcRef.current.remoteDescription)await pcRef.current.addIceCandidate(payload.data);
       else pendingIceRef.current.push(payload.data);
      }
     }catch(err){setError('Señalización WebRTC: '+err.message);setPhase('error')}
    })
    .subscribe(async state=>{
     if(state==='SUBSCRIBED'){
      try{await channel.track({id:instanceRef.current,user_id:user.id,alias:user.email?.split('@')[0]||'Compañero'});setPhase('waiting')}
      catch(err){setError('No se pudo entrar al canal privado: '+err.message);disconnect()}
     }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){
      setError('No se pudo conectar al canal privado. Verifica las políticas SQL y Realtime.');
      disconnect();
     }
    });
  }catch(err){disconnect();setError('No fue posible iniciar la radio: '+err.message)}
 };
 const activateAudio=()=>remoteRef.current?.play().then(()=>setError('')).catch(()=>setError('El navegador bloqueó la reproducción de audio.'));
 useEffect(()=>{
  const down=e=>{if((e.code==='Space'||e.code==='KeyV')&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();setMic(true)}};
  const up=e=>{if(e.code==='Space'||e.code==='KeyV'){e.preventDefault();setMic(false)}};
  const blur=()=>setMic(false);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)};
 },[setMic]);
 useEffect(()=>{
  if(!navigator.mediaSession)return;
  const action=()=>setHeadset('Evento multimedia detectado: '+new Date().toLocaleTimeString('es-CO')+' (sin activar PTT)');
  try{navigator.mediaSession.setActionHandler('play',action);navigator.mediaSession.setActionHandler('pause',action)}
  catch{return}
  return()=>{try{navigator.mediaSession.setActionHandler('play',null);navigator.mediaSession.setActionHandler('pause',null)}catch{}}
 },[]);
 useEffect(()=>{
  if(status!=='connected')return;
  let cancelled=false;
  const measure=async()=>{
   const pc=pcRef.current;if(!pc||pc.connectionState!=='connected')return;
   try{
    const stats=await pc.getStats();let pair=null;const byId=new Map();
    stats.forEach(x=>byId.set(x.id,x));
    stats.forEach(x=>{if(x.type==='candidate-pair'&&(x.selected||x.nominated&&x.state==='succeeded'))pair=x});
    if(!pair){const transport=[...byId.values()].find(x=>x.type==='transport'&&x.selectedCandidatePairId);if(transport)pair=byId.get(transport.selectedCandidatePairId)}
    if(!pair||cancelled)return;
    const local=byId.get(pair.localCandidateId),remote=byId.get(pair.remoteCandidateId);
    const relayed=local?.candidateType==='relay'||remote?.candidateType==='relay';
    setNetworkPath(relayed?'Retransmitida por TURN':local&&remote?'Directa (sin TURN)':'En evaluación');
    if(Number.isFinite(pair.currentRoundTripTime))setNetworkDelay(Math.round(pair.currentRoundTripTime*1000)+' ms');
   }catch{if(!cancelled)setNetworkPath('No disponible en este navegador')}
  };
  measure();const timer=setInterval(measure,5000);
  return()=>{cancelled=true;clearInterval(timer)};
 },[status]);
 const busy=status!=='idle';
 return <section className="stack narrow radio-test">
  <header><h2><Radio size={23}/> Radio PTT · prueba real WebRTC</h2>
   <p className="muted">Prueba gratuita entre dos usuarios autenticados del mismo equipo. Mantén presionado para transmitir. La radio web solo funciona de forma fiable con la pantalla activa.</p>
  </header>
  <div className="tile radio-test-panel">
   <label>Equipo autorizado<select disabled={busy} value={teamId} onChange={e=>setTeamId(e.target.value)}>
    <option value="">Selecciona un equipo</option>{teams.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
   </select></label>
   <p><strong>Estado:</strong> {statusText[status]||status}{peerName?' · '+peerName:''}</p>
   <div className="inline-actions">
    <button type="button" className="btn primary" disabled={busy||!teamId} onClick={start}>Entrar a la radio</button>
    <button type="button" className="btn outline" disabled={!busy} onClick={disconnect}><PhoneOff size={16}/> Salir</button>
    <button type="button" className="btn outline" onClick={activateAudio}><Volume2 size={16}/> Activar audio</button>
   </div>
   <audio ref={remoteRef} autoPlay playsInline/>
   <button type="button" className={'radio-ptt-btn '+(transmitting?'on':'')} disabled={status!=='connected'}
    onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture?.(e.pointerId);setMic(true)}}
    onPointerUp={()=>setMic(false)} onPointerCancel={()=>setMic(false)} onLostPointerCapture={()=>setMic(false)}
    onContextMenu={e=>e.preventDefault()}>
    {transmitting?<Mic size={32}/>:<MicOff size={32}/>}
    <strong>{transmitting?'TRANSMITIENDO':'MANTENER PARA HABLAR'}</strong>
   </button>
   <p className="small muted">Ruta de conexión: <strong>{networkPath}</strong> · RTT de red: <strong>{networkDelay}</strong>. Esta medición ayuda a determinar si necesitas TURN, pero no mide la latencia completa de voz.</p>
   <p className="small muted">El micrófono permanece autorizado pero silenciado mientras estás en la sala. Se libera totalmente al salir. No se graban llamadas.</p>
   <p className="small muted">Manos libres 3,5 mm: {headset}. Para usar el botón físico como PTT y mantener audio con pantalla apagada hace falta la aplicación nativa Android.</p>
   {error&&<p role="alert" className="radio-error"><AlertTriangle size={16}/>{error}</p>}
  </div>
  <div className="tile"><h3>Límites de esta prueba</h3>
   <p>Máximo dos participantes por sala. Si tu red bloquea conexiones P2P, fallará sin TURN. No es todavía la radio grupal definitiva ni la versión Android.</p>
  </div>
 </section>;
}
