'use strict';
const liquid=require('./adapters/liquid.cjs'),refuse=reason=>({ok:false,refused:true,reason});
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 const ids=op.ids,changes=op.classesById,contexts=op.contexts;
 if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one Liquid source file.');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.hasOwn(op,'classes')||Object.keys(changes).length!==ids.length||ids.some(id=>!Object.hasOwn(changes,id)||changes[id]!==null&&typeof changes[id]!=='string'))return refuse('Provide a class string or null for every selected layer.');
 if(!contexts||typeof contexts!=='object'||Array.isArray(contexts)||Object.keys(contexts).length!==ids.length||ids.some(id=>!Object.hasOwn(contexts,id)))return refuse('Re-select every Liquid layer to capture its rendered context.');
 const initial=liquid.collect(resolved.source,resolved.relPath).elements;
 for(const id of ids){const element=initial.find(element=>element.id===id);if(element?.kind!=='host'||element.generatedImage||element.attributeExpressions||(element.attributes||[]).filter(attr=>attr.name==='class').length>1)return refuse('Choose explicit host layers without generated or duplicate attributes in one Liquid file.');}
 let source=resolved.source;
 for(const id of ids){
  if(changes[id]===null)continue;
  const elements=liquid.collect(source,resolved.relPath).elements,element=elements.find(element=>element.id===id),hash=liquid.contentHash(source);if(!element)return refuse('A selected layer no longer resolves.');
  const result=liquid.planOp({...resolved,source,elements,element,hash,context:contexts[id]},{type:'setClasses',fileHash:hash,classes:changes[id]});if(!result.ok)return result;source=result.edits[0]?.after??source;
 }
 const hash=liquid.contentHash(source),elements=liquid.collect(source,resolved.relPath).elements,selection=ids.map(id=>{const element=elements.find(element=>element.id===id);if(!element)throw Error('A selected layer lost its source identity.');return liquid.describe({...resolved,source,hash,elements,element,context:contexts[id]});});
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}catch(error){return refuse(error.message);}}
module.exports={plan};
