(function(root){
 'use strict';
 function parse(value){
  const data=JSON.parse(value);
  if(!data||data.version!==1||Object.keys(data).some(key=>!['version','ranges','offsets','pixels','steps'].includes(key))||!data.ranges||Array.isArray(data.ranges)||typeof data.ranges!=='object')throw Error('Invalid responsive scale metadata.');
  const ranges=Object.entries(data.ranges).map(([width,factor])=>{
   if(!/^(0|[1-9][0-9]*)$/.test(width)||Number(width)>7680||typeof factor!=='number'||!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Invalid responsive scale range.');
   return [Number(width),factor];
  }).sort((a,b)=>a[0]-b[0]);
  if(!ranges.length||ranges.length>100)throw Error('Provide 1–100 responsive scale ranges.');
  for(const stored of [data.offsets,data.pixels])if(stored!==undefined&&(!stored||Array.isArray(stored)||typeof stored!=='object'||Object.entries(stored).some(([width,pair])=>!Object.hasOwn(data.ranges,width)||!Array.isArray(pair)||pair.length!==2||pair.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000))))throw Error('Invalid responsive scale offsets.');
  if(data.steps!==undefined){
   if(!Array.isArray(data.steps)||data.steps.length>100)throw Error('Provide at most 100 transform steps.');
   const pair=value=>Array.isArray(value)&&value.length===2&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000),width=n=>Number.isInteger(n)&&n>=0&&n<=7680;
   for(const step of data.steps){
    if(!step||typeof step!=='object'||Array.isArray(step))throw Error('Invalid transform step.');
    if(Object.hasOwn(step,'styles')){
     if(Object.keys(step).length!==1||!step.styles||typeof step.styles!=='object'||Array.isArray(step.styles)||Object.keys(step.styles).length>100)throw Error('Invalid member transform snapshot.');
     for(const [id,rules]of Object.entries(step.styles)){
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).length>100)throw Error('Invalid member transform identity.');
      for(const [key,value]of Object.entries(rules))if(!/^(0|[1-9][0-9]*)$/.test(key)||!width(Number(key))||!value||Object.keys(value).some(key=>!['factor','move'].includes(key))||typeof value.factor!=='number'||!Number.isFinite(value.factor)||value.factor<.01||value.factor>100||!pair(value.move))throw Error('Invalid member transform values.');
     }
    }else if(Object.keys(step).some(key=>!['factor','min','max','offset','move'].includes(key))||!width(step.min)||step.max!==undefined&&(!width(step.max)||step.max<=step.min)||typeof step.factor!=='number'||!Number.isFinite(step.factor)||step.factor<.01||step.factor>100||!pair(step.offset)||!pair(step.move))throw Error('Invalid group transform step.');
   }
  }
  return ranges;
 }
 function members(value){
  const ids=JSON.parse(value);
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)))throw Error('Invalid released scale members.');
  return ids;
 }
 function mount({document=root.document,geometry,controller,eligible=()=>true}){
  const win=document.defaultView,active=new Map();let pending=0,disposed=false;
  const report=(el,error)=>el.dispatchEvent(new win.CustomEvent('retouch:scale-error',{bubbles:true,detail:{message:error.message}}));
  const overlaps=(a,b)=>a.some(left=>b.some(right=>left.contains(right)||right.contains(left)));
  function reconcile(){
   if(disposed)return;
   const candidates=new Map();
   for(const el of document.querySelectorAll('[data-rt-scale]'))try{
    if(!eligible(el))continue;
    const raw=el.getAttribute('data-rt-scale'),ranges=parse(raw),data=JSON.parse(raw);let roots=[el],signature=raw;
    if(el.hasAttribute('data-rt-scale-set')){
     if(el.tagName!=='SCRIPT'||el.type!=='application/json')throw Error('Released scale metadata must be inert JSON.');
     const ids=members(el.textContent),scope=el.getAttribute('data-rt-scale-scope');let nodes;
     if(scope===null)nodes=[...document.querySelectorAll('[data-rt-scale-member]')];
     else if(scope==='siblings'){nodes=[];for(let node=el.previousElementSibling;node&&ids.includes(node.getAttribute('data-rt-scale-member'));node=node.previousElementSibling)nodes.push(node);}
     else throw Error('Invalid released scale ownership scope.');
     signature+='|'+el.textContent+'|'+scope;
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
    const control=controller.mount({geometry,steps:()=>data.steps||[],roots:()=>roots,identity:node=>node.getAttribute('data-rt-scale-member'),pixelOffset:()=>value(data.pixels||{},[0,0]),offset:()=>value(data.offsets||{},[0,0]),factor:()=>value(data.ranges,1),onError:error=>report(el,error)});
    active.set(el,{...binding,control});
   }
  }
  const observer=new win.MutationObserver(()=>{if(!disposed&&!pending)pending=win.requestAnimationFrame(()=>{pending=0;reconcile();});});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-rt-scale','data-rt-group','data-rt-scale-set','data-rt-scale-scope','data-rt-scale-member']});reconcile();
  return {refresh(){reconcile();for(const entry of active.values())entry.control.refresh();},manages(el){return [...active.values()].some(entry=>entry.control.manages(el));},owns(el,property){return [...active.values()].some(entry=>entry.control.owns(el,property));},pause(elements){const releases=[...active.values()].filter(entry=>overlaps(entry.roots,elements)).map(entry=>entry.control.pause());return ()=>releases.forEach(release=>release());},dispose(){if(disposed)return;disposed=true;observer.disconnect();win.cancelAnimationFrame(pending);for(const entry of active.values())entry.control.dispose();active.clear();}};
 }
 const api={parse,members,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupScaleBootstrap=api;
})(typeof window==='object'?window:globalThis);
