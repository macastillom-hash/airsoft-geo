import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ShieldCheck,Users,CalendarDays,Activity,Download,RefreshCw,FileText,Printer,History,LockKeyhole} from 'lucide-react';
import {supabase} from './supabase';
import './admin.css';

const errorText=e=>e?.message||'No fue posible consultar la información.';
const stamp=value=>value?new Date(value).toLocaleString('es-CO'):'—';
const modes={coordination:'Coordinación',stealth:'Sigilo',intelligence:'Inteligencia',direct_elimination:'Eliminación virtual',capture_flag:'Captura de bandera'};
const statuses={draft:'Borrador',scheduled:'Programada',active:'En curso',finished:'Finalizada',cancelled:'Cancelada'};
const csvValue=v=>'"'+String(v??'').replaceAll('"','""')+'"';
function csv(rows,cols){return '\ufeff'+[cols.map(c=>csvValue(c[1])).join(','),...rows.map(row=>cols.map(c=>csvValue(row[c[0]])).join(','))].join('\r\n');}
function saveFile(filename,mime,data){
 const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
const safeName=s=>String(s||'equipo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]/g,'-').slice(0,35);
export default function AdminPanel({user,teams,notify}){
 const owned=useMemo(()=>teams.filter(t=>t.owner_id===user.id),[teams,user.id]);
 const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[members,setMembers]=useState([]),[activities,setActivities]=useState([]),[assignments,setAssignments]=useState([]),[participation,setParticipation]=useState([]),[events,setEvents]=useState([]),[audit,setAudit]=useState([]),[messages,setMessages]=useState([]),[alerts,setAlerts]=useState([]),[filter,setFilter]=useState('all');
 const team=owned.find(t=>t.id===selected)||owned[0];
 useEffect(()=>{if(!selected&&owned.length)setSelected(owned[0].id)},[owned,selected]);
 const fetchData=useCallback(async()=>{
  if(!team)return;setBusy(true);
  try{
   const [ms,ats,chat,teamAlerts,logs]=await Promise.all([
    supabase.from('team_members').select('user_id,created_at').eq('team_id',team.id).limit(500),
    supabase.from('activity_teams').select('activity_id,side,score,created_at').eq('team_id',team.id).limit(500),
    supabase.from('messages').select('id,created_at').eq('team_id',team.id).order('created_at',{ascending:false}).limit(500),
    supabase.from('team_alerts').select('id,created_at,severity').eq('team_id',team.id).order('created_at',{ascending:false}).limit(500),
    supabase.from('f4_admin_audit').select('id,action,detail,created_at').eq('team_id',team.id).order('created_at',{ascending:false}).limit(200)
   ]);
   for(const result of [ms,ats,chat,teamAlerts,logs])if(result.error)throw result.error;
   const ids=(ms.data||[]).map(m=>m.user_id),actIds=(ats.data||[]).map(a=>a.activity_id);
   const [profiles,actRes,partRes,eventRes]=await Promise.all([
    ids.length?supabase.from('profiles').select('id,alias').in('id',ids):{data:[],error:null},
    actIds.length?supabase.from('activities').select('id,title,description,mode,status,starts_at,created_at,duration_minutes,organizer_id').in('id',actIds):{data:[],error:null},
    actIds.length?supabase.from('activity_participants').select('activity_id,team_id,user_id,display_name,status,joined_at').in('activity_id',actIds).eq('team_id',team.id).limit(1000):{data:[],error:null},
    actIds.length?supabase.from('activity_events').select('id,activity_id,event_type,detail,created_at').in('activity_id',actIds).order('created_at',{ascending:false}).limit(500):{data:[],error:null}
   ]);
   for(const result of [profiles,actRes,partRes,eventRes])if(result.error)throw result.error;
   const aliases=new Map((profiles.data||[]).map(p=>[p.id,p.alias]));
   setMembers((ms.data||[]).map(m=>({id:m.user_id,alias:aliases.get(m.user_id)||'Compañero',joined_at:m.created_at})));
   setAssignments(ats.data||[]);setActivities(actRes.data||[]);setParticipation(partRes.data||[]);setEvents(eventRes.data||[]);
   setMessages(chat.data||[]);setAlerts(teamAlerts.data||[]);setAudit(logs.data||[]);
  }catch(e){notify('Administración: '+errorText(e),'error')}
  finally{setBusy(false)}
 },[team?.id,notify]);
 useEffect(()=>{fetchData()},[fetchData]);
 const visibleActivities=activities.filter(a=>filter==='all'||a.status===filter).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const scores=assignments.map(a=>({...a,title:activities.find(x=>x.id===a.activity_id)?.title||'Actividad'}));
 function exportActivityReport(){
  if(!team)return;
  saveFile('airsoft-actividades-'+safeName(team.name)+'.csv','text/csv;charset=utf-8',
   csv(visibleActivities.map(a=>({...a,participantes:participation.filter(p=>p.activity_id===a.id).length,puntaje:assignments.find(t=>t.activity_id===a.id)?.score||0})),
    [['title','Actividad'],['mode','Modalidad'],['status','Estado'],['starts_at','Fecha prevista'],['participantes','Participantes'],['puntaje','Puntos']]));
 }
 function exportMembers(){
  if(!team)return;
  saveFile('airsoft-integrantes-'+safeName(team.name)+'.csv','text/csv;charset=utf-8',
   csv(members.map(m=>({alias:m.alias,joined_at:stamp(m.joined_at)})),[['alias','Alias'],['joined_at','Ingreso al equipo']]));
 }
 function exportSnapshot(){
  if(!team)return;
  const payload={
   format:'airsoft-geo-team-export-v4',generated_at:new Date().toISOString(),
   note:'Exportación informativa de este equipo. No restaura PostgreSQL ni contiene credenciales, mensajes privados, archivos o posiciones GPS.',
   team:{id:team.id,name:team.name},members,
   activities,activity_teams:scores,participants:participation,
   activity_events:events,admin_audit:audit,
   metrics:{members:members.length,activities:activities.length,teamMessages:messages.length,teamAlerts:alerts.length}
  };
  saveFile('airsoft-resumen-'+safeName(team.name)+'.json','application/json;charset=utf-8',JSON.stringify(payload,null,2));
 }
 if(!owned.length)return <div className="tile"><LockKeyhole size={26}/><h2>Acceso para administradores</h2><p className="muted">Este espacio se reserva a propietarios de equipos. Los permisos también se validan en Supabase.</p></div>;
 return <div className="stack admin-panel">
  <div className="section-head"><div><h2><ShieldCheck size={20}/> Centro de administración</h2><p className="muted">Información de tus equipos, actividades, eventos y exportaciones. Sin coordenadas GPS ni contenido de mensajes.</p></div>
   <div className="inline-actions"><select className="select-team" aria-label="Equipo administrado" value={team?.id||''} onChange={e=>setSelected(e.target.value)}>{owned.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn outline" disabled={busy} onClick={fetchData}><RefreshCw size={16}/> Actualizar</button></div></div>
  <div className="admin-metrics">
   <div className="metric"><div className="metric-top">Integrantes <Users size={19}/></div><strong>{members.length}</strong><small>Equipo seleccionado</small></div>
   <div className="metric"><div className="metric-top">Actividades <CalendarDays size={19}/></div><strong>{activities.length}</strong><small>Asociadas al equipo</small></div>
   <div className="metric"><div className="metric-top">Mensajes <Activity size={19}/></div><strong>{messages.length}{messages.length===500?'+':''}</strong><small>Conteo de hasta 500 registros</small></div>
   <div className="metric"><div className="metric-top">Alertas <ShieldCheck size={19}/></div><strong>{alerts.length}{alerts.length===500?'+':''}</strong><small>Historial de avisos</small></div>
  </div>
  <div className="tile"><h3><Download size={18}/> Reportes y copia informativa</h3><p className="muted small">Las exportaciones son de solo lectura, no incluyen la ubicación exacta ni archivos multimedia. «Guardar como PDF» utiliza la impresión del navegador.</p>
   <div className="inline-actions"><button className="btn outline" disabled={busy} onClick={exportMembers}><Download size={16}/> Integrantes CSV</button>
    <button className="btn outline" disabled={busy} onClick={exportActivityReport}><Download size={16}/> Actividades CSV</button>
    <button className="btn primary" disabled={busy} onClick={exportSnapshot}><FileText size={16}/> Exportar JSON</button>
    <button className="btn outline" onClick={()=>window.print()}><Printer size={16}/> Imprimir / PDF</button>
   </div><p className="small muted">Para una recuperación íntegra de Supabase es necesario un respaldo independiente de PostgreSQL y Storage. Este archivo JSON no es restaurable automáticamente.</p></div>
  <div className="tile admin-printable"><div className="section-head"><div><h3>Reporte de actividades</h3><p className="small muted">{team?.name} · {stamp(new Date().toISOString())}</p></div><select aria-label="Filtrar actividades" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos los estados</option>{Object.entries(statuses).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Actividad</th><th>Modalidad</th><th>Estado</th><th>Participantes</th><th>Puntos</th></tr></thead><tbody>
    {visibleActivities.map(a=><tr key={a.id}><td><strong>{a.title}</strong><small>{stamp(a.starts_at)}</small></td><td>{modes[a.mode]||a.mode}</td><td>{statuses[a.status]||a.status}</td><td>{participation.filter(p=>p.activity_id===a.id).length}</td><td>{assignments.find(t=>t.activity_id===a.id)?.score||0}</td></tr>)}
    {!visibleActivities.length&&<tr><td colSpan={5}>No hay actividades para este filtro.</td></tr>}
   </tbody></table></div></div>
  <div className="admin-columns"><div className="tile"><h3><Users size={18}/> Integrantes del equipo</h3><div className="admin-scroll">{members.map(m=><div className="admin-line" key={m.id}><b>{m.alias}</b><small>Desde {stamp(m.joined_at)}</small></div>)}{!members.length&&<p className="muted small">Sin participantes registrados.</p>}</div></div>
   <div className="tile"><h3><History size={18}/> Historial administrativo</h3><div className="admin-scroll">{audit.map(a=><div className="admin-line" key={a.id}><b>{a.detail||a.action}</b><small>{stamp(a.created_at)}</small></div>)}{!audit.length&&<p className="muted small">Las acciones nuevas aparecerán aquí. No se reconstruyen acciones pasadas.</p>}</div></div></div>
  <div className="tile admin-printable"><h3><History size={18}/> Eventos recientes</h3><div className="admin-scroll">{events.slice(0,60).map(ev=><div className="admin-line" key={ev.id}><b>{ev.event_type.replaceAll('_',' ')}</b><span>{ev.detail||'Evento de actividad'}</span><small>{stamp(ev.created_at)}</small></div>)}{!events.length&&<p className="muted small">Sin eventos registrados en las actividades asociadas.</p>}</div></div>
 </div>;
}
