(function(root){
 'use strict';
 function delta(x,y,shift){return shift?(Math.abs(x)>=Math.abs(y)?{x,y:0}:{x:0,y}):{x,y};}
 function mount({target,frame,canvas,onCommit,onEnd,onError}){
  const w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),r=target.getBoundingClientRect(),scale=f.width/w.innerWidth;
  if(r.width<=0||r.height<=0){onError('Select a visible layer with a nonzero size.');return null;}
  const parent=target.offsetParent,parentWidth=parent?.clientWidth,parentHeight=parent?.clientHeight;
  const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top){onError('Bring the layer into view before moving it.');return null;}
  const surface=root.document.createElement('div');surface.className='canvas-move-surface';surface.tabIndex=0;surface.setAttribute('aria-label','Move layer on canvas');
  Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const preview=root.document.createElement('div');preview.className='canvas-move-preview';preview.setAttribute('aria-label','Drag selected layer');
  const x=f.left+r.left*scale-left,y=f.top+r.top*scale-top;
  Object.assign(preview.style,{position:'absolute',left:x+'px',top:y+'px',width:r.width*scale+'px',height:r.height*scale+'px',border:'2px solid #6366f1',boxSizing:'border-box',background:'rgba(99,102,241,.12)',cursor:'move'});surface.append(preview);
  if(x+r.width*scale<=0||y+r.height*scale<=0||x>=right-left||y>=bottom-top){onError('Bring the layer into view before moving it.');return null;}
  let state=null,ended=false;const cleanups=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));}
  function cancel(){if(ended)return;ended=true;surface.remove();cleanups.forEach(fn=>fn());onEnd();}
  function paint(shift){const d=delta(state.rawX,state.rawY,shift);state.delta={x:d.x/scale,y:d.y/scale};preview.style.transform=`translate(${d.x}px,${d.y}px)`;}
  function move(e){if(!state||e.pointerId!==state.id)return;state.rawX=e.clientX-state.x;state.rawY=e.clientY-state.y;paint(e.shiftKey);}
  listen(surface,'pointerdown',e=>{if(e.button!==0||state)return;e.preventDefault();e.stopImmediatePropagation();if(e.target!==preview){cancel();return;}state={id:e.pointerId,x:e.clientX,y:e.clientY,rawX:0,rawY:0,delta:{x:0,y:0}};surface.setPointerCapture(e.pointerId);});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);const result=state.delta,distance=Math.hypot(state.rawX,state.rawY);cancel();if(distance>=4&&target.isConnected)onCommit(result);});
  for(const event of ['pointercancel','lostpointercapture'])listen(surface,event,cancel);
  listen(root,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(state&&e.key==='Shift'){e.preventDefault();e.stopImmediatePropagation();paint(e.shiftKey);}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','retouch:selection','resize','blur','pagehide'])listen(root,event,cancel);
  listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(w,'resize',cancel);listen(canvas,'scroll',cancel);
  let tick;const observe=()=>{if(ended)return;const current=target.getBoundingClientRect();if(!target.isConnected||target.offsetParent!==parent||parent?.clientWidth!==parentWidth||parent?.clientHeight!==parentHeight||['left','top','width','height'].some(key=>Math.abs(current[key]-r[key])>.5)){cancel();return;}tick=root.requestAnimationFrame(observe);};tick=root.requestAnimationFrame(observe);cleanups.push(()=>root.cancelAnimationFrame(tick));
  root.document.body.append(surface);surface.focus({preventScroll:true});return cancel;
 }
 const api={delta,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasMove=api;
})(typeof window==='object'?window:globalThis);
