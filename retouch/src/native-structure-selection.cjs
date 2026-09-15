'use strict';
// Compose source plans in memory, then submit one transaction. Never persist an
// intermediate selection edit or reuse IDs from an earlier source revision.
function plan(resolved,op,language){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!['react','liquid','html'].includes(language)||!['duplicateSelection','deleteSelection','moveSelection'].includes(op.type))return refuse('Choose a supported selection operation.');
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 2–100 distinct source layers in one file.');
  const adapter=require('./adapters/'+language+'.cjs'),elements=resolved.elements||adapter.collect(resolved.source,resolved.relPath).elements,start=el=>language==='react'?el.node.start:language==='html'?el.location.startOffset:el.tagStart,end=el=>language==='react'?el.node.end:language==='html'?el.location.endOffset:el.closeEnd;
  const selected=op.ids.map(id=>elements.find(el=>el.id===id));if(selected.some(el=>!el||el.kind!=='host'))return refuse('Select native layers from one source file.');
  const roots=selected.filter(el=>!selected.some(other=>other!==el&&start(other)<=start(el)&&end(other)>=end(el))).sort((a,b)=>start(b)-start(a));
  if(!roots.length||roots.some(el=>!Number.isInteger(start(el))||!Number.isInteger(end(el))))return refuse('A selected source range is incomplete.');
  const moving=op.type==='moveSelection',structure=require('./structure.cjs');
  if(moving){if(!['before','after','first','last'].includes(op.direction))return refuse('Choose a supported ordering direction.');const parents=roots.map(element=>structure.ranges({...resolved,elements,element},language).parentId);if(!parents[0]||new Set(parents).size!==1)return refuse('Reorder layers in the same source parent.');roots.sort((a,b)=>(['before','last'].includes(op.direction)?1:-1)*(start(a)-start(b)));}
  let source=resolved.source,parentId=null,created=[];const mapping=new Map(elements.map(el=>[el.id,el.id])),removed=new Set();
  for(const root of roots){
   const current=adapter.collect(source,resolved.relPath).elements,element=current.find(el=>el.id===mapping.get(root.id));if(!element)throw Error('A selected layer lost its source identity.');
   const state={...resolved,source,elements:current,element,hash:adapter.contentHash(source)};
   if(moving){const siblings=structure.ranges(state,language),index=siblings.findIndex(item=>item.selected),offset=op.direction==='before'?-1:1,peer=siblings[index+offset];if(op.direction==='first'&&index===0||op.direction==='last'&&index===siblings.length-1)continue;if(['before','after'].includes(op.direction)&&(!peer||roots.some(root=>{const item=current.find(item=>item.id===mapping.get(root.id));return item&&start(item)===peer.start;})))continue;}
   const next=adapter.planOp(state,{type:moving?'moveElement':op.type==='duplicateSelection'?'duplicateElement':'deleteElement',direction:op.direction,id:element.id,fileHash:adapter.contentHash(source)});
   if(!next.ok)return refuse(next.reason||'A selected layer cannot be structurally edited.');
   if(next.edits?.length!==1||next.edits[0].file!==resolved.file||next.edits[0].before!==source||!next.parentId)throw Error('The selection cannot be edited as one source transaction.');
   const remap=new Map(next.sourceIdMap||[]),deleted=new Set(next.removedSourceIds||[]);
   for(const [original,id]of mapping){if(deleted.has(id)){mapping.delete(original);removed.add(original);}else mapping.set(original,remap.get(id)||id);}
   created=created.map(id=>remap.get(id)||id);if(next.createdId)created.push(next.createdId);
   parentId=remap.get(next.parentId)||next.parentId;source=next.edits[0].after;
  }
  if(source===resolved.source)return refuse('The selected layers cannot move farther in that direction.');
  const final=adapter.collect(source,resolved.relPath).elements,ids=new Set(final.map(el=>el.id)),selectionIds=moving?[...roots].sort((a,b)=>start(a)-start(b)).map(root=>mapping.get(root.id)):op.type==='duplicateSelection'?created.reverse():[parentId];
  if(selectionIds.some(id=>!ids.has(id))||[...mapping.values()].some(id=>!ids.has(id))||new Set(mapping.values()).size!==mapping.size)throw Error('The final source identities could not be verified.');
  return {ok:true,hash:adapter.contentHash(source),structural:true,parentId,rootCount:roots.length,selectionIds,sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[...removed],edits:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
