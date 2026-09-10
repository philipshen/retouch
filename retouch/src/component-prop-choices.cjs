'use strict';
const {parseSource}=require('./id.cjs');
// Read finite primitive choices from module-local TypeScript contracts. Never
// execute source or guess a contract from values observed at other usages.
function inspect(resolved,name,definition){
 try{
  const def=definition||require('./components.cjs').definition(resolved),ast=parseSource(def.source);
  let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
  if(def.fn.typeParameters?.params?.length)return null;
  const declarations=new Map(),importedNames=new Set(ast.program.body.filter(n=>n.type==='ImportDeclaration').flatMap(n=>n.specifiers.map(s=>s.local.name)));
  for(let statement of ast.program.body){if(statement.type==='ExportNamedDeclaration')statement=statement.declaration;if(!statement)continue;if(['ClassDeclaration','TSEnumDeclaration','TSImportEqualsDeclaration','TSModuleDeclaration'].includes(statement.type)&&statement.id?.name)importedNames.add(statement.id.name);if(['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(statement.type)){const key=statement.id.name;if(declarations.has(key))return null;declarations.set(key,statement);}}
  function resolve(node,seen=new Set()){
   if(node?.type==='TSParenthesizedType')return resolve(node.typeAnnotation,seen);
   if(node?.type!=='TSTypeReference')return node;
   if(node.typeName.type!=='Identifier'||node.typeParameters||seen.has(node.typeName.name)||seen.size>=20)return null;
   const declaration=declarations.get(node.typeName.name);if(!declaration||declaration.typeParameters||declaration.extends?.length)return null;
   const next=new Set(seen);next.add(node.typeName.name);return resolve(declaration.type==='TSTypeAliasDeclaration'?declaration.typeAnnotation:declaration.body,next);
  }
  let keyVisits=0;
  function literalKeys(node,seen=new Set()){
   node=resolve(node);if(!node||++keyVisits>1000||seen.has(node)||seen.size>=20)return null;
   const next=new Set(seen);next.add(node);
   if(node.type==='TSLiteralType'&&node.literal.type==='StringLiteral')return [node.literal.value];
   if(node.type!=='TSUnionType')return null;
   const parts=node.types.map(type=>literalKeys(type,next));if(parts.some(part=>!part))return null;
   const keys=parts.flat();return keys.length<=100?keys:null;
  }
  let visits=0;
  function contractMembers(node,seen=new Set()){
   if(!node||++visits>1000||seen.size>=20)return null;
   if(node.type==='TSParenthesizedType')return contractMembers(node.typeAnnotation,seen);
   if(node.type==='TSTypeLiteral')return node.members;
   if(node.type==='TSIntersectionType'){
    const groups=node.types.map(type=>contractMembers(type,seen));return groups.every(Boolean)?groups.flat():null;
   }
   if(node.type==='TSTypeReference'&&node.typeName.type==='Identifier'){
    const utility=node.typeName.name,args=node.typeParameters?.params;
    if(!declarations.has(utility)&&!importedNames.has(utility)&&['Partial','Required','Readonly','Pick','Omit'].includes(utility)){
     if(!args||args.length!==(['Pick','Omit'].includes(utility)?2:1))return null;
     const base=contractMembers(args[0],seen);if(!base)return null;
     if(utility==='Readonly')return base;
     if(utility==='Partial'||utility==='Required')return base.map(field=>({...field,optional:utility==='Partial'}));
     const keys=literalKeys(args[1]);if(!keys)return null;
     const memberName=field=>!field.computed&&(field.key?.name??field.key?.value);
     if(utility==='Pick'&&keys.some(key=>!base.some(field=>memberName(field)===key)))return null;
     return base.filter(field=>utility==='Pick'?keys.includes(memberName(field)):!keys.includes(memberName(field)));
    }
   }
   if(node.type!=='TSTypeReference'||node.typeName.type!=='Identifier'||node.typeParameters||seen.has(node.typeName.name))return null;
   const declaration=declarations.get(node.typeName.name);if(!declaration||declaration.typeParameters)return null;
   const next=new Set(seen);next.add(node.typeName.name);
   if(declaration.type==='TSTypeAliasDeclaration')return contractMembers(declaration.typeAnnotation,next);
   const inherited=[];
   for(const base of declaration.extends||[]){
    if(base.expression.type!=='Identifier'||base.typeParameters)return null;
    const group=contractMembers({type:'TSTypeReference',typeName:base.expression},next);if(!group)return null;inherited.push(...group);
   }
   return [...inherited,...declaration.body.body];
  }
  const members=contractMembers(param?.typeAnnotation?.typeAnnotation);if(!members)return null;
  if(name===null)return {names:[...new Set(members.filter(p=>p.type==='TSPropertySignature'&&!p.computed).map(p=>p.key.name??p.key.value).filter(name=>typeof name==='string'))]};
  // Diamond inheritance can reach the same declaration more than once. Distinct
  // declarations of one property still need type-level conflict/narrowing checks.
  const fields=[...new Set(members)].filter(p=>p.type==='TSPropertySignature'&&!p.computed&&(p.key.name??p.key.value)===name);if(fields.length!==1)return null;
  const values=[];let choiceVisits=0;
  function expand(node,seen=new Set()){
   node=resolve(node);if(!node||++choiceVisits>1000||seen.size>=20||seen.has(node))return false;
   const next=new Set(seen);next.add(node);
   if(node.type==='TSUnionType')return node.types.every(type=>expand(type,next));
   if(node.type!=='TSLiteralType')return false;
   const value=node.literal;
   if(value.type==='UnaryExpression'&&value.operator==='-'&&value.argument.type==='NumericLiteral')values.push(-value.argument.value);
   else if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(value.type))values.push(value.value);else return false;
   return values.length<=100;
  }
  if(!expand(fields[0].typeAnnotation?.typeAnnotation))return null;
  if(!values.length||values.length>100||!values.every(v=>typeof v===typeof values[0]&&(typeof v!=='number'||Number.isFinite(v))))return null;
  return {choices:[...new Set(values)],type:typeof values[0],optional:!!fields[0].optional,definition:def};
 }catch{return null;}
}
module.exports={choices:(resolved,name,definition)=>inspect(resolved,name,definition),names:(resolved,definition)=>inspect(resolved,null,definition)?.names||[]};
