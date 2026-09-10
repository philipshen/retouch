'use strict';
const MagicString=require('magic-string'),liquid=require('./adapters/liquid.cjs'),catalog=require('./text-styles.cjs'),classes=require('./text-style-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-text-styles',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.attributes||[];
 if(element.generatedImage||element.attributeExpressions)throw Error('Text style links need an explicit template element without generated attributes.');
 if(attributes.filter(attr=>attr.name==='class').length>1)throw Error('The layer has duplicate class attributes.');
 const found=attributes.filter(attr=>attr.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate text style link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0];
 if(typeof attr.value!=='string'||attr.value.length>128*1024||/\{[%{]/.test(attr.value))throw Error('Text style links require a bounded literal string.');
 const value={value:require('./liquid-classes.cjs').decode(attr.value)};
 const links=JSON.parse(value.value);
 if(!links||typeof links!=='object'||Array.isArray(links)||Object.keys(links).length>32)throw Error('Invalid text style links.');
 for(const [scope,link]of Object.entries(links)){
  responsive.replaceScope('','',scope);
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['id','properties','overrides'].includes(key)))throw Error('Invalid text style link.');
  catalog.validate({version:1,styles:[{id:link.id,name:'Linked style',properties:link.properties}]});
  if(link.overrides!==undefined&&(!Array.isArray(link.overrides)||link.overrides.length>catalog.properties.length||new Set(link.overrides).size!==link.overrides.length||link.overrides.some(property=>!catalog.properties.includes(property))))throw Error('Invalid text style overrides.');
 }
 return {links,attribute:attr};
}
function describe(resolved){if(resolved.element.kind!=='host')return {};try{
 const links=metadata(resolved.element).links,info=liquid.describeElement(resolved);
 const overrides=info.classNameDynamic?{}:Object.fromEntries(Object.entries(links).map(([scope,link])=>[scope,[...new Set([...(link.overrides||[]),...classes.overrides(info.className||'',link.properties,scope)])].sort()]));
 return {classTextStyles:true,textStyleLinks:links,textStyleOverrides:overrides};
}catch(error){return {classTextStyles:false,textStyleLinkReason:error.message};}}
function plan(resolved,op,style){
 try{
  if(resolved.element.kind!=='host')return refuse('Select a host layer to apply a text style.');
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const scope=op.scope??'';responsive.replaceScope('','',scope);
  const current=metadata(resolved.element).links;let source=resolved.source;
  if(['applyTextStyle','resetTextStyle','refreshTextStyle'].includes(op.type)){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0],info=liquid.describeElement(resolved);
   if(info.classNameDynamic)return refuse('Reload the preview to read this layer’s rendered classes.');
   if(op.type!=='applyTextStyle'&&current[scope]?.id!==validated.id)return refuse('The layer is no longer linked to this text style.');
   const refreshed=op.type==='refreshTextStyle'?classes.refresh(info.className||'',current[scope].properties,validated.properties,scope,[...(current[scope].overrides||[]),...(resolved.textStyleSourceSnapshot?Object.keys(validated.properties).filter(key=>!(key in current[scope].properties)):[])]):null;
   const composed=refreshed?refreshed.classes:classes.compose(info.className||'',validated.properties,scope,op.type==='resetTextStyle'?[...Object.keys(current[scope].properties),...(current[scope].overrides||[])]:[]),result=liquid.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;
   source=result.edits[0]?.after||source;current[scope]={id:validated.id,properties:validated.properties,...(refreshed?.overrides.length?{overrides:refreshed.overrides}:{})};
  }else if(op.type==='detachTextStyle')delete current[scope];else return refuse('Unsupported Liquid text style operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 text style scopes.');
  const element=liquid.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during text style application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){
   const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer text style links are too large.');
   const escaped=serialized.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'\\u003c');
   if(escaped.length>128*1024)return refuse('The layer text style links are too large.');
   const token=attribute+'="'+escaped+'"';if(old)out.overwrite(old.attrStart,old.attrEnd,token);else out.appendLeft(element.nameEnd,' '+token);
  }else if(old)out.remove(old.attrStart,old.attrEnd);
  const after=out.toString();liquid.collect(after,resolved.relPath);
  return {ok:true,hash:liquid.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
// Refresh from source-owned class patches; never invent a rendered snapshot for
// an arbitrary Liquid expression. Newly introduced properties on dynamic layers
// retain local ownership because their inactive branches cannot be evaluated here.
function planFile(file,relPath,before,style){
 try{
  catalog.validate({version:1,styles:[style]});
  const parsed=liquid.collect(before,relPath),indexed=new Set(parsed.elements.map(element=>element.tagStart)),targets=[];
  for(const node of liquid._parse(before).all){
   if(!node.attributes?.some(attr=>attr.name===attribute))continue;
   if(!indexed.has(node.tagStart))throw Error('A text style link belongs to an unindexed Liquid layer.');
  }
  for(const element of parsed.elements){
   if(!element.attributes?.some(attr=>attr.name===attribute))continue;
   for(const [scope,link]of Object.entries(metadata(element).links))if(link.id===style.id)targets.push({id:element.id,scope});
  }
  let source=before;
  for(const target of targets){
   const elements=liquid.collect(source,relPath).elements,element=elements.find(item=>item.id===target.id);
   if(!element)throw Error('A linked Liquid layer could not be resolved.');
   let context,textStyleSourceSnapshot=false;
   if(element.classAttr?.dynamic){
    const patch=require('./liquid-classes.cjs').unpack(element.classAttr.value,element.id);
    if(patch.original===element.classAttr.value)throw Error('A linked dynamic class expression has no source-owned class patch. Reapply the style in the preview.');
    context={className:patch.added.join(' ')};textStyleSourceSnapshot=true;
   }
   const result=plan({file,relPath,source,hash:liquid.contentHash(source),element,elements,context,textStyleSourceSnapshot},{type:'refreshTextStyle',scope:target.scope},style);
   if(!result.ok)return result;source=result.edits[0]?.after||source;
  }
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planFile};
