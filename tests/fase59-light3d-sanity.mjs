import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {light3DStyle,LIGHT_3D_VECTOR_URL} from '../src/light3DStyle.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
assert.equal(light3DStyle.version,8);
assert.equal(LIGHT_3D_VECTOR_URL,'https://tiles.openfreemap.org/planet');
const sourceKeys=Object.keys(light3DStyle.sources);
assert.deepEqual(sourceKeys,['airsoft-vector'],'El 3D no debe descargar fuentes vectoriales duplicadas.');
assert.ok(light3DStyle.layers.length<=6,'Evitar estilos pesados en celulares.');
assert.ok(light3DStyle.layers.some(l=>l.type==='fill-extrusion'&&l['source-layer']==='building'));
assert.ok(light3DStyle.layers.some(l=>l['source-layer']==='transportation'));
assert.ok(light3DStyle.layers.every(l=>!l.source||l.source==='airsoft-vector'));
const map=read('src/Map3D.jsx');
const shell=read('src/UnifiedMap.jsx');
const camera=read('src/CameraNavigation.jsx');
for(const value of [
 'style:light3DStyle','antialias:false','renderWorldCopies:false','fadeDuration:0',
 'maxCanvasSize:[1280,1280]','maxTileCacheSize:16',
 'Math.min(window.devicePixelRatio||1,1.25)',
 'probe.getExtension(\'WEBGL_lose_context\')?.loseContext()',
 'clearInterval(stutterMonitor)','delta>4500',
 'if(document.visibilityState!==\'visible\'){lastCheck=now;return;}',
 "routeArrows(route.points,120,16)",
 "map.setLayoutProperty('airsoft-buildings-3d','visibility',next?'visible':'none')"
])assert.ok(map.includes(value),'3D safeguard missing: '+value);
assert.ok(!map.includes("style:streetStyle"));
assert.ok(!map.includes("addSource('airsoft-building-vector'"));
assert.ok(!map.includes("antialias:true"));
assert.ok(!map.includes("routeArrows(route.points,85,32)"));
assert.ok(shell.includes("const [mapStyle,setMapStyle]=useState('street')"),
 'La vista 2D debe seguir siendo la predeterminada.');
assert.ok(shell.includes("onUnsupported={fallback3D}"),
 'Si falla 3D se debe restaurar 2D.');
assert.ok(camera.includes('navigator.mediaDevices.getUserMedia') &&
 camera.includes('stream.getTracks().forEach(track=>track.stop())'),
 'La cámara en vivo debe permanecer disponible y privada.');
console.log('V5.9 PASS: 3D móvil ligero, fuente única, memoria acotada, recuperación 2D y cámara intacta.');
