(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.mount();})(typeof window==='object'?window:globalThis,function(){
 function widthAtRight(right,canvasWidth,scale){const pad=scale===1?0:24;return Math.max(240,Math.min(7680,Math.round((right<=canvasWidth-pad?2*right-canvasWidth:right-pad)/scale)));}
 function mount(){
  const frame=document.getElementById('app'),canvas=document.getElementById('frameWrap'),screens=window.RetouchScreens;
  const handle=document.createElement('button');handle.type='button';handle.id='screenResizeHandle';handle.setAttribute('role','slider');handle.setAttribute('aria-label','Resize screen width');handle.setAttribute('aria-orientation','horizontal');handle.setAttribute('aria-valuemin','240');handle.setAttribute('aria-valuemax','7680');handle.title='Drag to resize the screen. Arrow keys: 1 px; Shift: 10 px. Escape cancels.';document.body.append(handle);
  let drag=null,pending=null;
  const dimensions=()=>({width:frame.offsetWidth,height:screens.get()?.height||canvas.clientHeight});
  function position(){const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),top=Math.max(f.top,c.top),bottom=Math.min(f.bottom,c.bottom);handle.hidden=!drag&&(f.right<c.left+8||f.right>c.right+1||bottom-top<48);handle.style.left=Math.min(f.right,c.right)+'px';handle.style.top=((top+bottom)/2)+'px';const value=dimensions().width;handle.setAttribute('aria-valuenow',value);handle.setAttribute('aria-valuetext',value+' pixels');}
  const apply=(next,persist)=>screens.set(next,{persist,preservePan:true});
  function flush(){if(pending!==null){cancelAnimationFrame(pending);pending=null;}if(drag)apply({width:drag.width,height:drag.height},false);}
  function finish(save){if(!drag)return;if(drag.changed)flush();const state=drag;drag=null;if(state.changed)apply(save?{width:state.width,height:state.height}:state.original,true);if(!save){canvas.scrollLeft=state.scrollLeft;canvas.scrollTop=state.scrollTop;}if(handle.hasPointerCapture(state.pointerId))handle.releasePointerCapture(state.pointerId);handle.classList.remove('dragging');position();}
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();handle.focus({preventScroll:true});const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),size=dimensions();
   drag={pointerId:e.pointerId,original:screens.get(),width:size.width,height:Math.max(240,Math.min(7680,size.height)),x:e.clientX,right:f.right-c.left+canvas.scrollLeft,canvasWidth:canvas.clientWidth,scale:f.width/frame.offsetWidth,scrollLeft:canvas.scrollLeft,scrollTop:canvas.scrollTop,changed:false};handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
  });
  handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;if(e.clientX===drag.x&&!drag.changed)return;drag.changed=true;drag.width=widthAtRight(drag.right+e.clientX-drag.x,drag.canvasWidth,drag.scale);if(pending===null)pending=requestAnimationFrame(flush);});
  handle.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pointerId)finish(true);});
  handle.addEventListener('pointercancel',()=>finish(false));handle.addEventListener('lostpointercapture',()=>finish(false));window.addEventListener('blur',()=>finish(false));
  window.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},true);
  handle.addEventListener('keydown',e=>{const size=dimensions(),step=e.shiftKey?10:1;let value;if(e.key==='ArrowLeft')value=size.width-step;else if(e.key==='ArrowRight')value=size.width+step;else if(e.key==='Home')value=240;else if(e.key==='End')value=7680;else return;e.preventDefault();e.stopPropagation();apply({width:Math.max(240,Math.min(7680,value)),height:Math.max(240,Math.min(7680,size.height))},true);});
  window.addEventListener('retouch:viewport',position);window.addEventListener('retouch:screen',position);window.addEventListener('resize',position);canvas.addEventListener('scroll',position);frame.addEventListener('load',position);new ResizeObserver(position).observe(frame);position();
 }
 return {widthAtRight,mount};
});
