'use strict';
// Regroup only in memory so the ordinary JSX copy planner can enforce its
// identity and literal-source checks. Publish the final released source once.
const identity=require('./id.cjs'),regroup=require('./jsx-group-regroup.cjs');
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the released layers.');
 if(!['duplicateElement','pasteElement'].includes(op.type))throw Error('Choose a supported copy operation.');
 const {elements,roots}=regroup.claim(resolved);
 if(op.type==='pasteElement'&&(op.copiedHash!==resolved.hash||!roots.some(e=>e.id===op.copiedId)))throw Error('Copy a released sibling from the same source revision.');
 let source=resolved.source,groupId,createdId;const mapping=new Map(elements.map(e=>[e.id,e.id]));
 const advance=next=>{if(!next.ok)throw Error(next.reason);if(next.edits.length!==1||next.edits[0].file!==resolved.file||next.edits[0].before!==source)throw Error('Copy requires one source transaction.');const remap=new Map(next.sourceIdMap||[]),removed=new Set(next.removedSourceIds||[]);for(const [old,id]of mapping){if(removed.has(id))throw Error('Copy removed an existing source layer.');mapping.set(old,remap.get(id)||id);}if(groupId)groupId=remap.get(groupId)||groupId;if(createdId)createdId=remap.get(createdId)||createdId;source=next.edits[0].after;};
 const state=id=>{const collected=identity.collectElements(source,resolved.relPath);return {...resolved,...collected,source,hash:identity.contentHash(source),element:collected.elements.find(e=>e.id===id)};};
 const grouped=regroup.plan(resolved,{fileHash:resolved.hash,ids:roots.map(e=>e.id)});advance(grouped);groupId=grouped.selectionIds[0];
 const selected=state(mapping.get(resolved.element.id)),copied=require('./structure.cjs').planOp(selected,{...op,fileHash:selected.hash,...(op.type==='pasteElement'?{copiedId:mapping.get(op.copiedId),copiedHash:selected.hash}:{})},'react');advance(copied);createdId=copied.createdId;
 const owner=state(groupId),released=require('./jsx-group-release.cjs').plan(owner,{fileHash:owner.hash});advance(released);
 const final=identity.collectElements(source,resolved.relPath).elements,ids=new Set(final.map(e=>e.id));if(!createdId||!ids.has(createdId)||[...mapping.values()].some(id=>!ids.has(id))||new Set(mapping.values()).size!==mapping.size)throw Error('Copy changed source layer identities.');
 return {ok:true,hash:identity.contentHash(source),structural:true,parentId:released.parentId,createdId,selectionIds:[createdId],sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[],edits:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
