import React from 'react';
import {createRoot} from 'react-dom/client';
import RouteGuideHud from '../src/RouteGuideHud.jsx';
import '../src/style.css';
const route={
 points:[[4.445,-75.24],[4.446,-75.24],[4.447,-75.24]],
 maneuvers:[
  {type:1,beginShapeIndex:0,instruction:'Comienza.'},
  {type:10,beginShapeIndex:1,instruction:'Gira a la derecha.',verbal:'Gira a la derecha.'},
  {type:4,beginShapeIndex:2,instruction:'Llegaste al objetivo.'}
 ],calculatedAt:Date.now()
};
const me={lat:4.445,lng:-75.24,heading:0,accuracy:9,observedAt:Date.now()};
createRoot(document.getElementById('root')).render(<div style={{
 minHeight:'90vh',position:'relative',background:'#e7f1f8',padding:'20px'
}}>
 <RouteGuideHud me={me} route={route}/>
</div>);
