import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Camera,Compass,Navigation,ShieldCheck,X,AlertTriangle} from 'lucide-react';
import {cameraNavigation,compassFromEvent} from './cameraNavigation.js';
import './camera-navigation.css';

export default function CameraNavigation({me,destination,route,onClose}){
 const videoRef=useRef(null),streamRef=useRef(null),alive=useRef(true),lastReading=useRef(0),lastHeading=useRef(null);
 const [status,setStatus]=useState('idle'),[error,setError]=useState('');
 const [heading,setHeading]=useState(null),[sensor,setSensor]=useState('waiting');
 const [now,setNow]=useState(Date.now());
 const guidance=useMemo(()=>cameraNavigation(me,destination,route,heading,now),
  [me?.lat,me?.lng,me?.accuracy,me?.observedAt,destination?.lat,destination?.lng,route,heading,now]);

 function stopTracks(){
  const stream=streamRef.current;
  streamRef.current=null;
  if(stream)stream.getTracks().forEach(track=>track.stop());
  if(videoRef.current)videoRef.current.srcObject=null;
 }
 useEffect(()=>{
  alive.current=true;
  const hidden=()=>{
   if(document.visibilityState==='hidden'){
    stopTracks();setStatus('paused');setError('La cámara se detuvo al ocultar la aplicación.');
   }
  };
  const leave=()=>stopTracks();
  const esc=e=>{if(e.key==='Escape')onClose()};
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('pagehide',leave);
  window.addEventListener('keydown',esc);
  const id=setInterval(()=>setNow(Date.now()),1000);
  return()=>{
   alive.current=false;stopTracks();clearInterval(id);
   document.removeEventListener('visibilitychange',hidden);
   window.removeEventListener('pagehide',leave);
   window.removeEventListener('keydown',esc);
  };
 },[onClose]);
 useEffect(()=>{
  if(status!=='active')return;
  const onOrientation=event=>{
   const screenAngle=Number(window.screen?.orientation?.angle)||0;
   const next=compassFromEvent(event,screenAngle);
   if(next===null)return;
   const time=Date.now();
   if(time-lastReading.current<150)return;
   const prior=lastHeading.current;
   const delta=prior===null?0:((next-prior+540)%360)-180;
   // Filtro circular para reducir saltos de la brújula.
   const smooth=prior===null?next:((prior+delta*0.35)%360+360)%360;
   lastHeading.current=smooth;lastReading.current=time;
   setHeading(smooth);setSensor('ready');
  };
  window.addEventListener('deviceorientationabsolute',onOrientation);
  window.addEventListener('deviceorientation',onOrientation);
  return()=>{
   window.removeEventListener('deviceorientationabsolute',onOrientation);
   window.removeEventListener('deviceorientation',onOrientation);
  };
 },[status]);

 async function startCamera(){
  if(status==='active'||status==='starting')return;
  setError('');setStatus('starting');setHeading(null);setSensor('waiting');
  lastHeading.current=null;lastReading.current=0;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
   setError('La cámara requiere HTTPS y un navegador compatible.');
   setStatus('error');return;
  }
  // Ambas solicitudes salen directamente del clic: iOS exige activación de usuario.
  let compassPermission;
  try{
   const method=window.DeviceOrientationEvent?.requestPermission;
   compassPermission=typeof method==='function'?
    Promise.resolve(method.call(window.DeviceOrientationEvent,true)):
    Promise.resolve('not-required');
  }catch(e){compassPermission=Promise.resolve('denied')}
  const cameraPromise=navigator.mediaDevices.getUserMedia({
   audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}
  });
  const [orientationResult,cameraResult]=await Promise.allSettled([compassPermission,cameraPromise]);
  if(orientationResult.status==='rejected'||orientationResult.value==='denied')
   setSensor('denied');
  if(cameraResult.status==='rejected'){
   if(alive.current){
    const code=cameraResult.reason?.name;
    setError(code==='NotAllowedError'?'Permiso de cámara rechazado. Actívalo en el navegador e inténtalo de nuevo.':
     code==='NotFoundError'?'Este dispositivo no tiene una cámara disponible.':
     'No se pudo iniciar la cámara. Comprueba permisos y disponibilidad.');
    setStatus('error');
   }
   return;
  }
  const stream=cameraResult.value;
  if(!alive.current||document.visibilityState==='hidden'){
   stream.getTracks().forEach(t=>t.stop());return;
  }
  streamRef.current=stream;
  stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{
   if(alive.current){stopTracks();setStatus('error');setError('La cámara dejó de estar disponible.')}
  },{once:true}));
  try{
   if(!videoRef.current)throw Error('video unavailable');
   videoRef.current.srcObject=stream;
   await videoRef.current.play();
   if(!alive.current){stopTracks();return}
   setStatus('active');
  }catch{
   stopTracks();
   if(alive.current){setStatus('error');setError('El navegador no pudo mostrar el video.');}
  }
 }
 const suitable=guidance.state==='ready';
 return <section className="v56-camera" role="dialog" aria-modal="true"
  aria-label="Orientación con cámara en vivo">
  <video ref={videoRef} className="v56-camera-video" playsInline muted autoPlay
   aria-label="Vista local de la cámara, sin transmisión"/>
  <div className="v56-camera-top">
   <div><strong><Camera size={16}/> Cámara en vivo</strong>
    <small>Experimental · orientación GPS aproximada</small></div>
   <button type="button" onClick={onClose} aria-label="Cerrar cámara y volver al mapa">
    <X size={19}/> Cerrar
   </button>
  </div>
  {status!=='active'&&<div className="v56-camera-start">
   <Camera size={33}/>
   <strong>{status==='starting'?'Iniciando cámara…':'Orientación con cámara'}</strong>
   <p>Usa la cámara trasera y, si está disponible, la brújula para indicar el rumbo. No identifica visualmente calles ni obstáculos.</p>
   {error&&<p className="v56-camera-error" role="alert">{error}</p>}
   <button type="button" disabled={status==='starting'} onClick={startCamera}>
    {status==='starting'?'Solicitando permisos…':'Activar cámara'}
   </button>
   <small>El video permanece en este teléfono. Sin grabación, micrófono ni subida de imágenes.</small>
  </div>}
  {status==='active'&&<>
   {suitable&&guidance.headingAvailable?
    <div className="v56-camera-arrow" aria-label={'Dirección aproximada '+Math.round(guidance.relative)+' grados respecto al teléfono'}>
     <Navigation size={88} strokeWidth={2.6} style={{transform:'rotate('+guidance.relative+'deg)'}}/>
    </div>:
    <div className="v56-camera-warning" role="status"><AlertTriangle size={20}/>
     {guidance.state==='stale-gps'?'GPS desactualizado. No se muestra una flecha.':
      guidance.state==='inaccurate-gps'?'GPS impreciso (±'+Math.round(guidance.accuracy)+' m). Espera una señal mejor.':
      guidance.state==='off-route'?'Estás fuera de la ruta. Regresa al mapa para recalcular.':
      guidance.state==='no-destination'?'Selecciona primero un destino en el mapa.':
      'Brújula no disponible: usa el rumbo respecto al norte.'}
    </div>}
   <div className="v56-camera-guide">
    <strong>{suitable?(guidance.arrived?'Destino cercano':guidance.instruction):'Orientación en pausa'}</strong>
    {suitable&&<span>{guidance.distanceM} m al objetivo
     {guidance.metersToManeuver!==null?' · Próxima maniobra a '+guidance.metersToManeuver+' m':''}</span>}
    {suitable&&<span><Compass size={15}/> Rumbo {Math.round(guidance.bearing)}° respecto al norte
     {guidance.headingAvailable?' · Brújula disponible':''}</span>}
    {sensor==='denied'&&<small>Permiso de movimiento no concedido. La cámara continúa operativa.</small>}
    <small><ShieldCheck size={13}/> Revisa el entorno físico. No sigas flechas a través de obstáculos o áreas restringidas.</small>
   </div>
  </>}
 </section>;
}
