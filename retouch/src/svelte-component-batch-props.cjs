'use strict';
const source=require('./svelte-source.cjs');
function plan(resolved,op,adapter){try{
 if(op.fileHash!==resolved.hash)throw Error('The source changed. Re-select the component usages.');
 const selection=op.type==='setComponentPropSelection';
 if(!selection&&op.type!=='pasteComponentProps')throw Error('Choose a supported component property operation.');
 const targets=selection?(Array.isArray(op.ids)?op.ids.map(id=>({id,properties:[{name:op.name,value:op.value,definitionHash:op.definitionHashes?.[id],...(op.reset?{reset:true}:{})}]})):null):op.targets;
 if(!Array.isArray(targets)||targets.length<(selection?2:1)||targets.length>100||new Set(targets.map(t=>t?.id)).size!==targets.length||!targets.some(t=>t?.id===resolved.element.id))throw Error('Choose distinct component usages from the same source file.');
 if(selection&&op.clear)throw Error('Svelte property unset is not available yet.');
 let text=resolved.source,total=0;const refreshIds=new Set(),dependencies=new Map();
 for(const target of targets){
  if(!target||typeof target.id!=='string'||!/^[a-f0-9]{10}$/.test(target.id))throw Error('Invalid component usage.');
  if(!Array.isArray(target.properties)||!target.properties.length||target.properties.length>100||new Set(target.properties.map(p=>p?.name)).size!==target.properties.length||(total+=target.properties.length)>1000)throw Error('Choose distinct properties within the batch limit.');
  for(const property of target.properties){
   if(!property||typeof property.name!=='string'||property.unset!==undefined||!selection&&property.reset!==undefined)throw Error('Choose an existing literal component property.');
   const parsed=source.collect(text,resolved.relPath),element=parsed.components.find(e=>e.id===target.id);
   if(!element)throw Error('Every target must be a component usage in the same source file.');
   const current={...resolved,source:text,hash:source.contentHash(text),element,elements:[...parsed.elements,...parsed.components]};
   const component=adapter.describeComponent(current);if(!component.ok)throw Error(component.reason);
   const result=adapter.planOp(current,{type:'setComponentProp',fileHash:current.hash,name:property.name,value:property.value,definitionHash:property.definitionHash,...(property.reset?{reset:true}:{})});if(!result.ok)throw Error(result.reason);
   if(result.edits.length){text=result.edits.find(edit=>edit.file===resolved.file).after;refreshIds.add(result.componentProp.parentId||element.id);for(const edit of result.edits.filter(edit=>edit.file!==resolved.file)){const old=dependencies.get(edit.file);if(old&&old.before!==edit.before)throw Error('A component definition changed while planning.');dependencies.set(edit.file,edit);}}
  }
 }
 const hash=source.contentHash(text),parsed=adapter.collect(text,resolved.relPath),changed=text!==resolved.source;
 return {ok:true,hash,selection:targets.map(target=>adapter.describe({...resolved,source:text,hash,elements:parsed.elements,element:parsed.elements.find(e=>e.id===target.id)})),componentPaste:{changed,refreshIds:[...refreshIds]},edits:changed?[{file:resolved.file,before:resolved.source,after:text},...dependencies.values()]:[]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
