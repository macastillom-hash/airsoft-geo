import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map3d=read('src/Map3D.jsx');
const shell=read('src/UnifiedMap.jsx');
const css=read('src/map3d.css');
assert.ok(shell.includes("const [mapStyle,setMapStyle]=useState('street')"),
 'El mapa 2D debe seguir siendo la vista predeterminada.');
assert.ok(map3d.includes("event.isSourceLoaded")&&map3d.includes("'idle'")&&!map3d.includes("!event.tile"),
 'No declarar satélite listo antes de que MapLibre indique que terminó de cargar la fuente.');
assert.ok(!map3d.includes("!streetReady){"),
 'La recuperación del satélite no debe bloquearse si calles ya cargó.');
assert.ok(map3d.includes("map.setLayoutProperty('airsoft-satellite-layer','visibility','visible');") &&
 map3d.includes("map.setLayoutProperty('airsoft-streets-layer','visibility','visible');"),
 'El satélite debe mantenerse disponible debajo del mapa de calles.');
assert.ok(map3d.includes("setMode('satellite');setInfo('');"),
 'Se debe recuperar automáticamente el mapa satelital.');
assert.ok(map3d.includes("type:'raster-dem'") &&
 map3d.includes("encoding:'terrarium'") &&
 map3d.includes("current.setTerrain({source:'airsoft-terrain-dem',exaggeration:1});"),
 'El relieve opcional debe utilizar teselas de elevación abiertas.');
assert.ok(map3d.includes("if(terrainEnabled){") && map3d.includes("current.setTerrain(null);"),
 'El usuario debe poder desactivar el relieve.');
assert.ok(map3d.includes("disabled={!ready} aria-pressed={terrainEnabled}"),
 'No habilitar relieve mientras el motor no esté listo.');
assert.ok(css.includes('.v56-3d-tools'));
assert.ok(map3d.includes("routeArrows(route.points,85,32)") &&
 map3d.includes("if(showTeammates)teammates.forEach") &&
 map3d.includes("onUnsupported('Se perdió la aceleración gráfica."),
 'No eliminar las rutas, compañeros ni la recuperación ante pérdida de WebGL.');
assert.ok(!map3d.includes('GOOGLE_MAPS_API_KEY') &&
 !map3d.includes('maps.googleapis.com'),
 'No introducir servicios cartográficos de facturación.');
console.log('V5.5 PASS: 2D default, satellite recovery, optional open terrain, privacy and 3D safeguards.');
