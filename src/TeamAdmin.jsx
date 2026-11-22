import React,{useCallback,useEffect,useState} from 'react';
import {AlertTriangle,UserMinus,Users,Save,Plus,Trash2,Edit3,ShieldCheck} from 'lucide-react';
import {supabase} from './supabase';
import {ProfileAvatar} from './ProfileEditor';
import './team-roles.css';
const roleLabels={admin:'Administrador',coordinator:'Coordinador',participant:'Participante'};
const message=e=>e?.message||'No fue posible completar la operación';
export default function TeamAdmin({team,user,notify,onRefresh,managementRole='participant'}){
 const isOwner=team.owner_id===user.id,canManage=isOwner||managementRole==='admin';
 const canAlert=canManage||managementRole==='coordinator';
 const [roster,setRoster]=useState([]),[teamRoles,setTeamRoles]=useState([]);
 const [name,setName]=useState(team.name),[roleName,setRoleName]=useState('');
 const [alertText,setAlertText]=useState(''),[severity,setSeverity]=useState('normal'),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const [members,roles]=await Promise.all([
   supabase.from('team_members').select('user_id,administrative_role,operational_role_id').eq('team_id',team.id),
   supabase.from('team_roles').select('id,name,description').eq('team_id',team.id).order('name')
  ]);
  if(members.error||roles.error){notify(message(members.error||roles.error),'error');return;}
  const ids=(members.data||[]).map(m=>m.user_id);
  const {data:profiles,error:e2}=ids.length?await supabase.from('profiles').select('id,alias,avatar_path').in('id',ids):{data:[],error:null};
  if(e2){notify(message(e2),'error');return;}
  const byId=new Map((profiles||[]).map(p=>[p.id,p]));
  setTeamRoles(roles.data||[]);
  setRoster((members.data||[]).map(m=>({
   ...m,id:m.user_id,
   alias:byId.get(m.user_id)?.alias||'Participante',
   avatar_path:byId.get(m.user_id)?.avatar_path||null
  })));
 },[team.id,notify]);
 useEffect(()=>setName(team.name),[team.name]);
 useEffect(()=>{load()},[load]);
 async function run(fn,success){setBusy(true);try{await fn();if(success)notify(success,'success');await load()}
  catch(e){notify(message(e),'error')}finally{setBusy(false)}}
 function check(r){if(r.error)throw r.error;return r.data}
 async function rename(e){
  e.preventDefault();if(!isOwner||name.trim().length<3)return;
  await run(async()=>{check(await supabase.from('teams').update({name:name.trim()}).eq('id',team.id));await onRefresh()},'Nombre de equipo actualizado');
 }
 async function remove(member){
  if(!canManage||member.id===user.id||!window.confirm('¿Retirar a '+member.alias+' del equipo?'))return;
  await run(async()=>check(await supabase.from('team_members').delete().eq('team_id',team.id).eq('user_id',member.id)),'Participante retirado');
 }
 async function sendAlert(e){
  e.preventDefault();if(!canAlert||alertText.trim().length<3)return;
  await run(async()=>{
   check(await supabase.from('team_alerts').insert({team_id:team.id,sender_id:user.id,severity,content:alertText.trim()}));
   setAlertText('');
  },'Alerta enviada al equipo');
 }
 async function addRole(e){
  e.preventDefault();if(!isOwner||roleName.trim().length<2)return;
  await run(async()=>{
   check(await supabase.from('team_roles').insert({team_id:team.id,name:roleName.trim(),created_by:user.id}));
   setRoleName('');
  },'Rol operativo creado');
 }
 async function editRole(role){
  if(!isOwner)return;
  const next=window.prompt('Nuevo nombre del rol',role.name);
  if(!next||next.trim()===role.name)return;
  await run(async()=>check(await supabase.from('team_roles').update({name:next.trim()}).eq('id',role.id)),'Rol operativo actualizado');
 }
 async function removeRole(role){
  if(!isOwner||!window.confirm('¿Eliminar el rol "'+role.name+'"? Se quitará de las asignaciones.'))return;
  await run(async()=>check(await supabase.from('team_roles').delete().eq('id',role.id)),'Rol operativo eliminado');
 }
 async function assign(member,adminRole,operationalRole){
  if(!isOwner)return;
  await run(async()=>check(await supabase.rpc('f5_assign_team_roles',{
   p_team:team.id,p_member:member.id,p_administrative:adminRole,
   p_operational:operationalRole||null
  })),'Roles de '+member.alias+' actualizados');
 }
 return <section className="tile stack v5-team-admin">
  <div><h3><Users size={17}/> Administración: {team.name}</h3>
   <p className="muted small">{isOwner?'Propietario: puede administrar integrantes, asignar roles y editar el equipo.':
    canManage?'Administrador: puede retirar participantes y enviar alertas oficiales.':
    'Coordinador: puede comunicar avisos oficiales. Los cambios de roles pertenecen al propietario.'}</p></div>
  {isOwner&&<form className="admin-inline" onSubmit={rename}>
   <label>Nombre del equipo<input required minLength={3} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
   <button className="btn outline" disabled={busy||name.trim()===team.name}><Save size={16}/> Guardar</button>
  </form>}
  <div><h3>Integrantes y roles ({roster.length})</h3>
   <p className="muted small">El rol administrativo controla permisos. El operativo es una etiqueta que identifica la función durante las actividades.</p>
   {roster.map(m=>{
    const owner=team.owner_id===m.id,memberAdmin=owner?'owner':m.administrative_role;
    return <div className="v5-member-row" key={m.id}>
     <ProfileAvatar avatarPath={m.avatar_path} alias={m.alias} size="md"/>
     <div className="v5-member-main"><strong>{m.alias}{m.id===user.id?' (tú)':''}</strong>
      <small>{owner?'Propietario':roleLabels[m.administrative_role]||'Participante'}
       {m.operational_role_id?' · '+(teamRoles.find(r=>r.id===m.operational_role_id)?.name||'Rol operativo'):''}</small>
      {isOwner&&<div className="v5-role-selects">
       <label>Administrativo<select value={owner?'participant':m.administrative_role} disabled={busy||owner}
        onChange={e=>assign(m,e.target.value,m.operational_role_id)}>
        {Object.entries(roleLabels).map(([v,label])=><option value={v} key={v}>{label}</option>)}
       </select></label>
       <label>Operativo<select value={m.operational_role_id||''} disabled={busy}
        onChange={e=>assign(m,m.administrative_role,e.target.value)}>
        <option value="">Sin rol operativo</option>{teamRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
       </select></label></div>}
     </div>
     {canManage&&!owner&&m.id!==user.id&&(isOwner||memberAdmin!=='admin')&&
      <button className="btn danger" title="Retirar integrante" aria-label={'Retirar a '+m.alias}
       disabled={busy} onClick={()=>remove(m)}><UserMinus size={16}/></button>}
    </div>
   })}
  </div>
  {isOwner&&<div className="v5-role-manager">
   <h3><ShieldCheck size={17}/> Roles operativos configurables</h3>
   <p className="muted small">Ejemplos: Apoyo, Explorador, Líder, Comunicaciones, Primeros auxilios. No conceden permisos extra.</p>
   <div className="v5-role-pills">{teamRoles.map(r=><div className="v5-role-pill" key={r.id}>
    <span>{r.name}</span>
    <button type="button" title="Editar rol" aria-label={'Editar '+r.name} disabled={busy} onClick={()=>editRole(r)}><Edit3 size={14}/></button>
    <button type="button" title="Eliminar rol" aria-label={'Eliminar '+r.name} disabled={busy} onClick={()=>removeRole(r)}><Trash2 size={14}/></button>
   </div>)}</div>
   <form className="admin-inline" onSubmit={addRole}>
    <label>Nuevo rol operativo<input required minLength={2} maxLength={36} value={roleName}
      onChange={e=>setRoleName(e.target.value)} placeholder="Ej. Apoyo"/></label>
    <button className="btn primary" disabled={busy||roleName.trim().length<2}><Plus size={16}/> Agregar rol</button>
   </form>
  </div>}
  {canAlert&&<form onSubmit={sendAlert} className="stack">
   <div><h3><AlertTriangle size={16}/> Alerta oficial del equipo</h3>
    <p className="muted small">Los accesos rápidos personales están en Mapa GPS y no requieren permisos administrativos.</p></div>
   <label>Tipo<select value={severity} onChange={e=>setSeverity(e.target.value)}>
    <option value="normal">Aviso normal</option><option value="important">Alerta importante</option></select></label>
   <label>Mensaje<textarea rows={3} required minLength={3} maxLength={240} value={alertText}
    onChange={e=>setAlertText(e.target.value)} placeholder="Ej. Punto de reunión actualizado…"/></label>
   <button className="btn primary" disabled={busy||alertText.trim().length<3}>Enviar alerta oficial</button>
  </form>}
 </section>;
}