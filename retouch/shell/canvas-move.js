(function(root){
 'use strict';
 function delta(x,y,shift){return shift?(Math.abs(x)>=Math.abs(y)?{x,y:0}:{x:0,y}):{x,y};}
 // All geometry is in iframe viewport CSS pixels; tolerance is supplied in the
 // same units so the attraction distance stays constant at every canvas zoom.
 function snap(rect,movement,targets,{tolerance=6,lock=null}={}){
  const result={...movement,guides:[]};
  for(const axis of ['x','y']){
   if(lock&&axis!==lock)continue;
   const position=axis==='x'?'left':'top',dimension=axis==='x'?'width':'height',cross=axis==='x'?'top':'left',extent=axis==='x'?'height':'width';let best=null;
   for(const target of targets)for(const fraction of [0,.5,1])for(const other of [0,.5,1]){
    const value=target[position]+target[dimension]*other,adjustment=value-(rect[position]+movement[axis]+rect[dimension]*fraction);
    if(Math.abs(adjustment)<=tolerance&&(!best||Math.abs(adjustment)<Math.abs(best.adjustment)))best={adjustment,value,target};
   }
   if(best){result[axis]+=best.adjustment;result.guides.push({axis,value:best.value,start:Math.min(rect[cross]+movement[axis==='x'?'y':'x'],best.target[cross]),end:Math.max(rect[cross]+movement[axis==='x'?'y':'x']+rect[extent],best.target[cross]+best.target[extent])});}
  }
  return result;
 }
 function snapTargets(target){
  const d=target.ownerDocument,w=d.defaultView,parent=target.offsetParent,viewport=!parent||parent===d.body&&w.getComputedStyle(parent).position==='static',targets=[];
  if(viewport)targets.push({left:0,top:0,width:d.documentElement.clientWidth,height:w.innerHeight});
  else{const r=parent.getBoundingClientRect();targets.push({left:r.left+parent.clientLeft,top:r.top+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight});}
  for(const sibling of target.parentElement?.children||[]){
   if(sibling===target)continue;const css=w.getComputedStyle(sibling),r=sibling.getBoundingClientRect();
   if(css.visibility!=='visible'||css.display==='none'||r.width<=0||r.height<=0||r.right<=0||r.bottom<=0||r.left>=w.innerWidth||r.top>=w.innerHeight)continue;
   targets.push(r);
  }
  return targets;
 }
 function resize(width,height,handle,dx,dy,{shiftKey=false,altKey=false,minWidth=1,minHeight=1,maxWidth=Infinity,maxHeight=Infinity}={}){
  if(!['n','s','e','w','ne','nw','se','sw'].includes(handle)||![width,height,dx,dy,minWidth,minHeight].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid resize geometry.');
  const hx=handle.includes('w')?-1:handle.includes('e')?1:0,hy=handle.includes('n')?-1:handle.includes('s')?1:0,m=altKey?2:1;
  let w=width+hx*dx*m,h=height+hy*dy*m;
  if(shiftKey){const ratio=hx&&(!hy||Math.abs((w-width)/width)>=Math.abs((h-height)/height))?w/width:h/height,low=Math.max(minWidth/width,minHeight/height),high=Math.min(Math.max(minWidth,maxWidth)/width,Math.max(minHeight,maxHeight)/height);if(low>high)throw Error('The size bounds do not allow this aspect ratio.');const f=Math.min(high,Math.max(low,ratio));w=width*f;h=height*f;}
  else{w=Math.max(minWidth,Math.min(maxWidth,w));h=Math.max(minHeight,Math.min(maxHeight,h));}
  return {x:altKey||!hx?(width-w)/2:hx<0?width-w:0,y:altKey||!hy?(height-h)/2:hy<0?height-h:0,width:w,height:h};
 }
 function limits(target){
  const d=target.ownerDocument,window=d.defaultView,css=window.getComputedStyle(target),parent=target.offsetParent,viewport=!parent||parent===d.body&&window.getComputedStyle(parent).position==='static',w=viewport?d.documentElement.clientWidth:parent.clientWidth,h=viewport?window.innerHeight:parent.clientHeight;
  const number=p=>parseFloat(css.getPropertyValue(p))||0,borderX=number('padding-left')+number('padding-right')+number('border-left-width')+number('border-right-width'),borderY=number('padding-top')+number('padding-bottom')+number('border-top-width')+number('border-bottom-width');
  function value(raw,dimension,fallback){if(['auto','none'].includes(raw))return fallback;const match=/^(\d+(?:\.\d+)?|\.\d+)(px|%)$/.exec(raw);if(!match)throw Error('Use fixed or percentage size bounds before resizing on canvas.');return Number(match[1])*(match[2]==='%'?dimension/100:1);}
  // Placement writes border-box sizing; apply bounds in that resulting box model.
  return {minWidth:Math.max(1,borderX,value(css.minWidth,w,0)),minHeight:Math.max(1,borderY,value(css.minHeight,h,0)),maxWidth:value(css.maxWidth,w,Infinity),maxHeight:value(css.maxHeight,h,Infinity)};
 }
 function mount({target,frame,canvas,mode='move',opener=root.document.activeElement,onCommit,onEnd,onError}){
  const w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),r=target.getBoundingClientRect(),scale=f.width/w.innerWidth;
  if(r.width<=0||r.height<=0){onError('Select a visible layer with a nonzero size.');return null;}
  let bounds={};if(mode==='resize')try{bounds=limits(target);}catch(error){onError(error.message);return null;}
  const parent=target.offsetParent,parentWidth=parent?.clientWidth,parentHeight=parent?.clientHeight;
  const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top){onError('Bring the layer into view before moving it.');return null;}
  const surface=root.document.createElement('div');surface.className='canvas-move-surface';surface.tabIndex=0;surface.setAttribute('aria-label',(mode==='resize'?'Resize':'Move')+' layer on canvas');
  Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const preview=root.document.createElement('div');preview.className='canvas-move-preview';preview.setAttribute('aria-label','Drag selected layer');
  const x=f.left+r.left*scale-left,y=f.top+r.top*scale-top;
  Object.assign(preview.style,{position:'absolute',left:x+'px',top:y+'px',width:r.width*scale+'px',height:r.height*scale+'px',border:'2px solid #6366f1',boxSizing:'border-box',background:'rgba(99,102,241,.12)',cursor:'move'});surface.append(preview);
  const guides=root.document.createElement('div');guides.className='canvas-snap-guides';guides.setAttribute('aria-hidden','true');guides.style.pointerEvents='none';surface.append(guides);
  if(mode==='move'){const hint=root.document.createElement('div');hint.textContent='Drag to align · Shift locks an axis · Option / Alt disables snapping · Escape cancels';Object.assign(hint.style,{position:'absolute',bottom:'8px',left:'8px',right:'8px',padding:'6px 8px',background:'#1e293b',color:'white',fontSize:'12px',borderRadius:'4px',pointerEvents:'none'});surface.append(hint);}
  function paintGuides(items){guides.replaceChildren();for(const item of items){const line=root.document.createElement('div');line.dataset.snapAxis=item.axis;Object.assign(line.style,{position:'absolute',background:'#e11d48',left:(item.axis==='x'?f.left+item.value*scale-left:f.left+item.start*scale-left)+'px',top:(item.axis==='y'?f.top+item.value*scale-top:f.top+item.start*scale-top)+'px',width:item.axis==='x'?'1px':Math.max(1,(item.end-item.start)*scale)+'px',height:item.axis==='y'?'1px':Math.max(1,(item.end-item.start)*scale)+'px'});guides.append(line);}}
  if(mode==='resize')for(const handle of ['nw','n','ne','e','se','s','sw','w']){const button=root.document.createElement('button');button.type='button';button.dataset.resizeHandle=handle;const name={n:'top',s:'bottom',e:'right',w:'left',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'}[handle];button.setAttribute('aria-label','Resize '+name);button.title='Resize '+name+'. Arrow keys adjust; Enter applies; Escape cancels.';Object.assign(button.style,{position:'absolute',padding:'0',width:'10px',height:'10px',minWidth:'0',border:'1px solid #6366f1',borderRadius:'1px',background:'white',left:handle.includes('w')?'0%':handle.includes('e')?'100%':'50%',top:handle.includes('n')?'0%':handle.includes('s')?'100%':'50%',transform:'translate(-50%,-50%)',cursor:handle+'-resize'});preview.append(button);}
  if(x+r.width*scale<=0||y+r.height*scale<=0||x>=right-left||y>=bottom-top){onError('Bring the layer into view before moving it.');return null;}
  let state=null,ended=false;const cleanups=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));}
  function cancel(restoreFocus=false){if(ended)return;ended=true;surface.remove();cleanups.forEach(fn=>fn());onEnd();if(restoreFocus===true)(opener?.isConnected?opener:root.document.querySelector('[data-canvas-tool='+mode+']'))?.focus({preventScroll:true});}
  function paint(modifiers){
   if(mode==='resize'){const base=state.base||{x:0,y:0,width:r.width,height:r.height};state.delta=resize(base.width,base.height,state.handle,state.rawX/scale,state.rawY/scale,{...bounds,...modifiers});state.delta.x+=base.x;state.delta.y+=base.y;preview.style.width=state.delta.width*scale+'px';preview.style.height=state.delta.height*scale+'px';preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
   else{const locked=!state.keyboard&&modifiers.shiftKey,d=delta(state.rawX,state.rawY,locked),movement={x:d.x/scale,y:d.y/scale},snapped=!state.keyboard&&!modifiers.altKey?snap(r,movement,snapTargets(target),{tolerance:6/scale,lock:locked?(Math.abs(state.rawX)>=Math.abs(state.rawY)?'x':'y'):state.rawX===0?'y':state.rawY===0?'x':null}):{...movement,guides:[]};state.delta={x:snapped.x,y:snapped.y};paintGuides(snapped.guides);preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
  }
  function move(e){if(!state||e.pointerId!==state.id)return;state.rawX=e.clientX-state.x;state.rawY=e.clientY-state.y;try{paint({shiftKey:e.shiftKey,altKey:e.altKey});}catch(error){cancel();onError(error.message);}}
  listen(surface,'pointerdown',e=>{if(e.button!==0||state)return;e.preventDefault();e.stopImmediatePropagation();const handle=e.target.dataset.resizeHandle;if(mode==='resize'?!handle:e.target!==preview){cancel();return;}state={id:e.pointerId,handle,x:e.clientX,y:e.clientY,rawX:0,rawY:0,delta:{x:0,y:0}};surface.setPointerCapture(e.pointerId);});
  listen(surface,'focusin',e=>{if(state?.keyboard&&mode==='resize'&&e.target.dataset.resizeHandle&&e.target.dataset.resizeHandle!==state.handle){state={keyboard:true,handle:e.target.dataset.resizeHandle,id:null,rawX:0,rawY:0,base:state.delta,delta:state.delta};}});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(ended)return;const result=state.delta,distance=Math.hypot(state.rawX,state.rawY);cancel();const changed=Math.abs(result.x)+Math.abs(result.y)+(mode==='resize'?Math.abs(result.width-r.width)+Math.abs(result.height-r.height):0)>1e-6;if(distance>=4&&changed&&target.isConnected)onCommit(result);});
  for(const event of ['pointercancel','lostpointercapture'])listen(surface,event,cancel);
  listen(root,'keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel(true);return;}
   if(!surface.contains(e.target)||e.metaKey||e.ctrlKey)return;
   if(e.key==='Enter'&&state?.keyboard){e.preventDefault();e.stopImmediatePropagation();const result=state.delta,changed=Math.abs(result.x)+Math.abs(result.y)+(mode==='resize'?Math.abs(result.width-r.width)+Math.abs(result.height-r.height):0)>1e-6;cancel(true);if(changed&&target.isConnected)onCommit(result,{keyboard:true});return;}
   const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction||state&&!state.keyboard)return;
   const handle=e.target.dataset.resizeHandle;if(mode==='resize'&&!handle)return;e.preventDefault();e.stopImmediatePropagation();
   if(!state||state.handle!==handle)state={keyboard:true,handle,id:null,rawX:0,rawY:0,delta:{x:0,y:0}};
   const step=mode==='move'&&e.shiftKey?10:1;state.rawX+=direction[0]*step*scale;state.rawY+=direction[1]*step*scale;
   try{paint({shiftKey:e.shiftKey,altKey:e.altKey});}catch(error){cancel(true);onError(error.message);}
  },true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(state&&(!state.keyboard||surface.contains(e.target))&&['Shift','Alt'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();try{paint({shiftKey:e.shiftKey,altKey:e.altKey});}catch(error){cancel();onError(error.message);}}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(root,'retouch:selection',e=>{if(e.detail!==target.getAttribute('data-rt'))cancel();});
  listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(w,'resize',cancel);listen(canvas,'scroll',cancel);
  let tick;const observe=()=>{if(ended)return;const current=target.getBoundingClientRect();if(!target.isConnected||target.offsetParent!==parent||parent?.clientWidth!==parentWidth||parent?.clientHeight!==parentHeight||['left','top','width','height'].some(key=>Math.abs(current[key]-r[key])>.5)){cancel();return;}tick=root.requestAnimationFrame(observe);};tick=root.requestAnimationFrame(observe);cleanups.push(()=>root.cancelAnimationFrame(tick));
  root.document.body.append(surface);(mode==='resize'?preview.querySelector('[data-resize-handle=se]'):surface).focus({preventScroll:true});return cancel;
 }
 const api={delta,snap,resize,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasMove=api;
})(typeof window==='object'?window:globalThis);
