'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {applyPlan}=require('./transactions.cjs');
module.exports=function createStyleLibrary({filename,label,properties,valid,propertyLabel=label}){
const title=label[0].toUpperCase()+label.slice(1);
const LIMIT=512*1024,MAX_STYLES=100;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function fail(reason,statusCode=422){throw Object.assign(new Error(reason),{statusCode});}
function name(value){if(typeof value!=='string')fail(`Give the ${label} a name.`);const normalized=value.trim().replace(/\s+/g,' ');if(!normalized||normalized.length>80||/[\u0000-\u001f\u007f]/.test(normalized))fail(`Use a ${label} name between 1 and 80 characters.`);return normalized;}
function values(input){
 if(!object(input)||!Object.keys(input).length||Object.keys(input).some(key=>!properties.includes(key)))fail(`${title}s must contain supported ${propertyLabel} properties.`);
 const result={};for(const property of properties)if(Object.hasOwn(input,property)){if(typeof input[property]!=='string'||!valid(property,input[property]))fail(`Unsupported ${label} value for `+property+'.');result[property]=input[property];}return result;
}
function validate(input){
 if(!object(input)||input.version!==1||Object.keys(input).some(key=>!['version','styles'].includes(key))||!Array.isArray(input.styles)||input.styles.length>MAX_STYLES)fail(`Invalid ${label} library.`);
 const ids=new Set(),names=new Set(),styles=input.styles.map(style=>{
  if(!object(style)||Object.keys(style).some(key=>!['id','name','properties'].includes(key))||typeof style.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(style.id)||ids.has(style.id))fail(`Invalid or duplicate ${label} ID.`);
  const styleName=name(style.name),key=styleName.toLowerCase();if(names.has(key))fail(`${title} names must be unique.`);ids.add(style.id);names.add(key);return {id:style.id,name:styleName,properties:values(style.properties)};
 });return {version:1,styles};
}
function paths(root){
 const actual=fs.realpathSync(root),directory=path.join(actual,'.retouch'),file=path.join(directory,filename);
 for(const [entry,isDirectory]of [[directory,true],[file,false]]){let stat;try{stat=fs.lstatSync(entry);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(stat.isSymbolicLink()||(isDirectory?!stat.isDirectory():!stat.isFile()))fail(`The ${label} library must use regular project files.`,409);if(!isDirectory&&stat.size>LIMIT)fail(`The ${label} library is too large.`,413);}
 return {directory,file};
}
const revision=source=>source===null?null:crypto.createHash('sha256').update(source).digest('hex');
function read(root){
 const {file}=paths(root);let source;try{source=fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')return {version:1,styles:[],revision:null};throw error;}
 let parsed;try{parsed=JSON.parse(source);}catch{fail(`The ${label} library is not valid JSON.`,409);}return {...validate(parsed),revision:revision(source)};
}
function planChange(root,operation){
 if(!object(operation)||!['create','update','delete','import'].includes(operation.type)||Object.keys(operation).some(key=>!(operation.type==='import'?['type','revision','library']:['type','revision','id','name','properties']).includes(key)))fail(`Invalid ${label} operation.`);
 const {directory,file}=paths(root),source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,current=read(root);
 if(operation.revision!==current.revision||revision(source)!==current.revision)fail(`${title}s changed. Reload the library before saving.`,409);
 const styles=current.styles.map(style=>({...style}));let id=operation.id,added=0;
 if(operation.type==='import'){
  const incoming=validate(operation.library);
  for(const style of incoming.styles){
   const existing=styles.find(item=>item.id===style.id);
   if(existing){if(JSON.stringify(existing)!==JSON.stringify(style))fail('A different version of '+style.name+' already exists. No styles were imported.',409);continue;}
   if(styles.some(item=>item.name.toLowerCase()===style.name.toLowerCase()))fail('A style named '+style.name+' already exists with a different ID. Rename it before importing.',409);
   styles.push(style);added++;
  }
  if(!added)return {ok:true,edits:[],result:{...current,added:0}};
 }else if(operation.type==='create'){if(id!==undefined)fail('New style IDs are assigned by the library.');if(styles.length>=MAX_STYLES)fail(`The library supports up to 100 ${label}s.`);id=crypto.randomUUID();styles.push({id,name:name(operation.name),properties:values(operation.properties)});}
 else{const index=styles.findIndex(style=>style.id===id);if(index<0)fail(`That ${label} no longer exists.`,409);if(operation.type==='delete')styles.splice(index,1);else styles[index]={id,name:name(operation.name),properties:values(operation.properties)};}
 const library=validate({version:1,styles}),after=JSON.stringify(library,null,2)+'\n';if(Buffer.byteLength(after)>LIMIT)fail(`The ${label} library is too large.`,413);
 return {ok:true,edits:source===after?[]:[{file,before:source,after}],result:{...library,revision:revision(after),id,...(operation.type==='import'?{added}:{})}};
}
function commitPlan(root,plan,apply=applyPlan){
 if(!plan?.ok)return plan;const {directory}=paths(root);
 fs.mkdirSync(directory,{recursive:true});paths(root);
 const applied=apply(root,plan);if(!applied.ok)fail(applied.reason,409);
 return applied;
}
function change(root,operation){return commitPlan(root,planChange(root,operation)).result;}
return {read,change,planChange,commitPlan,validate,properties,LIMIT};
};
