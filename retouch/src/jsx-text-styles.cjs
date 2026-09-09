'use strict';
const MagicString=require('magic-string'),react=require('./adapters/react.cjs'),catalog=require('./text-styles.cjs'),classes=require('./text-style-classes.cjs'),responsive=require('../shell/responsive.js');
const attribute='data-rt-text-styles',refuse=reason=>({ok:false,refused:true,reason});
function metadata(element){
 const attributes=element.node.openingElement.attributes;
 if(attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name==='className').length>1)throw Error('The layer has duplicate class attributes.');
 if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))throw Error('Text style links need a layer without spread attributes.');
 const found=attributes.filter(attr=>attr.type==='JSXAttribute'&&attr.name.name===attribute);
 if(found.length>1)throw Error('The layer has duplicate text style link attributes.');
 if(!found.length)return {links:{},attribute:null};
 const attr=found[0],value=attr.value?.type==='StringLiteral'?attr.value:attr.value?.type==='JSXExpressionContainer'?attr.value.expression:null;
 if(value?.type!=='StringLiteral'||value.value.length>128*1024)throw Error('Text style links require a bounded literal string.');
 const links=JSON.parse(value.value);
 if(!links||typeof links!=='object'||Array.isArray(links)||Object.keys(links).length>32)throw Error('Invalid text style links.');
 for(const [scope,link]of Object.entries(links)){
  responsive.replaceScope('','',scope);
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['id','properties'].includes(key)))throw Error('Invalid text style link.');
  catalog.validate({version:1,styles:[{id:link.id,name:'Linked style',properties:link.properties}]});
 }
 return {links,attribute:attr};
}
function describe(resolved){try{return {textStyleLinks:metadata(resolved.element).links};}catch(error){return {textStyleLinkReason:error.message};}}
function plan(resolved,op,style){
 try{
  if(resolved.element.kind!=='host')return refuse('Select a host layer to apply a text style.');
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const scope=op.scope??'';responsive.replaceScope('','',scope);
  const current=metadata(resolved.element).links;let source=resolved.source;
  if(op.type==='applyTextStyle'){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0],info=react.describe(resolved);
   if(info.classNameDynamic)return refuse('Text style application needs literal classes.');
   const composed=classes.compose(info.className||'',validated.properties,scope),result=react.planOp(resolved,{type:'setClasses',classes:composed,fileHash:resolved.hash});if(!result.ok)return result;
   source=result.edits[0]?.after||source;current[scope]={id:validated.id,properties:validated.properties};
  }else if(op.type==='detachTextStyle')delete current[scope];else return refuse('Unsupported React text style operation.');
  if(Object.keys(current).length>32)return refuse('A layer supports up to 32 text style scopes.');
  const element=react.collect(source,resolved.relPath).elements.find(item=>item.id===resolved.element.id);if(!element)return refuse('The layer changed during text style application.');
  const old=metadata(element).attribute,out=new MagicString(source);
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer text style links are too large.');const token=attribute+'={'+JSON.stringify(serialized)+'}';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.node.openingElement.name.end,' '+token);}
  else if(old)out.remove(old.start,old.end);
  const after=out.toString();react.collect(after,resolved.relPath);
  return {ok:true,hash:react.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
