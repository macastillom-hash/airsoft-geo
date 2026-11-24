import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {validCoordinate} from './navigationUtils.js';

// Destinos persistidos para integrantes de un equipo. No modifica GPS compartido.
export default function useSharedDestinations(teamId,userId,online=true){
 const [items,setItems]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const requestRef=useRef(0);
 const load=useCallback(async()=>{
  const seq=++requestRef.current;
  if(!teamId){setItems([]);setError('');return}
  if(!online)return;
  const {data,error:readError}=await supabase.from('team_destinations')
   .select('id,team_id,creator_id,name,latitude,longitude,created_at,expires_at')
   .eq('team_id',teamId).gt('expires_at',new Date().toISOString())
   .order('created_at',{ascending:false}).limit(40);
  if(seq!==requestRef.current)return;
  if(readError){setError('No se pudieron consultar los destinos del equipo.');return}
  setItems(data||[]);setError('');
 },[teamId,online]);
 useEffect(()=>{
  // Invalidar peticiones anteriores cuando cambia el equipo.
  setItems([]);setError('');
  void load();
  if(!teamId||!online)return;
  const channel=supabase.channel('shared-destinations-'+teamId)
   .on('postgres_changes',{event:'*',schema:'public',table:'team_destinations',filter:'team_id=eq.'+teamId},()=>void load())
   .subscribe();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);
  return()=>{++requestRef.current;clearInterval(interval);void supabase.removeChannel(channel)};
 },[teamId,online,load]);
 const publish=async(name,latitude,longitude)=>{
  if(!teamId||!userId)throw Error('Selecciona un equipo antes de compartir.');
  if(!online)throw Error('Sin conexión. No se publicó el destino.');
  const title=String(name||'').trim();
  if(title.length<1||title.length>100)throw Error('El nombre del destino debe tener entre 1 y 100 caracteres.');
  if(!validCoordinate(latitude,longitude))throw Error('Coordenadas inválidas para compartir.');
  setBusy(true);
  try{
   const {error:writeError}=await supabase.from('team_destinations').insert({
    team_id:teamId,creator_id:userId,name:title,latitude,longitude
   });
   if(writeError)throw Error('No fue posible compartir el destino: '+writeError.message);
   await load();
  }finally{setBusy(false)}
 };
 const remove=async(id)=>{
  if(!teamId||!id)throw Error('Destino inválido.');
  if(!online)throw Error('Sin conexión. No se pudo retirar el destino.');
  setBusy(true);
  try{
   const {data,error:writeError}=await supabase.from('team_destinations').delete()
    .eq('id',id).eq('team_id',teamId).select('id');
   if(writeError)throw Error('No fue posible retirar el destino: '+writeError.message);
   if(!data?.length)throw Error('El destino ya no existe o no tienes permiso para retirarlo.');
   await load();
  }finally{setBusy(false)}
 };
 return {items,busy,error,load,publish,remove};
}
