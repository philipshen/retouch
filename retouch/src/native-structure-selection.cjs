'use strict';
// Compose source plans in memory, then submit one transaction. Never persist an
// intermediate selection edit or reuse IDs from an earlier source revision.
function plan(resolved,op,language){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!['react','liquid'].includes(language)||!['duplicateSelection','deleteSelection'].includes(op.type))return refuse('Choose a supported selection operation.');
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 2–100 distinct source layers in one file.');
  const adapter=require('./adapters/'+language+'.cjs'),elements=resolved.elements||adapter.collect(resolved.source,resolved.relPath).elements,start=el=>language==='react'?el.node.start:el.tagStart,end=el=>language==='react'?el.node.end:el.closeEnd;
  const selected=op.ids.map(id=>elements.find(el=>el.id===id));if(selected.some(el=>!el||el.kind!=='host'))return refuse('Select native layers from one source file.');
  const roots=selected.filter(el=>!selected.some(other=>other!==el&&start(other)<=start(el)&&end(other)>=end(el))).sort((a,b)=>start(b)-start(a));
  if(!roots.length||roots.some(el=>!Number.isInteger(start(el))||!Number.isInteger(end(el))))return refuse('A selected source range is incomplete.');
  let source=resolved.source,parentId=null,created=[];const mapping=new Map(elements.map(el=>[el.id,el.id])),removed=new Set();
  for(const root of roots){
   const current=adapter.collect(source,resolved.relPath).elements,element=current.find(el=>el.id===mapping.get(root.id));if(!element)throw Error('A selected layer lost its source identity.');
   const next=adapter.planOp({...resolved,source,elements:current,element,hash:adapter.contentHash(source)},{type:op.type==='duplicateSelection'?'duplicateElement':'deleteElement',id:element.id,fileHash:adapter.contentHash(source)});
   if(!next.ok)return refuse(next.reason||'A selected layer cannot be structurally edited.');
   if(next.edits?.length!==1||next.edits[0].file!==resolved.file||next.edits[0].before!==source||!next.parentId)throw Error('The selection cannot be edited as one source transaction.');
   const remap=new Map(next.sourceIdMap||[]),deleted=new Set(next.removedSourceIds||[]);
   for(const [original,id]of mapping){if(deleted.has(id)){mapping.delete(original);removed.add(original);}else mapping.set(original,remap.get(id)||id);}
   created=created.map(id=>remap.get(id)||id);if(next.createdId)created.push(next.createdId);
   parentId=remap.get(next.parentId)||next.parentId;source=next.edits[0].after;
  }
  const final=adapter.collect(source,resolved.relPath).elements,ids=new Set(final.map(el=>el.id)),selectionIds=op.type==='duplicateSelection'?created.reverse():[parentId];
  if(selectionIds.some(id=>!ids.has(id))||[...mapping.values()].some(id=>!ids.has(id))||new Set(mapping.values()).size!==mapping.size)throw Error('The final source identities could not be verified.');
  return {ok:true,hash:adapter.contentHash(source),structural:true,parentId,rootCount:roots.length,selectionIds,sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[...removed],edits:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
