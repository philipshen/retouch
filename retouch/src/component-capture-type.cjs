'use strict';
// A copied structural type must not refer to bindings from the old function.
const allowed=new Set(['TSTypeAnnotation','TSTypeLiteral','TSPropertySignature','TSMethodSignature','TSFunctionType','TSArrayType','TSTupleType','TSNamedTupleMember','TSOptionalType','TSRestType','TSLiteralType','TSParenthesizedType',...'TSStringKeyword TSNumberKeyword TSBooleanKeyword TSBigIntKeyword TSSymbolKeyword TSAnyKeyword TSNeverKeyword TSVoidKeyword TSUndefinedKeyword TSNullKeyword'.split(' ')]);
function closed(node){
 if(!node||typeof node!=='object')return true;
 if(Array.isArray(node))return node.every(closed);
 if(node.type?.startsWith('TS')&&!allowed.has(node.type)||node.computed||node.optional)return false;
 return Object.entries(node).every(([key,value])=>['loc','leadingComments','trailingComments','innerComments','extra'].includes(key)||closed(value));
}
function patternType(pattern,contract,name,resolve,depth=0){
 if(!pattern||!contract||depth>20||pattern.optional)return null;
 contract=resolve(contract);if(!contract)return null;
 if(pattern.type==='Identifier')return pattern.name===name?contract:null;
 if(pattern.type==='ObjectPattern'&&contract.type==='TSTypeLiteral'){
  for(const property of pattern.properties){
   if(property.type!=='ObjectProperty'||property.computed)continue;
   const key=property.key.name??property.key.value,members=contract.members.filter(member=>member.type==='TSPropertySignature'&&!member.computed&&(member.key.name??member.key.value)===key);
   if(members.length!==1||members[0].optional)continue;
   const result=patternType(property.value,members[0].typeAnnotation?.typeAnnotation,name,resolve,depth+1);if(result)return result;
  }
 }
 if(pattern.type==='ArrayPattern'&&contract.type==='TSTupleType'){
  for(let index=0;index<pattern.elements.length;index++){
   let member=contract.elementTypes[index];if(!member)return null;
   if(member.optional||['TSRestType','TSOptionalType'].includes(member.type))return null;
   if(member.type==='TSNamedTupleMember')member=member.elementType;
   if(['TSRestType','TSOptionalType'].includes(member.type))return null;
   const result=patternType(pattern.elements[index],member,name,resolve,depth+1);if(result)return result;
  }
 }
 // Defaults and rest bindings need separate narrowing/shape analysis.
 return null;
}
function typeResolver(binding,source){
 const program=binding.path.findParent(path=>path.isProgram()),declarations=new Map(),counts=new Map();
 if(program){
  program.traverse({
   'TSTypeAliasDeclaration|TSInterfaceDeclaration'(path){const name=path.node.id.name;counts.set(name,(counts.get(name)||0)+1);},
   TSTypeParameter(path){const name=path.node.name;counts.set(name,(counts.get(name)||0)+1);},
  });
  for(const statement of program.node.body){const node=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;if(node&&['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(node.type))declarations.set(node.id.name,node);}
 }
 return function resolve(type,seen=new Set()){
  if(!type)return null;
  if(type.type==='TSParenthesizedType')return resolve(type.typeAnnotation,seen);
  if(type.type!=='TSTypeReference')return type;
  if(type.typeName.type!=='Identifier'||type.typeParameters||type.typeArguments)return null;
  const name=type.typeName.name,node=declarations.get(name);
  if(!node||counts.get(name)!==1||node.typeParameters||seen.has(name)||seen.size>=20)return null;
  const next=new Set(seen);next.add(name);
  if(node.type==='TSTypeAliasDeclaration')return resolve(node.typeAnnotation,next);
  if(!node.extends?.length)return {type:'TSTypeLiteral',members:node.body.body,start:node.body.start,end:node.body.end};
  const members=[];
  for(const base of node.extends||[]){
    const resolved=resolve({type:'TSTypeReference',typeName:base.expression,typeParameters:base.typeParameters,typeArguments:base.typeArguments},next);
    if(resolved?.type!=='TSTypeLiteral')return null;
    members.push(...resolved.members);
  }
  members.push(...node.body.body);
  const keys=new Set();
  for(const member of members){
    if(!['TSPropertySignature','TSMethodSignature'].includes(member.type)||member.computed)return null;
    const key=String(member.key.name??member.key.value);if(keys.has(key))return null;keys.add(key);
  }
  return {type:'TSTypeLiteral',members,start:node.body.start,end:node.body.end,captureText:'{ '+members.map(member=>source.slice(member.start,member.end)).join('; ')+' }'};
 };
}
module.exports=function captureType(binding,source){
 const pattern=binding.path.node.type==='VariableDeclarator'?binding.path.node.id:binding.path.node;
 const resolve=typeResolver(binding,source),type=resolve(binding.identifier.typeAnnotation?.typeAnnotation||patternType(pattern,pattern.typeAnnotation?.typeAnnotation,binding.identifier.name,resolve));
 if(binding.identifier.optional||!type||!closed(type))return null;
 return '('+(type.captureText||source.slice(type.start,type.end))+')';
};
