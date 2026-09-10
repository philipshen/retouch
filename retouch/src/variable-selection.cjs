'use strict';
const html=require('./adapters/html.cjs'),bindings=require('./variable-bindings.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function plan(resolved,op,library,adapter=html){try{
 const isLiquid=adapter.name==='liquid',isReact=adapter.name==='react',classBased=isReact||isLiquid;if(!classBased&&adapter.name!=='html')return refuse('Variable selections need HTML, React or Liquid layers.');
 const linked=require(isReact?'./jsx-variable-bindings.cjs':isLiquid?'./liquid-variable-bindings.cjs':'./html-variable-bindings.cjs');
 const scope=classBased?(op.scope??''):op.width;if(classBased)require('../shell/responsive.js').replaceScope('','',scope);
 const type={applyVariableSelection:'applyVariable',resetVariableSelection:'resetVariable',detachVariableSelection:'detachVariable',removeVariableSelection:'removeVariable'}[op.type];
 if(!type)return refuse('Unsupported variable selection operation.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
 if((!classBased&&(!Number.isInteger(op.width)||op.width<0||op.width>7680))||!bindings.properties.includes(op.property))return refuse('Choose a supported property and screen scope.');
 const ids=op.ids;if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct layers in one source document.');
 if(isLiquid&&(!op.contexts||typeof op.contexts!=='object'||Array.isArray(op.contexts)||Object.keys(op.contexts).length!==ids.length||ids.some(id=>!Object.hasOwn(op.contexts,id))))return refuse('Re-select every Liquid layer to capture its rendered context.');
 const initial=adapter.collect(resolved.source,resolved.relPath).elements;
 for(const id of ids){const element=initial.find(element=>element.id===id);if(classBased){if(element?.kind!=='host')return refuse('Every selected layer must be a host layer in the same source file.');continue;}let node=element?.node;while(node&&node.tagName!=='body')node=node.parentNode;if(!node)return refuse('Every selected layer must belong to the same HTML body.');}
 let source=resolved.source;
 for(const id of ids){
  const elements=adapter.collect(source,resolved.relPath).elements,element=elements.find(item=>item.id===id),hash=adapter.contentHash(source);if(!element)return refuse('A selected layer no longer resolves.');
  const current={...resolved,source,elements,element,hash,...(isLiquid?{context:op.contexts[id]}:{})},links=linked.links(current);
  if(type!=='applyVariable'&&!links[scope]?.[op.property])continue;
  const result=linked.plan(current,{type,fileHash:hash,width:op.width,scope:op.scope,property:op.property,binding:op.binding},library);if(!result.ok)return result;source=result.edits[0]?.after||source;
 }
 const elements=adapter.collect(source,resolved.relPath).elements,hash=adapter.contentHash(source),selection=ids.map(id=>{const element=elements.find(item=>item.id===id);if(!element)throw Error('A selected layer lost its source identity.');const current={...resolved,source,elements,element,hash,...(isLiquid?{context:op.contexts[id]}:{})};return {...adapter.describe(current),...linked.describe(current)};});
 return {ok:true,hash,selection,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
}catch(error){return refuse(error.message);}}
module.exports={plan};
