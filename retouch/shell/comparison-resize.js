(function(){
 'use strict';
 const rail=document.getElementById('screenComparisons'),main=document.getElementById('main'),handle=document.createElement('div');
 const project=window.__RT_RENDERING?.stateScope?.project,key='retouch.comparison-width.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
 let preferred=270,drag=null;
 try{const saved=Number(localStorage.getItem(key));if(Number.isInteger(saved)&&saved>=240&&saved<=640)preferred=saved;}catch{}
 handle.id='comparisonResizeHandle';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label','Resize comparison panel');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-controls',rail.id);handle.title='Drag to resize comparisons. Arrow keys move the edge; Shift steps 50 px. Double-click resets. Escape cancels.';rail.before(handle);
 const maximum=()=>Math.max(240,Math.min(640,main.clientWidth-document.getElementById('layersPanel').offsetWidth-document.getElementById('panel').offsetWidth-168));
 function save(){try{localStorage.setItem(key,String(preferred));}catch{}}
 function layout(){
  const max=maximum(),width=Math.max(240,Math.min(max,preferred));handle.hidden=rail.hidden;rail.style.width=width+'px';
  handle.setAttribute('aria-valuemin','240');handle.setAttribute('aria-valuemax',String(max));handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuetext',width+' pixels wide');
 }
 function finish(commit){
  if(!drag)return;const state=drag;drag=null;if(!commit)preferred=state.previous;else save();
  if(handle.hasPointerCapture(state.id))handle.releasePointerCapture(state.id);handle.classList.remove('dragging');layout();
 }
 handle.addEventListener('pointerdown',event=>{if(event.button!==0||drag)return;event.preventDefault();handle.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,width:rail.offsetWidth,previous:preferred};handle.setPointerCapture(event.pointerId);handle.classList.add('dragging');});
 handle.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;preferred=Math.max(240,Math.min(maximum(),Math.round(drag.width+drag.x-event.clientX)));layout();});
 handle.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId)finish(true);});
 handle.addEventListener('pointercancel',()=>finish(false));handle.addEventListener('lostpointercapture',()=>finish(false));
 handle.addEventListener('dblclick',()=>{finish(false);preferred=270;save();layout();});
 handle.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();finish(false);return;}
  const step=event.shiftKey?50:10,width=rail.offsetWidth,next=event.key==='ArrowLeft'?width+step:event.key==='ArrowRight'?width-step:event.key==='Home'?240:event.key==='End'?maximum():null;
  if(next===null||drag)return;event.preventDefault();event.stopPropagation();preferred=Math.max(240,Math.min(maximum(),next));save();layout();
 });
 window.addEventListener('blur',()=>finish(false));window.addEventListener('resize',()=>{finish(false);layout();});
 new MutationObserver(()=>{if(rail.hidden)finish(false);layout();}).observe(rail,{attributes:true,attributeFilter:['hidden']});
 new ResizeObserver(layout).observe(main);layout();
})();
