export const validCoordinate=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&
 Math.abs(lat)<=90&&Math.abs(lng)<=180;
export function headingTo(a,b){
 if(!a||!b||!validCoordinate(a.lat,a.lng)||!validCoordinate(b.lat,b.lng))return null;
 const radians=Math.PI/180;
 const from=a.lat*radians,to=b.lat*radians,delta=(b.lng-a.lng)*radians;
 const y=Math.sin(delta)*Math.cos(to);
 const x=Math.cos(from)*Math.sin(to)-Math.sin(from)*Math.cos(to)*Math.cos(delta);
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
export function bearingLabel(bearing){
 if(!Number.isFinite(bearing))return '—';
 return ['N','NE','E','SE','S','SO','O','NO'][Math.round(bearing/45)%8];
}
export function externalWalkingDirections(dest){
 if(!dest||!validCoordinate(dest.lat,dest.lng))return '';
 const point=String(dest.lat)+','+String(dest.lng);
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(point)+'&travelmode=walking';
}