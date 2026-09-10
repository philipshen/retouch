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
function defaultProp(resolved,name,definition){
 try{
  const def=definition||require('./components.cjs').definition(resolved);
  let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
  if(param?.type!=='ObjectPattern')return null;
  const fields=param.properties.filter(p=>p.type==='ObjectProperty'&&!p.computed&&(p.key.name||p.key.value)===name);
  if(fields.length!==1||fields[0].value.type!=='AssignmentPattern')return null;
  const value=literal({value:fields[0].value.right});return value?{...value,definition:def}:null;
 }catch{return null;}
}
function describe(resolved,name,definition){
 const attrs=resolved.element.node.openingElement.attributes;
 if(resolved.element.kind!=='instance')return {reason:'Select a component instance.'};
 if(!/^[A-Za-z_$][\w$]*$/.test(name)||['key','ref','children','__proto__','__self','__source'].includes(name)||name.startsWith('data-rt'))return {reason:'This property has special component behavior.'};
 if(attrs.some(a=>a.type==='JSXSpreadAttribute'))return {reason:'A spread controls this usage. Edit its source binding.'};
 const matches=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name===name);
 if(matches.length>1)return {reason:'Resolve duplicate attributes first.'};
 const fallback=defaultProp(resolved,name,definition),defaults=fallback?{definitionHash:contentHash(fallback.definition.source),defaultValue:fallback.value,canReset:matches.length===1}:{};
 if(!matches.length){const choice=require('./component-prop-choices.cjs').choices(resolved,name,definition);return fallback?{editable:true,type:fallback.type,value:fallback.value,inherited:true,...defaults,...(choice?{choices:choice.choices,type:choice.type}: {})}:{reason:'This property uses its definition default.'};}
 const value=literal(matches[0]),choice=require('./component-prop-choices.cjs').choices(resolved,name,definition),contract=choice?{choices:choice.choices,type:choice.type,definitionHash:contentHash(choice.definition.source)}:{};return value?{editable:true,...value,...defaults,...contract}:{reason:'This property is driven by an expression. Edit its source binding.',...defaults};
}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before editing its properties.');
 try{
  const info=describe(resolved,op.name);if(op.reset===true?!info.canReset:!info.editable)return refuse(info.reason||'This property has no literal default to restore.');
  const fallback=op.reset===true||info.inherited?defaultProp(resolved,op.name):null;
  if((op.reset===true||info.inherited)&&!fallback)return refuse('The component default no longer resolves. Re-select the instance.');
  if(fallback&&op.definitionHash!==contentHash(fallback.definition.source))return refuse('The component definition changed. Re-select the instance before using its default.');
  if(op.reset!==true&&(typeof op.value!==info.type||info.type==='number'&&!Number.isFinite(op.value)||info.type==='string'&&op.value.length>100000))return refuse('Use a valid '+info.type+' value for this property.');
  const choice=info.choices?require('./component-prop-choices.cjs').choices(resolved,op.name):null;
  if(info.choices&&(!choice||op.definitionHash!==contentHash(choice.definition.source)))return refuse('The component type changed. Re-select the instance.');
  if(op.reset!==true&&choice&&!choice.choices.includes(op.value))return refuse('Choose one of the values declared by this component.');
  const dependency=fallback?.definition||choice?.definition;
  const attr=resolved.element.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===op.name);
  // Expression strings avoid JSX entity and multiline whitespace normalization.
  const code=op.reset===true?'':op.name+'={'+JSON.stringify(op.value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'}';
  const ms=new MagicString(resolved.source);if(attr)ms.overwrite(attr.start,attr.end,code);else ms.appendLeft(resolved.element.node.openingElement.name.end,' '+code);
  let parentId=null;traverse(parseSource(resolved.source),{JSXElement(p){if(p.node.start!==resolved.element.node.start)return;for(let q=p.parentPath;q;q=q.parentPath){const host=resolved.elements.find(e=>e.kind==='host'&&e.node.start===q.node.start);if(host){parentId=host.id;break;}}p.stop();}});
  const edits=[{file:resolved.file,before:resolved.source,after:ms.toString()}];
  if(dependency&&dependency.file!==resolved.file)edits.push({file:dependency.file,before:dependency.source,after:dependency.source});
  return {ok:true,hash:contentHash(ms.toString()),componentProp:{instanceId:resolved.element.id,parentId},edits};
 }catch(error){return refuse('Could not edit the component property: '+error.message);}
}
module.exports={describe,plan};
