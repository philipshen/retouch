'use strict';
const compiler=require('svelte/compiler'),source=require('./svelte-source.cjs'),styles=require('./svelte-css.cjs'),structure=require('./svelte-structure.cjs');
const types=['duplicateComponent','duplicateComponentSelection','deleteComponent','deleteComponentSelection'];
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['metadata','loc'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit);}}
function checkCopy(r,definition){
 walk(r.element.node,node=>{if(node.attributes?.some(a=>a.type==='SpreadAttribute'||a.type==='BindDirective'&&a.name==='this'||['id','ref','key'].includes(a.name?.toLowerCase())))throw Error('This usage contains an ID, reference or spread. Give the new instance an independent identity before duplicating.');});
 const def=definition(r);walk(source.collect(def.text,def.rel).ast.fragment,node=>{if(node.attributes?.some(a=>a.name?.toLowerCase()==='id'&&require('./svelte-component-props.cjs').literal(a)))throw Error('The component definition contains a fixed DOM ID. Make it instance-specific before duplicating.');});return def;
}
function describe(r,adapter,definition){
 let canDelete=true,canDuplicate=true,deleteReason=null,duplicateReason=null;
 try{structure.structuralStyles(r,adapter,r.element,false);}catch(error){canDelete=false;deleteReason=error.message;}
 try{checkCopy(r,definition);structure.structuralStyles(r,adapter,r.element,true);}catch(error){canDuplicate=false;duplicateReason=error.message;}
 return {canDelete,canDuplicate,deleteReason,duplicateReason};
}
function single(r,op,adapter,definition){
 const deleting=op.type==='deleteComponent',parsed=adapter.collect(r.source,r.relPath),selected=parsed.elements.find(e=>e.id===r.element.id);
 if(selected?.kind!=='instance')throw Error('Choose a Svelte component usage.');
 const def=deleting?null:checkCopy({...r,element:selected},definition),styled=structure.structuralStyles(r,adapter,selected,!deleting);
 // A non-rendering block keeps one structural slot, so unrelated source IDs
 // survive deletion. Retain the import and its module side effects.
 const replacement=deleting?'{#if false}{/if}':styled.fragment,delta=deleting?replacement.length-(selected.end-selected.start):replacement.length;
 const intermediate=deleting?r.source.slice(0,selected.start)+replacement+r.source.slice(selected.end):r.source.slice(0,selected.end)+replacement+r.source.slice(selected.end);
 const next=adapter.collect(intermediate,r.relPath).elements,mapped=new Set(),sourceIdMap=[],removedSourceIds=[];
 for(const element of parsed.elements){
  if(deleting&&element.start>=selected.start&&element.end<=selected.end){removedSourceIds.push(element.id);continue;}
  const start=element.start>=selected.end?element.start+delta:element.start,target=next.find(e=>e.start===start&&e.kind===element.kind&&e.tag===element.tag);
  if(!target||mapped.has(target.id))throw Error('A surviving source layer could not be mapped after the component edit.');mapped.add(target.id);if(target.id!==element.id)sourceIdMap.push([element.id,target.id]);
 }
 const created=next.filter(e=>!mapped.has(e.id)),expected=deleting?0:parsed.elements.filter(e=>e.start>=selected.start&&e.end<=selected.end).length;
 if(created.length!==expected||created.some(e=>e.start<selected.end||e.end>selected.end+replacement.length))throw Error('The copied usage changed surrounding source structure.');
 if(deleting&&sourceIdMap.length)throw Error('Deleting this usage would change unrelated source identities.');
 const after=styles.replaceModel(intermediate,r.relPath,styled.model),final=adapter.collect(after,r.relPath).elements;
 if(final.length!==next.length||next.some((e,i)=>e.id!==final[i].id||e.kind!==final[i].kind||e.tag!==final[i].tag))throw Error('Updating the style inventory changed source identities.');compiler.compile(after,{filename:r.relPath,generate:false});
 const parent=parsed.elements.filter(e=>e.kind==='host'&&e.start<selected.start&&e.end>=selected.end).sort((a,b)=>b.start-a.start)[0],copy=created.find(e=>e.kind==='instance'&&e.start===selected.end);
 const edits=[{file:r.file,before:r.source,after},...(def&&def.file!==r.file?[{file:def.file,before:def.text,after:def.text}]:[])];
 return {ok:true,hash:source.contentHash(after),...(deleting?{deletedComponent:{instanceId:selected.id,parentId:parent?.id||null,removedSourceIds}}:{duplicatedComponent:{instanceId:copy.id,originalId:selected.id,retainedInstanceId:selected.id,parentId:parent?.id||null,sourceIdMap,wrapped:false}}),edits};
}
function plan(r,op,adapter,definition){try{
 if(op.fileHash!==r.hash)throw Error('The source changed. Re-select the component usages.');if(!types.includes(op.type))throw Error('Choose duplicate or delete.');
 if(!op.type.endsWith('Selection'))return single(r,op,adapter,definition);
 const ids=op.ids;if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(r.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))throw Error('Choose 2 to 100 distinct component usages from one source file.');
 const original=adapter.collect(r.source,r.relPath).elements,members=ids.map(id=>original.find(e=>e.id===id));if(members.some(e=>e?.kind!=='instance'))throw Error('Select component usages in this source file.');
 const roots=members.filter(e=>!members.some(other=>other!==e&&other.start<e.start&&other.end>=e.end)),mapping=new Map(original.map(e=>[e.id,e.id])),copies=[],removed=new Set(),parents=new Set(),dependencies=new Map(),deleting=op.type==='deleteComponentSelection';let text=r.source;
 for(const root of [...roots].sort((a,b)=>b.start-a.start)){
  const elements=adapter.collect(text,r.relPath).elements,element=elements.find(e=>e.id===mapping.get(root.id));if(!element)throw Error('A selected component lost its source identity.');
  const result=single({...r,source:text,hash:source.contentHash(text),elements,element},{type:deleting?'deleteComponent':'duplicateComponent'},adapter,definition),info=deleting?result.deletedComponent:result.duplicatedComponent,remap=new Map(info.sourceIdMap||[]);
  for(const [before,now]of mapping)mapping.set(before,remap.get(now)||now);for(const copy of copies)copy.instanceId=remap.get(copy.instanceId)||copy.instanceId;
  if(deleting)for(const id of info.removedSourceIds)removed.add(id);else copies.push({originalId:root.id,instanceId:info.instanceId});parents.add(info.parentId);
  for(const edit of result.edits.slice(1)){const previous=dependencies.get(edit.file);if(previous&&previous.before!==edit.before)throw Error('A component definition changed while planning.');dependencies.set(edit.file,edit);}text=result.edits[0].after;
 }
 const final=adapter.collect(text,r.relPath).elements;copies.sort((a,b)=>final.find(e=>e.id===a.instanceId).start-final.find(e=>e.id===b.instanceId).start);
 return {ok:true,hash:source.contentHash(text),rootCount:roots.length,...(deleting?{removedSourceIds:[...removed],deletedComponentIds:roots.map(e=>e.id),parentId:parents.size===1?[...parents][0]:null}:{copiedComponents:copies,selectionIds:copies.map(copy=>copy.instanceId),sourceIdMap:[...mapping].filter(([a,b])=>a!==b)}),edits:[{file:r.file,before:r.source,after:text},...dependencies.values()]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={types,describe,plan};
