(function(root){
 'use strict';
 function constrained(preset,a,b,{shiftKey=false,altKey=false}={}){
  let dx=b.x-a.x,dy=b.y-a.y;
  if(shiftKey){
   if(['line','arrow'].includes(preset)){const length=Math.hypot(dx,dy),angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;dx=Math.cos(angle)*length;dy=Math.sin(angle)*length;}
   else{const size=Math.max(Math.abs(dx),Math.abs(dy));dx=(dx<0?-1:1)*size;dy=(dy<0?-1:1)*size;}
  }
  return [altKey?{x:a.x-dx,y:a.y-dy}:a,{x:a.x+dx,y:a.y+dy}];
 }
 function placement(preset,p,{altKey=false}={}){const height=['line','arrow'].includes(preset)?0:100;return [{x:p.x-(altKey?50:0),y:p.y-(altKey?height/2:0)},{x:p.x+(altKey?50:100),y:p.y+(altKey?height/2:height)}];}
 const ns='http://www.w3.org/2000/svg';
 function geometry(preset,a,b){
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
  if(preset==='arrow'){
   const api=typeof module==='object'&&module.exports?require('./svg-parametric.js'):root.RetouchSVGParametric;
   const head=Math.min(12,Math.hypot(b.x-a.x,b.y-a.y)*.3);
   return {points:api.generate({kind:'arrow',x1:a.x,y1:a.y,x2:b.x,y2:b.y,headLength:head,headWidth:head})||''};
  }
  if(preset==='triangle'||preset==='star'){
   const api=typeof module==='object'&&module.exports?require('./svg-parametric.js'):root.RetouchSVGParametric;
   return {points:api.generate({kind:preset==='star'?'star':'polygon',count:preset==='star'?5:3,ratio:Math.sin(Math.PI/10)/Math.sin(3*Math.PI/10),x,y,width:w,height:h})||''};
  }
  return {rectangle:{x,y,width:w,height:h},circle:{cx:x+w/2,cy:y+h/2,r:Math.min(w,h)/2},ellipse:{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2},line:{x1:a.x,y1:a.y,x2:b.x,y2:b.y}}[preset];
 }
 function viewportStyle(x,y,width,height){return {all:'initial',position:'absolute',left:x+'px',top:y+'px',width:width+'px',height:height+'px',display:'block',overflow:'visible'};}
 function nativeMatrix(target){
  const d=target.ownerDocument,w=d.defaultView;
  for(let el=target;el;el=el.parentElement){const css=w.getComputedStyle(el);if(css.perspective!=='none'||css.transform!=='none'&&!new w.DOMMatrix(css.transform).is2D)throw Error('Drawing into perspective containers is not supported yet.');}
  // WebKit can omit ancestor CSS transforms from SVG getScreenCTM. Three
  // zero-size layout probes measure the actual affine coordinate basis instead.
  const probes=[[0,0],[100,0],[0,100]].map(([x,y])=>{const probe=d.createElement('div');Object.assign(probe.style,viewportStyle(x,y,0,0),{visibility:'hidden',pointerEvents:'none'});return probe;});
  try{target.append(...probes);const [o,x,y]=probes.map(el=>el.getBoundingClientRect()),matrix=new w.DOMMatrix([(x.x-o.x)/100,(x.y-o.y)/100,(y.x-o.x)/100,(y.y-o.y)/100,o.x,o.y]);if(![matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite)||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-9)throw Error('This container has no drawable coordinate system.');return matrix;}finally{probes.forEach(probe=>probe.remove());}
 }
 function nativeSpace(target){
  const w=target.ownerDocument.defaultView,matrix=nativeMatrix(target);
  const nativeSnapshots=[];
  for(let el=target;el;el=el.parentElement){const css=w.getComputedStyle(el);nativeSnapshots.push({el,rect:el.getBoundingClientRect(),metrics:[el.clientLeft,el.clientTop,el.clientWidth,el.clientHeight],css:[css.position,css.transform,css.rotate,css.scale,css.translate,css.zoom,css.contain,css.willChange,css.filter,css.backdropFilter,css.perspective].join('|')});}
  function current(){return nativeSnapshots.every(({el,rect,metrics,css})=>{if(!el.isConnected)return false;const now=el.getBoundingClientRect(),style=w.getComputedStyle(el);return [el.clientLeft,el.clientTop,el.clientWidth,el.clientHeight].every((value,i)=>value===metrics[i])&&['x','y','width','height'].every(key=>Math.abs(now[key]-rect[key])<.1)&&css===[style.position,style.transform,style.rotate,style.scale,style.translate,style.zoom,style.contain,style.willChange,style.filter,style.backdropFilter,style.perspective].join('|');});}
  return {matrix,current};
 }
 function mount({target,frame,canvas,preset,onCommit,onEnd,onError,native=false,initialPointer=null,initialMove=null,initialReleased=false,pointerTarget=null,initialPoint=null,onClick=null,tool=null}){
  const d=target.ownerDocument,w=d.defaultView,viewport=native?null:target.tagName.toLowerCase()==='svg'?target:target.ownerSVGElement;
  let space;try{space=native?nativeSpace(target):null;}catch(error){onError(error.message);onEnd();return null;}
  const matrix=()=>space?.matrix||target.getScreenCTM();
  const surface=root.document.createElement('div');surface.className='svg-draw-surface';surface.dataset.shape=preset;if(tool)surface.dataset.tool=tool;surface.setAttribute('aria-label',tool==='text'?'Draw text box':'Draw '+preset);surface.title='Hold Space to reposition while drawing. Shift constrains; Option/Alt draws from center.';surface.tabIndex=0;
  Object.assign(surface.style,{position:'fixed',zIndex:40,cursor:'crosshair',touchAction:'none'});
  const drawing=root.document.createElementNS(ns,'svg');Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'hidden'});surface.append(drawing);
  const preview=root.document.createElementNS(ns,{rectangle:'rect',circle:'circle',ellipse:'ellipse',line:'line',arrow:'path',triangle:'polygon',star:'polygon'}[preset]);
  preview.style.cssText='pointer-events:none!important;fill:#d9d9d9!important;stroke:var(--accent, #0d99ff)!important;stroke-width:1!important;opacity:.7!important;';preview.setAttribute('vector-effect','non-scaling-stroke');if(tool==='text'||['line','arrow'].includes(preset))preview.style.setProperty('fill','none','important');
  let state=null,ended=false,spaceHeld=false;const cleanup=[];
  const current=()=>!space||space.current();
  if(native){let raf;const check=()=>{if(!current()){cancel();return;}raf=root.requestAnimationFrame(check);};raf=root.requestAnimationFrame(check);cleanup.push(()=>root.cancelAnimationFrame(raf));}
  function listen(el,event,fn,options){el.addEventListener(event,fn,options);cleanup.push(()=>el.removeEventListener(event,fn,options));}
  function cancel(){if(ended)return;ended=true;preview.remove();surface.remove();cleanup.forEach(f=>f());onEnd();}
  function point(e){const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth,m=matrix()?.inverse();if(!m)throw Error('This SVG transform cannot be drawn into.');const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(m);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This SVG transform cannot be drawn into.');return p;}
  function paint(modifiers){state.points=constrained(preset,state.a,state.b,modifiers);const values=geometry(preset,...state.points),attributes=preset==='arrow'?{d:root.RetouchSVGParametric.arrowPath(values.points)||''}:values;for(const [key,value]of Object.entries(attributes))preview.setAttribute(key,String(value));const m=matrix(),f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth;preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);if(!preview.isConnected)drawing.append(preview);}
  function move(e){if(ended||!state||e.pointerId!==state.id)return;if(!current()){cancel();return;}try{const next=point(e);if(spaceHeld){state.a={x:state.a.x+next.x-state.b.x,y:state.a.y+next.y-state.b.y};state.x+=e.clientX-state.pointerX;state.y+=e.clientY-state.pointerY;}state.b=next;state.pointerX=e.clientX;state.pointerY=e.clientY;state.distance=Math.hypot(e.clientX-state.x,e.clientY-state.y);paint(e);}catch(error){cancel();onError(error.message);}}
  const down=e=>{if(state||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();try{const a=point(e);state={id:e.pointerId,a,b:a,x:e.clientX,y:e.clientY,pointerX:e.clientX,pointerY:e.clientY,distance:0};surface.setAttribute('data-canvas-space-owner','');(pointerTarget||surface).setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}};
  listen(surface,'pointerdown',down);
  listen(surface,'pointermove',move);
  const up=e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(!state||ended)return;if(state.distance<4&&onClick){const p=state.a;cancel();onClick({x:p.x,y:p.y});return;}const [a,b]=state.distance>=4?state.points:placement(preset,state.a,e);cancel();onCommit([a.x,a.y,b.x,b.y]);};
  listen(surface,'pointerup',up);
  listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',cancel);
  listen(root,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  for(const host of [root,w])for(const type of ['keydown','keyup'])listen(host,type,e=>{if(state&&e.code==='Space'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();spaceHeld=type==='keydown';return;}if(state&&['Shift','Alt'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();paint(e);}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(w,'resize',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
  const f=frame.getBoundingClientRect(),r=viewport?viewport.getBoundingClientRect():{left:0,top:0,right:w.innerWidth,bottom:w.innerHeight},c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
  const left=Math.max(f.left+r.left*scale,f.left,c.left),top=Math.max(f.top+r.top*scale,f.top,c.top),right=Math.min(f.left+r.right*scale,f.right,c.right),bottom=Math.min(f.top+r.bottom*scale,f.bottom,c.bottom);
  if(right<=left||bottom<=top){cancel();onError('Bring the SVG canvas into view before drawing.');return null;}
  Object.assign(surface.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});root.document.body.append(surface);surface.focus({preventScroll:true});
  if(initialPoint){try{const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth,p=point({clientX:f.left+initialPoint.x*scale,clientY:f.top+initialPoint.y*scale}),[a,b]=placement(preset,p,initialPoint);cancel();onCommit([a.x,a.y,b.x,b.y]);}catch(error){cancel();onError(error.message);}return null;}
  if(initialPointer){try{
   const fromFrame=e=>{const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;return {clientX:f.left+e.clientX*scale,clientY:f.top+e.clientY*scale,pointerId:e.pointerId,button:e.button,shiftKey:e.shiftKey,altKey:e.altKey,preventDefault:()=>e.preventDefault(),stopImmediatePropagation:()=>e.stopImmediatePropagation()};};
   // A released pointer cannot be captured, but its buffered gesture still commits.
   const first=fromFrame(initialPointer);
   if(initialReleased){const a=point(first);state={id:first.pointerId,a,b:a,x:first.clientX,y:first.clientY,pointerX:first.clientX,pointerY:first.clientY,distance:0};}else down(first);
   if(initialMove)move(fromFrame(initialMove));
   if(initialReleased)up(fromFrame(initialMove||initialPointer));
   else if(!ended){listen(w,'pointermove',e=>move(fromFrame(e)),true);listen(w,'pointerup',e=>up(fromFrame(e)),true);listen(w,'pointercancel',cancel,true);listen(w,'lostpointercapture',cancel,true);}
  }catch(error){cancel();onError(error.message);}}
  return ended?null:cancel;
 }
 const api={mount,geometry,constrained,placement,viewportStyle,nativeSpace};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGDraw=api;
})(typeof window==='object'?window:globalThis);
