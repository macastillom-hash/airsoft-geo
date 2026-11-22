import React from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import '../src/style.css';
import {Dashboard} from '../src/App.jsx';
import ErrorBoundary from '../src/ErrorBoundary.jsx';

// Ruta exclusivamente de prueba en Vite DEV; no se incorpora al build de producción.
const syntheticUser={id:'11111111-1111-4111-8111-111111111111',email:'smoke@example.invalid'};
function report(message,type='info'){
 const host=document.getElementById('smoke-notices');
 if(host)host.textContent=type+': '+String(message);
}
createRoot(document.getElementById('root')).render(
 <React.StrictMode><ErrorBoundary><Dashboard user={syntheticUser} notify={report}/></ErrorBoundary></React.StrictMode>
);
