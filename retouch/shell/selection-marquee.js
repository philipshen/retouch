(function(root){
 'use strict';
 function rectangle(a,b){return {left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)};}
 function enclosed(rect,box){return box.width>0&&box.height>0&&box.left>=rect.left&&box.top>=rect.top&&box.right<=rect.left+rect.width&&box.bottom<=rect.top+rect.height;}
 function pick(d,rect){
  const candidates=[...d.querySelectorAll('body [data-rt]')].filter(el=>{
   if(['SCRIPT','STYLE','TEMPLATE','HEAD','META','LINK'].includes(el.tagName))return false;
   const css=d.defaultView.getComputedStyle(el);return !['hidden','collapse'].includes(css.visibility)&&enclosed(rect,el.getBoundingClientRect());
  });
  return candidates.filter(el=>!candidates.some(parent=>parent!==el&&parent.contains(el)));
 }
 function mount({document:d,enabled,onChange,onSelect}){
  const w=d.defaultView;let state=null,ignoreClick=null;
  const point=e=>({x:Math.max(0,Math.min(w.innerWidth,e.clientX)),y:Math.max(0,Math.min(w.innerHeight,e.clientY))});
  function finish(commit){
   if(!state)return;const current=state;state=null;
   if(d.documentElement.hasPointerCapture(current.pointerId))d.documentElement.releasePointerCapture(current.pointerId);
   onChange(null);
   if(current.moved){ignoreClick={x:current.rawLast.x,y:current.rawLast.y,time:Date.now()};if(commit)onSelect(pick(d,rectangle(current.start,current.last)),{append:current.append});}
  }
  function down(e){
   if(state||!enabled()||e.button!==0||!['HTML','BODY'].includes(e.target.tagName))return;
   e.preventDefault();e.stopImmediatePropagation();const start=point(e);state={pointerId:e.pointerId,start,last:start,rawLast:{x:e.clientX,y:e.clientY},moved:false,append:e.shiftKey||e.metaKey||e.ctrlKey};
   d.documentElement.setPointerCapture(e.pointerId);
  }
  function move(e){
   if(!state||e.pointerId!==state.pointerId)return;e.preventDefault();e.stopImmediatePropagation();state.last=point(e);state.rawLast={x:e.clientX,y:e.clientY};
   if(Math.hypot(state.last.x-state.start.x,state.last.y-state.start.y)>=4)state.moved=true;
   if(state.moved)onChange(rectangle(state.start,state.last));
  }
  function up(e){if(state&&e.pointerId===state.pointerId){move(e);finish(true);}}
  function cancel(){finish(false);}
  function escape(e){if(state&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}}
  function click(e){
   if(!ignoreClick)return;const previous=ignoreClick;ignoreClick=null;
   if(Date.now()-previous.time<500&&Math.abs(e.clientX-previous.x)<=2&&Math.abs(e.clientY-previous.y)<=2){e.preventDefault();e.stopImmediatePropagation();}
  }
  function blur(){if(!root.document.hasFocus())cancel();}
  d.addEventListener('pointerdown',down,true);d.addEventListener('click',click,true);d.documentElement.addEventListener('lostpointercapture',cancel);
  w.addEventListener('pointermove',move,true);w.addEventListener('pointerup',up,true);w.addEventListener('pointercancel',cancel,true);w.addEventListener('keydown',escape,true);w.addEventListener('resize',cancel);w.addEventListener('pagehide',cancel);w.addEventListener('blur',blur);
  root.addEventListener('keydown',escape,true);root.addEventListener('blur',blur);
  return ()=>{cancel();d.removeEventListener('pointerdown',down,true);d.removeEventListener('click',click,true);d.documentElement.removeEventListener('lostpointercapture',cancel);w.removeEventListener('pointermove',move,true);w.removeEventListener('pointerup',up,true);w.removeEventListener('pointercancel',cancel,true);w.removeEventListener('keydown',escape,true);w.removeEventListener('resize',cancel);w.removeEventListener('pagehide',cancel);w.removeEventListener('blur',blur);root.removeEventListener('keydown',escape,true);root.removeEventListener('blur',blur);};
 }
 const api={rectangle,enclosed,pick,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchMarquee=api;
})(typeof window==='object'?window:globalThis);
