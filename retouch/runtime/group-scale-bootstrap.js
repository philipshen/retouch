(function(root){
 'use strict';
 function parse(value){
  const data=JSON.parse(value);
  if(!data||data.version!==1||Object.keys(data).some(key=>!['version','ranges'].includes(key))||!data.ranges||Array.isArray(data.ranges)||typeof data.ranges!=='object')throw Error('Invalid responsive scale metadata.');
  const ranges=Object.entries(data.ranges).map(([width,factor])=>{
   if(!/^(0|[1-9][0-9]*)$/.test(width)||Number(width)>7680||typeof factor!=='number'||!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Invalid responsive scale range.');
   return [Number(width),factor];
  }).sort((a,b)=>a[0]-b[0]);
  if(!ranges.length||ranges.length>100)throw Error('Provide 1–100 responsive scale ranges.');
  return ranges;
 }
 function mount({document=root.document,geometry,controller}){
  const win=document.defaultView,active=new Map();let pending=0,disposed=false;
  const report=(el,error)=>el.dispatchEvent(new win.CustomEvent('retouch:scale-error',{bubbles:true,detail:{message:error.message}}));
  function reconcile(){
   if(disposed)return;
   const groups=[...document.querySelectorAll('[data-rt-scale]')];
   for(const [el,entry]of active)if(!groups.includes(el)||el.getAttribute('data-rt-scale')!==entry.raw||!el.hasAttribute('data-rt-group')||groups.some(other=>other!==el&&(other.contains(el)||el.contains(other)))){entry.control.dispose();active.delete(el);}
   for(const el of groups){
    if(active.has(el))continue;
    try{
     if(!el.hasAttribute('data-rt-group'))throw Error('Responsive scaling requires a group.');
     if(groups.some(other=>other!==el&&(other.contains(el)||el.contains(other))))throw Error('Overlapping responsive scale groups are not supported yet.');
     const raw=el.getAttribute('data-rt-scale'),ranges=parse(raw);
     const control=controller.mount({geometry,roots:()=>[el],identity:node=>node.getAttribute('data-rt-scale-member'),factor:()=>{let value=1;for(const [width,factor]of ranges){if(width>win.innerWidth)break;value=factor;}return value;},onError:error=>report(el,error)});
     active.set(el,{raw,control});
    }catch(error){report(el,error);}
   }
  }
  const observer=new win.MutationObserver(()=>{if(!disposed&&!pending)pending=win.requestAnimationFrame(()=>{pending=0;reconcile();});});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-rt-scale','data-rt-group']});reconcile();
  return {dispose(){if(disposed)return;disposed=true;observer.disconnect();win.cancelAnimationFrame(pending);for(const entry of active.values())entry.control.dispose();active.clear();}};
 }
 const api={parse,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupScaleBootstrap=api;
})(typeof window==='object'?window:globalThis);
