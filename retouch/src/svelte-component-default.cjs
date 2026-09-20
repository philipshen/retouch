'use strict';
const compiler=require('svelte/compiler'),MagicString=require('magic-string'),source=require('./svelte-source.cjs'),props=require('./svelte-component-props.cjs');
function inspect(def,name){
 if(typeof name!=='string'||!/^[$A-Z_a-z][$\w-]*$/.test(name)||/^(?:data-rt|__retouch)/.test(name)||['children','slot','this','__proto__'].includes(name))return null;
 const ast=compiler.parse(def.text,{modern:true}),nodes=[];
 for(const statement of ast.instance?.content.body||[]){
  const declaration=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
  if(declaration?.type!=='VariableDeclaration')continue;
  for(const item of declaration.declarations){
   if(statement.type==='ExportNamedDeclaration'&&declaration.kind==='let'&&item.id.type==='Identifier'&&item.id.name===name&&item.init)nodes.push(item.init);
   if(item.id.type==='ObjectPattern'&&item.init?.type==='CallExpression'&&item.init.callee.name==='$props')for(const property of item.id.properties)if(property.type==='Property'&&!property.computed&&(property.key.name??property.key.value)===name&&property.value.type==='AssignmentPattern'&&property.value.left.type==='Identifier')nodes.push(property.value.right);
  }
 }
 if(nodes.length!==1)return null;const node=nodes[0],value=props.literal({type:'Attribute',value:{type:'ExpressionTag',expression:node}});if(!value)return null;
 const contract=require('./svelte-component-choices.cjs').read(def.text).get(name);if(contract&&(!contract.supported||contract.type!==value.type||contract.choices&&!contract.choices.includes(value.value)))return null;
 return {node,editor:{...value,...(contract?.choices?{choices:contract.choices}:{}),revision:source.contentHash(JSON.stringify([def.file,def.definitionHash??source.contentHash(def.text),name]))}};
}
function describe(def,name){try{return inspect(def,name)?.editor||null;}catch{return null;}}
function plan(r,op,definition){try{
 if(op.fileHash!==r.hash)throw Error('The usage changed. Re-select the component.');const def=definition(r),state=inspect(def,op.name);if(!state)throw Error('This property has no editable literal default.');if(op.revision!==state.editor.revision)throw Error('The shared default or its type changed. Re-select the component.');
 const {type,choices}=state.editor;if(typeof op.value!==type||type==='number'&&!Number.isFinite(op.value)||type==='string'&&(op.value.length>100000||op.value.includes('\0'))||choices&&!choices.includes(op.value))throw Error('Choose a valid '+type+' default.');
 const code=Object.is(op.value,-0)?'-0':JSON.stringify(op.value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'),after=Object.is(op.value,state.editor.value)?def.text:new MagicString(def.text).overwrite(state.node.start,state.node.end,code).toString();
 compiler.compile(after,{filename:def.rel,generate:false});const beforeIds=source.collect(def.text,def.rel),afterIds=source.collect(after,def.rel);for(const key of ['elements','components'])if(beforeIds[key].length!==afterIds[key].length||beforeIds[key].some((e,i)=>e.id!==afterIds[key][i].id||e.tag!==afterIds[key][i].tag))throw Error('The default edit would change layer identities.');
 const root=def.meta.roots[0]?.id;if(!root)throw Error('This component has no source layer to refresh.');
 return {ok:true,hash:r.hash,componentDefault:{instanceId:r.element.id,definitionId:root,preserveScriptState:true},edits:[{file:r.file,before:r.source,after:r.source},{file:def.file,before:def.text,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={describe,plan};
