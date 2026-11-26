import React,{useCallback,useEffect,useRef,useState} from 'react';
import {LogOut,ShieldCheck,Users} from 'lucide-react';
import {supabase} from './supabase';

// Una cuenta anónima de Supabase NO habilita automáticamente los módulos.
// Debe haber pasado guest_join_team y conservar su sesión vigente en el servidor.
export default function GuestAccess({user,notify,pending,onPendingConsumed,children}){
 const [guest,setGuest]=useState(null);
 const [phase,setPhase]=useState('checking');
 const [alias,setAlias]=useState(pending?.alias||'');
 const [code,setCode]=useState(pending?.code||'');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const initialized=useRef(false);

 const verify=useCallback(async()=>{
  const {data,error:queryError}=await supabase.from('guest_sessions')
   .select('team_id,alias,expires_at,created_at').eq('user_id',user.id).maybeSingle();
  if(queryError){setError('No se pudo verificar el acceso de invitado. Revisa tu conexión.');setPhase('form');return}
  if(data && new Date(data.expires_at).getTime()>Date.now()){
   setGuest(data);setPhase('active');setError('');
  }else if(data){
   setGuest(null);setPhase('expired');setError('El acceso de invitado venció después de 24 horas.');
  }else{setGuest(null);setPhase('form')}
 },[user.id]);

 useEffect(()=>{
  if(initialized.current)return;
  initialized.current=true;
  const start=async()=>{
   if(pending?.code&&pending?.alias){
    const {error:joinError}=await supabase.rpc('guest_join_team',
     {p_code:pending.code.trim(),p_alias:pending.alias.trim()});
    onPendingConsumed?.();
    if(joinError)setError(joinError.message||'No se pudo ingresar al equipo.');
    else notify('Ingreso temporal autorizado. Acceso válido por 24 horas.','success');
   }
   await verify();
  };
  void start();
 },[pending,onPendingConsumed,verify,notify]);

 useEffect(()=>{
  if(!guest?.expires_at)return;
  const ms=new Date(guest.expires_at).getTime()-Date.now();
  const end=()=>{
   if(Date.now()>=new Date(guest.expires_at).getTime()){
    setGuest(null);setPhase('expired');void supabase.auth.signOut();
   }
  };
  if(ms<=0){end();return}
  const timer=setTimeout(end,ms+100);
  const visibility=()=>{if(document.visibilityState==='visible')end()};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('focus',end);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',end)};
 },[guest?.expires_at]);

 const submit=async(e)=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');
  try{
   const {error:joinError}=await supabase.rpc('guest_join_team',
    {p_code:code.trim(),p_alias:alias.trim()});
   if(joinError)throw joinError;
   await verify();
   notify('Ingreso temporal autorizado. Acceso válido por 24 horas.','success');
  }catch(e){setError(e?.message||'No se pudo validar tu invitación.');setPhase('form')}
  finally{setBusy(false)}
 };
 if(phase==='active'&&guest)return children(guest);
 if(phase==='checking')return <div className="config-screen"><ShieldCheck size={26}/><h2>Validando invitación…</h2></div>;
 return <main className="guest-entry"><div className="tile">
  <h2><Users size={22}/> Acceso temporal al equipo</h2>
  <p className="muted">No necesitas correo ni contraseña. Se admiten como máximo 10 invitados nuevos por día en toda la plataforma, y cada invitación dura 24 horas.</p>
  {error&&<p role="alert" className="guest-error">{error}</p>}
  {phase==='form'&&<form onSubmit={submit} className="guest-entry-form">
   <label>Alias temporal<input required minLength={3} maxLength={40} value={alias}
    onChange={e=>setAlias(e.target.value)} placeholder="Ej.: Operador Águila"/></label>
   <label>Código del equipo<input required minLength={10} maxLength={10}
    value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
    autoCapitalize="characters" placeholder="Código de 10 caracteres"/></label>
   <button className="btn primary full" disabled={busy}>{busy?'Comprobando…':'Entrar al Mapa GPS'}</button>
  </form>}
  <button type="button" className="btn outline full" onClick={()=>void supabase.auth.signOut()}>
   <LogOut size={16}/> Salir del acceso temporal
  </button>
 </div></main>;
}
