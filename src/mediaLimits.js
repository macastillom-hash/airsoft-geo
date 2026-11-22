// Airsoft Geo: límites conservadores para permanecer en cuotas gratuitas.
// Se validan también en Storage (límite actual del servidor: 10 MB por objeto).
export const MB=1024*1024;
export const MAX_ORIGINAL_IMAGE=15*MB;
export const MEDIA_LIMITS={
 image:2*MB,
 audio:3*MB,
 video:6*MB,
 document:5*MB
};
export const MEDIA_TYPES=[
 'image/jpeg','image/png','image/webp',
 'audio/webm','audio/mpeg','audio/mp4','audio/ogg',
 'video/mp4','video/webm','application/pdf'
];
export function mediaKind(type){
 if(['image/jpeg','image/png','image/webp'].includes(type))return 'image';
 if(['audio/webm','audio/mpeg','audio/mp4','audio/ogg'].includes(type))return 'audio';
 if(['video/mp4','video/webm'].includes(type))return 'video';
 if(type==='application/pdf')return 'document';
 return null;
}
export function validateAttachment(file){
 if(!file)throw Error('Selecciona un archivo.');
 const kind=mediaKind(file.type);
 if(!kind)throw Error('Formato no permitido. Adjunta JPG, PNG, WebP, audio, MP4, WebM o PDF.');
 if(!Number.isFinite(file.size)||file.size<=0)throw Error('Archivo vacío o inválido.');
 const max=kind==='image'?MAX_ORIGINAL_IMAGE:MEDIA_LIMITS[kind];
 if(file.size>max)
  throw Error(kind==='image'?'La fotografía original supera 15 MB.':
   'El '+(kind==='video'?'video':kind==='audio'?'audio':'PDF')+
   ' supera el máximo gratuito de '+Math.round(max/MB)+' MB.');
 return kind;
}
const imageBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
async function resizeImage(file){
 if(typeof document==='undefined'||typeof Image==='undefined')
  throw Error('Este navegador no permite comprimir imágenes.');
 const url=URL.createObjectURL(file);
 let img;
 try{
  img=await new Promise((resolve,reject)=>{
   const element=new Image();
   element.onload=()=>resolve(element);
   element.onerror=()=>reject(Error('No se pudo abrir la fotografía para comprimirla.'));
   element.src=url;
  });
  if(img.naturalWidth*img.naturalHeight>35000000)
   throw Error('La fotografía tiene una resolución excesiva.');
  const factor=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('No se pudo iniciar la compresión en este dispositivo.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let best=null;
  for(const quality of [0.82,0.70,0.56]){
   const blob=await imageBlob(canvas,'image/webp',quality);
   if(!blob||blob.type!=='image/webp')break;
   if(!best||blob.size<best.size)best=blob;
   if(blob.size<=MEDIA_LIMITS.image)break;
  }
  if(!best||best.size>MEDIA_LIMITS.image)
   throw Error('No fue posible comprimir esta fotografía a 2 MB. Elige una más pequeña.');
  if(file.size<=MEDIA_LIMITS.image&&file.size<=best.size)return file;
  return new File([best],(file.name||'imagen').replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});
 }finally{
  URL.revokeObjectURL(url);
 }
}
export async function prepareAttachment(file){
 const kind=validateAttachment(file);
 if(kind!=='image')return file;
 // Evita convertir archivos pequeños si ya caben en la cuota.
 if(file.size<=750*1024)return file;
 return resizeImage(file);
}
