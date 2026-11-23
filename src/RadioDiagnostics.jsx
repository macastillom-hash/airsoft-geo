import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Headphones,Radio,AlertTriangle} from 'lucide-react';
import './radio-diagnostics.css';

// Fase de diagnóstico: captura LOCAL solamente. No envía, graba ni almacena audio.
export default function RadioDiagnostics(){
 const [state,setState]=useState('idle');
 const [message,setMessage]=useState('');
 const [devices,setDevices]=useState([]);
 const [selected,setSelected]=useState('');
 const [headsetEvent,setHeadsetEvent]=useState('Sin evento detectado');
 const stream=useRef(null),pressed=useRef(false),busy=useRef(false);
 const deactivate=useCallback(()=>{
  pressed.current=false;
  stream.current?.getTracks().forEach(t=>t.stop());
  stream.current=null;
  setState('idle');
 },[]);
 const listInputs=useCallback(async()=>{
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{const all=await navigator.mediaDevices.enumerateDevices();setDevices(all.filter(d=>d.kind==='audioinput'))}
  catch{setDevices([])}
 },[]);
 useEffect(()=>{
  const change=()=>listInputs();
  navigator.mediaDevices?.addEventListener?.('devicechange',change);
  listInputs();
  return()=>{navigator.mediaDevices?.removeEventListener?.('devicechange',change);deactivate()};
 },[listInputs,deactivate]);
 const activate=useCallback(async()=>{
  if(pressed.current||busy.current)return;
  if(!navigator.mediaDevices?.getUserMedia){setMessage('Micrófono no disponible. Usa HTTPS y un navegador compatible.');return}
  pressed.current=true;busy.current=true;setMessage('');
  try{
   const audio=selected?{deviceId:{ideal:selected},echoCancellation:true,noiseSuppression:true,autoGainControl:true}:{echoCancellation:true,noiseSuppression:true,autoGainControl:true};
   const media=await navigator.mediaDevices.getUserMedia({audio,video:false});
   if(!pressed.current){media.getTracks().forEach(t=>t.stop());return}
   stream.current=media;
   setState('active');
   await listInputs();
   media.getAudioTracks()[0]?.addEventListener('ended',()=>{deactivate();setMessage('El micrófono fue desconectado o revocado.')},{once:true});
  }catch(err){pressed.current=false;setState('idle');setMessage(err?.name==='NotAllowedError'?'Permiso de micrófono denegado.':'No se pudo activar el micrófono: '+(err?.message||'error'))}
  finally{busy.current=false}
 },[selected,listInputs,deactivate]);
 const release=useCallback(()=>deactivate(),[deactivate]);
 // KEYCODE_HEADSETHOOK puede llegar como play/pause; el navegador puede consumirlo.
 // Estos eventos no sustituyen una app Android nativa ni garantizan uso con pantalla apagada.
 useEffect(()=>{
  const down=e=>{
   if((e.code==='Space'||e.code==='KeyV')&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();activate()}
  };
  const up=e=>{if(e.code==='Space'||e.code==='KeyV'){e.preventDefault();release()}};
  const blur=()=>release();
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}
 },[activate,release]);
 useEffect(()=>{
  if(!('mediaSession' in navigator))return;
  const mark=()=>setHeadsetEvent('Botón multimedia detectado: '+new Date().toLocaleTimeString('es-CO'));
  try{
   navigator.mediaSession.setActionHandler('play',mark);
   navigator.mediaSession.setActionHandler('pause',mark);
  }catch{return}
  return()=>{try{navigator.mediaSession.setActionHandler('play',null);navigator.mediaSession.setActionHandler('pause',null)}catch{}}
 },[]);
 return <section className="radio-test stack narrow">
  <header><h2><Radio size={23}/> Radio PTT · diagnóstico local</h2>
   <p className="muted">Primera fase segura: comprueba el permiso de micrófono, la pulsación del botón y el reconocimiento de manos libres de 3,5 mm. <strong>No transmite audio a otros teléfonos.</strong></p>
  </header>
  <div className="tile radio-test-panel">
   <label>Entrada de audio
    <select value={selected} onChange={e=>setSelected(e.target.value)} disabled={state==='active'}>
     <option value="">Micrófono predeterminado</option>
     {devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Micrófono detectado'}</option>)}
    </select>
   </label>
   <p className="small muted"><Headphones size={16}/> Conecta tus audífonos de 3,5 mm y comprueba que aparezcan como entrada de audio. Algunos celulares no distinguen los audífonos del micrófono interno.</p>
   <button type="button" className={'radio-ptt-btn '+(state==='active'?'on':'')} aria-label="Mantener presionado para probar micrófono"
    onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture?.(e.pointerId);activate()}}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onContextMenu={e=>e.preventDefault()}>
    {state==='active'?<Mic size={32}/>:<MicOff size={32}/>}
    <strong>{state==='active'?'MICRÓFONO ACTIVO':'MANTÉN PARA PROBAR'}</strong>
   </button>
   <p className="small">Estado: <strong>{state==='active'?'Capturando audio local (sin enviar)':'Micrófono apagado'}</strong>. También puedes mantener pulsada la barra espaciadora o V en un teclado físico.</p>
   {message&&<p className="radio-error" role="alert"><AlertTriangle size={16}/>{message}</p>}
   <p className="small muted">Evento multimedia del manos libres: {headsetEvent}. Su detección depende del navegador y del accesorio.</p>
  </div>
  <div className="tile">
   <h3>Pruebas pendientes</h3>
   <p>Para radio real entre equipos faltan el servicio WebRTC de distribución de audio, autorización de canales y señalización segura. La recepción con pantalla apagada y el control por botón físico requieren el componente Android nativo.</p>
   <p className="small muted">Este módulo no cambia los permisos GPS, la cámara ni los mapas. El micrófono se libera al soltar el botón, perder el foco o abandonar la pantalla.</p>
  </div>
 </section>;
}
