// Preferencias por usuario y dispositivo. Nunca se comparten con terceros.
export const defaults = {vibration:true,sound:false,system:true};
export const patterns = {
  team_message:[110], direct_message:[110,90,110],
  team_alert:[200,100,200,100,240]
};
export function loadNotificationSettings(userId){
  try {return {...defaults,...JSON.parse(localStorage.getItem(`airsoft-alerts:${userId}`)||'{}')}}
  catch{return {...defaults}}
}
export function saveNotificationSettings(userId,settings){
  try{localStorage.setItem(`airsoft-alerts:${userId}`,JSON.stringify(settings))}catch{}
}
export function vibratePattern(type='team_message'){
  if(typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return false;
  try{return navigator.vibrate(patterns[type]||patterns.team_message)}catch{return false}
}
export function playNotificationSound(){
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    const ctx=new Context();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=740;
    gain.gain.setValueAtTime(0.045,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.16);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start();osc.stop(ctx.currentTime+0.17);osc.onended=()=>ctx.close();
  }catch{/* Un navegador puede bloquear audio automático. */}
}
