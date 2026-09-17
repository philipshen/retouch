(function(){
 'use strict';
 // Each document owns its listener. Refresh drops navigated, hidden or removed frames.
 window.RetouchLinkedScroll=function(){
  const listeners=new Map();let expected=new WeakMap();
  const position=node=>[node.scrollLeft,node.scrollTop];
  const near=(a,b)=>a.every((value,index)=>Math.abs(value-b[index])<1.5);
  function identity(node){
   const id=node.getAttribute('data-rt'),instance=node.getAttribute('data-rt-i');
   if(!id&&!instance)return null;
   return {id,instance};
  }
  function peers(d,key){return [...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(node=>node.getAttribute('data-rt')===key.id&&node.getAttribute('data-rt-i')===key.instance);}
  function axisEnabled(node,axis){
   const d=node.ownerDocument,w=d.defaultView,style=w.getComputedStyle(node);
   if(node!==d.scrollingElement)return /auto|scroll/.test(style['overflow'+axis]);
   const html=w.getComputedStyle(d.documentElement),body=d.body&&w.getComputedStyle(d.body),overflow=html['overflow'+axis]==='visible'?(body?.['overflow'+axis]||'visible'):html['overflow'+axis];
   return !/hidden|clip/.test(overflow);
  }
  function scroll(d,event){
   const node=event.target===d?d.scrollingElement:event.target;
   if(!node?.ownerDocument||!node.isConnected)return;
   const now=position(node),pending=expected.get(node);expected.delete(node);if(pending&&near(now,pending))return;
   const root=node===d.scrollingElement,key=root?null:identity(node);
   // Repeated source instances can reorder at breakpoints. Never guess a peer.
   if(!root&&(!key||peers(d,key).length!==1))return;
   const ranges=[node.scrollWidth-node.clientWidth,node.scrollHeight-node.clientHeight],fractions=ranges.map((range,index)=>range>0?Math.max(-1,Math.min(1,now[index]/range)):null);
   for(const targetDoc of listeners.keys()){
    if(targetDoc===d)continue;
    const matches=root?[targetDoc.scrollingElement]:peers(targetDoc,key);if(matches.length!==1)continue;
    const target=matches[0];if(!target||!target.getClientRects().length)continue;
    const before=position(target),limits=[target.scrollWidth-target.clientWidth,target.scrollHeight-target.clientHeight],next=before.map((value,index)=>fractions[index]!==null&&axisEnabled(node,index?'Y':'X')&&axisEnabled(target,index?'Y':'X')?fractions[index]*limits[index]:value);
    if(near(before,next))continue;
    target.scrollTo({left:next[0],top:next[1],behavior:'instant'});expected.set(target,position(target));
   }
  }
  return {refresh(documents){
   const current=new Set(documents);for(const [d,listener]of listeners)if(!current.has(d)){d.removeEventListener('scroll',listener,true);listeners.delete(d);}
   for(const d of current)if(!listeners.has(d)){const listener=event=>scroll(d,event);d.addEventListener('scroll',listener,{capture:true,passive:true});listeners.set(d,listener);}
  },clear(){for(const [d,listener]of listeners)d.removeEventListener('scroll',listener,true);listeners.clear();expected=new WeakMap();}};
 };
})();
