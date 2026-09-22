'use strict';
// Stage each canonical stroke edit in memory and compose its layer mapping.
// A failed member never produces a partial file edit.
module.exports=function planSelection(r,op,kind){
 const S=require('./svg-stroke-source.cjs'),{view}=require('./svg-boolean-group.cjs');
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the vectors.');
 const selected=op.ids;
 if(!Array.isArray(selected)||selected.length<2||selected.length>100||new Set(selected).size!==selected.length||!selected.includes(r.element.id)||selected.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Select 2 to 100 distinct aligned vectors from one source file.');
 const type=op.property==='position'?'setSVGStrokeSourcePosition':op.property==='width'?'setSVGStrokeSourceWidth':'setSVGStrokeSourceStyle';
 const perMember=op.values!==undefined,numeric=['width','miterlimit','dashoffset'].includes(op.property);
 if(perMember&&(!['fill','stroke'].includes(op.property)&&!numeric||op.value!==undefined||!op.values||typeof op.values!=='object'||Array.isArray(op.values)||Object.keys(op.values).length!==selected.length||selected.some(id=>!Object.hasOwn(op.values,id)||(numeric?!Number.isFinite(op.values[id]):typeof op.values[id]!=='string'))))return refuse('Provide one supported value for every selected vector.');
 const extra=value=>op.property==='position'?{position:value}:op.property==='width'?{width:value}:{property:op.property,value};
 try{
  const initial=view(r,kind),roots=selected.map(id=>initial.elements.find(e=>e.id===id));
  if(roots.some(element=>!element||!S.context({...r,element},kind)))return refuse('Select unchanged aligned vectors from one source file.');
  const ancestors=id=>{const list=[];for(let parent=initial.parents.get(id);parent;parent=initial.parents.get(parent))list.push(parent);return list;};
  const parent=ancestors(selected[0]).find(id=>selected.every(other=>ancestors(other).includes(id)));
  if(!parent)return refuse('Select aligned vectors with a common source parent.');
  let source=r.source;const mapping=new Map(initial.elements.map(e=>[e.id,e.id]));
  for(const originalId of selected){
   const v=view({...r,source,elements:null},kind),id=mapping.get(originalId),element=v.elements.find(e=>e.id===id),member={...r,source,elements:v.elements,element,hash:v.adapter.contentHash(source)};
   if(!element)return refuse('A selected vector no longer resolves.');
   const change=S.plan(member,{type,fileHash:member.hash,...extra(perMember?op.values[originalId]:op.value)},kind);if(!change.ok)return change;
   if(!change.edits.length)continue;
   const removed=new Set(change.removedSourceIds),step=new Map(change.sourceIdMap);
   for(const [old,current]of mapping){if(removed.has(current))mapping.delete(old);else mapping.set(old,step.get(current)||current);}
   source=change.edits[0].after;
  }
  if(source===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
  const final=view({...r,source,elements:null},kind),selectionIds=selected.map(id=>mapping.get(id));
  if(selectionIds.some(id=>!id||!S.context({...r,source,elements:final.elements,element:final.elements.find(e=>e.id===id)},kind)))return refuse('The selected strokes did not round-trip.');
  return {ok:true,structural:true,hash:final.adapter.contentHash(source),parentId:mapping.get(parent),selectionIds,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:initial.elements.filter(e=>!mapping.has(e.id)).map(e=>e.id),edits:[{file:r.file,before:r.source,after:source}]};
 }catch(error){return refuse(error.message);}
};
