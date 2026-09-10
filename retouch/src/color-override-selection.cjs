'use strict';
const react=require('./adapters/react.cjs'),paint=require('./color-style-classes.cjs');
function plan(resolved,op,adapter=react){try{
 const liquid=adapter.name==='liquid';
 if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100)throw Error('Choose between 2 and 100 source layers.');
 const elements=adapter.collect(resolved.source,resolved.relPath).elements,changes={};
 for(const id of op.ids){const element=elements.find(item=>item.id===id);if(!element)throw Error('A selected layer could not be resolved.');const info=adapter.describe({...resolved,elements,element,...(liquid?{context:op.contexts?.[id]}:{})});if(info.classNameDynamic)throw Error('Color editing needs literal classes on every selected layer.');changes[id]=paint.compose(info.className||'',op.property,op.value,op.scope||'');}
 return require(liquid?'./liquid-class-selection.cjs':'./jsx-class-selection.cjs').plan(resolved,{ids:op.ids,fileHash:op.fileHash,classesById:changes,contexts:op.contexts});
}catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
