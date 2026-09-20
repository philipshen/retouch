(function(root){
 'use strict';
 function reconcile(next,previous=[]){
  const used=new Set(),matches=new Map(),key=path=>JSON.stringify(path);
  // Match unchanged actions first, including those moved to another branch.
  function match(predicate){next.forEach((item,n)=>{if(matches.has(n))return;const index=previous.findIndex((old,i)=>!used.has(i)&&predicate(old,item));if(index>=0){used.add(index);matches.set(n,previous[index].open);}});}
  match((old,item)=>old.signature===item.signature&&key(old.path)===key(item.path));
  match((old,item)=>old.signature===item.signature);
  // A field edit changes the signature but keeps the action at the same path.
  return next.map((item,n)=>{if(matches.has(n))return matches.get(n);const index=previous.findIndex((old,i)=>!used.has(i)&&key(old.path)===key(item.path)&&!next.some(candidate=>candidate.signature===old.signature));if(index<0)return true;used.add(index);return previous[index].open;});
 }
 function reorder(box,commit){
  const doc=box.ownerDocument,win=doc.defaultView;
  let gesture=null,job=null,previousTime=null,marker=null;
  function mark(target){
   if(marker===target)return;
   marker?.classList.remove('prototype-action-drop');marker=target;
   marker?.classList.add('prototype-action-drop');
  }
  function valid(){return gesture&&box.isConnected&&gesture.dialog.matches(':popover-open')&&!gesture.dialog.inert&&!doc.hidden;}
  function target(){
   const g=gesture,r=g.dialog.getBoundingClientRect();
   if(g.x<r.left||g.x>r.right||g.y<r.top||g.y>r.bottom)return null;
   const el=doc.elementFromPoint(g.x,g.y)?.closest('[data-action-drop-path]');
   if(!el||!box.contains(el))return null;
   const path=JSON.parse(el.dataset.actionDropPath);
   // A conditional cannot be moved into itself or either of its branches.
   if(g.from.every((value,i)=>path[i]===value))return null;
   return el;
  }
  function tick(now){
   job=null;
   if(!valid()){finish();return;}
   const g=gesture,elapsed=previousTime===null?0:Math.min(40,now-previousTime);previousTime=now;
   if(g.moved){
    const r=g.dialog.getBoundingClientRect(),top=r.top+(g.dialog.querySelector('header')?.getBoundingClientRect().height||0),edge=Math.min(48,(r.bottom-top)/3);
    if(edge>0&&g.x>=r.left&&g.x<=r.right&&g.y>=r.top&&g.y<=r.bottom){
     const speed=g.y<top+edge?-Math.min(1,(top+edge-g.y)/edge):g.y>r.bottom-edge?Math.min(1,(g.y-r.bottom+edge)/edge):0;
     if(speed)g.dialog.scrollTop+=speed*720*elapsed/1000;
    }
    mark(target());
   }
   job=win.requestAnimationFrame(tick);
  }
  function finish(){
   const g=gesture;if(!g)return;
   gesture=null;if(job!==null)win.cancelAnimationFrame(job);job=null;previousTime=null;mark(null);
   doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',up,true);
   doc.removeEventListener('pointercancel',cancel,true);doc.removeEventListener('keydown',key,true);
   doc.removeEventListener('visibilitychange',finish);win.removeEventListener('blur',finish);
   g.handle.removeEventListener('lostpointercapture',finish);box.classList.remove('prototype-action-dragging');
   if(g.handle.hasPointerCapture(g.id))g.handle.releasePointerCapture(g.id);
   if(g.moved){
    // The pointer release must not also toggle a card or activate Add action.
    const controller=new win.AbortController(),options={capture:true,signal:controller.signal};
    doc.addEventListener('click',event=>{if(event.detail){event.preventDefault();event.stopImmediatePropagation();}controller.abort();},options);
    // Escape can precede release by an arbitrary amount of time. A fresh press
    // ends the guard, so the next independent click always behaves normally.
    doc.addEventListener('pointerdown',()=>controller.abort(),options);
    doc.addEventListener('pointerup',()=>win.setTimeout(()=>controller.abort(),0),options);
    if(g.released)win.setTimeout(()=>controller.abort(),0);
   }
  }
  function move(event){
   const g=gesture;if(!g||event.pointerId!==g.id)return;
   if(!valid()){finish();return;}
   g.x=event.clientX;g.y=event.clientY;
   if(!g.moved&&Math.hypot(g.x-g.startX,g.y-g.startY)>=5){g.moved=true;box.classList.add('prototype-action-dragging');}
   if(g.moved){event.preventDefault();mark(target());}
  }
  function up(event){
   const g=gesture;if(!g||event.pointerId!==g.id)return;
   g.x=event.clientX;g.y=event.clientY;
   const destination=g.moved&&valid()?target():null;
   const path=destination?JSON.parse(destination.dataset.actionDropPath):null;
   if(g.moved){event.preventDefault();event.stopPropagation();}
   g.released=true;finish();if(path)commit(g.from,path);
  }
  function cancel(event){if(event.pointerId===gesture?.id)finish();}
  function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish();}}
  box.addEventListener('pointerdown',event=>{
   if(gesture||event.button!==0||!event.isPrimary)return;
   const handle=event.target.closest('.prototype-action > summary');
   if(!handle||!box.contains(handle))return;
   const dialog=box.closest('.prototype-details');if(!dialog||dialog.inert)return;
   gesture={id:event.pointerId,handle,dialog,from:JSON.parse(handle.parentElement.dataset.actionPath),x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
   handle.setPointerCapture(event.pointerId);handle.addEventListener('lostpointercapture',finish);
   doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',up,true);
   doc.addEventListener('pointercancel',cancel,true);doc.addEventListener('keydown',key,true);
   doc.addEventListener('visibilitychange',finish);win.addEventListener('blur',finish);
   job=win.requestAnimationFrame(tick);
  });
  return {cancel:finish};
 }
 const api={reconcile,reorder};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeActionView=api;
})(typeof window==='object'?window:globalThis);
