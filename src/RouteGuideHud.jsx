import React from 'react';
import {Compass,AlertTriangle,Navigation} from 'lucide-react';
import {routeGuidance} from './navigationGuide.js';
import {distanceLabel} from './geo';
import './route-guide.css';

/** Flecha de orientación GPS, sin abrir Google Maps ni compartir más datos. */
export default function RouteGuideHud({me,route}){
 if(!route?.points?.length)return null;
 const recent=me&&Number.isFinite(me.observedAt)&&Date.now()-me.observedAt<=30000;
 if(!recent)return <div className="v54-route-hud stale" role="status">
  <Compass size={18}/> GPS desactualizado. La orientación está en pausa.
 </div>;
 const guide=routeGuidance(me,route);
 if(!guide)return null;
 return <div className={'v54-route-hud '+(guide.offRoute?'offroute':'')} role="status"
  aria-label="Guía de orientación peatonal">
  <div className="v54-route-arrow-wrap">
   <span className="v54-route-arrow-head" style={{transform:'rotate('+((guide.headingAvailable?guide.relativeTurn:guide.bearing)-90)+'deg)'}}>
    ➤
   </span>
  </div>
  <div className="v54-route-label">
   <strong>{guide.instruction}</strong>
   <small><Navigation size={12}/> {guide.arrived?'Destino cercano':distanceLabel(guide.remainingMeters)+' restantes'}</small>
   {!guide.headingAvailable&&!guide.arrived&&<small>Flecha respecto al norte, no a la orientación del teléfono</small>}
   {guide.offRoute&&<small className="v54-deviation"><AlertTriangle size={12}/> Desvío aprox. {guide.routeDeviationMeters} m. Recalcula cuando puedas.</small>}
  </div>
 </div>;
}
