'use strict';
const {collectElements,contentHash}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
const classValue=node=>node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name==='className')?.value?.value??null;
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 const ids=op.ids,changes=op.classesById;
 if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one React source file.');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.hasOwn(op,'classes')||Object.keys(changes).length!==ids.length||Object.keys(changes).some(id=>!ids.includes(id))||ids.some(id=>!Object.hasOwn(changes,id)||changes[id]!==null&&typeof changes[id]!=='string'))return refuse('Provide a class string or null for every selected layer.');
 const initial=collectElements(resolved.source,resolved.relPath).elements;
 if(ids.some(id=>initial.find(e=>e.id===id)?.kind!=='host'))return refuse('Choose host layers from the same React source file.');
 // Each member is planned in memory; only the final single-file snapshot can
 // reach the shared transaction layer. null preserves a reference verbatim.
 let source=resolved.source;
 for(const id of ids){
  if(changes[id]===null)continue;
  const elements=collectElements(source,resolved.relPath).elements,element=elements.find(e=>e.id===id);
  if(!element)return refuse('A selected layer no longer resolves.');
  if(element.node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'))return refuse('Spread props may control a selected layer’s classes.');
  const hash=contentHash(source),result=require('./writer.cjs').planOp({...resolved,source,hash,elements,element},{type:'setClasses',id,fileHash:hash,classes:changes[id]});
  if(!result.ok)return result;
  const after=result.edits[0].after,fresh=collectElements(after,resolved.relPath).elements.find(e=>e.id===id);
  if(!fresh)return refuse('A selected layer lost its source identity.');
  if(classValue(fresh.node)!==classValue(element.node))source=after;
 }
 const hash=contentHash(source),elements=collectElements(source,resolved.relPath).elements;
 if(ids.some(id=>!elements.some(e=>e.id===id)))return refuse('The edited selection lost its source identity.');
 const selection=ids.map(id=>require('./adapters/react.cjs').describe({...resolved,source,hash,elements,element:elements.find(e=>e.id===id)}));
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}
module.exports={plan};
