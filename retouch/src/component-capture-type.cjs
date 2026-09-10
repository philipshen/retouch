'use strict';
// A copied structural type must not refer to bindings from the old function.
const allowed=new Set(['TSTypeAnnotation','TSTypeLiteral','TSPropertySignature','TSMethodSignature','TSFunctionType','TSArrayType','TSTupleType','TSNamedTupleMember','TSOptionalType','TSRestType','TSLiteralType','TSParenthesizedType',...'TSStringKeyword TSNumberKeyword TSBooleanKeyword TSBigIntKeyword TSSymbolKeyword TSAnyKeyword TSNeverKeyword TSVoidKeyword TSUndefinedKeyword TSNullKeyword'.split(' ')]);
function closed(node){
 if(!node||typeof node!=='object')return true;
 if(Array.isArray(node))return node.every(closed);
 if(node.type?.startsWith('TS')&&!allowed.has(node.type)||node.computed||node.optional)return false;
 return Object.entries(node).every(([key,value])=>['loc','leadingComments','trailingComments','innerComments','extra'].includes(key)||closed(value));
}
module.exports=function captureType(binding,source){
 let type=binding.identifier.typeAnnotation?.typeAnnotation,optional=!!binding.identifier.optional;
 if(!type&&binding.path.node.type==='ObjectPattern'){
  const pattern=binding.path.node,property=pattern.properties.find(p=>p.type==='ObjectProperty'&&!p.computed&&(p.value.type==='Identifier'?p.value.name:p.value.type==='AssignmentPattern'?p.value.left.name:null)===binding.identifier.name);
  const contract=pattern.typeAnnotation?.typeAnnotation;
  if(!property||contract?.type!=='TSTypeLiteral')return null;
  const name=property.key.name??property.key.value,member=contract.members.find(m=>m.type==='TSPropertySignature'&&!m.computed&&(m.key.name??m.key.value)===name);
  // Default initializers can narrow a union; leave that to a future type-aware path.
  if(property.value.type==='AssignmentPattern')return null;
  type=member?.typeAnnotation?.typeAnnotation;optional=!!member?.optional;
 }
 if(optional||!type||!closed(type))return null;
 return '('+source.slice(type.start,type.end)+')'+(optional?' | undefined':'');
};
