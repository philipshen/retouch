'use strict';
const MagicString=require('magic-string'),{contentHash,collectElements}=require('./id.cjs'),props=require('./component-props.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instances before pasting.');
 try{
  const targets=op.targets;
  if(!Array.isArray(targets)||!targets.length||targets.length>100||new Set(targets.map(t=>t?.id)).size!==targets.length||!targets.some(t=>t?.id===resolved.element.id))return refuse('Choose distinct component usages in one source file.');
  const elements=collectElements(resolved.source,resolved.relPath).elements,dependencies=new Map(),checks=new Map(),ms=new MagicString(resolved.source),refreshIds=new Set();let changed=false;
  for(const target of targets){
   const element=elements.find(e=>e.id===target?.id);if(element?.kind!=='instance')return refuse('Choose component usages in the same source file.');
   if(!Array.isArray(target.properties)||!target.properties.length||target.properties.length>100||new Set(target.properties.map(p=>p?.name)).size!==target.properties.length)return refuse('Choose distinct properties to paste.');
   const current={...resolved,elements,element};let invalid=null;
   const audit={path(file){try{const check=require('./source-path-checks.cjs').snapshot(resolved.appRoot,file),old=checks.get(file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component resolution changed.');checks.set(file,check);if(checks.size>1000)throw Error('Too many component dependencies.');}catch(error){invalid=error;throw error;}},read(file,source){const real=checks.get(file)?.realPath||file,old=dependencies.get(real);if(old&&old.before!==source){invalid=Error('A component dependency changed.');throw invalid;}if(real!==resolved.file)dependencies.set(real,{file:real,before:source,after:source});}};
   require('./components.cjs').definition(current,audit);if(invalid)throw invalid;
   let inserted='';
   for(const property of target.properties){
    if(!property||typeof property.name!=='string'||property.unset!==undefined&&property.unset!==true||property.unset===true&&Object.hasOwn(property,'value'))return refuse('Invalid copied property.');
    const info=props.describe(current,property.name),unset=property.unset===true;
    if(!info.editable||property.definitionHash!==info.definitionHash||unset&&!info.allowUnset)return refuse('A target property changed or is controlled by an expression. Review the paste again.');
    if(unset&&info.unset)continue;
    const result=props.plan(current,{fileHash:resolved.hash,name:property.name,value:property.value,definitionHash:property.definitionHash,clear:unset});if(!result.ok)return result;
    for(const edit of result.edits){if(edit.file===resolved.file)continue;const old=dependencies.get(edit.file);if(old&&old.before!==edit.before)throw Error('A component dependency changed.');dependencies.set(edit.file,edit);}
    for(const check of result.pathChecks||[]){const old=checks.get(check.file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component type resolution changed.');checks.set(check.file,check);}
    if(!unset&&!info.unset&&!info.inherited&&info.value===property.value)continue;
    const attr=element.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===property.name),code=unset?'':property.name+'={'+JSON.stringify(property.value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'}';
    if(attr)ms.overwrite(attr.start,attr.end,code);else inserted+=' '+code;
    refreshIds.add(result.componentProp.parentId||element.id);changed=true;
   }
   if(inserted)ms.appendLeft(element.node.openingElement.name.end,inserted);
  }
  const after=ms.toString(),hash=contentHash(after),fresh=collectElements(after,resolved.relPath).elements;
  const selection=targets.map(({id})=>{const element=fresh.find(e=>e.id===id);if(element?.kind!=='instance')throw Error('A component usage lost its source identity.');return require('./adapters/react.cjs').describe({...resolved,source:after,hash,elements:fresh,element});});
  return {ok:true,hash,selection,componentPaste:{refreshIds:[...refreshIds],changed},edits:[{file:resolved.file,before:resolved.source,after},...dependencies.values()],pathChecks:[...checks.values()]};
 }catch(error){return refuse('Could not paste component properties: '+error.message);}
}
module.exports={plan};
