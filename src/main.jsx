import React from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);

// Registro liviano del Service Worker. No intercepta peticiones de la app.
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/notification-sw.js').catch(()=>{});});}
