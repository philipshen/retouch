'use strict';
// A copied structural type must not refer to bindings from the old function.
const allowed=new Set(['TSTypeAnnotation','TSTypeLiteral','TSPropertySignature','TSMethodSignature','TSFunctionType','TSArrayType','TSTupleType','TSNamedTupleMember','TSOptionalType','TSRestType','TSLiteralType','TSParenthesizedType','TSTypeOperator',...'TSStringKeyword TSNumberKeyword TSBooleanKeyword TSBigIntKeyword TSSymbolKeyword TSAnyKeyword TSNeverKeyword TSVoidKeyword TSUndefinedKeyword TSNullKeyword'.split(' ')]);
function renderType(node,source,resolve,budget={left:2000},depth=0){
 if(!node||depth>20||--budget.left<0)return null;
 if(node.captureText){
  const members=node.members.map(member=>renderType(member,source,resolve,budget,depth+1));
  return members.some(member=>member===null)?null:'{ '+members.join('; ')+' }';
 }
 const edits=node.methodFunction?[{start:node.typeAnnotation.start-node.start,end:node.typeAnnotation.typeAnnotation.start-node.start,text:'=>'}]:[];let valid=true;
 function inspect(value){
  if(!valid||!value||typeof value!=='object')return;
  if(--budget.left<0){valid=false;return;}
  if(Array.isArray(value)){value.forEach(inspect);return;}
  if(value.type==='TSTypeReference'){
   const resolved=resolve(value),text=resolved&&renderType(resolved,source,resolve,budget,depth+1);
   if(text===null||text===undefined){valid=false;return;}
   edits.push({start:value.start-node.start,end:value.end-node.start,text:'('+text+')'});return;
  }
  if(value.type==='TSTypeOperator'&&(value.operator!=='readonly'||!['TSArrayType','TSTupleType'].includes(value.typeAnnotation.type))){valid=false;return;}
  if(value.type?.startsWith('TS')&&!allowed.has(value.type)||value.computed||value.optional&&!['TSPropertySignature','TSMethodSignature','Identifier','TSNamedTupleMember'].includes(value.type)){valid=false;return;}
  for(const [key,child]of Object.entries(value))if(!['loc','leadingComments','trailingComments','innerComments','extra'].includes(key))inspect(child);
 }
 inspect(node);if(!valid)return null;
 let text=source.slice(node.start,node.end);
 for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
 return text;
}
function patternType(pattern,contract,name,resolve,depth=0){
 if(!pattern||!contract||depth>20||pattern.optional)return null;
 contract=resolve(contract);if(!contract)return null;
 if(pattern.type==='Identifier')return pattern.name===name?contract:null;
 if(pattern.type==='ArrayPattern'&&contract.type==='TSTypeOperator'&&contract.operator==='readonly')contract=resolve(contract.typeAnnotation);
 if(pattern.type==='ObjectPattern'&&contract.type==='TSTypeLiteral'){
  for(const property of pattern.properties){
   if(property.type!=='ObjectProperty'||property.computed)continue;
   const key=property.key.name??property.key.value,members=contract.members.filter(member=>['TSPropertySignature','TSMethodSignature'].includes(member.type)&&!member.computed&&(member.key.name??member.key.value)===key);
   if(members.length!==1||members[0].optional)continue;
   const member=members[0];let type=member.typeAnnotation?.typeAnnotation;
   if(member.type==='TSMethodSignature'){
    if(!type||member.kind&&member.kind!=='method')continue;
    type={type:'TSFunctionType',methodFunction:true,parameters:member.parameters,typeParameters:member.typeParameters,typeAnnotation:member.typeAnnotation,start:member.key.end,end:type.end};
   }
   const result=patternType(property.value,type,name,resolve,depth+1);if(result)return result;
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
   'ClassDeclaration|ClassExpression|TSEnumDeclaration|TSModuleDeclaration|TSImportEqualsDeclaration'(path){const name=path.node.id?.name;if(name)counts.set(name,(counts.get(name)||0)+1);},
   'ImportSpecifier|ImportDefaultSpecifier|ImportNamespaceSpecifier'(path){const name=path.node.local.name;counts.set(name,(counts.get(name)||0)+1);},
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
 if(binding.identifier.optional||!type)return null;
 const text=renderType(type,source,resolve);return text===null?null:'('+text+')';
};
