(function(root){
 'use strict';
 function indices(count,from,to){
  if(!Number.isInteger(count)||count<1||count>8||![from,to].every(index=>Number.isInteger(index)&&index>=0&&index<count))throw Error('Choose a paint in this stack.');
  const result=Array.from({length:count},(_,index)=>index);result.splice(to,0,result.splice(from,1)[0]);return result;
 }
 function mount(container,onMove,current=()=>container.isConnected){
  const rows=[...container.querySelectorAll(':scope > .paint-order-row')],d=container.ownerDocument,w=d.defaultView;
  for(const [from,row]of rows.entries()){
   const handle=d.createElement('button');handle.type='button';handle.className='paint-drag-handle';handle.textContent='⠿';handle.setAttribute('aria-label','Drag paint '+(from+1));handle.title='Drag to reorder. Arrow keys move one paint; Home and End move to the front and back.';handle.setAttribute('aria-description',handle.title);row.prepend(handle);
   const commit=to=>{if(to===from||!current())return;root.RetouchPanelFocus?.queue(handle,'Drag paint '+(to+1));return onMove(indices(rows.length,from,to));};
   handle.onkeydown=event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.repeat)return;const to=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,from+(event.key==='ArrowUp'?-1:1)));commit(to);};
   handle.onpointerdown=event=>{
    if(event.button!==0||!current())return;event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});
    const pointerId=event.pointerId,interruptions=['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'];let active=true,moved=false,to=from,lastMove=null,scrollFrame=0,scroller=container.parentElement;while(scroller&&!/(auto|scroll)/.test(w.getComputedStyle(scroller).overflowY))scroller=scroller.parentElement;
    const clear=()=>rows.forEach(item=>item.classList.remove('paint-dragging','paint-drop-before','paint-drop-after'));
    const scroll=()=>{scrollFrame=0;if(!active||!moved||!scroller)return;const box=scroller.getBoundingClientRect(),y=lastMove.clientY,speed=y<box.top+24?-12:y>Math.min(w.innerHeight,box.bottom)-24?12:0,before=scroller.scrollTop;if(speed){scroller.scrollTop+=speed;if(scroller.scrollTop!==before)move(lastMove);}};
    const move=e=>{if(e.pointerId!==pointerId||!active)return;if(!current()){finish(false);return;}moved ||= Math.hypot(e.clientX-event.clientX,e.clientY-event.clientY)>=4;if(!moved)return;lastMove=e;if(!scrollFrame)scrollFrame=w.requestAnimationFrame(scroll);clear();row.classList.add('paint-dragging');const slot=rows.findIndex(item=>{const box=item.getBoundingClientRect();return e.clientY<box.top+box.height/2;}),insertion=slot<0?rows.length:slot;to=insertion>from?insertion-1:insertion;if(to!==from){if(insertion===rows.length)rows.at(-1).classList.add('paint-drop-after');else rows[insertion].classList.add('paint-drop-before');}};
    const finish=save=>{if(!active)return;active=false;w.cancelAnimationFrame(scrollFrame);observer.disconnect();w.removeEventListener('pointermove',move,true);w.removeEventListener('pointerup',up,true);w.removeEventListener('pointercancel',cancel,true);for(const type of interruptions)w.removeEventListener(type,cancel);d.removeEventListener('keydown',escape,true);handle.removeEventListener('lostpointercapture',cancel);if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);clear();if(save&&moved)commit(to);};
    const up=e=>{if(e.pointerId===pointerId){move(e);finish(true);}},cancel=()=>finish(false),escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}};
    const observer=new MutationObserver(()=>{if(!current())cancel();});observer.observe(d.body,{childList:true,subtree:true});
    w.addEventListener('pointermove',move,true);w.addEventListener('pointerup',up,true);w.addEventListener('pointercancel',cancel,true);for(const type of interruptions)w.addEventListener(type,cancel);d.addEventListener('keydown',escape,true);handle.addEventListener('lostpointercapture',cancel);handle.setPointerCapture(pointerId);
   };
  }
 }
 const api={indices,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPaintDrag=api;
})(typeof window==='object'?window:globalThis);
