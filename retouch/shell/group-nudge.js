(function(root){
 'use strict';
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 function mount({document:d,host=root,initialKey,current,prepare,onCommit,onEnd,onError}){
  const cleanups=[],held=new Set();let ended=false,released=false,context=null,preview=null,x=0,y=0,raf;
  function listen(target,type,fn){target.addEventListener(type,fn,true);cleanups.push(()=>target.removeEventListener(type,fn,true));}
  function valid(){try{return current()&&(!preview||preview.current());}catch{return false;}}
  function end(commit=false){
   if(ended)return;const allowed=commit&&context&&valid();ended=true;host.cancelAnimationFrame(raf);cleanups.forEach(fn=>fn());preview?.restore();onEnd();
   if(allowed&&(x||y))Promise.resolve().then(()=>onCommit(context,{x,y})).catch(error=>onError(error.message));
  }
  function paint(){if(ended||!context)return;if(!valid()){end();return;}try{preview.update({x,y});}catch(error){end();onError(error.message);}}
  function down(e){
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end();return;}
   if(e.key==='Shift')return;
   if(e.isComposing||e.altKey||e.ctrlKey||e.metaKey||!directions[e.key]){end();return;}
   e.preventDefault();e.stopImmediatePropagation();if(!valid()){end();return;}released=false;held.add(e.key);const step=e.shiftKey?10:1;x+=directions[e.key][0]*step;y+=directions[e.key][1]*step;paint();
  }
  function up(e){if(!held.delete(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(!held.size){released=true;if(context)end(true);}}
  for(const target of new Set([host,d.defaultView])){
   listen(target,'keydown',down);listen(target,'keyup',up);
   for(const type of ['blur','resize','pagehide','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(target,type,()=>end());
   listen(target,'pointerdown',()=>end());listen(target,'scroll',()=>end());
  }
  listen(host,'retouch:selection',()=>{if(!current())end();});
  function tick(){if(ended)return;if(!valid()){end();return;}raf=host.requestAnimationFrame(tick);}
  down(initialKey);if(!ended)raf=host.requestAnimationFrame(tick);
  Promise.resolve().then(()=>ended?null:prepare()).then(result=>{
   if(ended)return;if(!result||!current()){end();return;}context=result;
   if(released){end(true);return;}preview=result.preview();paint();
  }).catch(error=>{if(!ended){end();onError(error.message);}});
  return ()=>end();
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupNudge=api;
})(typeof window==='object'?window:globalThis);
