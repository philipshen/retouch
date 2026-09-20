'use strict';
const styles=require('./layer-style-classes.cjs');
function plan(resolved,op,adapter){try{
 if(!['react','liquid'].includes(adapter.name))throw Error('Choose React or Liquid source layers.');
 if(op.fileHash!==resolved.hash)throw Error('The source changed. Re-select the layers.');
 const ids=op.ids,changes=op.changesById;
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'))throw Error('Choose distinct layers from one source file.');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).length!==ids.length||ids.some(id=>!Object.hasOwn(changes,id)))throw Error('Provide copied styles for each target.');
 const elements=adapter.collect(resolved.source,resolved.relPath).elements,classesById={};
 for(const id of ids){
  const element=elements.find(item=>item.id===id);if(!element)throw Error('A target layer could not be resolved.');
  const info=adapter.describe({...resolved,elements,element,...(adapter.name==='liquid'?{context:op.contexts?.[id]}:{})});
  if(info.kind!=='host'||info.classNameDynamic||adapter.name==='liquid'&&!info.classSourceLiteral)throw Error('Style paste needs literal classes on every target layer.');
  classesById[id]=styles.compose(info.className||'',changes[id],op.scope||'');
 }
 return adapter.planOp({...resolved,...(adapter.name==='liquid'?{context:op.contexts?.[ids[0]]}:{})},ids.length>1?{type:'setClassesSelection',ids,fileHash:op.fileHash,classesById,contexts:op.contexts}:{type:'setClasses',fileHash:op.fileHash,classes:classesById[ids[0]]});
}catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
