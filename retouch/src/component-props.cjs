'use strict';
const MagicString=require('magic-string'),traverse=require('@babel/traverse').default;
const {parseSource,contentHash}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function literal(attr){
 if(!attr.value)return {type:'boolean',value:true};
 let node=attr.value;if(node.type==='JSXExpressionContainer')node=node.expression;
 if(node.type==='StringLiteral')return {type:'string',value:node.value};
 if(node.type==='BooleanLiteral')return {type:'boolean',value:node.value};
 if(node.type==='NumericLiteral')return {type:'number',value:node.value};
 if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='NumericLiteral')return {type:'number',value:-node.argument.value};
 return null;
}
function describe(resolved,name){
 const attrs=resolved.element.node.openingElement.attributes;
 if(resolved.element.kind!=='instance')return {reason:'Select a component instance.'};
 if(!/^[A-Za-z_$][\w$]*$/.test(name)||['key','ref','children','__proto__','__self','__source'].includes(name)||name.startsWith('data-rt'))return {reason:'This property has special component behavior.'};
 if(attrs.some(a=>a.type==='JSXSpreadAttribute'))return {reason:'A spread controls this usage. Edit its source binding.'};
 const matches=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name===name);
 if(matches.length!==1)return {reason:matches.length?'Resolve duplicate attributes first.':'This property uses its definition default.'};
 const value=literal(matches[0]);return value?{editable:true,...value}:{reason:'This property is driven by an expression. Edit its source binding.'};
}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before editing its properties.');
 try{
  const info=describe(resolved,op.name);if(!info.editable)return refuse(info.reason);
  if(typeof op.value!==info.type||info.type==='number'&&!Number.isFinite(op.value)||info.type==='string'&&op.value.length>100000)return refuse('Use a valid '+info.type+' value for this property.');
  const attr=resolved.element.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===op.name);
  // Expression strings avoid JSX entity and multiline whitespace normalization.
  const code=op.name+'={'+JSON.stringify(op.value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'}';
  const ms=new MagicString(resolved.source);ms.overwrite(attr.start,attr.end,code);
  let parentId=null;traverse(parseSource(resolved.source),{JSXElement(p){if(p.node.start!==resolved.element.node.start)return;for(let q=p.parentPath;q;q=q.parentPath){const host=resolved.elements.find(e=>e.kind==='host'&&e.node.start===q.node.start);if(host){parentId=host.id;break;}}p.stop();}});
  return {ok:true,hash:contentHash(ms.toString()),componentProp:{instanceId:resolved.element.id,parentId},edits:[{file:resolved.file,before:resolved.source,after:ms.toString()}]};
 }catch(error){return refuse('Could not edit the component property: '+error.message);}
}
module.exports={describe,plan};
