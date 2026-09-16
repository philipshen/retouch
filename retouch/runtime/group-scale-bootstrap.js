(function(root){
 'use strict';
 function parse(value){
  const data=JSON.parse(value);
  if(!data||data.version!==1||Object.keys(data).some(key=>!['version','ranges','offsets','pixels'].includes(key))||!data.ranges||Array.isArray(data.ranges)||typeof data.ranges!=='object')throw Error('Invalid responsive scale metadata.');
  const ranges=Object.entries(data.ranges).map(([width,factor])=>{
   if(!/^(0|[1-9][0-9]*)$/.test(width)||Number(width)>7680||typeof factor!=='number'||!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Invalid responsive scale range.');
   return [Number(width),factor];
  }).sort((a,b)=>a[0]-b[0]);
  if(!ranges.length||ranges.length>100)throw Error('Provide 1–100 responsive scale ranges.');
  for(const stored of [data.offsets,data.pixels])if(stored!==undefined&&(!stored||Array.isArray(stored)||typeof stored!=='object'||Object.entries(stored).some(([width,pair])=>!Object.hasOwn(data.ranges,width)||!Array.isArray(pair)||pair.length!==2||pair.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000))))throw Error('Invalid responsive scale offsets.');
  return ranges;
 }
 function members(value){
  const ids=JSON.parse(value);
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)))throw Error('Invalid released scale members.');
  return ids;
 }
 function mount({document=root.document,geometry,controller}){
  const win=document.defaultView,active=new Map();let pending=0,disposed=false;
  const report=(el,error)=>el.dispatchEvent(new win.CustomEvent('retouch:scale-error',{bubbles:true,detail:{message:error.message}}));
  const overlaps=(a,b)=>a.some(left=>b.some(right=>left.contains(right)||right.contains(left)));
  function reconcile(){
   if(disposed)return;
   const candidates=new Map();
   for(const el of document.querySelectorAll('[data-rt-scale]'))try{
    const raw=el.getAttribute('data-rt-scale'),ranges=parse(raw),data=JSON.parse(raw);let roots=[el],signature=raw;
    if(el.hasAttribute('data-rt-scale-set')){
     if(el.tagName!=='SCRIPT'||el.type!=='application/json')throw Error('Released scale metadata must be inert JSON.');
     const ids=members(el.textContent),nodes=[...document.querySelectorAll('[data-rt-scale-member]')];signature+='|'+el.textContent;
     roots=ids.flatMap(id=>{const matches=nodes.filter(node=>node.getAttribute('data-rt-scale-member')===id);if(matches.length>1)throw Error('A released scale member has multiple owners.');return matches;});
    }else if(!el.hasAttribute('data-rt-group'))throw Error('Responsive scaling requires a group.');
    if(roots.length)candidates.set(el,{signature,ranges,data,roots});
   }catch(error){report(el,error);}
   const conflicting=new Set();for(const [el,binding]of candidates)if([...candidates].some(([other,value])=>other!==el&&overlaps(binding.roots,value.roots)))conflicting.add(el);
   for(const el of conflicting){candidates.delete(el);report(el,Error('Overlapping responsive scale groups are not supported yet.'));}
   for(const [el,entry]of active){const next=candidates.get(el);if(!next||next.signature!==entry.signature||next.roots.length!==entry.roots.length||next.roots.some((node,i)=>node!==entry.roots[i])){entry.control.dispose();active.delete(el);}}
   for(const [el,binding]of candidates){
    if(active.has(el))continue;
    const {ranges,data,roots}=binding;
    const value=(map,fallback)=>{let result=fallback;for(const [width]of ranges){if(width>win.innerWidth)break;result=map[width]??fallback;}return result;};
    const control=controller.mount({geometry,roots:()=>roots,identity:node=>node.getAttribute('data-rt-scale-member'),pixelOffset:()=>value(data.pixels||{},[0,0]),offset:()=>value(data.offsets||{},[0,0]),factor:()=>value(data.ranges,1),onError:error=>report(el,error)});
    active.set(el,{...binding,control});
   }
  }
  const observer=new win.MutationObserver(()=>{if(!disposed&&!pending)pending=win.requestAnimationFrame(()=>{pending=0;reconcile();});});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-rt-scale','data-rt-group','data-rt-scale-set','data-rt-scale-member']});reconcile();
  return {refresh(){reconcile();for(const entry of active.values())entry.control.refresh();},owns(el,property){return [...active.values()].some(entry=>entry.control.owns(el,property));},pause(elements){const releases=[...active.values()].filter(entry=>overlaps(entry.roots,elements)).map(entry=>entry.control.pause());return ()=>releases.forEach(release=>release());},dispose(){if(disposed)return;disposed=true;observer.disconnect();win.cancelAnimationFrame(pending);for(const entry of active.values())entry.control.dispose();active.clear();}};
 }
 const api={parse,members,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupScaleBootstrap=api;
})(typeof window==='object'?window:globalThis);
