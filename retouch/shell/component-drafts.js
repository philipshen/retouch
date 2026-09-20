(function(){
 'use strict';
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function read(node){
  if(node.localName==='select')return [...node.options].map(option=>option.selected);
  return ['checkbox','radio'].includes(node.type)?node.checked:node.value;
 }
 function defaults(node){
  if(node.localName==='select'){
   const values=[...node.options].map(option=>option.defaultSelected);
   if(!node.multiple){const index=values.lastIndexOf(true),fallback=[...node.options].findIndex(option=>!option.disabled&&!option.parentElement?.disabled);return values.map((_,i)=>i===(index<0?fallback:index));}return values;
  }
  return ['checkbox','radio'].includes(node.type)?node.defaultChecked:node.defaultValue;
 }
 const shape=node=>node.localName==='select'?[...node.options].map(option=>[option.value,option.text,option.disabled,!!option.parentElement?.disabled]):null;
 function controls(d){return [...d.querySelectorAll('input[data-rt],textarea[data-rt],select[data-rt]')].filter(node=>!['file','hidden','button','submit','reset','image'].includes(node.type)).slice(0,10000);}
 function identity(node){const scopes=[];for(let at=node;at;at=at.parentElement){const id=at.getAttribute('data-rt-i');if(id)scopes.push(id);}return {id:node.getAttribute('data-rt'),scopes};}
 // Snapshots are operation-local and never persisted. Only remounted controls
 // with identical authored defaults and an unambiguous source occurrence match.
 window.RetouchComponentDrafts=()=>{
  const frames=[];for(const frame of document.querySelectorAll('#app,.compare-surface iframe'))try{
   const d=frame.contentDocument;if(!d?.body)continue;frames.push({frame,d,url:d.URL,entries:controls(d).map(node=>({node,...identity(node),tag:node.localName,type:node.type,value:read(node),defaults:defaults(node),shape:shape(node),selection:typeof node.selectionStart==='number'?[node.selectionStart,node.selectionEnd,node.selectionDirection]:null}))});
  }catch{}
  return (pairs=[],ignored=[])=>{
   const mapping=new Map(pairs),skip=new Set(ignored),key=(item,map)=>JSON.stringify([map?(mapping.get(item.id)||item.id):item.id,item.scopes.map(id=>map?(mapping.get(id)||id):id).filter(id=>!skip.has(id))]);
   for(const saved of frames)try{
    if(saved.frame.contentDocument!==saved.d||saved.d.URL!==saved.url)continue;
    const before=new Map(),after=new Map();for(const item of saved.entries){const k=key(item,true),items=before.get(k)||[];items.push(item);before.set(k,items);}for(const node of controls(saved.d)){const k=key(identity(node),false),items=after.get(k)||[];items.push(node);after.set(k,items);}
    for(const [k,entries]of before){const nodes=after.get(k);if(nodes?.length!==entries.length)continue;for(let i=0;i<nodes.length;i++){
     const node=nodes[i],old=entries[i];if(node===old.node||node.localName!==old.tag||node.type!==old.type||!equal(shape(node),old.shape)||!equal(defaults(node),old.defaults)||!equal(read(node),defaults(node)))continue;
     if(node.localName==='select'){if(node.options.length!==old.value.length)continue;[...node.options].forEach((option,index)=>option.selected=old.value[index]);}
     else if(['checkbox','radio'].includes(node.type))node.checked=old.value;else node.value=old.value;
     if(old.selection)try{node.setSelectionRange(...old.selection);}catch{}
    }}
   }catch{}
  };
 };
})();
