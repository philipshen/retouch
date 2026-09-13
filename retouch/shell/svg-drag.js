(function(root){
 'use strict';
 function mount({document:d,frame,candidate,prepare,onStart,onError=()=>{}}){
  const w=d.defaultView,cleanup=[];let pending=null,active=null,ignore=null;
  const listen=(el,type,fn)=>{if(!el?.addEventListener)return;el.addEventListener(type,fn,{capture:true});cleanup.push(()=>el.removeEventListener(type,fn,{capture:true}));};
  const cancel=()=>{const p=pending;pending=null;if(p?.preparing&&p.selected.target.hasPointerCapture?.(p.id))p.selected.target.releasePointerCapture(p.id);};
  listen(d,'pointerdown',e=>{ignore=null;cancel();active=null;if(e.isPrimary===false||e.button!==0||e.ctrlKey||e.metaKey||e.altKey)return;const selected=candidate(e.target);if(!selected)return;pending={selected,event:e,x:e.clientX,y:e.clientY,id:e.pointerId};});
  const ignoreClick=e=>{ignore={x:e.clientX,y:e.clientY,time:Date.now()};};
  function start(p){if(pending!==p)return;pending=null;if(!p.released)active=p.id;onStart(p.selected,p.event,p.move,!!p.released);}
  listen(w,'pointermove',e=>{if(!pending||e.pointerId!==pending.id)return;const p=pending;if(e.buttons!==1){if(!p.released)pending=null;return;}if(p.preparing){p.move=e;e.preventDefault();e.stopImmediatePropagation();return;}const now=candidate(p.selected.target),scale=frame.getBoundingClientRect().width/w.innerWidth;if(!now||now.info!==p.selected.info||now.target!==p.selected.target){pending=null;return;}if(Math.hypot(e.clientX-p.x,e.clientY-p.y)*scale<4)return;p.move=e;e.preventDefault();e.stopImmediatePropagation();if(p.selected.info){start(p);return;}active=p.id;p.preparing=true;p.selected.target.setPointerCapture?.(p.id);Promise.resolve().then(()=>prepare(p.selected,()=>pending===p)).then(selected=>{if(pending!==p)return;if(!selected){cancel();return;}p.selected=selected;start(p);}).catch(error=>{if(pending===p){cancel();onError(error);}});});
  listen(w,'pointerup',e=>{if(pending?.id===e.pointerId){if(pending.preparing){pending.released=true;pending.move=e;ignoreClick(e);e.preventDefault();e.stopImmediatePropagation();}else pending=null;}if(active===e.pointerId){active=null;ignoreClick(e);}});
  listen(w,'pointercancel',e=>{if(pending?.id===e.pointerId)cancel();if(active===e.pointerId)active=null;});
  listen(d,'click',e=>{if(!ignore)return;const point=ignore;ignore=null;if(Date.now()-point.time<500&&Math.abs(e.clientX-point.x)<2&&Math.abs(e.clientY-point.y)<2){e.preventDefault();e.stopImmediatePropagation();}});
  for(const host of [w,root]){listen(host,'keydown',e=>{if(e.key==='Escape')cancel();});listen(host,'blur',()=>{if(host!==root||!root.document?.hasFocus())cancel();});for(const type of ['resize','pagehide','retouch:before-zoom','retouch:screen'])listen(host,type,cancel);}
  listen(w,'scroll',cancel);listen(w,'lostpointercapture',e=>{if(pending?.id===e.pointerId&&!pending.released)cancel();});
  return ()=>{cancel();active=null;cleanup.forEach(fn=>fn());};
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGDrag=api;
})(typeof window==='object'?window:globalThis);
