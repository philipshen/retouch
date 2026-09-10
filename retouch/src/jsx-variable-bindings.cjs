'use strict';
const MagicString=require('magic-string'),react=require('./adapters/react.cjs'),bindings=require('./variable-bindings.cjs'),V=require('../shell/html-css-values.js'),classes=require('./variable-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-variables',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.node.openingElement.attributes;
 if(attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name==='className').length>1)throw Error('The layer has duplicate class attributes.');
 if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))throw Error('Variable links need a layer without spread attributes.');
 const found=attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate variable link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0],value=attr.value?.type==='StringLiteral'?attr.value:attr.value?.type==='JSXExpressionContainer'?attr.value.expression:null;
 if(value?.type!=='StringLiteral'||value.value.length>128*1024)throw Error('Variable links require a bounded literal string.');
 const links=JSON.parse(value.value);
 if(!links||typeof links!=='object'||Array.isArray(links)||Object.keys(links).length>32)throw Error('Invalid variable links.');
 for(const [scope,group]of Object.entries(links)){
  responsive.replaceScope('','',scope);
  if(!group||typeof group!=='object'||Array.isArray(group)||!Object.keys(group).length||Object.keys(group).some(p=>!classes.properties.includes(p)))throw Error('Invalid variable scope.');
  for(const [property,link]of Object.entries(group)){
   if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['id','modes','unit','value','override'].includes(key))||link.override!==undefined&&typeof link.override!=='boolean')throw Error('Invalid variable link.');
   bindings.specification({id:link.id,modes:link.modes,...(link.unit!==undefined?{unit:link.unit}:{})});if(typeof link.value!=='string'||!V.valid(property,link.value))throw Error('Invalid stored variable value.');
  }
 }
 return {links,attribute:attr};
}
function describe(resolved){if(resolved.element.kind!=='host')return {};try{
 const links=metadata(resolved.element).links,info=require('./writer.cjs').describeElement(resolved);
 if(info.classNameDynamic)throw Error('Variable links need literal classes.');
 const overrides=Object.fromEntries(Object.entries(links).map(([scope,group])=>[scope,Object.entries(group).filter(([property,link])=>link.override||classes.overridden(info.className||'',property,link.value,scope)).map(([property])=>property)]));
 return {classVariables:true,variableLinks:links,variableOverrides:overrides};
}catch(error){return {classVariables:false,variableReason:error.message};}}
function plan(resolved,op,library){
 try{
  if(resolved.element.kind!=='host')return refuse('Select a host layer to apply a variable.');
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const scope=op.scope??'';responsive.replaceScope('','',scope);
  if(!classes.properties.includes(op.property))return refuse('Choose a supported variable property.');
  const current=metadata(resolved.element).links,oldLink=current[scope]?.[op.property];let source=resolved.source;
  if(['applyVariable','resetVariable','refreshVariable'].includes(op.type)){
   const spec=op.type==='applyVariable'?op.binding:oldLink&&{id:oldLink.id,modes:oldLink.modes,...(oldLink.unit!==undefined?{unit:oldLink.unit}:{})};if(!spec)return refuse('The layer is no longer linked to a variable.');
   const resolvedValue=bindings.resolve(library,op.property,spec),value=resolvedValue.value,info=require('./writer.cjs').describeElement(resolved);
   if(info.classNameDynamic)return refuse('Variable application needs literal classes.');
   const override=op.type==='refreshVariable'&&(oldLink.override||classes.overridden(info.className||'',op.property,oldLink.value,scope));
   if(!override){
    const inline=resolved.element.node.openingElement.attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name==='style');
    if(inline.length>1)throw Error('The layer has duplicate inline styles.');
    if(inline.length){const object=inline[0].value?.expression;if(object?.type!=='ObjectExpression'||object.properties.some(p=>p.type!=='ObjectProperty'||p.computed||!['StringLiteral','NumericLiteral'].includes(p.value.type)||typeof p.value.value==='string'&&/!important/i.test(p.value.value)))throw Error('Variable application needs static inline styles without important declarations.');}
    const composed=classes.compose(info.className||'',op.property,value,scope),result=react.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;source=result.edits[0]?.after||source;
   }
   (current[scope]??={})[op.property]={...resolvedValue.binding,value,...(override?{override:true}:{})};
  }else if(['detachVariable','removeVariable'].includes(op.type)){if(op.type==='removeVariable'){if(!oldLink)return refuse('The layer is no longer linked to a variable.');const info=require('./writer.cjs').describeElement(resolved);if(info.classNameDynamic)return refuse('Removing a variable override needs literal classes.');const result=react.planOp(resolved,{type:'setClasses',classes:classes.compose(info.className||'',op.property,null,scope),fileHash:resolved.hash});if(!result.ok)return result;source=result.edits[0]?.after||source;}if(oldLink){delete current[scope][op.property];if(!Object.keys(current[scope]).length)delete current[scope];}}else return refuse('Unsupported React variable operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 variable scopes.');
  const element=react.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during variable application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer variable links are too large.');const token=attribute+'={'+JSON.stringify(serialized)+'}';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.node.openingElement.name.end,' '+token);}
  else if(old)out.remove(old.start,old.end);
  const after=out.toString();react.collect(after,resolved.relPath);
  return {ok:true,hash:react.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,library){
 try{
  const parsed=react.collect(before,relPath),indexed=new Set(parsed.elements.map(element=>element.node.openingElement.start)),targets=[];
  require('@babel/traverse').default(parsed.ast,{JSXAttribute(p){if(p.node.name.name===attribute&&!indexed.has(p.parentPath.node.start))throw Error('A variable link belongs to an unindexed JSX layer.');}});
  for(const element of parsed.elements){
   if(!element.node.openingElement.attributes.some(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute))continue;
   if(element.kind!=='host')throw Error('A variable link belongs to a component instance rather than a host layer.');
   for(const [scope,group]of Object.entries(metadata(element).links))for(const property of Object.keys(group))targets.push({id:element.id,scope,property});
  }
  let source=before;
  for(const target of targets){const element=react.collect(source,relPath).elements.find(item=>item.id===target.id);if(!element)throw Error('A linked JSX layer could not be resolved.');const result=plan({file,relPath,source,hash:react.contentHash(source),element},{type:'refreshVariable',scope:target.scope,property:target.property},library);if(!result.ok)return result;source=result.edits[0]?.after||source;}
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planFile,links:resolved=>metadata(resolved.element).links};
