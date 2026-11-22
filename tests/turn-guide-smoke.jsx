import React from 'react';
import {createRoot} from 'react-dom/client';
import RouteGuideHud from '../src/RouteGuideHud.jsx';
import '../src/style.css';
const now=Date.now();
const route={calculatedAt:now,points:[[4.445,-75.24],[4.446,-75.24],[4.446,-75.239]],
 maneuvers:[
  {begin_shape_index:0,type:1,instruction:'Sal hacia el norte'},
  {begin_shape_index:1,type:10,instruction:'Gira a la derecha'},
  {begin_shape_index:2,type:4,instruction:'Llegaste al destino'}
 ]};
function Fixture(){
 const [offRoute,setOffRoute]=React.useState(false);
 const [rerouted,setRerouted]=React.useState(false);
 const [active,setActive]=React.useState(true);
 const [newGPS,setNewGPS]=React.useState(now);
 return <div style={{position:'relative',height:'620px',padding:'8px'}}>
  <button type="button" id="mock-reroute" onClick={()=>setOffRoute(v=>!v)}>Simular desvío</button>
  <button type="button" id="mock-old-gps" onClick={()=>setNewGPS(v=>v===now?now-40000:now)}>GPS antiguo</button>
  <button type="button" id="mock-stop" onClick={()=>setActive(v=>!v)}>Quitar ruta</button>
  <span data-testid="reroute-status">{rerouted?'Recalculación solicitada':''}</span>
  {active&&<RouteGuideHud me={{lat:offRoute?4.445:4.4455,lng:offRoute?-75.238:-75.24,
   accuracy:8,observedAt:newGPS}} route={route} connection={{state:'online'}}
   routeStatus="idle" onRecalculate={()=>setRerouted(true)}/>}
 </div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
