'use strict';
const MagicString=require('magic-string'),props=require('./component-props.cjs'),{contentHash}=require('./id.cjs');
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
module.exports={describe,plan};
