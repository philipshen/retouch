'use strict';
const html=require('./adapters/html.cjs'),css=require('./html-css.cjs');
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id)||op.ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one HTML document.');
 const initial=html.collect(resolved.source,resolved.relPath).elements;
 for(const id of op.ids){
  const element=initial.find(e=>e.id===id);let body=element?.node;
  while(body&&body.tagName!=='body')body=body.parentNode;
  if(!element||!body)return refuse('Every selected layer must belong to the same HTML body.');
 }
 // Plan against private in-memory snapshots. Nothing reaches disk unless every
 // selected layer passes validation; the returned edit has one before-image.
 let source=resolved.source;
 for(const id of op.ids){
  const elements=html.collect(source,resolved.relPath).elements,element=elements.find(e=>e.id===id);
  if(!element)return refuse('A selected layer no longer resolves.');
  const hash=html.contentHash(source),result=css.plan({...resolved,source,hash,elements,element},{...op,fileHash:hash});
  if(!result.ok)return result;
  if(result.edits.length)source=result.edits[0].after;
 }
 const hash=html.contentHash(source),elements=html.collect(source,resolved.relPath).elements;
 const selection=op.ids.map(id=>{const r={...resolved,source,hash,elements,element:elements.find(e=>e.id===id)};return {...html.describe(r),...css.describe(r)};});
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}
module.exports={plan};
