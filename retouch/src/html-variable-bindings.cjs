'use strict';
const MagicString=require('magic-string'),html=require('./adapters/html.cjs'),css=require('./html-css.cjs'),bindings=require('./variable-bindings.cjs'),V=require('../shell/html-css-values.js');
const attribute='data-rt-variables',properties=bindings.properties,refuse=reason=>({ok:false,refused:true,reason});
function links({element}){
 const raw=element.node.attrs.find(a=>a.name===attribute)?.value;if(raw===undefined)return {};
 if(raw.length>128*1024)throw Error('Variable links are too large.');const state=JSON.parse(raw);
 if(!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).length>32)throw Error('Invalid variable links.');
 for(const [width,group]of Object.entries(state)){
  if(!/^(0|[1-9]\d*)$/.test(width)||Number(width)>7680||!group||typeof group!=='object'||Array.isArray(group)||!Object.keys(group).length||Object.keys(group).some(p=>!properties.includes(p)))throw Error('Invalid variable scope.');
  for(const [property,link]of Object.entries(group)){
   if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(k=>!['id','modes','unit','value','override'].includes(k))||link.override!==undefined&&typeof link.override!=='boolean')throw Error('Invalid variable link.');
   bindings.specification({id:link.id,modes:link.modes,...(link.unit!==undefined?{unit:link.unit}:{})});if(typeof link.value!=='string'||!V.valid(property,link.value))throw Error('Invalid stored variable value.');
  }
 }return state;
}
function describe(resolved){try{
 const state=links(resolved),info=css.describe(resolved);if(info.cssReason)throw Error(info.cssReason);
 return {variables:true,variableLinks:state,variableOverrides:Object.fromEntries(Object.entries(state).map(([width,group])=>[width,Object.entries(group).filter(([p,link])=>link.override||info.cssRules[width]?.[p]!==link.value).map(([p])=>p)]))};
}catch(error){return {variables:false,variableReason:error.message};}}
function plan(resolved,op,library){try{
 if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the layer.');
 if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!properties.includes(op.property))return refuse('Choose a supported variable property and screen scope.');
 const state=links(resolved),oldLink=state[op.width]?.[op.property];let source=resolved.source;
 if(op.type==='detachVariable'){if(oldLink){delete state[op.width][op.property];if(!Object.keys(state[op.width]).length)delete state[op.width];}}
 else if(['applyVariable','resetVariable','refreshVariable'].includes(op.type)){
  const spec=op.type==='applyVariable'?op.binding:oldLink&&{id:oldLink.id,modes:oldLink.modes,...(oldLink.unit!==undefined?{unit:oldLink.unit}:{})};if(!spec)return refuse('The layer is no longer linked to a variable.');const resolvedValue=bindings.resolve(library,op.property,spec),value=resolvedValue.value;
  const info=css.describe(resolved);if(info.cssReason)return refuse(info.cssReason);
  const override=op.type==='refreshVariable'&&(oldLink.override||info.cssRules[op.width]?.[op.property]!==oldLink.value);
  if(!override){const result=css.plan(resolved,{width:op.width,property:op.property,value});if(!result.ok)return result;source=result.edits[0]?.after||source;}
  (state[op.width]??={})[op.property]={...resolvedValue.binding,value,...(override?{override:true}:{})};
 }else return refuse('Unsupported variable operation.');
 if(Object.keys(state).length>32)return refuse('A layer supports up to 32 variable scopes.');
 const element=html.collect(source,resolved.relPath).elements.find(e=>e.id===resolved.element.id);if(!element)return refuse('The linked layer changed.');
 const out=new MagicString(source),old=element.location.attrs?.[attribute];
 if(Object.keys(state).length){const value=JSON.stringify(state);if(value.length>128*1024)return refuse('Variable links are too large.');const token=attribute+'="'+value.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"';if(old)out.overwrite(old.startOffset,old.endOffset,token);else out.appendLeft(element.location.startTag.startOffset+1+element.tag.length,' '+token);}else if(old)out.remove(old.startOffset,old.endOffset);
 const after=out.toString();return {ok:true,hash:html.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}catch(error){return refuse(error.message);}}
function planFile(file,relPath,before,library){try{
 const elements=html.collect(before,relPath).elements,indexed=new Set(elements.map(e=>e.location.startTag.startOffset)),targets=[];
 function check(node){if(node.attrs?.some(a=>a.name===attribute)&&!indexed.has(node.sourceCodeLocation?.startTag?.startOffset))throw Error('An unindexed layer has a variable link.');for(const child of node.childNodes||[])check(child);if(node.content)check(node.content);}
 check(require('parse5').parse(before,{sourceCodeLocationInfo:true}));
 for(const element of elements)for(const [width,group]of Object.entries(links({element})))for(const property of Object.keys(group))targets.push({id:element.id,width:Number(width),property});
 let source=before;for(const target of targets){const element=html.collect(source,relPath).elements.find(e=>e.id===target.id);if(!element)throw Error('A linked layer could not be resolved.');const result=plan({file,relPath,source,hash:html.contentHash(source),element},{type:'refreshVariable',width:target.width,property:target.property},library);if(!result.ok)return result;source=result.edits[0]?.after||source;}
 return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
}catch(error){return refuse(error.message);}}
module.exports={links,describe,plan,planFile,properties};
