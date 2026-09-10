(function(root){
 'use strict';
 function mount({enabled,onActivate}){
  const d=root.document,canvas=d.getElementById('frameWrap'),frame=d.getElementById('app'),button=d.getElementById('canvasHand');
  const surface=d.createElement('div');surface.className='canvas-pan-surface';surface.setAttribute('aria-label','Pan canvas');surface.hidden=true;d.body.append(surface);
  let held=false,toggled=false,drag=null;const hooked=new WeakSet();
  function paint(){
   const active=held||toggled||!!drag,r=canvas.getBoundingClientRect();surface.hidden=!active;
   Object.assign(surface.style,{left:r.left+'px',top:r.top+'px',width:canvas.clientWidth+'px',height:canvas.clientHeight+'px',cursor:drag?'grabbing':'grab'});
   button.setAttribute('aria-pressed',String(toggled));
  }
  function cancel(){held=false;toggled=false;if(drag)drag.canceled=true;paint();}
  function activate(){if(!enabled())return false;onActivate();return true;}
  function keydown(e){
   if(e.key==='Escape'&&(held||toggled||drag)){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
   if(e.code!=='Space'||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||e.target?.isContentEditable||e.target?.closest?.('input,textarea,select,summary,button:not([role="treeitem"]),[contenteditable]')||d.querySelector('dialog[open]'))return;
   if(!held&&!activate())return;e.preventDefault();e.stopImmediatePropagation();held=true;paint();
  }
  function keyup(e){if(e.code==='Space'&&held){e.preventDefault();e.stopImmediatePropagation();held=false;paint();}}
  function hook(w){if(hooked.has(w.document))return;hooked.add(w.document);w.addEventListener('keydown',keydown,true);w.addEventListener('keyup',keyup,true);}
  hook(root);frame.addEventListener('load',()=>{cancel();try{hook(frame.contentWindow);}catch{}});
  button.addEventListener('click',()=>{if(toggled){cancel();return;}if(activate()){toggled=true;paint();}});
  surface.addEventListener('pointerdown',e=>{
   if(drag?.canceled){const id=drag.id;drag=null;if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);e.preventDefault();e.stopImmediatePropagation();root.requestAnimationFrame(paint);return;}
   if(e.button!==0||drag||!enabled())return;e.preventDefault();e.stopImmediatePropagation();
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:canvas.scrollLeft,top:canvas.scrollTop};surface.setPointerCapture(e.pointerId);paint();
  });
  surface.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();if(drag.canceled)return;
   canvas.scrollLeft=drag.left+drag.x-e.clientX;canvas.scrollTop=drag.top+drag.y-e.clientY;
  });
  function up(e){
   if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();const id=drag.id;drag=null;
   if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
   // Consume the compatibility click before removing the hand surface.
   root.requestAnimationFrame(paint);
  }
  surface.addEventListener('pointerup',up);surface.addEventListener('pointercancel',up);
  surface.addEventListener('lostpointercapture',()=>{if(drag){drag=null;paint();}});
  for(const type of ['click','dblclick','contextmenu'])surface.addEventListener(type,e=>{e.preventDefault();e.stopImmediatePropagation();});
  surface.addEventListener('wheel',e=>{
   e.preventDefault();e.stopImmediatePropagation();
   if(!e.ctrlKey&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))){canvas.scrollLeft+=(e.deltaX||e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientWidth:1);return;}
   canvas.dispatchEvent(new WheelEvent('wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,clientX:e.clientX,clientY:e.clientY,bubbles:true,cancelable:true}));
  },{passive:false});
  root.addEventListener('blur',cancel);root.addEventListener('retouch:before-zoom',cancel);root.addEventListener('retouch:screen',cancel);
  new ResizeObserver(()=>{if(drag)cancel();paint();}).observe(canvas);paint();
  return {cancel};
 }
 root.RetouchCanvasPan={mount};
})(window);
