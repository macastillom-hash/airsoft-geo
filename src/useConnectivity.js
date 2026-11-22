import {useEffect,useRef,useState} from 'react';

/**
 * Verifica conectividad de la aplicación, no únicamente navigator.onLine.
 * No afirma que el backend Supabase esté disponible hasta intentar una operación.
 */
export default function useConnectivity(){
 const [connection,setConnection]=useState(()=>{
  const online=typeof navigator==='undefined'||navigator.onLine!==false;
  return {state:online?'online':'offline',checkedAt:0,reconnectedAt:0};
 });
 const previous=useRef(connection.state);
 useEffect(()=>{
  let active=true,controller=null;
  function change(state){
   if(!active)return;
   const reconnected=previous.current==='offline'&&state==='online';
   previous.current=state;
   setConnection(p=>({state,checkedAt:Date.now(),reconnectedAt:reconnected?Date.now():p.reconnectedAt}));
  }
  async function probe(){
   if(!active)return;
   if(navigator.onLine===false){controller?.abort();change('offline');return;}
   controller?.abort();
   const req=new AbortController();controller=req;
   const timeout=setTimeout(()=>req.abort(),7000);
   try{
    const url=new URL('/',window.location.origin);
    url.searchParams.set('healthcheck',String(Date.now()));
    const res=await fetch(url.toString(),{method:'HEAD',cache:'no-store',signal:req.signal});
    if(active&&controller===req)change(res.ok?'online':'offline');
   }catch{
    if(active&&controller===req)change('offline');
   }finally{clearTimeout(timeout)}
  }
  const onOffline=()=>{controller?.abort();change('offline')};
  const onOnline=()=>probe();
  const visibility=()=>{if(document.visibilityState==='visible')probe()};
  window.addEventListener('offline',onOffline);
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',visibility);
  probe();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')probe()},20000);
  return()=>{active=false;controller?.abort();clearInterval(interval);
   window.removeEventListener('offline',onOffline);window.removeEventListener('online',onOnline);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[]);
 return connection;
}
