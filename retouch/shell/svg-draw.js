(function(root){
 'use strict';
 function constrained(preset,a,b,{shiftKey=false,altKey=false}={}){
  let dx=b.x-a.x,dy=b.y-a.y;
  if(shiftKey){
   if(preset==='line'){const length=Math.hypot(dx,dy),angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;dx=Math.cos(angle)*length;dy=Math.sin(angle)*length;}
   else{const size=Math.max(Math.abs(dx),Math.abs(dy));dx=(dx<0?-1:1)*size;dy=(dy<0?-1:1)*size;}
  }
  return [altKey?{x:a.x-dx,y:a.y-dy}:a,{x:a.x+dx,y:a.y+dy}];
 }
 const ns='http://www.w3.org/2000/svg';
 function geometry(preset,a,b){
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
  if(preset==='triangle'||preset==='star'){
   const api=typeof module==='object'&&module.exports?require('./svg-parametric.js'):root.RetouchSVGParametric;
   return {points:api.generate({kind:preset==='star'?'star':'polygon',count:preset==='star'?5:3,ratio:Math.sin(Math.PI/10)/Math.sin(3*Math.PI/10),x,y,width:w,height:h})||''};
  }
  return {rectangle:{x,y,width:w,height:h},circle:{cx:x+w/2,cy:y+h/2,r:Math.min(w,h)/2},ellipse:{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2},line:{x1:a.x,y1:a.y,x2:b.x,y2:b.y}}[preset];
 }
 function mount({target,frame,canvas,preset,onCommit,onEnd,onError}){
  const d=target.ownerDocument,w=d.defaultView,viewport=target.tagName.toLowerCase()==='svg'?target:target.ownerSVGElement;
  const surface=root.document.createElement('div');surface.className='svg-draw-surface';surface.dataset.shape=preset;surface.setAttribute('aria-label','Draw '+preset);surface.tabIndex=0;
  Object.assign(surface.style,{position:'fixed',zIndex:40,cursor:'crosshair',touchAction:'none'});
  const drawing=root.document.createElementNS(ns,'svg');Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'hidden'});surface.append(drawing);
  const preview=root.document.createElementNS(ns,{rectangle:'rect',circle:'circle',ellipse:'ellipse',line:'line',triangle:'polygon',star:'polygon'}[preset]);
  preview.style.cssText='pointer-events:none!important;fill:#a5b4fc!important;stroke:#6366f1!important;stroke-width:1!important;opacity:.7!important;';preview.setAttribute('vector-effect','non-scaling-stroke');if(preset==='line')preview.style.setProperty('fill','none','important');
  let state=null,ended=false;const cleanup=[];
  function listen(el,event,fn,options){el.addEventListener(event,fn,options);cleanup.push(()=>el.removeEventListener(event,fn,options));}
  function cancel(){if(ended)return;ended=true;preview.remove();surface.remove();cleanup.forEach(f=>f());onEnd();}
  function point(e){const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth,m=target.getScreenCTM()?.inverse();if(!m)throw Error('This SVG transform cannot be drawn into.');const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(m);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This SVG transform cannot be drawn into.');return p;}
  function paint(modifiers){state.points=constrained(preset,state.a,state.b,modifiers);for(const [key,value]of Object.entries(geometry(preset,...state.points)))preview.setAttribute(key,String(value));const m=target.getScreenCTM(),f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth;preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);if(!preview.isConnected)drawing.append(preview);}
  function move(e){if(!state||e.pointerId!==state.id)return;try{state.b=point(e);state.distance=Math.hypot(e.clientX-state.x,e.clientY-state.y);paint(e);}catch(error){cancel();onError(error.message);}}
  listen(surface,'pointerdown',e=>{if(state||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();try{const a=point(e);state={id:e.pointerId,a,b:a,x:e.clientX,y:e.clientY,distance:0};surface.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(!state||ended)return;const {points:[a,b],distance}=state;cancel();if(distance>=4)onCommit([a.x,a.y,b.x,b.y]);});
  listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',cancel);
  listen(root,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  for(const type of ['keydown','keyup'])listen(root,type,e=>{if(state&&['Shift','Alt'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();paint(e);}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(w,'resize',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
  const f=frame.getBoundingClientRect(),r=viewport.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
  const left=Math.max(f.left+r.left*scale,f.left,c.left),top=Math.max(f.top+r.top*scale,f.top,c.top),right=Math.min(f.left+r.right*scale,f.right,c.right),bottom=Math.min(f.top+r.bottom*scale,f.bottom,c.bottom);
  if(right<=left||bottom<=top){cancel();onError('Bring the SVG canvas into view before drawing.');return null;}
  Object.assign(surface.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});root.document.body.append(surface);surface.focus({preventScroll:true});return cancel;
 }
 const api={mount,geometry,constrained};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGDraw=api;
})(typeof window==='object'?window:globalThis);
