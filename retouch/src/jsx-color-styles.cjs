'use strict';
const MagicString=require('magic-string'),react=require('./adapters/react.cjs'),catalog=require('./color-styles.cjs'),classes=require('./color-style-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-color-styles',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.node.openingElement.attributes;
 if(attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name==='className').length>1)throw Error('The layer has duplicate class attributes.');
 if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))throw Error('Color style links need a layer without spread attributes.');
 const found=attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate color style link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0],value=attr.value?.type==='StringLiteral'?attr.value:attr.value?.type==='JSXExpressionContainer'?attr.value.expression:null;
 if(value?.type!=='StringLiteral'||value.value.length>128*1024)throw Error('Color style links require a bounded literal string.');
 const links=JSON.parse(value.value);
 if(!links||typeof links!=='object'||Array.isArray(links)||Object.keys(links).length>32)throw Error('Invalid color style links.');
 for(const [scope,group]of Object.entries(links)){
  responsive.replaceScope('','',scope);
  if(!group||typeof group!=='object'||Array.isArray(group)||!Object.keys(group).length||Object.keys(group).some(p=>!classes.properties.includes(p)))throw Error('Invalid color style scope.');
  for(const link of Object.values(group)){
   if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['id','value','override'].includes(key))||link.override!==undefined&&typeof link.override!=='boolean')throw Error('Invalid color style link.');
   catalog.validate({version:1,styles:[{id:link.id,name:'Linked color',properties:{color:link.value}}]});
  }
 }
 return {links,attribute:attr};
}
function describe(resolved){if(resolved.element.kind!=='host')return {};try{
 const links=metadata(resolved.element).links,info=require('./writer.cjs').describeElement(resolved);
 if(info.classNameDynamic)throw Error('Color style links need literal classes.');
 const overrides=Object.fromEntries(Object.entries(links).map(([scope,group])=>[scope,Object.entries(group).filter(([property,link])=>link.override||classes.overridden(info.className||'',property,link.value,scope)).map(([property])=>property)]));
 return {classColorStyles:true,colorStyleLinks:links,colorStyleOverrides:overrides};
}catch(error){return {classColorStyles:false,colorStyleLinkReason:error.message};}}
function plan(resolved,op,style){
 try{
  if(resolved.element.kind!=='host')return refuse('Select a host layer to apply a color style.');
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const scope=op.scope??'';responsive.replaceScope('','',scope);
  if(!classes.properties.includes(op.property))return refuse('Choose a supported color property.');
  const current=metadata(resolved.element).links,oldLink=current[scope]?.[op.property];let source=resolved.source;
  if(['applyColorStyle','resetColorStyle','refreshColorStyle'].includes(op.type)){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0],info=require('./writer.cjs').describeElement(resolved),value=validated.properties.color;
   if(info.classNameDynamic)return refuse('Color style application needs literal classes.');
   if(op.type!=='applyColorStyle'&&oldLink?.id!==validated.id)return refuse('The layer is no longer linked to this color style.');
   const override=op.type==='refreshColorStyle'&&(oldLink.override||classes.overridden(info.className||'',op.property,oldLink.value,scope));
   if(!override){const composed=classes.compose(info.className||'',op.property,value,scope),result=react.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;source=result.edits[0]?.after||source;}
   (current[scope]??={})[op.property]={id:validated.id,value,...(override?{override:true}:{})};
  }else if(op.type==='detachColorStyle'){if(oldLink){delete current[scope][op.property];if(!Object.keys(current[scope]).length)delete current[scope];}}else return refuse('Unsupported React color style operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 color style scopes.');
  const element=react.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during color style application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer color style links are too large.');const token=attribute+'={'+JSON.stringify(serialized)+'}';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.node.openingElement.name.end,' '+token);}
  else if(old)out.remove(old.start,old.end);
  const after=out.toString();react.collect(after,resolved.relPath);
  return {ok:true,hash:react.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,style){
 try{
  catalog.validate({version:1,styles:[style]});const parsed=react.collect(before,relPath),indexed=new Set(parsed.elements.map(element=>element.node.openingElement.start)),targets=[];
  require('@babel/traverse').default(parsed.ast,{JSXAttribute(p){if(p.node.name.name===attribute&&!indexed.has(p.parentPath.node.start))throw Error('A color style link belongs to an unindexed JSX layer.');}});
  for(const element of parsed.elements){
   if(!element.node.openingElement.attributes.some(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute))continue;
   for(const [scope,group]of Object.entries(metadata(element).links))for(const [property,link]of Object.entries(group))if(link.id===style.id)targets.push({id:element.id,scope,property});
  }
  let source=before;
  for(const target of targets){const element=react.collect(source,relPath).elements.find(item=>item.id===target.id);if(!element)throw Error('A linked JSX layer could not be resolved.');const result=plan({file,relPath,source,hash:react.contentHash(source),element},{type:'refreshColorStyle',scope:target.scope,property:target.property},style);if(!result.ok)return result;source=result.edits[0]?.after||source;}
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planFile};
