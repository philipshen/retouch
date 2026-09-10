(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.mount();})(typeof window==='object'?window:globalThis,function(){
 const clamp=value=>Math.max(240,Math.min(7680,Math.round(value)));
 function widthAtRight(right,canvasWidth,scale){const pad=scale===1?0:24;return clamp((right<=canvasWidth-pad?2*right-canvasWidth:right-pad)/scale);}
 function heightAtDelta(height,delta,scale){return clamp(height+delta/scale);}
 function preserveAspect(width,height,initialWidth,initialHeight){
  const x=width/initialWidth,y=height/initialHeight,requested=Math.abs(x-1)>Math.abs(y-1)?x:y;
  const ratio=Math.max(240/initialWidth,240/initialHeight,Math.min(7680/initialWidth,7680/initialHeight,requested));
  return {width:clamp(initialWidth*ratio),height:clamp(initialHeight*ratio)};
 }
 function mount(){
  const frame=document.getElementById('app'),canvas=document.getElementById('frameWrap'),screens=window.RetouchScreens,handles={};
  let drag=null,pending=null,applying=false;
  const dimensions=()=>({width:frame.offsetWidth,height:screens.get()?.height||canvas.clientHeight});
  const apply=(next,persist,axis)=>{applying=true;try{screens.set(screens.constrainMain(next,axis),{persist,preservePan:true,preserveRatio:true});}finally{applying=false;}};
  function position(){
   const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),top=Math.max(f.top,c.top),bottom=Math.min(f.bottom,c.bottom),left=Math.max(f.left,c.left),right=Math.min(f.right,c.right),size=dimensions();
   for(const [axis,handle]of Object.entries(handles)){
    const rightHidden=f.right<c.left+8||f.right>c.right+1,bottomHidden=f.bottom<c.top+8||f.bottom>c.bottom+1;
    handle.hidden=drag?.axis!==axis&&(axis==='both'?rightHidden||bottomHidden:axis==='width'?rightHidden||bottom-top<48:bottomHidden||right-left<48);
    handle.style.left=(axis==='height'?(left+right)/2:Math.min(f.right,c.right))+'px';handle.style.top=(axis==='width'?(top+bottom)/2:Math.min(f.bottom,c.bottom))+'px';
    if(axis==='both')handle.title=size.width+' × '+size.height+' px. Drag both dimensions; hold Shift to keep the starting ratio. Arrow keys resize one axis; Shift steps 10 px. Escape cancels.';
    else{handle.setAttribute('aria-valuenow',size[axis]);handle.setAttribute('aria-valuetext',size[axis]+' pixels');}
   }
  }
  function flush(){if(pending!==null){cancelAnimationFrame(pending);pending=null;}if(drag)apply({width:drag.width,height:drag.height},false);}
  function finish(save){
   if(!drag)return;if(drag.changed)flush();const state=drag;drag=null;
   if(state.changed)apply(save?{width:state.width,height:state.height}:state.original,true);
   if(!save){canvas.scrollLeft=state.scrollLeft;canvas.scrollTop=state.scrollTop;}
   if(state.handle.hasPointerCapture(state.pointerId))state.handle.releasePointerCapture(state.pointerId);state.handle.classList.remove('dragging');position();
  }
  function discard(){
   if(!drag)return;if(pending!==null){cancelAnimationFrame(pending);pending=null;}const state=drag;drag=null;
   if(state.handle.hasPointerCapture(state.pointerId))state.handle.releasePointerCapture(state.pointerId);state.handle.classList.remove('dragging');position();
  }
  function move(e){
   if(!drag||e.pointerId!==drag.pointerId)return;
   if(canvas.clientWidth!==drag.canvasWidth||canvas.clientHeight!==drag.canvasHeight){finish(false);return;}
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.lastX=e.clientX;drag.lastY=e.clientY;
   if((drag.axis==='width'?dx===0:drag.axis==='height'?dy===0:dx===0&&dy===0)&&!drag.changed)return;drag.changed=true;
   if(drag.axis!=='height')drag.width=widthAtRight(drag.right+dx,drag.canvasWidth,drag.scale);
   if(drag.axis!=='width')drag.height=heightAtDelta(drag.initialHeight,dy,drag.scale);
   Object.assign(drag,screens.constrainMain({width:drag.width,height:drag.height},drag.axis,{width:drag.initialWidth,height:drag.initialHeight}));
   if(drag.axis==='both'&&e.shiftKey&&!screens.isRatioLocked())Object.assign(drag,preserveAspect(drag.width,drag.height,drag.initialWidth,drag.initialHeight));
   if(pending===null)pending=requestAnimationFrame(flush);
  }
  for(const axis of ['width','height','both']){
   const handle=document.createElement('button');handles[axis]=handle;handle.type='button';handle.id=axis==='width'?'screenResizeHandle':axis==='height'?'screenHeightResizeHandle':'screenCornerResizeHandle';handle.className='screen-resize-handle';handle.dataset.axis=axis;
   if(axis==='both')handle.setAttribute('aria-label','Resize screen dimensions');else{handle.setAttribute('role','slider');handle.setAttribute('aria-label','Resize screen '+axis);handle.setAttribute('aria-orientation',axis==='width'?'horizontal':'vertical');handle.setAttribute('aria-valuemin','240');handle.setAttribute('aria-valuemax','7680');handle.title='Drag to resize screen '+axis+'. Arrow keys: 1 px; Shift: 10 px. Escape cancels.';}document.body.append(handle);
   handle.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();handle.focus({preventScroll:true});const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),size=dimensions();
    const initialHeight=axis!=='width'?frame.offsetHeight:clamp(size.height);
    drag={axis,handle,pointerId:e.pointerId,original:screens.get(),width:size.width,initialWidth:size.width,height:initialHeight,initialHeight,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,right:f.right-c.left+canvas.scrollLeft,canvasWidth:canvas.clientWidth,canvasHeight:canvas.clientHeight,scale:f.width/frame.offsetWidth,scrollLeft:canvas.scrollLeft,scrollTop:canvas.scrollTop,changed:false};handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
   });
   handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pointerId){move(e);finish(true);}});
   handle.addEventListener('pointercancel',()=>finish(false));handle.addEventListener('lostpointercapture',()=>finish(false));
   handle.addEventListener('keydown',e=>{
    const size=dimensions(),step=e.shiftKey?10:1;let value;
    if(axis==='both'){const key={ArrowLeft:['width',-step],ArrowRight:['width',step],ArrowUp:['height',-step],ArrowDown:['height',step]}[e.key];if(!key)return;e.preventDefault();e.stopPropagation();apply({...size,height:clamp(size.height),[key[0]]:clamp(size[key[0]]+key[1])},true,key[0]);return;}
    if(e.key===(axis==='width'?'ArrowLeft':'ArrowUp'))value=size[axis]-step;else if(e.key===(axis==='width'?'ArrowRight':'ArrowDown'))value=size[axis]+step;else if(e.key==='Home')value=240;else if(e.key==='End')value=7680;else return;
    e.preventDefault();e.stopPropagation();apply({...size,height:clamp(size.height),[axis]:clamp(value)},true,axis);
   });
  }
  window.addEventListener('blur',()=>finish(false));window.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},true);
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{if(e.key==='Shift'&&drag?.axis==='both')move({pointerId:drag.pointerId,clientX:drag.lastX,clientY:drag.lastY,shiftKey:type==='keydown'});});
  window.addEventListener('retouch:screen',()=>{if(!applying)discard();},true);
  window.addEventListener('retouch:before-zoom',()=>finish(false));
  window.addEventListener('resize',()=>finish(false),true);
  new ResizeObserver(()=>{if(drag&&canvas.clientWidth!==drag.canvasWidth)finish(false);}).observe(canvas);
  window.addEventListener('retouch:zoom',position);
  window.addEventListener('retouch:viewport',position);window.addEventListener('retouch:screen',position);window.addEventListener('resize',position);canvas.addEventListener('scroll',position);frame.addEventListener('load',position);new ResizeObserver(position).observe(frame);position();
 }
 return {widthAtRight,heightAtDelta,preserveAspect,mount};
});
