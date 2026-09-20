'use strict';
const MagicString=require('magic-string'),props=require('./component-props.cjs'),{contentHash,collectElements}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function entries(resolved,definition){
 if(resolved.element.kind!=='instance')return [];
 return resolved.element.node.openingElement.attributes.filter(attr=>attr.type==='JSXAttribute').flatMap(attr=>{
  const name=attr.name.name,info=props.describe(resolved,name,definition);
  return info.canReset||info.canClear?[{name,reset:!!info.canReset,definitionHash:info.definitionHash}]:[];
 });
}
function describe(resolved,definition){
 try{const properties=entries(resolved,definition);return properties.length?{names:properties.map(p=>p.name),revision:contentHash(JSON.stringify([resolved.hash,properties]))}:null;}catch{return null;}
}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance.');
 try{
  const dependencies=new Map(),checks=new Map();let invalid=null;
  const audit={path(file){try{const check=require('./source-path-checks.cjs').snapshot(resolved.appRoot,file),old=checks.get(file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component resolution changed.');checks.set(file,check);if(checks.size>1000)throw Error('Too many component dependencies.');}catch(error){invalid=error;throw error;}},read(file,source){const real=checks.get(file)?.realPath||file,old=dependencies.get(real);if(old&&old.before!==source){invalid=Error('A component dependency changed.');throw invalid;}if(real!==resolved.file)dependencies.set(real,{file:real,before:source,after:source});}};
  const definition=require('./components.cjs').definition(resolved,audit);if(invalid)throw invalid;
  const properties=entries(resolved,definition),revision=contentHash(JSON.stringify([resolved.hash,properties]));
  if(!properties.length)return refuse('This instance has no properties that can be reset.');
  if(op.revision!==revision)return refuse('The component properties or defaults changed. Re-select the instance.');
  const ms=new MagicString(resolved.source);let parentId=null;
  // Validate every removal against one source snapshot, including same-file definitions.
  for(const property of properties){
   const result=props.plan(resolved,{...property,fileHash:resolved.hash,clear:!property.reset});if(!result.ok)return result;
   parentId=result.componentProp.parentId;
   for(const edit of result.edits){if(edit.file===resolved.file)continue;const old=dependencies.get(edit.file);if(old&&old.before!==edit.before)throw Error('A component dependency changed.');dependencies.set(edit.file,edit);}
   for(const check of result.pathChecks||[]){const old=checks.get(check.file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component type resolution changed.');checks.set(check.file,check);}
   const attr=resolved.element.node.openingElement.attributes.find(attr=>attr.type==='JSXAttribute'&&attr.name.name===property.name);ms.remove(attr.start,attr.end);
  }
  const after=ms.toString();return {ok:true,hash:contentHash(after),componentProp:{instanceId:resolved.element.id,parentId},edits:[{file:resolved.file,before:resolved.source,after},...dependencies.values()],pathChecks:[...checks.values()]};
 }catch(error){return refuse('Could not reset component properties: '+error.message);}
}
function planSelection(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instances.');
 try{
  const {ids,revisions}=op;
  if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct component usages in one source file.');
  if(!revisions||typeof revisions!=='object'||Array.isArray(revisions)||Object.keys(revisions).length!==ids.length||Object.keys(revisions).some(id=>!ids.includes(id)||revisions[id]!==null&&typeof revisions[id]!=='string'))return refuse('Provide the current reset revision for every selected instance.');
  const elements=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>elements.find(element=>element.id===id));
  if(members.some(element=>element?.kind!=='instance'))return refuse('Select component usages from the same source file.');
  const dependencies=new Map(),checks=new Map(),ms=new MagicString(resolved.source),refreshIds=new Set();let changed=0;
  for(const element of members){
   const current={...resolved,elements,element},meta=describe(current);
   if((meta?.revision||null)!==revisions[element.id])return refuse('The selected properties or defaults changed. Re-select the instances.');
   if(!meta)continue;
   const result=plan(current,{fileHash:resolved.hash,revision:meta.revision});if(!result.ok)return result;
   for(const edit of result.edits){if(edit.file===resolved.file)continue;const old=dependencies.get(edit.file);if(old&&old.before!==edit.before)throw Error('A component dependency changed.');dependencies.set(edit.file,edit);}
   for(const check of result.pathChecks||[]){const old=checks.get(check.file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component resolution changed.');checks.set(check.file,check);}
   // Remove only the validated attributes, keeping nested usages and intervening source intact.
   for(const name of meta.names){const attr=element.node.openingElement.attributes.find(attr=>attr.type==='JSXAttribute'&&attr.name.name===name);ms.remove(attr.start,attr.end);}
   refreshIds.add(result.componentProp.parentId||element.id);changed++;
  }
  if(!changed)return refuse('The selected instances have no properties that can be reset.');
  const after=ms.toString(),hash=contentHash(after),fresh=collectElements(after,resolved.relPath).elements;
  const selection=ids.map(id=>{const element=fresh.find(element=>element.id===id);if(element?.kind!=='instance')throw Error('A component usage lost its source identity.');return require('./adapters/react.cjs').describe({...resolved,source:after,hash,elements:fresh,element});});
  return {ok:true,hash,selection,componentReset:{refreshIds:[...refreshIds]},edits:[{file:resolved.file,before:resolved.source,after},...dependencies.values()],pathChecks:[...checks.values()]};
 }catch(error){return refuse('Could not reset selected component properties: '+error.message);}
}
module.exports={describe,plan,planSelection};
