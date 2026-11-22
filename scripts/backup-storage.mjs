/**
 * Airsoft Geo: backup de objetos privados Supabase Storage.
 * No expone claves ni medios en stdout. Ejecutar únicamente en entorno confiable.
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY como secretos de entorno.
 */
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw Error('Uso: node scripts/backup-storage.mjs <directorio-privado>');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url?.startsWith('https://')||!key)throw Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const sha=value=>createHash('sha256').update(value).digest('hex');
const buckets=['team-media','direct-media','profile-avatars'];
const files=[];
let totalBytes=0;
for(const bucket of buckets){
 // Comprobar que el bucket existe. Nunca interpretar ausencia como copia vacía.
 const {data:bucketInfo,error:bucketError}=await client.storage.getBucket(bucket);
 if(bucketError||!bucketInfo)throw Error('No se pudo consultar un bucket obligatorio ('+bucket+').');
 if(bucketInfo.public)throw Error('Bucket privado inesperadamente público: '+bucket);
 await mkdir(path.join(root,'objects',bucket),{recursive:true,mode:0o700});
 const seenFolders=new Set();
 async function walk(prefix='',depth=0){
  if(depth>50||seenFolders.has(prefix))throw Error('Recorrido anómalo de carpetas en Storage');
  seenFolders.add(prefix);
  let offset=0;
  for(;;){
   const {data,error}=await client.storage.from(bucket).list(prefix,{
    limit:100,offset,sortBy:{column:'name',order:'asc'}
   });
   if(error)throw Error('No se pudo listar Storage del bucket '+bucket+': '+error.message);
   const batch=data||[];
   for(const item of batch){
    if(!item?.name||item.name==='.'||item.name==='..'||item.name.includes('/')||item.name.includes('\\'))
     throw Error('Ruta inesperada detectada en listado de Storage');
    const storagePath=prefix?prefix+'/'+item.name:item.name;
    if(item.id===null||item.id===undefined){
     await walk(storagePath,depth+1);
     continue;
    }
    const {data:blob,error:downloadError}=await client.storage.from(bucket).download(storagePath);
    if(downloadError||!blob)throw Error('No se pudo descargar un objeto privado de Storage: '+bucket);
    const bytes=Buffer.from(await blob.arrayBuffer());
    const digest=sha(bytes);
    // Nunca derivar el nombre local directamente de la ruta provista por Storage.
    const localName=sha(bucket+'\0'+storagePath)+'.bin';
    const localRel='objects/'+bucket+'/'+localName;
    await writeFile(path.join(root,'objects',bucket,localName),bytes,{flag:'wx',mode:0o600});
    files.push({bucket,key:storagePath,local:localRel,bytes:bytes.length,sha256:digest,
      content_type:item.metadata?.mimetype||null});
    totalBytes+=bytes.length;
   }
   if(batch.length<100)break;
   offset+=batch.length;
  }
 }
 await walk();
}
files.sort((a,b)=>a.bucket.localeCompare(b.bucket)||a.key.localeCompare(b.key));
const result={format:'airsoft-geo-storage-v1',created_at:new Date().toISOString(),
 buckets,files,total_objects:files.length,total_bytes:totalBytes,
 warning:'Objetos físicos privados: requieren restauración separada de los metadatos de PostgreSQL.'};
await writeFile(path.join(root,'storage-manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('Storage privado respaldado: '+files.length+' objetos, '+totalBytes+' bytes.');