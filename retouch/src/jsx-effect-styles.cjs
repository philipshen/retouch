'use strict';
const MagicString=require('magic-string'),react=require('./adapters/react.cjs'),catalog=require('./effect-styles.cjs'),classes=require('./effect-style-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-effect-styles',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.node.openingElement.attributes;
 if(attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name==='className').length>1)throw Error('The layer has duplicate class attributes.');
 if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))throw Error('Effect style links need a layer without spread attributes.');
 const found=attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate effect style link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0],value=attr.value?.type==='StringLiteral'?attr.value:attr.value?.type==='JSXExpressionContainer'?attr.value.expression:null;
 if(value?.type!=='StringLiteral'||value.value.length>128*1024)throw Error('Effect style links require a bounded literal string.');
 const links=JSON.parse(value.value);
 if(!links||typeof links!=='object'||Array.isArray(links)||Object.keys(links).length>32)throw Error('Invalid effect style links.');
 for(const [scope,link]of Object.entries(links)){
  responsive.replaceScope('','',scope);
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['id','properties','overrides'].includes(key)))throw Error('Invalid effect style link.');
  catalog.validate({version:1,styles:[{id:link.id,name:'Linked style',properties:link.properties}]});
  if(link.overrides!==undefined&&(!Array.isArray(link.overrides)||link.overrides.length>catalog.properties.length||new Set(link.overrides).size!==link.overrides.length||link.overrides.some(property=>!catalog.properties.includes(property))))throw Error('Invalid effect style overrides.');
 }
 return {links,attribute:attr};
}
function describe(resolved){if(resolved.element.kind!=='host')return {};try{
 const links=metadata(resolved.element).links,info=require('./writer.cjs').describeElement(resolved);
 if(info.classNameDynamic)throw Error('Effect style links need literal classes.');
 const overrides=info.classNameDynamic?{}:Object.fromEntries(Object.entries(links).map(([scope,link])=>[scope,[...new Set([...(link.overrides||[]),...classes.overrides(info.className||'',link.properties,scope)])].sort()]));
 return {classEffectStyles:true,effectStyleLinks:links,effectStyleOverrides:overrides};
}catch(error){return {classEffectStyles:false,effectStyleLinkReason:error.message};}}
function plan(resolved,op,style){
 try{
  if(resolved.element.kind!=='host')return refuse('Select a host layer to apply a effect style.');
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const scope=op.scope??'';responsive.replaceScope('','',scope);
  const current=metadata(resolved.element).links;let source=resolved.source;
  if(['applyEffectStyle','resetEffectStyle','refreshEffectStyle'].includes(op.type)){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0],info=react.describe(resolved);
   if(info.classNameDynamic)return refuse('Effect style application needs literal classes.');
   if(op.type!=='applyEffectStyle'&&current[scope]?.id!==validated.id)return refuse('The layer is no longer linked to this effect style.');
   const refreshed=op.type==='refreshEffectStyle'?classes.refresh(info.className||'',current[scope].properties,validated.properties,scope,current[scope].overrides):null;
   const composed=refreshed?refreshed.classes:classes.compose(info.className||'',validated.properties,scope,op.type==='resetEffectStyle'?[...Object.keys(current[scope].properties),...(current[scope].overrides||[])]:[]),result=react.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;
   source=result.edits[0]?.after||source;current[scope]={id:validated.id,properties:validated.properties,...(refreshed?.overrides.length?{overrides:refreshed.overrides}:{})};
  }else if(op.type==='detachEffectStyle')delete current[scope];else return refuse('Unsupported React effect style operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 effect style scopes.');
  const element=react.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during effect style application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer effect style links are too large.');const token=attribute+'={'+JSON.stringify(serialized)+'}';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.node.openingElement.name.end,' '+token);}
  else if(old)out.remove(old.start,old.end);
  const after=out.toString();react.collect(after,resolved.relPath);
  return {ok:true,hash:react.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,style){
 try{
  catalog.validate({version:1,styles:[style]});const parsed=react.collect(before,relPath),indexed=new Set(parsed.elements.map(element=>element.node.openingElement.start)),targets=[];
  require('@babel/traverse').default(parsed.ast,{JSXAttribute(p){if(p.node.name.name===attribute&&!indexed.has(p.parentPath.node.start))throw Error('A effect style link belongs to an unindexed JSX layer.');}});
  for(const element of parsed.elements){
   if(!element.node.openingElement.attributes.some(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute))continue;
   for(const [scope,link]of Object.entries(metadata(element).links))if(link.id===style.id)targets.push({id:element.id,scope});
  }
  let source=before;
  for(const target of targets){const element=react.collect(source,relPath).elements.find(item=>item.id===target.id);if(!element)throw Error('A linked JSX layer could not be resolved.');const result=plan({file,relPath,source,hash:react.contentHash(source),element},{type:'refreshEffectStyle',scope:target.scope},style);if(!result.ok)return result;source=result.edits[0]?.after||source;}
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planFile};
