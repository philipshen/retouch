'use strict';
const react=require('./adapters/react.cjs'),paint=require('./color-style-classes.cjs');
function plan(resolved,op,adapter=react){try{
 const liquid=adapter.name==='liquid';
 if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100)throw Error('Choose between 2 and 100 source layers.');
 const visibility=op.type==='setBackgroundPaintSelection';
 if(visibility&&(!op.changesById||typeof op.changesById!=='object'||Array.isArray(op.changesById)||Object.keys(op.changesById).length!==op.ids.length||op.ids.some(id=>!Object.hasOwn(op.changesById,id))))throw Error('Provide background paint changes for every selected layer.');
 const elements=adapter.collect(resolved.source,resolved.relPath).elements,changes={};
 for(const id of op.ids){const element=elements.find(item=>item.id===id);if(!element)throw Error('A selected layer could not be resolved.');const info=adapter.describe({...resolved,elements,element,...(liquid?{context:op.contexts?.[id]}:{})});if(info.classNameDynamic)throw Error('Color editing needs literal classes on every selected layer.');if(visibility){const value=op.changesById[id];if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Provide a background paint change set.');}
 changes[id]=visibility?(Object.keys(op.changesById[id]).length?paint.composeBackground(info.className||'',op.changesById[id],op.scope||''):info.className||''):op.value===null?paint.compose(info.className||'',op.property,null,op.scope||''):paint.composeStyle(info.className||'',op.property,op.value,op.scope||'',op.backgroundPaints?.[id]);}
 return require(liquid?'./liquid-class-selection.cjs':'./jsx-class-selection.cjs').plan(resolved,{ids:op.ids,fileHash:op.fileHash,classesById:changes,contexts:op.contexts});
}catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
