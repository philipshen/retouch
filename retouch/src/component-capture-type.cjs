'use strict';
// A copied structural type must not refer to bindings from the old function.
const allowed=new Set(['TSTypeAnnotation','TSTypeLiteral','TSPropertySignature','TSMethodSignature','TSFunctionType','TSArrayType','TSTupleType','TSNamedTupleMember','TSOptionalType','TSRestType','TSLiteralType','TSParenthesizedType',...'TSStringKeyword TSNumberKeyword TSBooleanKeyword TSBigIntKeyword TSSymbolKeyword TSAnyKeyword TSNeverKeyword TSVoidKeyword TSUndefinedKeyword TSNullKeyword'.split(' ')]);
function closed(node){
 if(!node||typeof node!=='object')return true;
 if(Array.isArray(node))return node.every(closed);
 if(node.type?.startsWith('TS')&&!allowed.has(node.type)||node.computed||node.optional)return false;
 return Object.entries(node).every(([key,value])=>['loc','leadingComments','trailingComments','innerComments','extra'].includes(key)||closed(value));
}
function patternType(pattern,contract,name,depth=0){
 if(!pattern||!contract||depth>20||pattern.optional)return null;
 while(contract.type==='TSParenthesizedType')contract=contract.typeAnnotation;
 if(pattern.type==='Identifier')return pattern.name===name?contract:null;
 if(pattern.type==='ObjectPattern'&&contract.type==='TSTypeLiteral'){
  for(const property of pattern.properties){
   if(property.type!=='ObjectProperty'||property.computed)continue;
   const key=property.key.name??property.key.value,members=contract.members.filter(member=>member.type==='TSPropertySignature'&&!member.computed&&(member.key.name??member.key.value)===key);
   if(members.length!==1||members[0].optional)continue;
   const result=patternType(property.value,members[0].typeAnnotation?.typeAnnotation,name,depth+1);if(result)return result;
  }
 }
 if(pattern.type==='ArrayPattern'&&contract.type==='TSTupleType'){
  for(let index=0;index<pattern.elements.length;index++){
   let member=contract.elementTypes[index];if(!member)return null;
   if(member.optional||['TSRestType','TSOptionalType'].includes(member.type))return null;
   if(member.type==='TSNamedTupleMember')member=member.elementType;
   if(['TSRestType','TSOptionalType'].includes(member.type))return null;
   const result=patternType(pattern.elements[index],member,name,depth+1);if(result)return result;
  }
 }
 // Defaults and rest bindings need separate narrowing/shape analysis.
 return null;
}
module.exports=function captureType(binding,source){
 const pattern=binding.path.node.type==='VariableDeclarator'?binding.path.node.id:binding.path.node;
 const type=binding.identifier.typeAnnotation?.typeAnnotation||patternType(pattern,pattern.typeAnnotation?.typeAnnotation,binding.identifier.name);
 if(binding.identifier.optional||!type||!closed(type))return null;
 return '('+source.slice(type.start,type.end)+')';
};
