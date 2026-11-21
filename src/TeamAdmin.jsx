import React,{useEffect,useState} from 'react';
import {AlertTriangle,UserMinus,Users,Save} from 'lucide-react';
import {supabase} from './supabase';

export default function TeamAdmin({team,user,notify,onRefresh}){
 const [roster,setRoster]=useState([]),[name,setName]=useState(team.name),[alertText,setAlertText]=useState(''),[severity,setSeverity]=useState('normal'),[busy,setBusy]=useState(false);
 useEffect(()=>setName(team.name),[team.name]);
 useEffect(()=>{let live=true;async function load(){const {data,error}=await supabase.from('team_members').select('user_id').eq('team_id',team.id);
  if(error){notify(error.message,'error');return;}
  const ids=(data||[]).map(x=>x.user_id);
  if(!ids.length){if(live)setRoster([]);return;}
  const {data:profiles,error:e2}=await supabase.from('profiles').select('id,alias').in('id',ids);
  if(e2){notify(e2.message,'error');return;}if(live)setRoster(ids.map(id=>({id,alias:profiles?.find(p=>p.id===id)?.alias||'Participante'})))}
  load();return()=>{live=false}
 },[team.id,onRefresh]);
 async function rename(e){e.preventDefault();if(name.trim().length<3)return;setBusy(true);
  const {error}=await supabase.from('teams').update({name:name.trim()}).eq('id',team.id);
  if(error)notify(error.message,'error');else{notify('Nombre de equipo actualizado.','success');await onRefresh()};setBusy(false)
 }
 async function remove(member){if(!window.confirm(`¿Retirar a ${member.alias} de ${team.name}?`))return;
  setBusy(true);const {error}=await supabase.from('team_members').delete().eq('team_id',team.id).eq('user_id',member.id);
  if(error)notify(error.message,'error');else{setRoster(old=>old.filter(m=>m.id!==member.id));notify('Participante retirado del equipo.','success')};setBusy(false)
 }
 async function sendAlert(e){e.preventDefault();if(alertText.trim().length<3)return;setBusy(true);
  const {error}=await supabase.from('team_alerts').insert({team_id:team.id,sender_id:user.id,severity,content:alertText.trim()});
  if(error)notify(error.message,'error');else{notify('Alerta enviada a los integrantes del equipo.','success');setAlertText('')};setBusy(false)
 }
 return <div className="tile stack"><div><h3><Users size={17}/> Administración: {team.name}</h3><p className="muted small">Solo el creador del equipo puede editarlo, retirar miembros y enviar alertas.</p></div>
  <form className="admin-inline" onSubmit={rename}><label>Nombre del equipo<input required minLength={3} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn outline" disabled={busy||name.trim()===team.name}><Save size={16}/> Guardar</button></form>
  <div><h3>Participantes ({roster.length})</h3>{roster.map(m=><div key={m.id} className="person"><div className="avatar">{m.alias.slice(0,1).toUpperCase()}</div><div><strong>{m.alias}</strong><small>{m.id===user.id?'Creador':'Participante'}</small></div>{m.id!==user.id&&<button className="btn danger member-remove" disabled={busy} title="Retirar del equipo" onClick={()=>remove(m)}><UserMinus size={16}/></button>}</div>)}</div>
  <form onSubmit={sendAlert} className="stack"><div><h3><AlertTriangle size={16}/> Enviar una alerta al equipo</h3><p className="muted small">Se mostrará en Notificaciones y vibrará en dispositivos compatibles con la web activa.</p></div><label>Tipo de alerta<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="normal">Aviso normal</option><option value="important">Alerta importante</option></select></label><label>Mensaje<textarea rows={3} required minLength={3} maxLength={240} value={alertText} onChange={e=>setAlertText(e.target.value)} placeholder="Ej. Punto de reunión actualizado…"/></label><button className="btn primary" disabled={busy||alertText.trim().length<3}>Enviar alerta al equipo</button></form>
 </div>
}
