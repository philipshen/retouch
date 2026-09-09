(function(root){
 'use strict';
 function delta(x,y,shift){return shift?(Math.abs(x)>=Math.abs(y)?{x,y:0}:{x:0,y}):{x,y};}
 function resize(width,height,handle,dx,dy,{shiftKey=false,altKey=false,minWidth=1,minHeight=1,maxWidth=Infinity,maxHeight=Infinity}={}){
  if(!['n','s','e','w','ne','nw','se','sw'].includes(handle)||![width,height,dx,dy,minWidth,minHeight].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid resize geometry.');
  const hx=handle.includes('w')?-1:handle.includes('e')?1:0,hy=handle.includes('n')?-1:handle.includes('s')?1:0,m=altKey?2:1;
  let w=width+hx*dx*m,h=height+hy*dy*m;
  if(shiftKey){const ratio=hx&&(!hy||Math.abs((w-width)/width)>=Math.abs((h-height)/height))?w/width:h/height,low=Math.max(minWidth/width,minHeight/height),high=Math.min(Math.max(minWidth,maxWidth)/width,Math.max(minHeight,maxHeight)/height);if(low>high)throw Error('The size bounds do not allow this aspect ratio.');const f=Math.min(high,Math.max(low,ratio));w=width*f;h=height*f;}
  else{w=Math.max(minWidth,Math.min(maxWidth,w));h=Math.max(minHeight,Math.min(maxHeight,h));}
  return {x:altKey||!hx?(width-w)/2:hx<0?width-w:0,y:altKey||!hy?(height-h)/2:hy<0?height-h:0,width:w,height:h};
 }
 function limits(target){
  const css=target.ownerDocument.defaultView.getComputedStyle(target),parent=target.offsetParent,w=parent?.clientWidth||target.ownerDocument.documentElement.clientWidth,h=parent?.clientHeight||target.ownerDocument.defaultView.innerHeight;
  const number=p=>parseFloat(css.getPropertyValue(p))||0,borderX=number('padding-left')+number('padding-right')+number('border-left-width')+number('border-right-width'),borderY=number('padding-top')+number('padding-bottom')+number('border-top-width')+number('border-bottom-width');
  function value(raw,dimension,fallback){if(['auto','none'].includes(raw))return fallback;const match=/^(\d+(?:\.\d+)?|\.\d+)(px|%)$/.exec(raw);if(!match)throw Error('Use fixed or percentage size bounds before resizing on canvas.');return Number(match[1])*(match[2]==='%'?dimension/100:1);}
  // Placement writes border-box sizing; apply bounds in that resulting box model.
  return {minWidth:Math.max(1,borderX,value(css.minWidth,w,0)),minHeight:Math.max(1,borderY,value(css.minHeight,h,0)),maxWidth:value(css.maxWidth,w,Infinity),maxHeight:value(css.maxHeight,h,Infinity)};
 }
 function mount({target,frame,canvas,mode='move',onCommit,onEnd,onError}){
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
  if(mode==='resize')for(const handle of ['nw','n','ne','e','se','s','sw','w']){const button=root.document.createElement('button');button.type='button';button.dataset.resizeHandle=handle;button.setAttribute('aria-label','Resize '+handle);Object.assign(button.style,{position:'absolute',padding:'0',width:'10px',height:'10px',minWidth:'0',border:'1px solid #6366f1',borderRadius:'1px',background:'white',left:handle.includes('w')?'0%':handle.includes('e')?'100%':'50%',top:handle.includes('n')?'0%':handle.includes('s')?'100%':'50%',transform:'translate(-50%,-50%)',cursor:handle+'-resize'});preview.append(button);}
  if(x+r.width*scale<=0||y+r.height*scale<=0||x>=right-left||y>=bottom-top){onError('Bring the layer into view before moving it.');return null;}
  let state=null,ended=false;const cleanups=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));}
  function cancel(){if(ended)return;ended=true;surface.remove();cleanups.forEach(fn=>fn());onEnd();}
  function paint(modifiers){
   if(mode==='resize'){state.delta=resize(r.width,r.height,state.handle,state.rawX/scale,state.rawY/scale,{...bounds,...modifiers});preview.style.width=state.delta.width*scale+'px';preview.style.height=state.delta.height*scale+'px';preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
   else{const d=delta(state.rawX,state.rawY,modifiers.shiftKey);state.delta={x:d.x/scale,y:d.y/scale};preview.style.transform=`translate(${d.x}px,${d.y}px)`;}
  }
  function move(e){if(!state||e.pointerId!==state.id)return;state.rawX=e.clientX-state.x;state.rawY=e.clientY-state.y;try{paint({shiftKey:e.shiftKey,altKey:e.altKey});}catch(error){cancel();onError(error.message);}}
  listen(surface,'pointerdown',e=>{if(e.button!==0||state)return;e.preventDefault();e.stopImmediatePropagation();const handle=e.target.dataset.resizeHandle;if(mode==='resize'?!handle:e.target!==preview){cancel();return;}state={id:e.pointerId,handle,x:e.clientX,y:e.clientY,rawX:0,rawY:0,delta:{x:0,y:0}};surface.setPointerCapture(e.pointerId);});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(ended)return;const result=state.delta,distance=Math.hypot(state.rawX,state.rawY);cancel();if(distance>=4&&target.isConnected)onCommit(result);});
  for(const event of ['pointercancel','lostpointercapture'])listen(surface,event,cancel);
  listen(root,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(state&&['Shift','Alt'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();try{paint({shiftKey:e.shiftKey,altKey:e.altKey});}catch(error){cancel();onError(error.message);}}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(root,'retouch:selection',e=>{if(e.detail!==target.getAttribute('data-rt'))cancel();});
  listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(w,'resize',cancel);listen(canvas,'scroll',cancel);
  let tick;const observe=()=>{if(ended)return;const current=target.getBoundingClientRect();if(!target.isConnected||target.offsetParent!==parent||parent?.clientWidth!==parentWidth||parent?.clientHeight!==parentHeight||['left','top','width','height'].some(key=>Math.abs(current[key]-r[key])>.5)){cancel();return;}tick=root.requestAnimationFrame(observe);};tick=root.requestAnimationFrame(observe);cleanups.push(()=>root.cancelAnimationFrame(tick));
  root.document.body.append(surface);surface.focus({preventScroll:true});return cancel;
 }
 const api={delta,resize,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasMove=api;
})(typeof window==='object'?window:globalThis);
