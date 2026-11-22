import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map3d=read('src/Map3D.jsx');
const shell=read('src/UnifiedMap.jsx');
const nav=read('src/MapNavigation.jsx');
const css=read('src/map3d.css');
assert.ok(shell.includes("const [mapStyle,setMapStyle]=useState('street')"),
 'El mapa 2D debe seguir siendo la vista predeterminada.');
assert.ok(map3d.includes("style:streetStyle") &&
 map3d.includes("https://tiles.openfreemap.org/styles/liberty"),
 'El 3D debe usar calles vectoriales gratuitas como base.');
assert.ok(!map3d.includes("style:baseStyle")&&
 !map3d.includes("sourceDataType!=='content'"),
 'El 3D ya no debe depender de la detección del antiguo satélite obligatorio.');
assert.ok(map3d.includes("function toggleSatellite()")&&
 map3d.includes("img.onload=()=>finish(true)")&&
 map3d.includes("img.onerror=()=>finish(false)")&&
 map3d.includes("setTimeout(()=>finish(false),7000)"),
 'Satélite solo con petición del usuario y diagnóstico de conexión.');
assert.ok(map3d.includes("setLayoutProperty(layer,'visibility','none')") &&
 map3d.includes("setInfo('El satélite no está disponible ahora."),
 'Fallar con satélite no debe dejar en blanco el 3D de calles.');
assert.ok(map3d.includes("type:'raster-dem'") &&
 map3d.includes("encoding:'terrarium'") &&
 map3d.includes("current.setTerrain({source:'airsoft-terrain-dem',exaggeration:1});"),
 'Relieve opcional de datos abiertos.');
assert.ok(map3d.includes("if(terrainEnabled){") &&
 map3d.includes("current.setTerrain(null);"),
 'El relieve debe poder desactivarse.');
assert.ok(css.includes('.v56-3d-tools'));
assert.ok(map3d.includes("routeArrows(route.points,85,32)") &&
 map3d.includes("if(showTeammates)teammates.forEach") &&
 map3d.includes("onUnsupported('Se perdió la aceleración gráfica."),
 'Rutas, compañeros y recuperación WebGL deben conservarse.');
assert.ok(nav.includes("aria-label=\"Abrir cámara en vivo\"")&&
 nav.includes("destination&&<button")&&
 nav.includes("className=\"v56-open-camera\""),
 'Cámara accesible en el encabezado y dentro del panel del destino.');
assert.ok(!map3d.includes('GOOGLE_MAPS_API_KEY') &&
 !map3d.includes('maps.googleapis.com'),
 'Sin APIs cartográficas comerciales de facturación.');
console.log('V5.8 PASS: 2D por defecto, vector 3D, satélite opcional, relieve y cámara accesible.');
