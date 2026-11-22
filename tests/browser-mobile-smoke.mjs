/**
 * Browser integration smoke. No production credentials or database used.
 * Runs on a local Vite server and mock Supabase responses using a mobile browser.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,devices} from 'playwright';

const port=4717;
const host='http://127.0.0.1:'+port;
const fakeUrl='https://test-airsoft.supabase.co';
const fakeUser={
 id:'00000000-0000-4000-8000-000000000042',aud:'authenticated',role:'authenticated',
 email:'test@example.invalid',app_metadata:{provider:'email',providers:['email']},
 user_metadata:{alias:'Prueba'},created_at:'2026-01-01T00:00:00Z',
 updated_at:'2026-01-01T00:00:00Z'
};
function mockPolyline(points){
 let lat=0,lng=0,out='';
 for(const [a,b] of points){
  const la=Math.round(a*1e6),lo=Math.round(b*1e6);
  for(let value of [la-lat,lo-lng]){
   let n=value<0?~(value<<1):value<<1;
   while(n>=32){out+=String.fromCharCode(((n&31)|32)+63);n>>>=5}
   out+=String.fromCharCode(n+63);
  }
  lat=la;lng=lo;
 }
 return out;
}
const mockRouteGeometry=[[4.445,-75.24],[4.4455,-75.24],[4.446,-75.24],
 [4.446,-75.2395],[4.446,-75.239]];
const vite=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port',String(port),'--strictPort'],{
 env:{...process.env,VITE_SUPABASE_URL:fakeUrl,VITE_SUPABASE_ANON_KEY:'public-test-anon-key'},
 stdio:['ignore','pipe','pipe']
});
let logs='';
vite.stderr.on('data',b=>logs+=String(b));
let browser;
async function serverReady(){
 for(let i=0;i<90;i++){
  if(vite.exitCode!==null)throw Error('Vite exited: '+logs);
  try{const r=await fetch(host);if(r.ok)return}catch{}
  await new Promise(r=>setTimeout(r,400));
 }
 throw Error('Vite did not become ready: '+logs);
}
async function makePage(seedSession){
 const context=await browser.newContext({...devices['Pixel 7'],locale:'es-CO'});
 if(seedSession){
  await context.addInitScript(({user,ref})=>{
   const session={
    access_token:'local-mock-token',refresh_token:'local-refresh-token',token_type:'bearer',
    expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user
   };
   localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(session));
  },{user:fakeUser,ref:'test-airsoft'});
 }
 await context.route(fakeUrl+'/**',async route=>{
  const req=new URL(route.request().url());
  if(req.pathname.includes('websocket'))return route.abort();
  if(req.pathname==='/auth/v1/user')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fakeUser)});
  if(req.pathname.startsWith('/rest/v1/profiles')&&req.searchParams.get('id')?.startsWith('eq.')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    id:fakeUser.id,alias:'Prueba',discoverable:false,avatar_path:null,display_name:'Prueba',about_me:''
   })});
  }
  if(req.pathname.startsWith('/rest/v1/')){
   return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  }
  if(req.pathname.startsWith('/rest/v1/rpc/')){
   return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  }
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 return {page,context,errors};
}
try{
 await serverReady();
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 {
  const {page,context,errors}=await makePage(false);
  await page.goto(host,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(2500);
  const body=await page.locator('body').innerText();
  assert.ok(body.includes('Bienvenido de nuevo'),
   'Una sesión nueva debe mostrar login, no blanco. HTML='+body.slice(0,500)+' JS='+errors.join('\n').slice(0,1900));
  assert.equal(errors.filter(e=>/Uncaught|ReferenceError|TypeError|SyntaxError/.test(e)).length,0,errors.join('\n'));
  console.log('PASS: login rendered in Pixel 7');
  await context.close();
 }
 {
  const {page,context,errors}=await makePage(true);
  await context.grantPermissions(['geolocation'],{origin:host});
  await context.setGeolocation({latitude:4.445,longitude:-75.24,accuracy:12});
  await context.route('https://valhalla1.openstreetmap.de/**',async request=>{
   const response={trip:{summary:{length:0.24,time:195},legs:[{
    shape:mockPolyline(mockRouteGeometry),
    maneuvers:[
     {type:1,begin_shape_index:0,end_shape_index:2,instruction:'Camina hacia el norte.'},
     {type:10,begin_shape_index:2,end_shape_index:4,instruction:'Gira a la derecha.',
      verbal_pre_transition_instruction:'Gira a la derecha hacia el objetivo.'},
     {type:4,begin_shape_index:4,end_shape_index:4,instruction:'Llegaste al destino.'}
    ]}]}};
   await request.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  await page.goto(host,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(3800);
  const body=await page.locator('body').innerText();
  const serious=errors.filter(e=>/ReferenceError|TypeError|SyntaxError|rendered more hooks|Cannot access|React error/.test(e));
  assert.ok(body.includes('Mapa GPS')&&body.includes('Compartir GPS'),
   'Sesion restaurada NO muestra mapa. Body='+body.slice(0,700)+' JS_ERRORS='+errors.join('\n').slice(0,2600));
  assert.equal(serious.length,0,'JS errors on map: '+serious.join('\n'));
  console.log('PASS: logged-in mobile map rendered. Buttons and navigation present.');
  // V5.3: change maps without leaving the application or crashing the dashboard.
  await page.getByRole('button',{name:'Ver mapa 3D'}).click();
  await page.waitForTimeout(1700);
  assert.ok((await page.locator('body').innerText()).includes('Compartir GPS'),
   'Changing to 3D must not blank the mobile dashboard.');
  await page.getByRole('button',{name:'Ver calles'}).click();
  await page.locator('.leaflet-container').waitFor({timeout:8000});
  assert.ok((await page.locator('body').innerText()).includes('Mapa GPS'),
   'Returning to 2D must keep the GPS interface visible.');
  assert.equal(errors.filter(e=>/ReferenceError|SyntaxError|rendered more hooks/.test(e)).length,0,
   '3D switch errors: '+errors.join('\n').slice(0,2000));
  console.log('PASS: optional 3D switch and 2D fallback keep the mobile UI alive.');
  // V5.4: full mobile navigation flow, all inside the React map.
  await page.getByText('GPS disponible').first().waitFor({timeout:12000});
  await page.getByRole('button',{name:'Abrir o cerrar navegación'}).click();
  await page.getByRole('button',{name:/Elegir en mapa/}).click();
  const leaflet=page.locator('.leaflet-container');
  const rect=await leaflet.boundingBox();
  assert.ok(rect&&rect.width>200&&rect.height>250,'Leaflet must have tappable bounds');
  await leaflet.click({position:{x:Math.floor(rect.width*0.52),y:Math.floor(rect.height*0.38)},force:true});
  await page.getByRole('button',{name:/Cómo llegar aquí/}).waitFor({timeout:8000});
  await page.getByRole('button',{name:/Cómo llegar aquí/}).click();
  await page.getByRole('button',{name:'Iniciar navegación guiada'}).waitFor({timeout:8000});
  await page.getByRole('button',{name:'Iniciar navegación guiada'}).click();
  await page.locator('.v54-turn-panel').waitFor({timeout:8000});
  assert.ok((await page.locator('.v54-turn-panel').innerText()).includes('Gira a la derecha'),
   'Guided UI should use actual mocked Valhalla maneuver, not only bearing');
  await page.getByRole('button',{name:'Ver mapa 3D'}).click();
  await page.waitForTimeout(900);
  assert.ok(await page.locator('.v54-turn-panel').isVisible(),
   'Guided turn panel must survive switching to 3D');
  await page.getByRole('button',{name:'Ver calles'}).click();
  await page.locator('.leaflet-container').waitFor({timeout:8000});
  await page.getByRole('button',{name:'Finalizar guía'}).click();
  assert.equal(await page.locator('.v54-turn-panel').count(),0);
  console.log('PASS: GPS route, actual next turn, start/stop, 3D continuity and no external navigation.');
  const fatal=errors.filter(e=>/ReferenceError|TypeError|SyntaxError|rendered more hooks/i.test(e));
  assert.equal(fatal.length,0,fatal.join('\n').slice(0,1600));

  await context.close();
 }
}finally{
 if(browser)await browser.close();
 vite.kill('SIGTERM');
}
