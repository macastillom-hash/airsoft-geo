/**
 * Airsoft Geo: estilo 3D ligero para celulares.
 * Una sola fuente vectorial, sin hojas complejas, sprites ni peticiones de fuentes.
 * Los nombres de calles siguen disponibles en el mapa principal 2D.
 */
export const LIGHT_3D_VECTOR_URL='https://tiles.openfreemap.org/planet';
export const light3DStyle={
 version:8,
 name:'Airsoft Geo 3D ligero',
 sources:{
  'airsoft-vector':{type:'vector',url:LIGHT_3D_VECTOR_URL,
   attribution:'© OpenStreetMap contributors · OpenFreeMap'}
 },
 layers:[
  {id:'airsoft-background',type:'background',paint:{'background-color':'#e6e9e3'}},
  {id:'airsoft-landuse',type:'fill',source:'airsoft-vector',
   'source-layer':'landuse',
   paint:{'fill-color':'#cfdfc7','fill-opacity':0.65}},
  {id:'airsoft-water',type:'fill',source:'airsoft-vector',
   'source-layer':'water',
   paint:{'fill-color':'#91c9db'}},
  {id:'airsoft-road-outline',type:'line',source:'airsoft-vector',
   'source-layer':'transportation',layout:{'line-cap':'round','line-join':'round'},
   paint:{'line-color':'#aab8bb',
    'line-width':['interpolate',['linear'],['zoom'],5,0.4,10,1.8,14,4,17,7]}},
  {id:'airsoft-roads',type:'line',source:'airsoft-vector',
   'source-layer':'transportation',layout:{'line-cap':'round','line-join':'round'},
   paint:{'line-color':'#ffffff',
    'line-width':['interpolate',['linear'],['zoom'],5,0.2,10,1.1,14,2.6,17,4.8]}},
  {id:'airsoft-buildings-3d',type:'fill-extrusion',source:'airsoft-vector',
   'source-layer':'building',minzoom:14,
   paint:{
    'fill-extrusion-color':'#a5b4be',
    'fill-extrusion-height':['coalesce',
     ['to-number',['get','render_height']],
     ['to-number',['get','height']],8],
    'fill-extrusion-base':['coalesce',
     ['to-number',['get','render_min_height']],
     ['to-number',['get','min_height']],0],
    'fill-extrusion-opacity':0.76
   }}
 ]
};
