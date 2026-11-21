import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Send,Upload,MessagesSquare,FileText} from 'lucide-react';
import {supabase} from './supabase';
import VoiceRecorder from './VoiceRecorder';

const allowed=['image/jpeg','image/png','image/webp','audio/webm','audio/mpeg','audio/mp4','audio/ogg','video/mp4','video/webm','application/pdf'];
function Attachment({message}){
 const [url,setUrl]=useState(''),[problem,setProblem]=useState(false);
 useEffect(()=>{let live=true;if(!message.file_path)return;
  supabase.storage.from('direct-media').createSignedUrl(message.file_path,120).then(({data,error})=>{
   if(!live)return;if(error)setProblem(true);else setUrl(data.signedUrl)
  });return()=>{live=false};},[message.file_path]);
 if(!message.file_path)return null;
 if(problem)return <span className="small">No se pudo abrir el archivo privado.</span>;
 if(!url)return <span className="small">Cargando archivo…</span>;
 const mime=message.mime_type||'';
 return <div className="media-item">{mime.startsWith('image/')?<a href={url} target="_blank" rel="noreferrer"><img alt={message.file_name||'Imagen'} src={url}/></a>:mime.startsWith('audio/')?<audio controls preload="none" src={url}/>:mime.startsWith('video/')?<video controls preload="metadata" src={url}/>:<a href={url} target="_blank" rel="noreferrer"><FileText size={18}/>{message.file_name}</a>}</div>
}
export default function DirectChat({user,peer,notify}){
 const [messages,setMessages]=useState([]),[text,setText]=useState(''),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const bottom=useRef(null),fileRef=useRef(null);
 const load=useCallback(async()=>{
  const {data,error}=await supabase.from('direct_messages').select('*')
   .or(`and(sender_id.eq.${user.id},recipient_id.eq.${peer.user_id}),and(sender_id.eq.${peer.user_id},recipient_id.eq.${user.id})`)
   .order('created_at',{ascending:false}).limit(100);
  if(error)notify(error.message,'error');else setMessages((data||[]).reverse());setLoading(false);
 },[user.id,peer.user_id,notify]);
 useEffect(()=>{setLoading(true);load();const ch=supabase.channel(`dm-${user.id}-${peer.user_id}`)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages'},payload=>{
   const m=payload.new;
   if((m.sender_id===user.id&&m.recipient_id===peer.user_id)||(m.sender_id===peer.user_id&&m.recipient_id===user.id))load();
  }).subscribe();return()=>{supabase.removeChannel(ch)}},[load,peer.user_id,user.id]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages.length]);
 async function submit(e){e.preventDefault();if(!text.trim()&&!file)return;setBusy(true);let path;
  try{
   if(file){if(file.size>10*1024*1024)throw Error('Archivo mayor de 10 MB.');if(!allowed.includes(file.type))throw Error('Formato de archivo no permitido.');
    path=`${user.id}/${peer.user_id}/${crypto.randomUUID()}`;
    const {error}=await supabase.storage.from('direct-media').upload(path,file,{contentType:file.type});if(error)throw error;
   }
   const {error}=await supabase.from('direct_messages').insert({sender_id:user.id,recipient_id:peer.user_id,content:text.trim()||null,file_path:path||null,file_name:file?.name||null,mime_type:file?.type||null});
   if(error)throw error;setText('');setFile(null);if(fileRef.current)fileRef.current.value='';await load();
  }catch(err){notify(err.message||'No se pudo enviar','error');if(path)await supabase.storage.from('direct-media').remove([path]);}
  finally{setBusy(false)}
 }
 return <div className="chat-panel"><div className="chat-header"><div className="tile-icon"><MessagesSquare size={20}/></div><div><h3>Chat privado con {peer.alias}</h3><div className="small muted">Solo participantes de esta conversación pueden leer los mensajes.</div></div></div>
  <div className="message-list">{loading?<div className="empty">Cargando mensajes…</div>:messages.length===0?<div className="empty">Todavía no hay mensajes privados.</div>:messages.map(m=><div key={m.id} className={'message '+(m.sender_id===user.id?'mine':'')}><div className="msg-meta">{m.sender_id===user.id?'Tú':peer.alias} · {new Date(m.created_at).toLocaleString('es-CO')}</div>{m.content&&<div className="msg-text">{m.content}</div>}<Attachment message={m}/></div>)}<div ref={bottom}/></div>
  <form className="send-panel" onSubmit={submit}><label className="attachment" title="Adjuntar fotografía, video, audio o PDF"><Upload size={19}/><input ref={fileRef} type="file" accept={allowed.join(',')} onChange={e=>setFile(e.target.files?.[0]||null)}/></label><VoiceRecorder disabled={busy} notify={notify} onRecorded={setFile}/><input className="send-input" value={text} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder={file?`Adjunto: ${file.name}`:'Escribe un mensaje privado…'}/><button className="btn primary" disabled={busy||(!text.trim()&&!file)}><Send size={18}/><span>{busy?'Enviando':'Enviar'}</span></button></form>
  <div className="hint">Archivos privados, hasta 10 MB. Graba notas de voz de hasta 60 segundos.</div>
 </div>
}
