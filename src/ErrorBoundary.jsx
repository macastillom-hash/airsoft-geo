import React from 'react';

/** Fallback visible para evitar una pantalla en blanco por excepciones de renderizado. */
export default class ErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={error:null};}
 static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error,info){
  // No se envían datos del usuario ni credenciales a servicios externos.
  console.error('[Airsoft Geo] Error en la interfaz:',error,info.componentStack);
 }
 render(){
  if(!this.state.error)return this.props.children;
  return <main role="alert" style={{
   minHeight:'100vh',padding:'clamp(25px,5vw,65px)',background:'#f2f6fb',color:'#173c55',
   display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',
   fontFamily:'system-ui,sans-serif',gap:'12px'
  }}>
   <h1 style={{fontSize:'26px',margin:0}}>Airsoft Geo no pudo mostrar esta pantalla</h1>
   <p style={{maxWidth:'540px',lineHeight:1.5}}>Se detectó un error de interfaz. Tu cuenta, mensajes y datos no fueron eliminados. Puedes recargar o informar el código del error.</p>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:'12px',maxWidth:'620px',
    background:'#e7edf4',padding:'12px',borderRadius:'9px',width:'100%'}}>
    {String(this.state.error?.message||'Error desconocido').slice(0,500)}
   </pre>
   <button onClick={()=>window.location.reload()} style={{background:'#136cbb',color:'white',
    border:0,borderRadius:'8px',fontWeight:700,padding:'12px 22px'}}>Recargar aplicación</button>
  </main>;
 }
}