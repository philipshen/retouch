'use strict';
const {collectElements,contentHash}=require('./id.cjs');
// Discover module-level JSX functions from source; do not instantiate components.
function definitions(source,relPath,parsed){
 const {ast,elements}=parsed||collectElements(source,relPath),bindings=new Map(),exports=new Map();
 const expose=(local,name)=>{const names=exports.get(local)||[];names.push(name);exports.set(local,names);};
 function add(node,statement){
  if(node?.type==='FunctionDeclaration'&&node.id)bindings.set(node.id.name,{fn:node,statement});
  if(node?.type==='VariableDeclaration')for(const item of node.declarations)if(item.id.type==='Identifier'&&['ArrowFunctionExpression','FunctionExpression'].includes(item.init?.type))bindings.set(item.id.name,{fn:item.init,statement,declaration:item});
 }
 for(const statement of ast.program.body){
  const node=['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(statement.type)?statement.declaration:statement;add(node,statement);
  if(statement.type==='ExportNamedDeclaration'){
   if(node?.id)expose(node.id.name,node.id.name);
   if(node?.type==='VariableDeclaration')for(const item of node.declarations)if(item.id.type==='Identifier')expose(item.id.name,item.id.name);
   if(!statement.source)for(const spec of statement.specifiers)if(spec.type==='ExportSpecifier')expose(spec.local.name,spec.exported.name??spec.exported.value);
  }
  if(statement.type==='ExportDefaultDeclaration'){
   if(node.type==='Identifier')expose(node.name,'default');
   else if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)){const name=node.id?.name||'Default component';if(!bindings.has(name))bindings.set(name,{fn:node,statement});expose(name,'default');}
  }
 }

 const result=[];
 for(const [name,binding] of bindings){
  const names=exports.get(name)||[],explicit=[...(binding.fn.leadingComments||[]),...(binding.statement.leadingComments||[])].some(comment=>comment.value.trim()==='* @retouch-component');
  if(!explicit&&!names.some(exportName=>exportName==='default'||/^[A-Z]/.test(exportName)))continue;
  const returns=require('./component-return-roots.cjs')(binding.fn),host=elements.find(element=>element.kind==='host'&&returns.some(node=>element.node.start>=node.start&&element.node.end<=node.end));if(!host)continue;
  result.push({name,names:[...new Set([name,...names.filter(name=>name!=='default')])],exports:names,definitionId:host.id,file:relPath,fn:binding.fn,source,explicitComponent:explicit});
 }
 return result;
}
function describe(resolved){
 const definition=definitions(resolved.source,resolved.relPath).find(item=>item.definitionId===resolved.element.id);if(!definition)return {ok:false,reason:'This source id is not a discoverable component definition.'};
 const def={...definition,file:resolved.file},props=new Map();let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
 if(param?.type==='ObjectPattern')for(const field of param.properties){if(field.type!=='ObjectProperty'||field.computed)continue;const name=field.key.name??field.key.value;if(typeof name!=='string')continue;props.set(name,{name,value:'Unknown type',default:field.value.type==='AssignmentPattern'?def.source.slice(field.value.right.start,field.value.right.end):'—'});}
 const types=require('./component-prop-choices.cjs');for(const name of types.names(resolved,def))if(!props.has(name))props.set(name,{name,value:'Unknown type',default:'—'});
 for(const prop of props.values()){const type=types.property(resolved,prop.name,def);if(type)prop.value=(type.choices?type.choices.map(value=>JSON.stringify(value)).join(' | '):type.type)+(type.optional?' (optional)':' (required)');}
 let insertion;try{const schema=require('./component-insertion-props.cjs')(resolved,def);insertion={ok:true,properties:schema.properties,revision:schema.revision};}catch(error){insertion={ok:false,reason:error.message};}
 return {ok:true,definitionOnly:true,insertion,name:def.name,file:resolved.relPath,hash:contentHash(resolved.source),source:resolved.source.slice(def.fn.start,def.fn.end),props:[...props.values()],definitionId:def.definitionId};
}
module.exports={definitions,describe};
