'use strict';
const compiler=require('svelte/compiler'),props=require('./svelte-component-props.cjs');
// Inspect authored contracts without executing code. Unknown declared types stay
// read-only rather than becoming unrestricted inputs inferred from one usage.
function read(text,context){
 const ast=compiler.parse(text,{modern:true}),declarations=new Map(),fields=new Map(),optional=new Set(),defaulted=new Set();let contract=null,declared=false;
 const statements=[...(ast.module?.content.body||[]),...(ast.instance?.content.body||[])].map(s=>s.type==='ExportNamedDeclaration'?s.declaration:s).filter(Boolean);
 for(const s of statements)if(['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(s.type)){const name=s.id.name;declarations.set(name,declarations.has(name)?null:s);}
 for(const statement of statements)if(statement.type==='ImportDeclaration')for(const specifier of statement.specifiers)declarations.set(specifier.local.name,null);
 const generic=ast.instance?.attributes?.some(attribute=>attribute.name==='generics');
 let modules=null,moduleError=false;try{if(context?.appRoot&&context?.file)modules=require('./component-type-modules.cjs')(context,{file:require('node:fs').realpathSync(context.file),source:text},{program:{body:statements}});}catch{moduleError=true;}
 const utilities=new Set(['Partial','Required','Readonly','Pick','Omit']),filters=new Set(['Exclude','Extract']);
 const builtin=node=>node.type==='TSTypeReference'&&node.typeName.type==='Identifier'&&(utilities.has(node.typeName.name)||filters.has(node.typeName.name))&&(modules?modules.builtin(node,node.typeName.name):!declarations.has(node.typeName.name));
 const argumentsOf=node=>node.typeParameters?.params||node.typeArguments?.params;
 let visits=0;
 function resolve(node,seen=new Set()){
  if(!node||++visits>2000||seen.size>20)return null;
  if(node.type==='TSParenthesizedType')return resolve(node.typeAnnotation,seen);
  if(node.type==='TSIndexedAccessType'){
   if(seen.has(node))return null;const next=new Set(seen);next.add(node);
   const list=members(node.objectType,next),names=keys(node.indexType,next);if(!validMembers(list)||!names?.length)return null;
   const values=[];for(const name of names){const fields=[...new Set(list)].filter(field=>memberName(field)===name);if(fields.length!==1||fields[0].optional)return null;const value=resolve(fields[0].typeAnnotation?.typeAnnotation,next);if(!value)return null;values.push(value.node);}
   return {node:values.length===1?values[0]:{type:'TSUnionType',types:values},seen:next};
  }
  if(node.type!=='TSTypeReference')return {node,seen};
  if(builtin(node))return {node,seen};
  if((!modules&&node.typeName.type!=='Identifier')||node.typeParameters||node.typeArguments)return null;
  let def;try{def=modules?modules.lookup(node):declarations.get(node.typeName.name);}catch{return null;}if(!def||def.typeParameters||seen.has(def))return null;
  const next=new Set(seen);next.add(def);return resolve(def.type==='TSTypeAliasDeclaration'?def.typeAnnotation:def,next);
 }
 function keys(node,seen){
  const state=resolve(node,seen);if(!state)return null;
  if(state.node.type==='TSTypeOperator'&&state.node.operator==='keyof'){
   const list=members(state.node.typeAnnotation,state.seen);return validMembers(list)?[...new Set(list.map(memberName))]:null;
  }
  const value=primitive(node,seen);return value?.type==='string'&&value.choices?value.choices:null;
 }
 const memberName=field=>field.key?.name??field.key?.value;
 const validMembers=list=>list&&list.length<=100&&list.every(field=>field.type==='TSPropertySignature'&&!field.computed&&typeof memberName(field)==='string');
 function members(node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  if(builtin(node)&&utilities.has(node.typeName.name)){
   const args=argumentsOf(node),utility=node.typeName.name;
   if(!args||args.length!==(['Pick','Omit'].includes(utility)?2:1)||seen.has(node))return null;
   const next=new Set(seen);next.add(node);const base=members(args[0],next);if(!validMembers(base))return null;
   if(utility==='Readonly')return base;
   if(utility==='Partial'||utility==='Required')return base.map(field=>({...field,optional:utility==='Partial'}));
   const names=keys(args[1],next);if(!names||names.length>100)return null;
   if(utility==='Pick'&&names.some(name=>!base.some(field=>memberName(field)===name)))return null;
   return base.filter(field=>utility==='Pick'?names.includes(memberName(field)):!names.includes(memberName(field)));
  }
  if(node.type==='TSTypeLiteral')return node.members;
  if(node.type==='TSIntersectionType'){const groups=node.types.map(t=>members(t,seen));return groups.every(Boolean)?groups.flat():null;}
  if(node.type!=='TSInterfaceDeclaration')return null;
  const groups=(node.extends||[]).map(base=>{const reference={type:'TSTypeReference',typeName:base.expression,...(base.typeParameters?{typeParameters:base.typeParameters}:{}),...(base.typeArguments?{typeArguments:base.typeArguments}:{})};return members(modules?modules.inherit(reference,base):reference,seen);});
  return groups.every(Boolean)?[...groups.flat(),...node.body.body]:null;
 }
 function finite(node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  if(seen.has(node))return null;const next=new Set(seen);next.add(node);
  if(node.type==='TSTypeOperator'&&node.operator==='keyof'){const list=members(node.typeAnnotation,next);return validMembers(list)?[...new Set(list.map(memberName))]:null;}
  if(node.type==='TSNeverKeyword')return [];
  if(node.type==='TSBooleanKeyword')return [true,false];
  if(node.type==='TSUnionType'){
   if(node.types.length>100)return null;const groups=node.types.map(type=>finite(type,next));if(groups.some(group=>!group))return null;
   const values=[...new Set(groups.flat())];return values.length<=100?values:null;
  }
  if(builtin(node)&&filters.has(node.typeName.name)){
   const args=argumentsOf(node);if(args?.length!==2)return null;const values=finite(args[0],next);if(!values)return null;
   const matches=values.map(value=>matchesFilter(value,args[1],next));if(matches.includes(null))return null;
   return values.filter((_,index)=>node.typeName.name==='Extract'?matches[index]:!matches[index]);
  }
  if(node.type!=='TSLiteralType')return null;return primitive(node,seen)?.choices||null;
 }
 function matchesFilter(value,node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  if(seen.has(node))return null;const next=new Set(seen);next.add(node);
  if(node.type==='TSUnionType'){
   if(node.types.length>100)return null;const matches=node.types.map(type=>matchesFilter(value,type,next));return matches.includes(null)?null:matches.some(Boolean);
  }
  if(node.type==='TSNeverKeyword')return false;
  if(['TSAnyKeyword','TSUnknownKeyword'].includes(node.type))return true;
  const type={TSStringKeyword:'string',TSNumberKeyword:'number',TSBooleanKeyword:'boolean'}[node.type];if(type)return typeof value===type;
  const values=finite(node,seen);return values?values.includes(value):null;
 }
 function primitive(node,seen){
  const state=resolve(node,seen);if(!state)return null;node=state.node;seen=state.seen;
  if(builtin(node)&&filters.has(node.typeName.name)){
   const choices=finite(node,seen);if(!choices?.length||new Set(choices.map(value=>typeof value)).size!==1)return null;
   return {type:typeof choices[0],choices};
  }
  const type={TSStringKeyword:'string',TSNumberKeyword:'number',TSBooleanKeyword:'boolean'}[node.type];if(type)return {type};
  if(node.type==='TSLiteralType'){const literal=node.literal,expression=['StringLiteral','NumericLiteral','BooleanLiteral'].includes(literal.type)?{type:'Literal',value:literal.value}:literal.type==='UnaryExpression'&&literal.argument.type==='NumericLiteral'?{...literal,argument:{type:'Literal',value:literal.argument.value}}:literal;const value=props.literal({type:'Attribute',value:{type:'ExpressionTag',expression}});return value?{type:value.type,choices:[value.value]}:null;}
  if(node.type!=='TSUnionType'||node.types.length>100)return null;
  const values=node.types.map(t=>primitive(t,seen));if(values.some(v=>!v)||new Set(values.map(v=>v.type)).size!==1)return null;
  if(values.some(v=>!v.choices))return {type:values[0].type};
  const choices=[...new Set(values.flatMap(v=>v.choices))];return choices.length<=100?{type:values[0].type,choices}:null;
 }
 for(const statement of ast.instance?.content.body||[]){
  const s=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
  if(s?.type!=='VariableDeclaration')continue;
  for(const item of s.declarations){
   if(statement.type==='ExportNamedDeclaration'&&s.kind==='let'&&item.id.type==='Identifier'&&item.init)defaulted.add(item.id.name);
   if(item.init?.type==='CallExpression'&&item.init.callee.name==='$props'&&item.id.type==='ObjectPattern')for(const property of item.id.properties)if(property.type==='Property'&&!property.computed&&property.value.type==='AssignmentPattern')defaulted.add(property.key.name??property.key.value);
   if(statement.type==='ExportNamedDeclaration'&&s.kind==='let'&&item.id.type==='Identifier'&&item.id.typeAnnotation)fields.set(item.id.name,item.id.typeAnnotation.typeAnnotation);
   if(item.init?.type==='CallExpression'&&item.init.callee.name==='$props'&&item.id.typeAnnotation){declared=true;contract=item.id.typeAnnotation.typeAnnotation;}
  }
 }
 if(declared){const list=members(contract);if(list&&!list.some(f=>f.type!=='TSPropertySignature'||f.computed))for(const field of list){const name=field.key.name??field.key.value;fields.set(name,fields.has(name)?null:field.typeAnnotation?.typeAnnotation);if(field.optional)optional.add(name);}else contract=null;}
 const values=new Map();for(const [name,node]of fields){visits=0;const value=generic||moduleError?null:primitive(node);values.set(name,value?{supported:true,...value,...(optional.has(name)?{optional:true}:{})}:{supported:false});}
 return {names:[...fields.keys()],hasDefault:name=>defaulted.has(name),get:name=>values.get(name)||(declared||generic||moduleError?{supported:false}:null),metadata:()=>modules?.metadata()||{dependencies:[],pathChecks:[],revision:require('./svelte-source.cjs').contentHash(text)}};
}
function accepts(contract,value){return contract?.supported&&typeof value===contract.type&&(!contract.choices||contract.choices.includes(value));}
module.exports={read,accepts};
