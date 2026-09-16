(function(root){
 'use strict';
 // The source adapter must persist this controller and its geometry dependencies
 // with the site. Loading it only into editor frames cannot fix authored output.
 function mount({roots,factor,media='',onError=()=>{},geometry=root.RetouchGroupMove,identity,offset=()=>[0,0],pixelOffset=()=>[0,0]}){
  if(!geometry)throw Error('Load group geometry before responsive scaling.');
  if(typeof roots!=='function'||typeof factor!=='function')throw Error('Provide live group roots and scale factor readers.');
  const document=root.document,query=media?root.matchMedia(media):null;
  let preview=null,pending=0,disposed=false,paused=0,managed=new Set();
  const observed=new Set(),sizes=new WeakMap();
  const schedule=()=>{if(!disposed&&!paused&&!pending)pending=root.requestAnimationFrame(()=>{pending=0;refresh();});};
  const mutation=new root.MutationObserver(schedule);
  const resize=new root.ResizeObserver(entries=>{
   let changed=false;
   for(const entry of entries){const value=entry.contentRect.width+','+entry.contentRect.height;if(sizes.get(entry.target)!==value){sizes.set(entry.target,value);changed=true;}}
   if(changed)schedule();
  });
  function observe(elements){
   const next=new Set([document.documentElement]);
   for(const element of elements)for(let node=element;node;node=node.parentElement)next.add(node);
   for(const node of observed)if(!next.has(node)){resize.unobserve(node);observed.delete(node);}
   for(const node of next)if(!observed.has(node)){observed.add(node);resize.observe(node);}
   mutation.observe(document.documentElement,{subtree:true,attributes:true,childList:true,characterData:true});
  }
  function refresh(){
   if(disposed||paused)return;
   mutation.disconnect();
   let targets=[];
   try{
    // Restore only our own writes. A host change to either property becomes
    // part of the next baseline rather than being overwritten on cleanup.
    preview?.restore();preview=null;managed.clear();
    const selected=roots();if(!Array.isArray(selected))throw Error('Resolve an array of group roots.');targets=selected.filter(el=>el?.nodeType===1&&el.ownerDocument===document);
    if(query&&!query.matches)return;
    const value=factor(),shift=offset(),pixels=pixelOffset();if([shift,pixels].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n))))throw Error('Resolve a finite scale offset.');
    const members=geometry.measureSelection(selected,()=>false,identity);targets=members.map(item=>item.el);managed=new Set(targets);
    const memberFactors=Object.fromEntries(members.map(item=>[item.id,geometry.memberScale(item.el)]));
    const movements=Object.fromEntries(members.map(item=>[item.id,geometry.scaleMovement(item.el)]));
    if(value===1&&Object.values(memberFactors).every(n=>n===1)&&[...shift,...pixels,...Object.values(movements).flatMap(value=>[value.x,value.y])].every(n=>n===0))return;
    const left=Math.min(...members.map(item=>item.rect.x)),top=Math.min(...members.map(item=>item.rect.y)),width=Math.max(...members.map(item=>item.rect.right))-left,height=Math.max(...members.map(item=>item.rect.bottom))-top;
    preview=geometry.scalePreview(members,{runtime:true});preview.update({factor:value,movements,memberFactors,offset:{x:shift[0]*width+pixels[0],y:shift[1]*height+pixels[1]}});
   }catch(error){preview?.restore();preview=null;onError(error);}
   finally{if(!disposed)observe(targets);}
  }
  const fontSet=document.fonts;
  root.addEventListener('resize',schedule);
  document.addEventListener('load',schedule,true);
  fontSet?.addEventListener('loadingdone',schedule);
  query?.addEventListener('change',schedule);
  refresh();
  return {refresh,manages:el=>managed.has(el),owns:(el,property)=>!!preview?.owns(el,property),pause(){paused++;root.cancelAnimationFrame(pending);pending=0;let released=false;return ()=>{if(released)return;released=true;paused--;schedule();};},dispose(){
   if(disposed)return;disposed=true;
   root.cancelAnimationFrame(pending);pending=0;mutation.disconnect();resize.disconnect();
   root.removeEventListener('resize',schedule);document.removeEventListener('load',schedule,true);
   fontSet?.removeEventListener('loadingdone',schedule);query?.removeEventListener('change',schedule);
   preview?.restore();preview=null;
  }};
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchResponsiveGroupScale=api;
})(typeof window==='object'?window:globalThis);
