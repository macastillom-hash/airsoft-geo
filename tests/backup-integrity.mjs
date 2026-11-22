import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const sha=v=>createHash('sha256').update(v).digest('hex');
const temp=await mkdtemp(path.join(tmpdir(),'airsoft-backup-test-'));
const verify=()=>spawnSync(process.execPath,
 [new URL('../scripts/verify-backup.mjs',import.meta.url).pathname,temp],
 {encoding:'utf8'});
try{
 await writeFile(path.join(temp,'postgres.dump'),Buffer.from('PGDMP-mock-data'));
 await mkdir(path.join(temp,'objects','team-media'),{recursive:true});
 const bytes=Buffer.from('prueba de archivo privado');
 const local='objects/team-media/'+sha('team-media\0test/file.png')+'.bin';
 await writeFile(path.join(temp,local),bytes);
 const manifest={format:'airsoft-geo-storage-v1',created_at:new Date().toISOString(),
  buckets:['team-media','direct-media','profile-avatars'],files:[
   {bucket:'team-media',key:'test/file.png',local,bytes:bytes.length,sha256:sha(bytes)}
  ],total_objects:1,total_bytes:bytes.length};
 await writeFile(path.join(temp,'storage-manifest.json'),JSON.stringify(manifest));
 const valid=verify();
 assert.equal(valid.status,0,'Copia válida rechazada: '+valid.stderr);
 const data=JSON.parse(valid.stdout);
 assert.equal(data.storage_objects,1);
 await writeFile(path.join(temp,local),Buffer.from('datos manipulados'));
 assert.notEqual(verify().status,0,'Los cambios de archivos deben detectarse');
 await writeFile(path.join(temp,local),bytes);
 manifest.files[0].local='../escape.bin';
 await writeFile(path.join(temp,'storage-manifest.json'),JSON.stringify(manifest));
 assert.notEqual(verify().status,0,'Debe rechazarse path traversal');
 console.log('Backup integrity: valid copy, tampering and path traversal checks OK');
}finally{
 await rm(temp,{recursive:true,force:true});
}
