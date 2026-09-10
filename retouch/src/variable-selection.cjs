'use strict';
const html=require('./adapters/html.cjs'),linked=require('./html-variable-bindings.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function plan(resolved,op,library,adapter=html){try{
 const type={applyVariableSelection:'applyVariable',resetVariableSelection:'resetVariable',detachVariableSelection:'detachVariable',removeVariableSelection:'removeVariable'}[op.type];
 if(!type)return refuse('Unsupported variable selection operation.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!linked.properties.includes(op.property))return refuse('Choose a supported property and screen scope.');
 const ids=op.ids;if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one HTML document.');
 const initial=html.collect(resolved.source,resolved.relPath).elements;
 for(const id of ids){let node=initial.find(element=>element.id===id)?.node;while(node&&node.tagName!=='body')node=node.parentNode;if(!node)return refuse('Every selected layer must belong to the same HTML body.');}
 let source=resolved.source;
 for(const id of ids){
  const elements=html.collect(source,resolved.relPath).elements,element=elements.find(item=>item.id===id),hash=html.contentHash(source);if(!element)return refuse('A selected layer no longer resolves.');
  const current={...resolved,source,elements,element,hash},links=linked.links(current);
  if(type!=='applyVariable'&&!links[op.width]?.[op.property])continue;
  const result=linked.plan(current,{type,fileHash:hash,width:op.width,property:op.property,binding:op.binding},library);if(!result.ok)return result;source=result.edits[0]?.after||source;
 }
 const elements=html.collect(source,resolved.relPath).elements,hash=html.contentHash(source),selection=ids.map(id=>{const element=elements.find(item=>item.id===id);if(!element)throw Error('A selected layer lost its source identity.');const current={...resolved,source,elements,element,hash};return {...adapter.describe(current),...linked.describe(current)};});
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}catch(error){return refuse(error.message);}}
module.exports={plan};
