import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';

// Convierte una grabación explícitamente iniciada en un archivo adjunto normal.
export default function VoiceRecorder({onRecorded,notify,disabled=false}){
 const recorderRef=useRef(null),streamRef=useRef(null),timerRef=useRef(null),activeRef=useRef(true);
 const [recording,setRecording]=useState(false);
 useEffect(()=>()=>{activeRef.current=false;clearTimeout(timerRef.current);if(recorderRef.current?.state==='recording')recorderRef.current.stop();streamRef.current?.getTracks().forEach(t=>t.stop())},[]);
 async function begin(){
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
   notify('Tu navegador no admite grabación de voz desde la web. Puedes adjuntar un audio existente.','error');return;
  }
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});streamRef.current=stream;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));
   const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined),chunks=[];
   recorderRef.current=recorder;
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onstop=()=>{
    clearTimeout(timerRef.current);stream.getTracks().forEach(t=>t.stop());
    streamRef.current=null;recorderRef.current=null;
    if(activeRef.current)setRecording(false);
    if(!chunks.length||!activeRef.current)return;
    const type=recorder.mimeType.split(';')[0]||'audio/webm';
    const ext=type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm';
    const file=new File([new Blob(chunks,{type})],`nota-voz-${Date.now()}.${ext}`,{type});
    if(file.size>10*1024*1024)notify('El audio supera 10 MB. Graba un mensaje más corto.','error');
    else onRecorded(file);
   };
   recorder.start();setRecording(true);
   timerRef.current=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},60000);
  }catch(e){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
    notify('No se pudo acceder al micrófono: '+(e?.message||'permiso denegado'),'error');}
 }
 function stop(){if(recorderRef.current?.state==='recording')recorderRef.current.stop()}
 return <button type="button" className={'record-button '+(recording?'recording':'')} onClick={recording?stop:begin} disabled={disabled} aria-label={recording?'Detener grabación':'Grabar mensaje de voz'} title={recording?'Detener y adjuntar audio':'Grabar audio (máx. 60 s)'}>
  {recording?<><Square size={16}/><span>Detener</span></>:<Mic size={19}/>}
 </button>;
}
