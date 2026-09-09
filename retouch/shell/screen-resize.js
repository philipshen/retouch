(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.mount();})(typeof window==='object'?window:globalThis,function(){
 const clamp=value=>Math.max(240,Math.min(7680,Math.round(value)));
 function widthAtRight(right,canvasWidth,scale){const pad=scale===1?0:24;return clamp((right<=canvasWidth-pad?2*right-canvasWidth:right-pad)/scale);}
 function heightAtDelta(height,delta,scale){return clamp(height+delta/scale);}
 function mount(){
  const frame=document.getElementById('app'),canvas=document.getElementById('frameWrap'),screens=window.RetouchScreens,handles={};
  let drag=null,pending=null;
  const dimensions=()=>({width:frame.offsetWidth,height:screens.get()?.height||canvas.clientHeight});
  const apply=(next,persist)=>screens.set(next,{persist,preservePan:true});
  function position(){
   const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),top=Math.max(f.top,c.top),bottom=Math.min(f.bottom,c.bottom),left=Math.max(f.left,c.left),right=Math.min(f.right,c.right),size=dimensions();
   for(const [axis,handle]of Object.entries(handles)){
    handle.hidden=drag?.axis!==axis&&(axis==='width'?(f.right<c.left+8||f.right>c.right+1||bottom-top<48):(f.bottom<c.top+8||f.bottom>c.bottom+1||right-left<48));
    handle.style.left=(axis==='width'?Math.min(f.right,c.right):(left+right)/2)+'px';handle.style.top=(axis==='width'?(top+bottom)/2:Math.min(f.bottom,c.bottom))+'px';
    handle.setAttribute('aria-valuenow',size[axis]);handle.setAttribute('aria-valuetext',size[axis]+' pixels');
   }
  }
  function flush(){if(pending!==null){cancelAnimationFrame(pending);pending=null;}if(drag)apply({width:drag.width,height:drag.height},false);}
  function finish(save){
   if(!drag)return;if(drag.changed)flush();const state=drag;drag=null;
   if(state.changed)apply(save?{width:state.width,height:state.height}:state.original,true);
   if(!save){canvas.scrollLeft=state.scrollLeft;canvas.scrollTop=state.scrollTop;}
   if(state.handle.hasPointerCapture(state.pointerId))state.handle.releasePointerCapture(state.pointerId);state.handle.classList.remove('dragging');position();
  }
  function move(e){
   if(!drag||e.pointerId!==drag.pointerId)return;const delta=drag.axis==='width'?e.clientX-drag.x:e.clientY-drag.y;
   if(delta===0&&!drag.changed)return;drag.changed=true;
   if(drag.axis==='width')drag.width=widthAtRight(drag.right+delta,drag.canvasWidth,drag.scale);else drag.height=heightAtDelta(drag.initialHeight,delta,drag.scale);
   if(pending===null)pending=requestAnimationFrame(flush);
  }
  for(const axis of ['width','height']){
   const handle=document.createElement('button');handles[axis]=handle;handle.type='button';handle.id=axis==='width'?'screenResizeHandle':'screenHeightResizeHandle';handle.className='screen-resize-handle';handle.dataset.axis=axis;
   handle.setAttribute('role','slider');handle.setAttribute('aria-label','Resize screen '+axis);handle.setAttribute('aria-orientation',axis==='width'?'horizontal':'vertical');handle.setAttribute('aria-valuemin','240');handle.setAttribute('aria-valuemax','7680');handle.title='Drag to resize screen '+axis+'. Arrow keys: 1 px; Shift: 10 px. Escape cancels.';document.body.append(handle);
   handle.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();handle.focus({preventScroll:true});const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),size=dimensions();
    const initialHeight=axis==='height'?frame.offsetHeight:clamp(size.height);
    drag={axis,handle,pointerId:e.pointerId,original:screens.get(),width:size.width,height:initialHeight,initialHeight,x:e.clientX,y:e.clientY,right:f.right-c.left+canvas.scrollLeft,canvasWidth:canvas.clientWidth,scale:f.width/frame.offsetWidth,scrollLeft:canvas.scrollLeft,scrollTop:canvas.scrollTop,changed:false};handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
   });
   handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pointerId){move(e);finish(true);}});
   handle.addEventListener('pointercancel',()=>finish(false));handle.addEventListener('lostpointercapture',()=>finish(false));
   handle.addEventListener('keydown',e=>{
    const size=dimensions(),step=e.shiftKey?10:1;let value;
    if(e.key===(axis==='width'?'ArrowLeft':'ArrowUp'))value=size[axis]-step;else if(e.key===(axis==='width'?'ArrowRight':'ArrowDown'))value=size[axis]+step;else if(e.key==='Home')value=240;else if(e.key==='End')value=7680;else return;
    e.preventDefault();e.stopPropagation();apply({...size,height:clamp(size.height),[axis]:clamp(value)},true);
   });
  }
  window.addEventListener('blur',()=>finish(false));window.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},true);
  window.addEventListener('retouch:viewport',position);window.addEventListener('retouch:screen',position);window.addEventListener('resize',position);canvas.addEventListener('scroll',position);frame.addEventListener('load',position);new ResizeObserver(position).observe(frame);position();
 }
 return {widthAtRight,heightAtDelta,mount};
});
