import React,{useEffect,useState} from 'react';
import {Camera,Trash2,Save,UserRound,ShieldCheck} from 'lucide-react';
import {supabase} from './supabase';
import './profile.css';

export function useAvatarUrl(avatarPath){
 const [url,setUrl]=useState('');
 useEffect(()=>{
  let live=true;
  if(!avatarPath){setUrl('');return;}
  async function signed(){
   const {data,error}=await supabase.storage.from('profile-avatars').createSignedUrl(avatarPath,300);
   if(live)setUrl(!error?data?.signedUrl||'':'');
  }
  signed();
  const id=setInterval(signed,240000);
  return()=>{live=false;clearInterval(id)};
 },[avatarPath]);
 return url;
}
export function ProfileAvatar({avatarPath,alias,size='md',className=''}) {
 const src=useAvatarUrl(avatarPath),[broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return <span className={'v5-avatar v5-avatar-'+size+' '+className}>
  {src&&!broken?<img src={src} alt={'Fotografía de '+(alias||'participante')} onError={()=>setBroken(true)}/>:
   <span aria-hidden="true">{(alias||'?').trim().slice(0,1).toUpperCase()||'?'}</span>}
 </span>;
}
const validPhotoTypes=['image/jpeg','image/png','image/webp'];
async function compressPhoto(file){
 if(!validPhotoTypes.includes(file.type))throw Error('Usa una fotografía JPG, PNG o WebP.');
 if(file.size>15*1024*1024)throw Error('La fotografía original debe ser inferior a 15 MB.');
 const temporary=URL.createObjectURL(file);
 let image;
 try{
  image=await new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo leer la imagen.'));
   img.src=temporary;
  });
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height)throw Error('Imagen no válida.');
  const scale=Math.min(1,512/Math.max(width,height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('El navegador no admite procesamiento de imágenes.');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
  if(blob?.type!=='image/webp'){
   ctx.fillStyle='#fff';
   ctx.globalCompositeOperation='destination-over';
   ctx.fillRect(0,0,canvas.width,canvas.height);
   blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
  }
  canvas.width=0;canvas.height=0;
  if(!blob||blob.size>3*1024*1024)throw Error('No se pudo comprimir la fotografía a menos de 3 MB.');
  return blob;
 }finally{URL.revokeObjectURL(temporary)}
}
export default function ProfileEditor({user,profile,onChange,notify}){
 const [alias,setAlias]=useState(profile?.alias||''),[displayName,setDisplayName]=useState(profile?.display_name||'');
 const [about,setAbout]=useState(profile?.about_me||''),[busy,setBusy]=useState(false);
 useEffect(()=>{setAlias(profile?.alias||'');setDisplayName(profile?.display_name||'');setAbout(profile?.about_me||'')},
 [profile?.alias,profile?.display_name,profile?.about_me]);
 async function save(e){
  e.preventDefault();
  if(!alias.trim()||alias.trim().length<3||alias.trim().length>40)return;
  setBusy(true);
  try{
   const {data,error}=await supabase.from('profiles').update({
    alias:alias.trim(),display_name:displayName.trim(),about_me:about.trim()
   }).eq('id',user.id).select('*').single();
   if(error)throw error;
   onChange(data);
   notify('Perfil actualizado correctamente.','success');
  }catch(e){notify('No se guardó el perfil: '+e.message,'error')}
  finally{setBusy(false)}
 }
 async function changePhoto(e){
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  setBusy(true);
  let newPath='';
  try{
   const blob=await compressPhoto(file);
   const extension=blob.type==='image/webp'?'webp':'jpg';
   newPath=user.id+'/'+crypto.randomUUID()+'.'+extension;
   const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(newPath,blob,{contentType:blob.type,upsert:false});
   if(uploadError)throw uploadError;
   const {data,error}=await supabase.from('profiles').update({avatar_path:newPath}).eq('id',user.id).select('*').single();
   if(error)throw error;
   const oldPath=profile?.avatar_path;
   onChange(data);
   if(oldPath&&oldPath.startsWith(user.id+'/')){
    await supabase.storage.from('profile-avatars').remove([oldPath]);
   }
   notify('Fotografía de perfil actualizada.','success');
  }catch(error){
   if(newPath)await supabase.storage.from('profile-avatars').remove([newPath]).catch(()=>{});
   notify('No se pudo actualizar la fotografía: '+error.message,'error');
  }finally{setBusy(false)}
 }
 async function removePhoto(){
  if(!profile?.avatar_path||!window.confirm('¿Quitar tu fotografía de perfil?'))return;
  setBusy(true);
  try{
   const oldPath=profile.avatar_path;
   const {data,error}=await supabase.from('profiles').update({avatar_path:null}).eq('id',user.id).select('*').single();
   if(error)throw error;
   onChange(data);
   await supabase.storage.from('profile-avatars').remove([oldPath]);
   notify('Fotografía retirada.','success');
  }catch(error){notify('No se pudo retirar la fotografía: '+error.message,'error')}
  finally{setBusy(false)}
 }
 return <div className="stack v5-profile">
  <section className="tile"><h3><Camera size={18}/> Fotografía personal</h3>
   <div className="v5-photo-row"><ProfileAvatar avatarPath={profile?.avatar_path} alias={profile?.alias} size="xl"/>
    <div className="v5-photo-controls"><p className="small muted">Imagen privada: solo tus compañeros autorizados podrán verla. JPG, PNG o WebP. Se ajustará a 512 píxeles.</p>
     <label className={'btn outline '+(busy?'disabled':'')}><Camera size={16}/> {profile?.avatar_path?'Cambiar fotografía':'Subir fotografía'}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={changePhoto} hidden/>
     </label>
     {profile?.avatar_path&&<button className="btn danger" disabled={busy} onClick={removePhoto}><Trash2 size={15}/> Eliminar</button>}
    </div></div>
  </section>
  <form className="tile" onSubmit={save}><h3><UserRound size={18}/> Datos de mi perfil</h3>
   <label>Alias operativo<input value={alias} onChange={e=>setAlias(e.target.value)} required minLength={3} maxLength={40}/></label>
   <label>Nombre visible (opcional)<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} placeholder="Nombre que deseas compartir con el equipo"/></label>
   <label>Acerca de mí (opcional)<textarea rows={3} value={about} onChange={e=>setAbout(e.target.value)} maxLength={240} placeholder="Breve descripción opcional"/></label>
   <label>Correo electrónico<input disabled readOnly value={user.email||''}/></label>
   <div className="v5-profile-footer"><p className="small muted"><ShieldCheck size={15}/> Los roles y permisos se asignan por equipo desde su administración.</p>
    <button className="btn primary" disabled={busy||!alias.trim()}><Save size={16}/> {busy?'Guardando…':'Guardar datos'}</button></div>
  </form>
 </div>;
}