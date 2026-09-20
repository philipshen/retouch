'use strict';
const compiler=require('svelte/compiler'),props=require('./svelte-component-props.cjs');
// Inspect authored contracts without executing code. Unknown declared types stay
// read-only rather than becoming unrestricted inputs inferred from one usage.
function read(text){
 const ast=compiler.parse(text,{modern:true}),declarations=new Map(),fields=new Map();let contract=null,declared=false;
 const statements=[...(ast.module?.content.body||[]),...(ast.instance?.content.body||[])].map(s=>s.type==='ExportNamedDeclaration'?s.declaration:s).filter(Boolean);
 for(const s of statements)if(['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(s.type)){const name=s.id.name;declarations.set(name,declarations.has(name)?null:s);}
 for(const statement of statements)if(statement.type==='ImportDeclaration')for(const specifier of statement.specifiers)declarations.set(specifier.local.name,null);
 const generic=ast.instance?.attributes?.some(attribute=>attribute.name==='generics');
 let visits=0;
 function resolve(node,seen=new Set()){
  if(!node||++visits>2000||seen.size>20)return null;
  if(node.type==='TSParenthesizedType')return resolve(node.typeAnnotation,seen);
  if(node.type!=='TSTypeReference')return {node,seen};
  if(node.typeName.type!=='Identifier'||node.typeParameters||node.typeArguments)return null;
  const def=declarations.get(node.typeName.name);if(!def||def.typeParameters||seen.has(def))return null;
  const next=new Set(seen);next.add(def);return resolve(def.type==='TSTypeAliasDeclaration'?def.typeAnnotation:def,next);
 }
 function members(node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  if(node.type==='TSTypeLiteral')return node.members;
  if(node.type==='TSIntersectionType'){const groups=node.types.map(t=>members(t,seen));return groups.every(Boolean)?groups.flat():null;}
  if(node.type!=='TSInterfaceDeclaration')return null;
  const groups=(node.extends||[]).map(base=>base.typeParameters||base.typeArguments?null:members({type:'TSTypeReference',typeName:base.expression},seen));
  return groups.every(Boolean)?[...groups.flat(),...node.body.body]:null;
 }
 function primitive(node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  const type={TSStringKeyword:'string',TSNumberKeyword:'number',TSBooleanKeyword:'boolean'}[node.type];if(type)return {type};
  if(node.type==='TSLiteralType'){const value=props.literal({type:'Attribute',value:{type:'ExpressionTag',expression:node.literal}});return value?{type:value.type,choices:[value.value]}:null;}
  if(node.type!=='TSUnionType'||node.types.length>100)return null;
  const values=node.types.map(t=>primitive(t,seen));if(values.some(v=>!v)||new Set(values.map(v=>v.type)).size!==1)return null;
  if(values.some(v=>!v.choices))return {type:values[0].type};
  const choices=[...new Set(values.flatMap(v=>v.choices))];return choices.length<=100?{type:values[0].type,choices}:null;
 }
 for(const statement of ast.instance?.content.body||[]){
  const s=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
  if(s?.type!=='VariableDeclaration')continue;
  for(const item of s.declarations){
   if(statement.type==='ExportNamedDeclaration'&&s.kind==='let'&&item.id.type==='Identifier'&&item.id.typeAnnotation)fields.set(item.id.name,item.id.typeAnnotation.typeAnnotation);
   if(item.init?.type==='CallExpression'&&item.init.callee.name==='$props'&&item.id.typeAnnotation){declared=true;contract=item.id.typeAnnotation.typeAnnotation;}
  }
 }
 if(declared){const list=members(contract);if(list&&!list.some(f=>f.type!=='TSPropertySignature'||f.computed))for(const field of list){const name=field.key.name??field.key.value;fields.set(name,fields.has(name)?null:field.typeAnnotation?.typeAnnotation);}else contract=null;}
 return {get(name){visits=0;if(generic)return {supported:false};if(!fields.has(name))return declared?{supported:false}:null;const value=primitive(fields.get(name));return value?{supported:true,...value}:{supported:false};}};
}
function accepts(contract,value){return contract?.supported&&typeof value===contract.type&&(!contract.choices||contract.choices.includes(value));}
module.exports={read,accepts};
