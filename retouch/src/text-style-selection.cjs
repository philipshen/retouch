'use strict';
const refuse=reason=>({ok:false,refused:true,reason});
// Plan the entire selection in memory; the transaction receives one before-image.
function plan(resolved,op,style,adapter){
 try{
  if(!['html','react'].includes(adapter.name))return refuse('Text style selection is not available for this renderer yet.');
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  const type={applyTextStyleSelection:'applyTextStyle',resetTextStyleSelection:'resetTextStyle',detachTextStyleSelection:'detachTextStyle'}[op.type||'applyTextStyleSelection'];
  if(!type)return refuse('Unsupported selection text style operation.');
  const scope=adapter.name==='react'?(op.scope??''):String(op.width);
  if(adapter.name==='react')require('../shell/responsive.js').replaceScope('','',scope);
  else if(!Number.isInteger(op.width)||op.width<0||op.width>7680)return refuse('Choose a supported screen width.');
  const ids=op.ids;
  if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one source file.');
  const initial=adapter.collect(resolved.source,resolved.relPath).elements;
  if(ids.some(id=>initial.find(element=>element.id===id)?.kind!=='host'))return refuse('Every selected layer must belong to the same source file.');
  const linked=require(adapter.name==='react'?'./jsx-text-styles.cjs':'./html-text-styles.cjs');let source=resolved.source;
  for(const id of ids){
   const elements=adapter.collect(source,resolved.relPath).elements,element=elements.find(item=>item.id===id),hash=adapter.contentHash(source);
   if(!element)return refuse('A selected layer no longer resolves.');
   const current={...resolved,source,elements,element,hash},description=linked.describe(current);
   if(description.textStyleLinkReason)return refuse(description.textStyleLinkReason);
   const link=description.textStyleLinks?.[scope];let selectedStyle=style;
   if(type!=='applyTextStyle'){
    if(!link)continue;
    if(type==='resetTextStyle'){selectedStyle=style?.styles?.find(item=>item.id===link.id);if(!selectedStyle)return refuse('A selected layer uses an unavailable style. Restore its library or detach the link.');}
   }
   const result=linked.plan(current,{type,scope:op.scope,width:op.width,fileHash:hash},selectedStyle);
   if(!result.ok)return result;source=result.edits[0]?.after||source;
  }
  const elements=adapter.collect(source,resolved.relPath).elements,hash=adapter.contentHash(source),selection=ids.map(id=>{
   const element=elements.find(item=>item.id===id);if(!element)throw Error('The selected layer lost its source identity.');
   return adapter.describe({...resolved,source,elements,element,hash});
  });
  return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
