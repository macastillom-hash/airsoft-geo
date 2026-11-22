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
  // V5.6: elegir un destino y abrir/cerrar cámara sin solicitar permisos.
  await page.locator('.v52-nav-title').click();
  await page.getByRole('button',{name:'Elegir en mapa'}).click();
  await page.locator('.leaflet-container').click({position:{x:110,y:120}});
  await page.locator('.v52-destination-line').waitFor({timeout:8000});
  await page.getByRole('button',{name:'Cámara en vivo'}).click();
  await page.getByRole('dialog',{name:'Orientación con cámara en vivo'}).waitFor({timeout:12000});
  assert.ok((await page.locator('.v56-camera').innerText()).includes('Activar cámara'),
   'La cámara no debe solicitar permiso sin pulsación explícita.');
  await page.getByRole('button',{name:'Cerrar cámara y volver al mapa'}).click();
  await page.locator('.v56-camera').waitFor({state:'detached',timeout:8000});
  await page.locator('.leaflet-container').waitFor({timeout:8000});
  assert.equal(errors.filter(e=>/ReferenceError|TypeError|SyntaxError|React error/.test(e)).length,0,
   'Camera open/close regression: '+errors.join('\n').slice(0,2000));
  console.log('PASS: camera modal stays in Airsoft Geo, waits for consent and returns to 2D.');

  await context.close();
 }
 {
  const {page,context,errors}=await makePage(false);
  await page.goto(host+'/tests/browser-turn-guide.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('.v55-next-turn').waitFor({timeout:10000});
  assert.ok((await page.locator('.v55-next-turn').innerText()).includes('Gira a la derecha'),
   'Mobile turn-by-turn instruction must be rendered');
  const voiceButton=page.getByRole('button',{name:/Escuchar indicaciones/});
  assert.ok(await voiceButton.isVisible(),'Voice is an explicit optional control');
  if(await voiceButton.isEnabled()){
   await voiceButton.click();
   assert.equal(await page.getByRole('button',{name:/Voz activada/}).getAttribute('aria-pressed'),'true',
    'Voice must activate only via user gesture');
   const repeatButton=page.getByRole('button',{name:/Repetir indicación/});
   assert.ok(await repeatButton.isVisible(),'A user must be able to replay the current turn');
   await repeatButton.click();
  }
  const serious=errors.filter(e=>/ReferenceError|TypeError|SyntaxError|React error/.test(e));
  assert.equal(serious.length,0,'Turn guide browser errors: '+serious.join('\n'));
  console.log('PASS: mobile next-turn UI and opt-in speech control rendered without JS errors.');
  await context.close();
 }
}finally{
 if(browser)await browser.close();
 vite.kill('SIGTERM');
}
