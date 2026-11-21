/**
 * Verificación sin acceso a internet de la copia PostgreSQL + Storage.
 * No restaura ni escribe datos de producción.
 */
import {readFile,stat,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Uso: node scripts/verify-backup.mjs <directorio-extraído>');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
async function shaFile(filename){const h=createHash('sha256');for await(const block of createReadStream(filename))h.update(block);return h.digest('hex');}
const mustSha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const raw=await readFile(path.join(root,'storage-manifest.json'),'utf8');
const manifest=JSON.parse(raw);
if(manifest.format!=='airsoft-geo-storage-v1'||!Array.isArray(manifest.files)||
 !Array.isArray(manifest.buckets)||manifest.buckets.length!==2)throw Error('Manifiesto de Storage inválido');
if(!manifest.buckets.includes('team-media')||!manifest.buckets.includes('direct-media'))throw Error('Falta un bucket obligatorio');
if(manifest.total_objects!==manifest.files.length)throw Error('Conteo inconsistente de objetos');
let nbytes=0;
const keys=new Set(),locals=new Set();
for(const obj of manifest.files){
 if(!manifest.buckets.includes(obj.bucket)||typeof obj.key!=='string'||!obj.key||
 typeof obj.local!=='string'||!obj.local||keys.has(obj.bucket+'\0'+obj.key)||locals.has(obj.local)||
 !mustSha(obj.sha256)||!Number.isSafeInteger(obj.bytes)||obj.bytes<0)throw Error('Entrada inválida o duplicada');
 keys.add(obj.bucket+'\0'+obj.key);locals.add(obj.local);
 const local=path.resolve(root,obj.local);
 if(!local.startsWith(root+path.sep))throw Error('Ruta del respaldo fuera del directorio');
 const contents=await readFile(local);
 if(contents.length!==obj.bytes||sha(contents)!==obj.sha256)throw Error('Archivo alterado en el respaldo: '+obj.bucket);
 nbytes+=contents.length;
}
if(nbytes!==manifest.total_bytes)throw Error('Total de bytes inconsistente');
const database=path.join(root,'postgres.dump');
const stats=await stat(database);
if(stats.size<5)throw Error('Dump de PostgreSQL vacío');
const handle=await open(database,'r');
const header=Buffer.alloc(5);
try{await handle.read(header,0,5,0)}finally{await handle.close()}
const signature=header.toString();
if(signature!=='PGDMP')throw Error('El archivo no parece ser un pg_dump custom');
const result={format:'airsoft-geo-backup-verified-v1',verified_at:new Date().toISOString(),
 database_bytes:stats.size,database_sha256:await shaFile(database),
 storage_objects:manifest.total_objects,storage_bytes:nbytes};
console.log(JSON.stringify(result));
