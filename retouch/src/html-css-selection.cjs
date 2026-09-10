'use strict';
const html=require('./adapters/html.cjs'),css=require('./html-css.cjs');
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id)||op.ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one HTML document.');
 if(!Number.isInteger(op.width)||op.width<0||op.width>7680)return refuse('Choose a supported screen width.');
 const individual=op.changesById;
 if(individual!==undefined&&(!individual||typeof individual!=='object'||Array.isArray(individual)||['property','value','changes'].some(key=>Object.hasOwn(op,key))||Object.keys(individual).length!==op.ids.length||Object.keys(individual).some(id=>!op.ids.includes(id))))return refuse('Provide exactly one CSS change set for every selected layer.');
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
  if(individual!==undefined&&individual[id]&&typeof individual[id]==='object'&&!Array.isArray(individual[id])&&!Object.keys(individual[id]).length)continue;
  const hash=html.contentHash(source),result=css.plan({...resolved,source,hash,elements,element},{...op,...(individual===undefined?{}:{changes:individual[id]}),fileHash:hash});
  if(!result.ok)return result;
  if(result.edits.length)source=result.edits[0].after;
 }
 const hash=html.contentHash(source),elements=html.collect(source,resolved.relPath).elements;
 const selection=op.ids.map(id=>{const r={...resolved,source,hash,elements,element:elements.find(e=>e.id===id)};return {...html.describe(r),...css.describe(r),...require('./html-text-styles.cjs').describe(r)};});
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}
module.exports={plan};
