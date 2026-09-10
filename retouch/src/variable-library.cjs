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
 if(!operation||typeof operation!=='object'||Array.isArray(operation)||operation.type!=='replace'||Object.keys(operation).some(key=>!['type','revision','library'].includes(key)))fail('Invalid variable library operation.',422);
 const {file}=paths(root),source=readSource(root),current=decode(source);
 if(operation.revision!==revision(source))fail('Variable collections changed. Reload before saving.');
 const library=model.validate(operation.library);model.resolver(library).resolveAll();
 if(JSON.stringify(library)===JSON.stringify(current))return {ok:true,edits:[],result:{...current,revision:revision(source)}};
 const after=JSON.stringify(library,null,2)+'\n';if(Buffer.byteLength(after)>LIMIT)fail('Variable library exceeds 2 MiB.',413);
 return {ok:true,edits:[{file,before:source,after}],result:{...library,revision:revision(after)}};
}
function commitPlan(root,plan,apply=applyPlan){
 if(!plan?.ok)return plan;const {directory}=paths(root);fs.mkdirSync(directory,{recursive:true});paths(root);
 const result=apply(root,plan);if(!result.ok)fail(result.reason);return result;
}
function resolve(root,request){
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['revision','modes'].includes(key)))fail('Invalid variable mode preview.',422);
 const current=read(root);if(request.revision!==current.revision)fail('Variable collections changed. Reload before previewing modes.');
 const values=model.resolver({version:current.version,collections:current.collections,variables:current.variables},request.modes).resolveAll();return {revision:current.revision,values};
}
module.exports={LIMIT,read,planChange,commitPlan,resolve};
