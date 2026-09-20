'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),model=require('./variable-collections.cjs'),{applyPlan}=require('./transactions.cjs');
const LIMIT=2*1024*1024,empty=()=>({version:1,collections:[],variables:[]});
const fail=(message,statusCode=409)=>{throw Object.assign(Error(message),{statusCode});};
const revision=source=>source===null?null:crypto.createHash('sha256').update(source).digest('hex');
function paths(root){
 const actual=fs.realpathSync(root),directory=path.join(actual,'.retouch'),file=path.join(directory,'variables.json');
 for(const [entry,isDirectory]of [[directory,true],[file,false]]){let stat;try{stat=fs.lstatSync(entry);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(stat&&(stat.isSymbolicLink()||(isDirectory?!stat.isDirectory():!stat.isFile())))fail('Variable collections must use regular project files.');if(stat&&!isDirectory&&stat.size>LIMIT)fail('Variable library exceeds 2 MiB.',413);}
 return {directory,file};
}
function readSource(root){const {file}=paths(root);try{return fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function decode(source){if(source===null)return empty();let data;try{data=JSON.parse(source);}catch{fail('Variable library is not valid JSON.');}return model.validate(data);}
function read(root){const source=readSource(root);return {...decode(source),revision:revision(source)};}
function planChange(root,operation){
 if(!operation||typeof operation!=='object'||Array.isArray(operation)||!['replace','import'].includes(operation.type)||Object.keys(operation).some(key=>!['type','revision','library'].includes(key)))fail('Invalid variable library operation.',422);
 const {file}=paths(root),source=readSource(root),current=decode(source);
 if(operation.revision!==revision(source))fail('Variable collections changed. Reload before saving.');
 let library=model.validate(operation.library);
 if(operation.type==='import'){
  const merged={version:1,collections:[...current.collections],variables:[...current.variables]};
  for(const key of ['collections','variables'])for(const entry of library[key]){const existing=current[key].find(item=>item.id===entry.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(entry))fail('An imported '+(key==='collections'?'collection':'variable')+' conflicts with an existing identity. Existing definitions were preserved.');}else merged[key].push(entry);}
  library=model.validate(merged);
 }
 model.resolver(library).resolveAll();
 // Check each named mode with other collections at their defaults. Combined
 // cross-collection mode choices are also validated when previewed or applied.
 for(const collection of library.collections)for(const mode of collection.modes)if(mode.id!==collection.defaultMode)model.resolver(library,{[collection.id]:mode.id}).resolveAll();
 if(JSON.stringify(library)===JSON.stringify(current))return {ok:true,edits:[],result:{...current,revision:revision(source)}};
 const after=JSON.stringify(library,null,2)+'\n';if(Buffer.byteLength(after)>LIMIT)fail('Variable library exceeds 2 MiB.',413);
 return {ok:true,edits:[{file,before:source,after}],result:{...library,revision:revision(after)}};
}
function commitPlan(root,plan,apply=applyPlan){
 if(!plan?.ok)return plan;const {directory}=paths(root);fs.mkdirSync(directory,{recursive:true});paths(root);
 const result=apply(root,plan);if(!result.ok)fail(result.reason);return result;
}
function resolve(root,request){
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['revision','modes','variableId','variableIds','overrides','bindings','expression'].includes(key)))fail('Invalid variable mode preview.',422);
 const current=read(root);if(request.revision!==current.revision)fail('Variable collections changed. Reload before previewing modes.');
 const definition={version:current.version,collections:current.collections,variables:current.variables};
 if(Object.hasOwn(request,'expression')){
  if(['bindings','variableId','variableIds'].some(key=>Object.hasOwn(request,key)))fail('Expression previews cannot also request bindings or variable lists.',422);
  try{const resolver=model.resolver(definition,request.modes,request.overrides),result=require('../shell/prototype-expressions.js').evaluate(request.expression,id=>resolver.resolve(id));return {revision:current.revision,result};}catch(error){fail(error.message,422);}
 }
 if(request.bindings!==undefined){
  if(['modes','variableId','variableIds'].some(key=>Object.hasOwn(request,key)))fail('Binding previews use each binding’s own modes.',422);
  try{return {revision:current.revision,bindings:require('./variable-bindings.cjs').project(definition,request.bindings,request.overrides)};}catch(error){fail(error.message,422);}
 }
 const resolver=model.resolver(definition,request.modes,request.overrides);
 if(request.variableId!==undefined)model.cssName(request.variableId);
 if(request.variableIds!==undefined){
  if(request.variableId!==undefined||!Array.isArray(request.variableIds)||request.variableIds.length<1||request.variableIds.length>100||new Set(request.variableIds).size!==request.variableIds.length)fail('Preview between 1 and 100 distinct variables.',422);
  for(const id of request.variableIds)model.cssName(id);
  const values=[],errors=[];for(const id of request.variableIds){try{values.push(resolver.resolve(id));}catch(error){errors.push({id,reason:error.message});}}
  return {revision:current.revision,values,errors};
 }
 const values=request.variableId===undefined?resolver.resolveAll():[resolver.resolve(request.variableId)];return {revision:current.revision,values};
}
module.exports={LIMIT,read,planChange,commitPlan,resolve};
