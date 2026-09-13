(function(root){
 'use strict';
 function mount({document:d,frame,candidate,onStart}){
  const w=d.defaultView,cleanup=[];let pending=null,active=null,ignore=null;
  const listen=(el,type,fn)=>{el.addEventListener(type,fn,{capture:true});cleanup.push(()=>el.removeEventListener(type,fn,{capture:true}));};
  listen(d,'pointerdown',e=>{ignore=null;pending=null;if(e.isPrimary===false||e.button!==0||e.ctrlKey||e.metaKey||e.altKey)return;const selected=candidate(e.target);if(!selected)return;pending={selected,event:e,x:e.clientX,y:e.clientY,id:e.pointerId};});
  listen(w,'pointermove',e=>{if(!pending||e.pointerId!==pending.id)return;if(e.buttons!==1){pending=null;return;}const p=pending,now=candidate(p.selected.target),scale=frame.getBoundingClientRect().width/w.innerWidth;if(!now||now.info!==p.selected.info){pending=null;return;}if(Math.hypot(e.clientX-p.x,e.clientY-p.y)*scale<4)return;pending=null;active=p.id;e.preventDefault();e.stopImmediatePropagation();onStart(p.selected,p.event,e);});
  listen(w,'pointerup',e=>{pending=null;if(active===e.pointerId){active=null;ignore={x:e.clientX,y:e.clientY,time:Date.now()};}});
  listen(w,'pointercancel',e=>{if(pending?.id===e.pointerId)pending=null;if(active===e.pointerId)active=null;});
  listen(d,'click',e=>{if(!ignore)return;const point=ignore;ignore=null;if(Date.now()-point.time<500&&Math.abs(e.clientX-point.x)<2&&Math.abs(e.clientY-point.y)<2){e.preventDefault();e.stopImmediatePropagation();}});
  listen(w,'keydown',e=>{if(e.key==='Escape')pending=null;});listen(w,'blur',()=>{pending=null;});
  return ()=>{pending=null;active=null;cleanup.forEach(fn=>fn());};
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGDrag=api;
})(typeof window==='object'?window:globalThis);
