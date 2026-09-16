'use strict';
const MagicString=require('magic-string'),identity=require('./id.cjs'),released=require('./jsx-group-regroup.cjs'),bootstrap=require('../runtime/group-scale-bootstrap.js');
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the released layers.');
 const {elements,record,parent,roots,owned}=released.claim(resolved),ids=op.type==='deleteElement'?[resolved.element.id]:op.ids;
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>!owned.some(e=>e.id===id)))throw Error('Select released layers from the same group.');
 const selected=owned.filter(e=>ids.includes(e.id)),removedRoots=selected.filter(e=>!selected.some(other=>other!==e&&other.node.start<e.node.start&&other.node.end>e.node.end)),survivors=roots.filter(e=>!ids.includes(e.id)),removed=elements.filter(e=>removedRoots.some(root=>e.node.start>=root.node.start&&e.node.end<=root.node.end)),dead=new Set(removed.map(released.member).filter(Boolean));
 const payload={...record.data,members:survivors.map(released.member)},metadata=JSON.parse(payload.metadata);
 for(const step of metadata.steps||[])if(step.styles)step.styles=Object.fromEntries(Object.entries(step.styles).filter(([id])=>!dead.has(id)));
 payload.metadata=JSON.stringify(metadata);bootstrap.parse(payload.metadata);
 const anchor=record.element.node,replacement=survivors.length?'<'+record.binding+' released={'+JSON.stringify(payload)+'} />':'';
 const changes=[...removedRoots.map(e=>({start:e.node.start,end:e.node.end,text:''})),{start:anchor.start,end:anchor.end,text:replacement}],out=new MagicString(resolved.source);
 for(const edit of changes)out.overwrite(edit.start,edit.end,edit.text);
 if(!survivors.length)removed.push(record.element);
 const after=out.toString(),final=identity.collectElements(after,resolved.relPath).elements,removedIds=new Set(removed.map(e=>e.id)),mapping=new Map();
 for(const old of elements){if(removedIds.has(old.id))continue;const at=old.node.start+changes.filter(edit=>edit.end<=old.node.start).reduce((sum,edit)=>sum+edit.text.length-(edit.end-edit.start),0),next=final.find(e=>e.kind===old.kind&&e.node.start===at);if(!next)throw Error('Deleting released layers changed an unrelated source identity.');mapping.set(old.id,next.id);}
 if(final.length!==elements.length-removedIds.size||new Set(mapping.values()).size!==final.length)throw Error('Deleting released layers changed the source structure.');
 const container=elements.find(e=>e.node.children?.includes(removedRoots[0].node)),parentId=mapping.get(container?.id)||mapping.get(parent.id);return {ok:true,hash:identity.contentHash(after),structural:true,parentId,rootCount:removedRoots.length,selectionIds:[parentId],sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[...removedIds],edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
