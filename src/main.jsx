import React from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import App from './App.jsx';
class AppErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={crashed:false};}
 static getDerivedStateFromError(){return {crashed:true}}
 componentDidCatch(error,info){console.error('Airsoft Geo: error al dibujar la interfaz',error,info.componentStack)}
 render(){
  if(!this.state.crashed)return this.props.children;
  return <main role="alert" style={{minHeight:'100dvh',display:'grid',placeContent:'center',
   gap:15,textAlign:'center',padding:25,fontFamily:'system-ui',color:'#193c52',background:'#f5f8fc'}}>
   <h1 style={{fontSize:23,margin:0}}>No se pudo mostrar Airsoft Geo</h1>
   <p style={{maxWidth:420,lineHeight:1.6,margin:0}}>Se detectó un error de visualización. Tu cuenta y tus datos no se han eliminado. Puedes recargar la aplicación.</p>
   <button style={{padding:14,border:0,borderRadius:10,background:'#147cf5',color:'white',
    fontWeight:700,fontSize:15,cursor:'pointer'}} onClick={()=>window.location.reload()}>
    Recargar aplicación</button>
  </main>;
 }
}
createRoot(document.getElementById('root')).render(
 <React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>
);

// Registro liviano del Service Worker. No intercepta peticiones de la app.
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/notification-sw.js').catch(()=>{});});}
