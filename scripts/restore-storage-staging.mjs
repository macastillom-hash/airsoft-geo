/**
 * Restauración de medios SOLO a un proyecto Supabase de prueba distinto.
 * NO restaura Auth ni PostgreSQL ni modifica el proyecto de producción.
 * Usar únicamente después de inspeccionar el respaldo local desencriptado.
 */
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const PROD_REF='lfkyznzwvgrsnmaukigi';
const root=process.argv[2];
if(!root)throw Error('Uso: node scripts/restore-storage-staging.mjs <carpeta-de-copia-descifrada>');
const url=process.env.STAGING_SUPABASE_URL,key=process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Faltan STAGING_SUPABASE_URL y STAGING_SUPABASE_SERVICE_ROLE_KEY');
const hostname=new URL(url).hostname;
if(!hostname.endsWith('.supabase.co')||hostname===PROD_REF+'.supabase.co'||
 url===process.env.SUPABASE_URL)throw Error('No se permite restaurar a producción ni a un dominio no verificado');
if(process.env.I_CONFIRM_STAGING_RESTORE!=='YES')throw Error('Establece I_CONFIRM_STAGING_RESTORE=YES después de revisar el proyecto de prueba');
const manifest=JSON.parse(await readFile(path.join(root,'storage-manifest.json'),'utf8'));
if(manifest.format!=='airsoft-geo-storage-v1'||!Array.isArray(manifest.files))throw Error('Manifiesto inválido');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
for(const bucket of ['team-media','direct-media']){
 const {data:existing,error:readError}=await client.storage.getBucket(bucket);
 if(readError && !String(readError.message).toLowerCase().includes('not found'))
  throw Error('No se pudo consultar el bucket de prueba');
 if(!existing){
  const {error}=await client.storage.createBucket(bucket,{public:false,fileSizeLimit:10485760});
  if(error)throw Error('No se pudo crear un bucket privado de prueba: '+error.message);
 }else if(existing.public)throw Error('Bucket de prueba inesperadamente público');
}
let checked=0;
for(const row of manifest.files){
 if(!['team-media','direct-media'].includes(row.bucket)||!row.key||
 !/^objects\/(team-media|direct-media)\/[a-f0-9]{64}\.bin$/.test(row.local))
  throw Error('Objeto de respaldo no válido');
 const rootAbs=path.resolve(root),full=path.resolve(rootAbs,row.local);
 if(!full.startsWith(rootAbs+path.sep))throw Error('Ruta inesperada');
 const bytes=await readFile(full);
 const actual=createHash('sha256').update(bytes).digest('hex');
 if(actual!==row.sha256||bytes.length!==row.bytes)throw Error('Checksum inválido; no se restaura');
 const {error}=await client.storage.from(row.bucket).upload(row.key,bytes,{
  upsert:false,contentType:row.content_type||'application/octet-stream'});
 if(error)throw Error('Error restaurando objeto de prueba: '+error.message);
 const {data:copied,error:checkError}=await client.storage.from(row.bucket).download(row.key);
 if(checkError||!copied)throw Error('No se pudo verificar el objeto restaurado');
 const received=createHash('sha256').update(Buffer.from(await copied.arrayBuffer())).digest('hex');
 if(received!==actual)throw Error('Restauración con checksum distinto');
 checked++;
}
if(checked!==manifest.total_objects)throw Error('El conteo de objetos no coincide');
console.log('Storage de prueba verificado: '+checked+' archivos. Producción no se modificó.');
