'use strict';
// Test oracle: measure real DOM probes. Replaced elements need a temporary
// ordinary box with matching styles because their children do not lay out.
module.exports=el=>{
  let target=el,surrogate;
  try{
   if(el.localName==='img'){
    const css=getComputedStyle(el);surrogate=document.createElement('div');
    for(const property of ['position','left','top','width','height','min-width','max-width','min-height','max-height','box-sizing','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style','transform','translate','rotate','scale','transform-origin','transform-box','zoom'])surrogate.style.setProperty(property,css.getPropertyValue(property),'important');
    // Preserve the authored origin; computed values lose reference-box percentages.
    if(el.style.transformOrigin)surrogate.style.setProperty('transform-origin',el.style.transformOrigin,'important');
    el.parentNode.insertBefore(surrogate,el);target=surrogate;
    const actual=el.getBoundingClientRect(),copy=target.getBoundingClientRect();
    for(const key of ['x','y','width','height'])if(Math.abs(actual[key]-copy[key])>.1)throw Error('Image geometry oracle differs in '+key+': '+actual[key]+' / '+copy[key]);
   }
   const css=getComputedStyle(target),width=parseFloat(css.width),height=parseFloat(css.height),m=parent.RetouchSVGDraw.nativeSpace(target).matrix.translate(-target.clientLeft,-target.clientTop);
   const frame=parent.RetouchSVGDraw.nativeSpace(el.offsetParent).matrix.inverse();return {width,height,points:[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);const local=p.matrixTransform(frame);return {x:p.x,y:p.y,localX:local.x,localY:local.y};})};
  }finally{surrogate?.remove();}
};
