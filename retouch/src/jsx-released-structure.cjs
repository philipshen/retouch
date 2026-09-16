'use strict';
// Regroup only in memory so the ordinary JSX structural planners can enforce their
// identity and literal-source checks. Publish the final released source once.
const identity=require('./id.cjs'),regroup=require('./jsx-group-regroup.cjs');
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the released layers.');
 if(!['duplicateElement','pasteElement','moveElement','moveSelection'].includes(op.type))throw Error('Choose a supported copy or ordering operation.');
 const {elements,roots,owned}=regroup.claim(resolved);
 if(op.type==='pasteElement'&&(op.copiedHash!==resolved.hash||!owned.some(e=>e.id===op.copiedId)))throw Error('Copy a released sibling from the same source revision.');
 if(op.type==='moveSelection'&&(!Array.isArray(op.ids)||op.ids.some(id=>!owned.some(e=>e.id===id))))throw Error('Reorder released layers from the same group.');
 let source=resolved.source,groupId,createdId,movedId,operationParentId,selectionIds=[];const mapping=new Map(elements.map(e=>[e.id,e.id]));
 const advance=next=>{if(!next.ok)throw Error(next.reason);if(next.edits.length!==1||next.edits[0].file!==resolved.file||next.edits[0].before!==source)throw Error('Editing released layers requires one source transaction.');const remap=new Map(next.sourceIdMap||[]),removed=new Set(next.removedSourceIds||[]);for(const [old,id]of mapping){if(removed.has(id))throw Error('Editing released layers removed an existing source layer.');mapping.set(old,remap.get(id)||id);}if(groupId)groupId=remap.get(groupId)||groupId;if(createdId)createdId=remap.get(createdId)||createdId;if(movedId)movedId=remap.get(movedId)||movedId;if(operationParentId)operationParentId=removed.has(operationParentId)?null:remap.get(operationParentId)||operationParentId;selectionIds=selectionIds.map(id=>remap.get(id)||id);source=next.edits[0].after;};
 const state=id=>{const collected=identity.collectElements(source,resolved.relPath);return {...resolved,...collected,source,hash:identity.contentHash(source),element:collected.elements.find(e=>e.id===id)};};
 const grouped=regroup.plan(resolved,{fileHash:resolved.hash,ids:roots.map(e=>e.id)});advance(grouped);groupId=grouped.selectionIds[0];
 const selected=state(mapping.get(resolved.element.id)),operation={...op,fileHash:selected.hash,...(op.type==='pasteElement'?{copiedId:mapping.get(op.copiedId),copiedHash:selected.hash}:{}),...(op.type==='moveSelection'?{ids:op.ids.map(id=>mapping.get(id))}:{})},edited=op.type==='moveSelection'?require('./native-structure-selection.cjs').plan(selected,operation,'react'):require('./structure.cjs').planOp(selected,operation,'react');advance(edited);operationParentId=edited.parentId;createdId=edited.createdId;movedId=edited.movedId;selectionIds=edited.selectionIds||[createdId||movedId];
 const owner=state(groupId),released=require('./jsx-group-release.cjs').plan(owner,{fileHash:owner.hash});advance(released);
 const final=identity.collectElements(source,resolved.relPath).elements,ids=new Set(final.map(e=>e.id));if(!selectionIds.length||selectionIds.some(id=>!ids.has(id))||[...mapping.values()].some(id=>!ids.has(id))||new Set(mapping.values()).size!==mapping.size)throw Error('Editing released layers changed source layer identities.');
 return {ok:true,hash:identity.contentHash(source),structural:true,parentId:ids.has(operationParentId)?operationParentId:released.parentId,...(createdId?{createdId}:{}),...(movedId?{movedId}:{}),...(edited.rootCount?{rootCount:edited.rootCount}:{}),selectionIds,sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[],edits:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
