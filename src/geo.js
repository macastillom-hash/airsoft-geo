export function metersBetween(a,b){
  const d2r=Math.PI/180; const dlat=(b.lat-a.lat)*d2r; const dlon=(b.lng-a.lng)*d2r;
  const s=Math.sin(dlat/2)**2+Math.cos(a.lat*d2r)*Math.cos(b.lat*d2r)*Math.sin(dlon/2)**2;
  return Math.round(6371000*2*Math.asin(Math.min(1,Math.sqrt(s))));
}
export function distanceLabel(m){return m==null?'—':m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`}
export function isValidLocation(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180}
