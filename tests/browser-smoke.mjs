import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SMOKE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,
 geolocation:{latitude:4.445,longitude:-75.242,accuracy:15},permissions:['geolocation']});
const errors=[];
const consoleErrors=[];
page.on('pageerror',error=>errors.push(error?.message||String(error)));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
try{
 await page.goto(base+'/tests/browser-smoke.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.v52-map-topcontrols').waitFor({timeout:18000});
 assert.equal(await page.getByRole('alert').filter({hasText:'Airsoft Geo no pudo mostrar'}).count(),0,
  'The React ErrorBoundary should not appear');
 await page.getByRole('button',{name:/Compartir GPS/}).first().waitFor();
 await page.getByRole('button',{name:/Permitir que me encuentren/}).first().waitFor();
 assert.ok(await page.locator('.leaflet-container').isVisible(),'Leaflet map must mount');
 const metrics=await page.evaluate(()=>{
  const map=document.querySelector('.v5-map-shell');
  const style=window.getComputedStyle(map);
  return {height:map.getBoundingClientRect().height,vh:window.innerHeight,
   display:style.display};
 });
 assert.ok(metrics.height>metrics.vh*0.48,'Mobile map must occupy most of available view: '+JSON.stringify(metrics));
 await page.getByRole('button',{name:'Abrir o cerrar navegación'}).click();
 await page.getByRole('button',{name:/Elegir en mapa/}).click();
 const map=page.locator('.leaflet-container');
 const bounds=await map.boundingBox();
 if(bounds)await page.mouse.click(bounds.x+bounds.width*0.50,bounds.y+bounds.height*0.32);
 await page.getByText('Punto elegido en mapa').first().waitFor({timeout:7000});
 await page.getByRole('button',{name:'Ver satélite'}).click();
 await page.locator('.leaflet-tile-pane').waitFor();
 assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
 console.log('V5.2 BROWSER SMOKE PASSED: real React dashboard mounted, map visible, navigation and satellite controls work.');
 console.log('Map metrics:',JSON.stringify(metrics));
}catch(error){
 console.error('BROWSER SMOKE FAILED:',error.message);
 console.error('PAGE ERRORS:',JSON.stringify(errors));
 console.error('CONSOLE ERRORS:',JSON.stringify(consoleErrors.slice(-12)));
 console.error('BODY:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,1800));
 await page.screenshot({path:'/tmp/airsoft-v52-smoke-failure.png',fullPage:true}).catch(()=>{});
 process.exitCode=1;
}finally{
 await page.close();
 await browser.close();
}
