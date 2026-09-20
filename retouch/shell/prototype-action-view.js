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
 function dragScroll(box,onStop){
  let job=null,point=null,time=null,dialog=null,active=false;
  function stop(){const wasActive=active;active=false;if(job!==null)cancelAnimationFrame(job);job=null;point=null;time=null;document.removeEventListener('dragover',over,true);document.removeEventListener('drop',stop);document.removeEventListener('dragend',stop);document.removeEventListener('mouseup',stop,true);document.removeEventListener('keydown',key,true);root.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);if(wasActive)onStop?.();}
  function over(event){point={x:event.clientX,y:event.clientY};if(dialog?.contains(event.target)){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}}
  function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();stop();}}
  function tick(now){job=null;if(!active||!box.isConnected||!dialog?.matches(':popover-open')||dialog.inert||document.hidden){stop();return;}const elapsed=time===null?0:Math.min(40,now-time);time=now;
   if(point){const r=dialog.getBoundingClientRect(),top=r.top+(dialog.querySelector('header')?.getBoundingClientRect().height||0),edge=Math.min(48,(r.bottom-top)/3);if(point.x>=r.left&&point.x<=r.right&&point.y>=r.top&&point.y<=r.bottom){const velocity=point.y<top+edge?-Math.min(1,(top+edge-point.y)/edge):point.y>r.bottom-edge?Math.min(1,(point.y-r.bottom+edge)/edge):0;if(velocity)dialog.scrollTop+=velocity*720*elapsed/1000;}}
   job=requestAnimationFrame(tick);
  }
  return {start(event){stop();dialog=box.closest('.prototype-details');if(!dialog)return;active=true;point={x:event.clientX,y:event.clientY};document.addEventListener('dragover',over,true);document.addEventListener('drop',stop);document.addEventListener('dragend',stop);document.addEventListener('mouseup',stop,true);document.addEventListener('keydown',key,true);root.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);job=requestAnimationFrame(tick);},stop,get active(){return active;}};
 }
 const api={reconcile,dragScroll};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeActionView=api;
})(typeof window==='object'?window:globalThis);
