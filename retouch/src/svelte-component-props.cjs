'use strict';
const MagicString=require('magic-string'),compiler=require('svelte/compiler'),source=require('./svelte-source.cjs');
function literal(attribute){
 if(attribute.type!=='Attribute')return null;
 if(attribute.value===true)return {type:'boolean',value:true};
 if(Array.isArray(attribute.value)&&attribute.value.every(node=>node.type==='Text'))return {type:'string',value:attribute.value.map(node=>node.data).join('')};
 if(attribute.value?.type!=='ExpressionTag')return null;
 const expression=attribute.value.expression;
 if(expression.type==='Literal'&&['string','boolean','number'].includes(typeof expression.value)&&!(typeof expression.value==='number'&&!Number.isFinite(expression.value)))return {type:typeof expression.value,value:expression.value};
 if(expression.type==='UnaryExpression'&&['-','+'].includes(expression.operator)&&expression.argument.type==='Literal'&&typeof expression.argument.value==='number'&&Number.isFinite(expression.argument.value))return {type:'number',value:expression.operator==='-'?-expression.argument.value:expression.argument.value};
 return null;
}
function describe(resolved,parsed=source.collect(resolved.source,resolved.relPath)){
 const element=parsed.components.find(item=>item.id===resolved.element.id);
 if(!element)throw Error('Select a Svelte component usage.');
 const attributes=element.node.attributes,spread=attributes.some(item=>item.type==='SpreadAttribute');
 const props=attributes.filter(item=>item.name).map(attribute=>{
  const name=attribute.name,value=literal(attribute),reserved=!/^[A-Za-z_$][\w$-]*$/.test(name)||/^(?:data-rt|__retouch)/.test(name)||['children','slot','this'].includes(name),duplicate=attributes.filter(item=>item.name===name).length>1;
  const reason=spread?'A spread controls this component usage.':duplicate?'Resolve duplicate properties first.':reserved?'This property has special component behavior.':!value?'This property is controlled by a binding or expression.':null;
  return {name,...value,editable:!reason,...(reason?{reason}:{})};
 });
 return {id:element.id,name:element.tag,props,element,parsed};
}
function plan(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)throw Error('The component usage changed. Re-select it.');
  const info=describe(resolved),prop=info.props.find(item=>item.name===op.name);
  if(!prop?.editable)throw Error(prop?.reason||'Choose an existing literal component property.');
  if(typeof op.value!==prop.type||prop.type==='number'&&!Number.isFinite(op.value)||prop.type==='string'&&(op.value.length>100000||op.value.includes('\0')))throw Error('Use a valid '+prop.type+' property value.');
  if(Object.is(prop.value,op.value))return {ok:true,hash:resolved.hash,edits:[]};
  const attribute=info.element.node.attributes.find(item=>item.name===op.name),value=Object.is(op.value,-0)?'-0':JSON.stringify(op.value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const out=new MagicString(resolved.source);out.overwrite(attribute.start,attribute.end,op.name+'={'+value+'}');const after=out.toString(),next=source.collect(after,resolved.relPath);
  for(const key of ['elements','components'])if(info.parsed[key].length!==next[key].length||next[key].some((item,index)=>item.id!==info.parsed[key][index].id||item.tag!==info.parsed[key][index].tag))throw Error('The property edit changed surrounding source identities.');
  compiler.compile(after,{filename:resolved.relPath,generate:false});
  const saved=describe({...resolved,source:after},next);if(!Object.is(saved.props.find(item=>item.name===op.name)?.value,op.value))throw Error('Svelte would interpret the property differently.');
  const parent=info.parsed.elements.filter(item=>item.start<info.element.start&&item.end>=info.element.end).sort((a,b)=>b.start-a.start)[0];
  return {ok:true,hash:source.contentHash(after),componentProp:{instanceId:info.element.id,parentId:parent?.id||null},edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
module.exports={describe,plan,literal};
