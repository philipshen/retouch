(function(root){
 'use strict';
 // The source adapter must persist this controller and its geometry dependencies
 // with the site. Loading it only into editor frames cannot fix authored output.
 function mount({roots,factor,media='',onError=()=>{},geometry=root.RetouchGroupMove,identity,offset=()=>[0,0],pixelOffset=()=>[0,0],steps=()=>[]}){
  if(!geometry)throw Error('Load group geometry before responsive scaling.');
  if(typeof roots!=='function'||typeof factor!=='function')throw Error('Provide live group roots and scale factor readers.');
  const document=root.document,query=media?root.matchMedia(media):null;
  let previews=[],pending=0,disposed=false,paused=0,managed=new Set();
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
  const owns=(el,property)=>previews.some(preview=>preview.owns(el,property));
  function restore(){for(let i=previews.length-1;i>=0;i--)previews[i].restore();previews=[];}
  function refresh(){
   if(disposed||paused)return;
   mutation.disconnect();
   let targets=[];
   try{
    // Restore only our own writes. A host change to either property becomes
    // part of the next baseline rather than being overwritten on cleanup.
    restore();managed.clear();
    const selected=roots();if(!Array.isArray(selected))throw Error('Resolve an array of group roots.');targets=selected.filter(el=>el?.nodeType===1&&el.ownerDocument===document).flatMap(el=>[el,...el.querySelectorAll('[data-rt-scale-member],[data-rt]')]);
    if(query&&!query.matches)return;
    const value=factor(),shift=offset(),pixels=pixelOffset();if([shift,pixels].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n))))throw Error('Resolve a finite scale offset.');
    const members=geometry.measureSelection(selected,()=>false,identity,{visibleOnly:true});targets=[...new Set([...targets,...members.map(item=>item.el)])];managed=new Set(members.map(item=>item.el));if(!members.length)return;
    function apply(value,shift=[0,0],pixels=[0,0],memberFactors={},movements={}){
     if(value===1&&Object.values(memberFactors).every(n=>n===1)&&[...shift,...pixels,...Object.values(movements).flatMap(value=>[value.x,value.y])].every(n=>n===0))return;
     const current=geometry.measureSelection(selected,()=>false,identity,{visibleOnly:true}),left=Math.min(...current.map(item=>item.rect.x)),top=Math.min(...current.map(item=>item.rect.y)),width=Math.max(...current.map(item=>item.rect.right))-left,height=Math.max(...current.map(item=>item.rect.bottom))-top;
     const preview=geometry.scalePreview(current,{runtime:true,owns});previews.push(preview);preview.update({factor:value,movements,memberFactors,offset:{x:shift[0]*width+pixels[0],y:shift[1]*height+pixels[1]}});
    }
    const read=(snapshot,id)=>{let value={factor:1,move:[0,0]};for(const [width,next]of Object.entries(Object.hasOwn(snapshot,id)?snapshot[id]:{}).sort(([a],[b])=>Number(a)-Number(b)))if(Number(width)<=document.defaultView.innerWidth)value=next;return value;};
    let consumed={};
    function styles(snapshot,live=false){
     const memberFactors=Object.create(null),movements=Object.create(null);for(const item of members){const prior=read(consumed,item.id),move=live?geometry.scaleMovement(item.el):null,next=live?{factor:geometry.memberScale(item.el),move:[move.x,move.y]}:read(snapshot,item.id);memberFactors[item.id]=next.factor/prior.factor;movements[item.id]={x:next.move[0]-prior.move[0],y:next.move[1]-prior.move[1]};}
     apply(1,[0,0],[0,0],memberFactors,movements);consumed=snapshot;
    }
    apply(value,shift,pixels);
    for(const step of steps())if(step.styles)styles(step.styles);else if(document.defaultView.innerWidth>=step.min&&(step.max===undefined||document.defaultView.innerWidth<step.max))apply(step.factor,step.offset,step.move);
    styles({},true);
   }catch(error){restore();onError(error);}
   finally{if(!disposed)observe(targets);}
  }
  const fontSet=document.fonts;
  root.addEventListener('resize',schedule);
  document.addEventListener('load',schedule,true);
  fontSet?.addEventListener('loadingdone',schedule);
  query?.addEventListener('change',schedule);
  refresh();
  return {refresh,manages:el=>managed.has(el),owns,pause(){paused++;root.cancelAnimationFrame(pending);pending=0;let released=false;return ()=>{if(released)return;released=true;paused--;schedule();};},dispose(){
   if(disposed)return;disposed=true;
   root.cancelAnimationFrame(pending);pending=0;mutation.disconnect();resize.disconnect();
   root.removeEventListener('resize',schedule);document.removeEventListener('load',schedule,true);
   fontSet?.removeEventListener('loadingdone',schedule);query?.removeEventListener('change',schedule);
   restore();
  }};
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchResponsiveGroupScale=api;
})(typeof window==='object'?window:globalThis);
