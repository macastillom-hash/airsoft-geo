import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {MapContainer,TileLayer,Marker,Circle,Popup,useMap} from 'react-leaflet';
import L from 'leaflet';
import {CalendarDays,MapPin,Users,Flag,ShieldCheck,Plus,RefreshCw,Check,Trash2,Edit3,Play,Square,AlertTriangle,MessagesSquare,Navigation,Radio,UserCheck} from 'lucide-react';
import {supabase} from './supabase';
import {metersBetween,distanceLabel} from './geo';
import './activities.css';

const modes={coordination:'Coordinación',stealth:'Sigilo',intelligence:'Inteligencia',direct_elimination:'Eliminación virtual',capture_flag:'Captura de bandera'};
const statusLabels={draft:'Borrador',scheduled:'Programada',active:'En curso',finished:'Finalizada',cancelled:'Cancelada'};
const err=e=>e?.message||'No se pudo completar la operación';
const dateLabel=dt=>dt?new Date(dt).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}):'Sin fecha';
const localInputTime=dt=>{if(!dt)return '';const d=new Date(dt);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const icon=(color)=>L.divIcon({className:'',html:`<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px #0005"></div>`,iconAnchor:[9,9],iconSize:[18,18]});
const myIcon=icon('#147cf5'),friendIcon=icon('#18ae94');
const blankActivity={title:'',description:'',mode:'coordination',duration_minutes:60,respawn_seconds:0,starts_at:''};
const blankZone={name:'',zone_type:'meeting',team_id:'',latitude:'',longitude:'',radius_m:50};
function PanTo({point}){const map=useMap();useEffect(()=>{if(point)map.setView(point,15)},[map,point?.[0],point?.[1]]);return null}
function ActivityMap({me,allies,zones,sharing}){
 const base=me?[me.lat,me.lng]:zones.length?[zones[0].latitude,zones[0].longitude]:[4.65,-74.1];
 return <div className="act-map"><MapContainer center={base} zoom={me||zones.length?15:6} className="act-leaflet" scrollWheelZoom={false}>
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  <PanTo point={base}/>
  {zones.map(z=><React.Fragment key={z.id}><Circle center={[z.latitude,z.longitude]} radius={z.radius_m} pathOptions={{color:z.zone_type==='base'?'#e58b3a':'#427bd4',fillOpacity:.11,weight:2}}/><Marker position={[z.latitude,z.longitude]} icon={icon(z.zone_type==='base'?'#d58325':'#638be3')}><Popup><strong>{z.name}</strong><br/>{z.zone_type==='base'?'Base de equipo':'Zona de actividad'} · {z.radius_m} m</Popup></Marker></React.Fragment>)}
  {me&&<Marker position={[me.lat,me.lng]} icon={myIcon}><Popup>Tu posición · precisión aprox. {Math.round(me.accuracy||0)} m · {sharing?'Compartiendo':'Solo local'}</Popup></Marker>}
  {allies.map(p=><Marker key={p.user_id} position={[p.latitude,p.longitude]} icon={friendIcon}><Popup>{p.display_name}<br/>Compañero · {me?distanceLabel(metersBetween(me,{lat:p.latitude,lng:p.longitude})):'—'}</Popup></Marker>)}
 </MapContainer><div className="act-map-caption">Marcadores: azul, tú; verde, compañeros autorizados; naranja, bases. No se transmiten posiciones de rivales desde este módulo.</div></div>;
}
export default function Activities({user,teams,me,sharing,positions,alias,notify,onOpenChat,onToggleSharing}){
 const [activities,setActivities]=useState([]),[selectedId,setSelectedId]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [activityTeams,setActivityTeams]=useState([]),[participants,setParticipants]=useState([]),[zones,setZones]=useState([]),[flags,setFlags]=useState([]),[eliminations,setEliminations]=useState([]),[events,setEvents]=useState([]);
 const [showForm,setShowForm]=useState(false),[editId,setEditId]=useState(''),[form,setForm]=useState(blankActivity),[createTeam,setCreateTeam]=useState('');
 const [inviteCode,setInviteCode]=useState(''),[inviteTeam,setInviteTeam]=useState(''),[joinTeam,setJoinTeam]=useState('');
 const [zoneForm,setZoneForm]=useState(blankZone),[zoneEditId,setZoneEditId]=useState(''),[targetId,setTargetId]=useState('');
 const activity=activities.find(a=>a.id===selectedId);
 const isOrganizer=activity?.organizer_id===user.id;
 const myOwners=teams.filter(t=>t.owner_id===user.id);
 const canConfigure=!!activity&&isOrganizer&&['draft','scheduled'].includes(activity.status);
 const isActive=activity?.status==='active';
 const activityTeamIds=activityTeams.map(t=>t.team_id);
 const myAssignedTeams=teams.filter(t=>activityTeamIds.includes(t.id));
 const myParticipant=participants.find(p=>p.user_id===user.id);
 const myTeamId=myParticipant?.team_id;
 const myAllies=participants.filter(p=>p.team_id===myTeamId&&p.user_id!==user.id&&p.status!=='withdrawn');
 const enemies=participants.filter(p=>p.team_id!==myTeamId&&p.status==='active');
 const pending=eliminations.filter(e=>e.target_id===user.id&&e.status==='pending');
 const freshAllies=positions.filter(p=>myAllies.some(a=>a.user_id===p.user_id)&&Date.now()-new Date(p.updated_at).getTime()<45000)
   .map(p=>({...p,display_name:myAllies.find(a=>a.user_id===p.user_id)?.display_name||'Compañero'}));
 const sortedTeams=activityTeams.map(at=>({...at,team:teams.find(t=>t.id===at.team_id)}));
 const loadActivities=useCallback(async()=>{
  const {data,error}=await supabase.from('activities').select('*').order('created_at',{ascending:false}).limit(100);
  if(error)notify('Actividades: '+err(error),'error');else{
   setActivities(data||[]);setSelectedId(prev=>(data||[]).some(a=>a.id===prev)?prev:(data||[])[0]?.id||'');
  }
  setLoading(false);
 },[notify]);
 const loadDetails=useCallback(async()=>{
  if(!selectedId){setActivityTeams([]);setParticipants([]);setZones([]);setFlags([]);setEliminations([]);setEvents([]);return;}
  const names=['activity_teams','activity_participants','activity_zones','activity_flags','activity_eliminations','activity_events'];
  const response=await Promise.all(names.map(n=>supabase.from(n).select('*').eq('activity_id',selectedId).order(n==='activity_events'?'created_at':n==='activity_participants'?'joined_at':'activity_id',{ascending:false}).limit(120)));
  const setters=[setActivityTeams,setParticipants,setZones,setFlags,setEliminations,setEvents];
  response.forEach(({data,error},i)=>{if(error)notify(`${names[i]}: ${err(error)}`,'error');else setters[i](data||[])});
 },[selectedId,notify]);
 useEffect(()=>{loadActivities()},[loadActivities]);
 useEffect(()=>{loadDetails()},[loadDetails]);
 useEffect(()=>{
  if(!selectedId)return;
  const channel=supabase.channel('airsoft-activities-'+selectedId);
  ['activities','activity_teams','activity_participants','activity_zones','activity_flags','activity_eliminations','activity_events'].forEach(table=>{
   channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{loadActivities();loadDetails()});
  });
  channel.subscribe();
  const id=setInterval(()=>{if(document.visibilityState==='visible'){loadActivities();loadDetails()}},15000);
  return()=>{clearInterval(id);supabase.removeChannel(channel)};
 },[selectedId,loadActivities,loadDetails]);
 const refresh=async()=>{await Promise.all([loadActivities(),loadDetails()])};
 async function run(action,success){setBusy(true);try{await action();if(success)notify(success,'success');await refresh()}catch(e){notify(err(e),'error')}finally{setBusy(false)}}
 function requireOk(result){if(result.error)throw result.error;return result.data}
 function newActivity(){setEditId('');setForm({...blankActivity});setCreateTeam(myOwners[0]?.id||'');setShowForm(true)}
 function editActivity(){if(!canConfigure)return;setEditId(activity.id);setForm({title:activity.title,description:activity.description,mode:activity.mode,duration_minutes:activity.duration_minutes,respawn_seconds:activity.respawn_seconds||0,starts_at:localInputTime(activity.starts_at)});setShowForm(true)}
 async function saveActivity(e){e.preventDefault();const team=createTeam||myOwners[0]?.id;
  await run(async()=>{
   const payload={title:form.title.trim(),description:form.description.trim(),mode:form.mode,duration_minutes:Number(form.duration_minutes),respawn_seconds:form.mode==='direct_elimination'?Number(form.respawn_seconds):0,starts_at:form.starts_at?new Date(form.starts_at).toISOString():null};
   if(editId){requireOk(await supabase.from('activities').update(payload).eq('id',editId));}
   else{if(!team)throw Error('Debes administrar un equipo para crear actividades');
    const newId=requireOk(await supabase.rpc('f3_create_activity',{p_team:team,p_title:payload.title,p_description:payload.description,p_mode:payload.mode,p_starts_at:payload.starts_at,p_duration:payload.duration_minutes,p_respawn:payload.respawn_seconds}));
    setSelectedId(newId);
   }
   setShowForm(false);
  },editId?'Actividad actualizada':'Actividad creada en borrador');
 }
 async function changeStatus(next){if(!isOrganizer)return;
  if(next==='cancelled'&&!window.confirm('¿Cancelar la actividad? Se conservará el historial.'))return;
  await run(async()=>requireOk(await supabase.from('activities').update({status:next}).eq('id',activity.id)),`Actividad: ${statusLabels[next]}`);
 }
 async function addTeamByCode(e){e.preventDefault();await run(async()=>{
  if(!inviteTeam)throw Error('Selecciona el equipo del que eres propietario');
  const id=requireOk(await supabase.rpc('f3_join_activity_team',{p_code:inviteCode.trim(),p_team:inviteTeam}));
  setSelectedId(id);setInviteCode('');
 },'Equipo asociado a la actividad');}
 async function removeTeam(teamId){if(!canConfigure||!window.confirm('¿Quitar este equipo y sus inscripciones?'))return;
  await run(async()=>requireOk(await supabase.from('activity_teams').delete().eq('activity_id',activity.id).eq('team_id',teamId)),'Equipo retirado');}
 async function enroll(){await run(async()=>{
  if(!joinTeam)throw Error('Selecciona un equipo asignado a la actividad');
  requireOk(await supabase.from('activity_participants').insert({activity_id:activity.id,team_id:joinTeam,user_id:user.id,display_name:(alias||user.user_metadata?.alias||'Participante').slice(0,40)}));
 },'Te has inscrito en la actividad');}
 async function leave(){if(!window.confirm('¿Abandonar la actividad? Tu GPS se controla por separado desde el perfil.'))return;
  await run(async()=>{
   if(['draft','scheduled'].includes(activity.status))requireOk(await supabase.from('activity_participants').delete().eq('activity_id',activity.id).eq('user_id',user.id));
   else requireOk(await supabase.from('activity_participants').update({status:'withdrawn'}).eq('activity_id',activity.id).eq('user_id',user.id));
  },'Has abandonado la actividad');}
 function startZoneEdit(z){setZoneEditId(z.id);setZoneForm({...z,team_id:z.team_id||''})}
 async function saveZone(e){e.preventDefault();if(!canConfigure)return;
  await run(async()=>{
   const payload={name:zoneForm.name.trim(),zone_type:zoneForm.zone_type,team_id:zoneForm.team_id||null,
    latitude:Number(zoneForm.latitude),longitude:Number(zoneForm.longitude),radius_m:Number(zoneForm.radius_m)};
   if(zoneEditId)requireOk(await supabase.from('activity_zones').update(payload).eq('id',zoneEditId).eq('activity_id',activity.id));
   else requireOk(await supabase.from('activity_zones').insert({...payload,activity_id:activity.id}));
   setZoneEditId('');setZoneForm(blankZone);
  },zoneEditId?'Zona modificada':'Zona registrada');}
 async function removeZone(z){if(!canConfigure||!window.confirm('¿Eliminar esta zona?'))return;
  await run(async()=>requireOk(await supabase.from('activity_zones').delete().eq('id',z.id)),'Zona eliminada');}
 async function requestElimination(e){e.preventDefault();if(!targetId)return;
  await run(async()=>{
   requireOk(await supabase.from('activity_eliminations').insert({activity_id:activity.id,requester_id:user.id,target_id:targetId}));
   setTargetId('');
  },'Solicitud digital enviada. La otra persona debe confirmarla');}
 async function respondElimination(id,status){await run(async()=>requireOk(await supabase.from('activity_eliminations').update({status}).eq('id',id)),status==='confirmed'?'Captura virtual confirmada':'Solicitud rechazada');}
 async function flagAction(teamId,action){await run(async()=>requireOk(await supabase.rpc('f3_flag_action',{p_activity:activity.id,p_flag_team:teamId,p_action:action})),action==='pickup'?'Bandera recogida virtualmente':'Captura registrada en el marcador');}
 async function organizerAction(action,target){await run(async()=>requireOk(await supabase.rpc('f3_organizer_action',{p_activity:activity.id,p_action:action,p_user:target||null})),action==='reinstate'?'Participante reincorporado':'Banderas reiniciadas');}
 const visible=!!activity;
 return <div className="act-page stack">
  <div className="section-head"><div><h2>Actividades y coordinación</h2><p className="muted">Sesiones autorizadas, zonas GPS, equipos y registros virtuales. Sin ubicación obligatoria.</p></div><button className="btn outline" onClick={refresh}><RefreshCw size={16}/> Actualizar</button></div>
  <div className="act-layout"><aside className="act-list tile"><div className="act-list-title"><h3>Mis actividades</h3><button className="btn primary" disabled={!myOwners.length} onClick={newActivity}><Plus size={16}/> Nueva</button></div>
   {!myOwners.length&&<p className="small muted">Para organizar una actividad debes ser propietario de un equipo.</p>}
   {loading?<p>Cargando…</p>:activities.length===0?<p className="muted small">Aún no hay actividades asignadas a tus equipos.</p>:activities.map(a=><button key={a.id} className={'act-choice '+(selectedId===a.id?'selected':'')} onClick={()=>setSelectedId(a.id)}><strong>{a.title}</strong><span>{modes[a.mode]} · {statusLabels[a.status]}</span><small>{dateLabel(a.starts_at)}</small></button>)}
   <form onSubmit={addTeamByCode} className="act-invite"><h4>Unir otro equipo</h4><p className="small muted">Solo el propietario puede aceptar una invitación con el código de actividad.</p><input required value={inviteCode} maxLength={10} placeholder="Código de actividad" onChange={e=>setInviteCode(e.target.value.toUpperCase())}/><select required value={inviteTeam} onChange={e=>setInviteTeam(e.target.value)}><option value="">Selecciona tu equipo</option>{myOwners.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn outline full" disabled={busy||!myOwners.length}>Unir equipo</button></form>
  </aside>
  <div className="act-detail stack">{!visible?<div className="tile empty">Selecciona una actividad o crea una nueva para comenzar.</div>:<>
   <section className="tile act-heading"><div className="act-heading-top"><div><span className="eyebrow">{modes[activity.mode]} · {statusLabels[activity.status]}</span><h2>{activity.title}</h2><p className="muted">{activity.description||'Actividad privada para coordinar equipos y compartir información.'}</p><p className="small muted"><CalendarDays size={14}/> {dateLabel(activity.starts_at)} · {activity.duration_minutes} minutos · inicio manual</p></div>{isOrganizer&&canConfigure&&<button className="btn outline" onClick={editActivity}><Edit3 size={16}/> Editar</button>}</div>
    <div className="act-actions">{isOrganizer&&<>
     {activity.status==='draft'&&<button className="btn outline" disabled={busy||!activity.starts_at} onClick={()=>changeStatus('scheduled')}><CalendarDays size={16}/> Programar</button>}
     {['draft','scheduled'].includes(activity.status)&&<button className="btn primary" disabled={busy} onClick={()=>changeStatus('active')}><Play size={16}/> Iniciar</button>}
     {isActive&&<button className="btn primary" disabled={busy} onClick={()=>changeStatus('finished')}><Square size={16}/> Finalizar</button>}
     {['draft','scheduled','active'].includes(activity.status)&&<button className="btn danger" disabled={busy} onClick={()=>changeStatus('cancelled')}>Cancelar</button>}
    </>}{isOrganizer&&<span className="act-code">Código: <code>{activity.invite_code}</code></span>}
    </div>
   </section>
   <section className="tile"><h3><Users size={18}/> Equipos y participantes</h3><div className="act-team-grid">{sortedTeams.map(t=><div className="act-team" key={t.team_id}><div className="act-team-title"><strong>{t.team?.name||'Equipo '+t.side}</strong><span>Equipo {t.side==='alpha'?'A':'B'}</span></div><div className="act-stats"><b>{participants.filter(p=>p.team_id===t.team_id&&p.status==='active').length}</b> activos <b>{t.score}</b> puntos</div>{canConfigure&&<button className="act-small-button" disabled={busy} onClick={()=>removeTeam(t.team_id)}><Trash2 size={14}/> Retirar equipo</button>}</div>)}</div>
    {!myParticipant&&['draft','scheduled','active'].includes(activity.status)?<div className="act-inline"><select value={joinTeam} onChange={e=>setJoinTeam(e.target.value)}><option value="">Mi equipo en esta actividad…</option>{myAssignedTeams.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button className="btn primary" disabled={busy||!joinTeam} onClick={enroll}><UserCheck size={16}/> Inscribirme</button></div>:myParticipant?<div className="act-inline"><span>Participas como <strong>{myParticipant.display_name}</strong> · {myParticipant.status}</span>{myParticipant.status!=='withdrawn'&&<button className="btn outline" disabled={busy} onClick={leave}>Abandonar</button>}</div>:null}
    <div className="act-roster">{participants.map(p=><div key={p.user_id} className="act-person"><span>{p.display_name} {p.user_id===user.id?'(tú)':''}</span><small>{p.status==='active'?'Activo':p.status==='eliminated'?'Eliminado virtualmente':'Retirado'} · {p.team_id===myTeamId?'Aliado':p.team_id===activityTeams.find(t=>t.side==='alpha')?.team_id?'Equipo A':'Equipo B'}</small>{isOrganizer&&isActive&&p.status==='eliminated'&&<button className="act-small-button" onClick={()=>organizerAction('reinstate',p.user_id)} disabled={busy}>Reincorporar</button>}</div>)}</div>
   </section>
   <section className="tile"><div className="section-head"><div><h3><MapPin size={18}/> Mapa y zonas autorizadas</h3><p className="small muted">GPS compartido solo por decisión del usuario; las posiciones de rivales no se muestran.</p></div><button className={'btn '+(sharing?'outline':'primary')} onClick={onToggleSharing}>{sharing?'Detener GPS':'Compartir GPS'}</button></div>
    <div className="act-note"><ShieldCheck size={17}/> Compartir GPS lo hace visible para todos tus compañeros de equipo en Airsoft Geo, no únicamente para esta actividad. Puedes detenerlo en cualquier momento.</div>
    <ActivityMap me={me} sharing={sharing} allies={myParticipant?.status!=='withdrawn'?freshAllies:[]} zones={zones}/>
    <div className="act-zones">{zones.map(z=><div className="act-zone" key={z.id}><div><strong>{z.name}</strong><small>{z.zone_type==='base'?'Base de equipo':z.zone_type} · {z.radius_m} m · {z.latitude.toFixed(5)}, {z.longitude.toFixed(5)}</small></div>{canConfigure&&<div className="act-zone-tools"><button aria-label="Editar zona" onClick={()=>startZoneEdit(z)}><Edit3 size={16}/></button><button aria-label="Eliminar zona" onClick={()=>removeZone(z)}><Trash2 size={16}/></button></div>}</div>)}</div>
    {canConfigure&&<form className="act-zone-form" onSubmit={saveZone}><h4>{zoneEditId?'Editar zona GPS':'Agregar zona GPS'}</h4><div className="act-form-grid"><label>Nombre<input required minLength={3} maxLength={80} value={zoneForm.name} onChange={e=>setZoneForm(o=>({...o,name:e.target.value}))}/></label><label>Tipo<select value={zoneForm.zone_type} onChange={e=>setZoneForm(o=>({...o,zone_type:e.target.value,team_id:e.target.value==='base'?o.team_id:''}))}><option value="meeting">Encuentro</option><option value="base">Base / bandera</option><option value="objective">Objetivo</option><option value="checkpoint">Punto de control</option></select></label><label>Equipo para base<select disabled={zoneForm.zone_type!=='base'} required={zoneForm.zone_type==='base'} value={zoneForm.team_id} onChange={e=>setZoneForm(o=>({...o,team_id:e.target.value}))}><option value="">No aplica</option>{activityTeams.map(t=><option value={t.team_id} key={t.team_id}>{t.team?.name||teams.find(x=>x.id===t.team_id)?.name||'Equipo '+t.side}</option>)}</select></label><label>Radio (m)<input type="number" required min="20" max="500" value={zoneForm.radius_m} onChange={e=>setZoneForm(o=>({...o,radius_m:e.target.value}))}/></label><label>Latitud<input type="number" min="-90" max="90" step="any" required value={zoneForm.latitude} onChange={e=>setZoneForm(o=>({...o,latitude:e.target.value}))}/></label><label>Longitud<input type="number" min="-180" max="180" step="any" required value={zoneForm.longitude} onChange={e=>setZoneForm(o=>({...o,longitude:e.target.value}))}/></label></div><div className="act-inline"><button className="btn outline" type="button" disabled={!me} onClick={()=>setZoneForm(o=>({...o,latitude:me.lat.toFixed(6),longitude:me.lng.toFixed(6)}))}><Navigation size={16}/> Usar mi GPS actual</button><button className="btn primary" disabled={busy}>{zoneEditId?'Guardar zona':'Agregar zona'}</button>{zoneEditId&&<button className="btn outline" type="button" onClick={()=>{setZoneEditId('');setZoneForm(blankZone)}}>Cancelar edición</button>}</div></form>}
   </section>
   {activity.mode==='direct_elimination'&&<section className="tile"><h3><ShieldCheck size={18}/> Eliminación virtual</h3><p className="small muted">Una captura solo se registra cuando el destinatario la acepta en su celular. Sin contacto físico ni persecución obligatoria.</p>
    {isActive&&myParticipant?.status==='eliminated'&&activity.respawn_seconds>0&&<div className="act-inline"><p className="small muted">Reincorporación permitida después de {activity.respawn_seconds} segundos desde la confirmación.</p><button className="btn primary" disabled={busy} onClick={()=>run(async()=>requireOk(await supabase.rpc('f3_respawn',{p_activity:activity.id})),'Ya puedes participar')}>Reincorporarme</button></div>}
    {isActive&&myParticipant?.status==='active'&&<form className="act-inline" onSubmit={requestElimination}><select required value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">Selecciona un rival activo…</option>{enemies.map(p=><option value={p.user_id} key={p.user_id}>{p.display_name}</option>)}</select><button className="btn primary" disabled={busy||!targetId}>Solicitar captura</button></form>}
    {pending.map(p=><div className="act-confirm" key={p.id}><span><AlertTriangle size={16}/> {participants.find(x=>x.user_id===p.requester_id)?.display_name||'Un participante'} solicita confirmar una eliminación virtual</span><button className="btn primary" disabled={busy} onClick={()=>respondElimination(p.id,'confirmed')}><Check size={15}/> Confirmar</button><button className="btn outline" disabled={busy} onClick={()=>respondElimination(p.id,'rejected')}>Rechazar</button></div>)}
    <p className="small muted">Solicitudes pendientes: {eliminations.filter(e=>e.status==='pending').length} · confirmadas: {eliminations.filter(e=>e.status==='confirmed').length}</p>
   </section>}
   {activity.mode==='capture_flag'&&<section className="tile"><h3><Flag size={18}/> Captura de bandera virtual</h3><p className="small muted">Requiere dos equipos y una base GPS configurada por equipo. Para recoger o puntuar se verifica GPS compartido reciente y precisión estimada máxima de 60 m.</p>
    {flags.map(f=><div key={f.team_id} className="act-flag-row"><div><strong>Bandera: {teams.find(t=>t.id===f.team_id)?.name||activityTeams.find(t=>t.team_id===f.team_id)?.side||'Equipo'}</strong><small>{f.status==='carried'?'En traslado virtual':'En la base'}{f.carrier_id?' · Portador: '+(participants.find(p=>p.user_id===f.carrier_id)?.display_name||'Participante'):''}</small></div>{isActive&&myParticipant?.status==='active'&&myTeamId!==f.team_id&&<>{f.status==='base'?<button className="btn outline" disabled={busy||!sharing} onClick={()=>flagAction(f.team_id,'pickup')}>Recoger</button>:f.carrier_id===user.id?<button className="btn primary" disabled={busy||!sharing} onClick={()=>flagAction(f.team_id,'score')}>Entregar en mi base</button>:null}</>}</div>)}
    {isOrganizer&&isActive&&<button className="btn outline" disabled={busy} onClick={()=>{if(window.confirm('¿Devolver todas las banderas a su base?'))organizerAction('reset_flags')}}>Reiniciar banderas</button>}
   </section>}
   <section className="tile"><div className="act-history-title"><h3><Radio size={18}/> Registro de operaciones</h3><button className="btn outline" onClick={onOpenChat}><MessagesSquare size={16}/> Abrir mensajes</button></div><p className="small muted">Los mensajes, fotografías y audios se siguen compartiendo en los chats seguros de cada equipo.</p>{events.length?events.slice(0,30).map(e=><div className="act-history" key={e.id}><span>{e.event_type.replace(/_/g,' ')} · {e.detail}</span><small>{dateLabel(e.created_at)}</small></div>):<p className="small muted">Todavía no hay eventos registrados.</p>}</section>
  </>}</div></div>
  {showForm&&<div className="act-modal-backdrop" role="presentation"><form className="act-modal" onSubmit={saveActivity}><h2>{editId?'Editar actividad':'Nueva actividad'}</h2><p className="muted small">Las modalidades son actividades coordinadas entre personas, no videojuegos.</p><label>Nombre<input required minLength={4} maxLength={90} value={form.title} onChange={e=>setForm(o=>({...o,title:e.target.value}))}/></label><label>Descripción<textarea rows={3} maxLength={1000} value={form.description} onChange={e=>setForm(o=>({...o,description:e.target.value}))}/></label><label>Modalidad<select value={form.mode} onChange={e=>setForm(o=>({...o,mode:e.target.value}))}>{Object.entries(modes).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>{!editId&&<label>Equipo organizador<select required value={createTeam} onChange={e=>setCreateTeam(e.target.value)}>{myOwners.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}<div className="act-form-grid"><label>Fecha prevista<input type="datetime-local" value={form.starts_at} onChange={e=>setForm(o=>({...o,starts_at:e.target.value}))}/></label><label>Duración (minutos)<input type="number" min={15} max={480} required value={form.duration_minutes} onChange={e=>setForm(o=>({...o,duration_minutes:e.target.value}))}/></label></div>{form.mode==='direct_elimination'&&<label>Reincorporación tras eliminación<select value={form.respawn_seconds} onChange={e=>setForm(o=>({...o,respawn_seconds:Number(e.target.value)}))}><option value={0}>Sin reaparición automática</option><option value={30}>A los 30 segundos</option><option value={60}>A los 60 segundos</option><option value={120}>A los 120 segundos</option></select></label>}<p className="small muted">El inicio será manual por el organizador; la fecha no activa GPS ni inicia la actividad automáticamente.</p><div className="act-inline"><button className="btn primary" disabled={busy}>Guardar actividad</button><button className="btn outline" type="button" onClick={()=>setShowForm(false)}>Cancelar</button></div></form></div>}
 </div>;
}