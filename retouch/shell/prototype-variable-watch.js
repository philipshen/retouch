(function(root){
 'use strict';
 function mount(d,change,ownedStyle){
  const w=d.defaultView,media=new Map(),observed=new Set(),probe=node=>node?.nodeType===1&&node.hasAttribute('data-rt-prototype-probe');let closed=false;
  const notify=()=>{if(!closed)change();},resize=new w.ResizeObserver(notify);
  function synchronize(){
   const nodes=new Set([d.documentElement]);for(const el of d.querySelectorAll('[data-rt-variables]'))for(let node=el;node;node=node.parentElement)nodes.add(node);
   for(const node of observed)if(!nodes.has(node)){resize.unobserve(node);observed.delete(node);}for(const node of nodes)if(!observed.has(node)){observed.add(node);resize.observe(node);}
   const queries=new Set(),seen=new Set();
   function query(value){if(value&&value!=='all')queries.add(value);}
   function rules(list){for(const rule of list){query(rule.media?.mediaText);if(rule.styleSheet)sheet(rule.styleSheet);if(rule.cssRules)rules(rule.cssRules);}}
   function sheet(value){if(!value||seen.has(value)||probe(value.ownerNode))return;seen.add(value);query(value.media?.mediaText);try{rules(value.cssRules);}catch{/* The cascade resolver reports unreadable sheets when used. */}}
   for(const value of [...d.styleSheets,...(d.adoptedStyleSheets||[])])sheet(value);
   for(const [query,list]of media)if(!queries.has(query)){list.removeEventListener('change',notify);media.delete(query);}
   for(const query of queries)if(!media.has(query)){const list=w.matchMedia(query);list.addEventListener('change',notify);media.set(query,list);}
  }
  function withoutProbe(value){const style=d.createElement('span').style;style.cssText=value||'';for(const name of [...style])if(root.RetouchPrototypeBindingCascade.isProbeProperty(name))style.removeProperty(name);return style.cssText;}
  function relevant(record){
   if(probe(record.target)||record.target.parentElement?.closest('[data-rt-prototype-probe]'))return false;
   if(record.type==='childList')return [...record.addedNodes,...record.removedNodes].some(node=>!probe(node));
   if(record.type==='attributes'){
    if(record.oldValue===record.target.getAttribute(record.attributeName))return false;
    if(record.attributeName==='style'&&(ownedStyle(record.target)||withoutProbe(record.oldValue)===withoutProbe(record.target.getAttribute('style'))))return false;
   }
   return true;
  }
  const observer=new w.MutationObserver(records=>{if(records.some(relevant)){synchronize();notify();}});
  synchronize();observer.observe(d.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true});
  const loaded=()=>{synchronize();notify();};d.addEventListener('load',loaded,true);w.addEventListener('resize',notify);
  return ()=>{if(closed)return;closed=true;observer.disconnect();resize.disconnect();for(const list of media.values())list.removeEventListener('change',notify);media.clear();observed.clear();d.removeEventListener('load',loaded,true);w.removeEventListener('resize',notify);};
 }
 root.RetouchPrototypeVariableWatch={mount};
})(window);
