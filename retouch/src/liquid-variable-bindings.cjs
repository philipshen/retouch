'use strict';
const MagicString=require('magic-string'),liquid=require('./adapters/liquid.cjs'),bindings=require('./variable-bindings.cjs'),V=require('../shell/html-css-values.js'),classes=require('./variable-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-variables',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.attributes||[];
 if(element.generatedImage||element.attributeExpressions)throw Error('Variable links need an explicit template element without generated attributes.');
 if(attributes.filter(attr=>attr.name==='class').length>1)throw Error('The layer has duplicate class attributes.');
 const found=attributes.filter(attr=>attr.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate variable link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0];
 if(typeof attr.value!=='string'||attr.value.length>128*1024||/\{[%{]/.test(attr.value))throw Error('Variable links require a bounded literal string.');
 const value={value:require('./liquid-classes.cjs').decode(attr.value)};
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
 const links=metadata(resolved.element).links,info=liquid.describeElement(resolved);
 if(info.classNameDynamic)throw Error('Reload the preview to read this layer’s rendered classes.');
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
   const resolvedValue=bindings.resolve(library,op.property,spec),value=resolvedValue.value,info=liquid.describeElement(resolved);
   if(info.classNameDynamic)return refuse('Reload the preview to read this layer’s rendered classes.');
   const override=op.type==='refreshVariable'&&(oldLink.override||classes.overridden(info.className||'',op.property,oldLink.value,scope));
   if(!override){
    const inline=(resolved.element.attributes||[]).filter(attr=>attr.name==='style');
    if(inline.length>1||inline.some(attr=>typeof attr.value!=='string'||/\{[%{]|!important/i.test(require('./liquid-classes.cjs').decode(attr.value))))throw Error('Variable application needs static inline styles without important declarations.');
    const composed=classes.compose(info.className||'',op.property,value,scope),result=liquid.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;source=result.edits[0]?.after||source;
   }
   (current[scope]??={})[op.property]={...resolvedValue.binding,value,...(override?{override:true}:{})};
  }else if(['detachVariable','removeVariable'].includes(op.type)){if(op.type==='removeVariable'){if(!oldLink)return refuse('The layer is no longer linked to a variable.');const info=liquid.describeElement(resolved);if(info.classNameDynamic)return refuse('Reload the preview to remove this binding override.');const result=liquid.planOp(resolved,{type:'setClasses',classes:classes.compose(info.className||'',op.property,null,scope),fileHash:resolved.hash});if(!result.ok)return result;source=result.edits[0]?.after||source;}if(oldLink){delete current[scope][op.property];if(!Object.keys(current[scope]).length)delete current[scope];}}else return refuse('Unsupported Liquid variable operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 variable scopes.');
  const element=liquid.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during variable application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){
   const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer variable links are too large.');
   const escaped=serialized.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'\\u003c');
   if(escaped.length>128*1024)return refuse('The layer variable links are too large.');
   const token=attribute+'="'+escaped+'"';if(old)out.overwrite(old.attrStart,old.attrEnd,token);else out.appendLeft(element.nameEnd,' '+token);
  }else if(old)out.remove(old.attrStart,old.attrEnd);
  const after=out.toString();liquid.collect(after,resolved.relPath);
  return {ok:true,hash:liquid.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,library){
 try{
  const parsed=liquid.collect(before,relPath),indexed=new Set(parsed.elements.map(element=>element.tagStart)),targets=[];
  for(const node of liquid._parse(before).all)if(node.attributes?.some(attr=>attr.name===attribute)&&!indexed.has(node.tagStart))throw Error('A variable link belongs to an unindexed Liquid layer.');
  for(const element of parsed.elements){
   if(!element.attributes?.some(attr=>attr.name===attribute))continue;
   for(const [scope,group]of Object.entries(metadata(element).links))for(const property of Object.keys(group))targets.push({id:element.id,scope,property});
  }
  let source=before;
  for(const target of targets){
   const elements=liquid.collect(source,relPath).elements,element=elements.find(item=>item.id===target.id);if(!element)throw Error('A linked Liquid layer could not be resolved.');
   let context;
   if(element.classAttr?.dynamic){const patch=require('./liquid-classes.cjs').unpack(element.classAttr.value,element.id);if(patch.original===element.classAttr.value)throw Error('A linked dynamic class expression has no source-owned class patch. Reapply the variable in the preview.');context={className:patch.added.join(' ')};}
   const result=plan({file,relPath,source,hash:liquid.contentHash(source),element,elements,context},{type:'refreshVariable',scope:target.scope,property:target.property},library);if(!result.ok)return result;source=result.edits[0]?.after||source;
  }
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planFile,links:resolved=>metadata(resolved.element).links};
