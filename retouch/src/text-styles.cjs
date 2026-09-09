'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {applyPlan}=require('./transactions.cjs');
const {valid}=require('../shell/html-css-values.js');
const properties=['font-family','font-size','font-weight','font-style','font-optical-sizing','font-variation-settings','font-variant-numeric','line-height','letter-spacing','text-align','text-decoration-line','text-transform'];
const LIMIT=512*1024,MAX_STYLES=100;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function fail(reason,statusCode=422){throw Object.assign(new Error(reason),{statusCode});}
function name(value){if(typeof value!=='string')fail('Give the text style a name.');const normalized=value.trim().replace(/\s+/g,' ');if(!normalized||normalized.length>80||/[\u0000-\u001f\u007f]/.test(normalized))fail('Use a text style name between 1 and 80 characters.');return normalized;}
function values(input){
 if(!object(input)||!Object.keys(input).length||Object.keys(input).some(key=>!properties.includes(key)))fail('Text styles must contain supported typography properties.');
 const result={};for(const property of properties)if(Object.hasOwn(input,property)){if(typeof input[property]!=='string'||!valid(property,input[property]))fail('Unsupported text style value for '+property+'.');result[property]=input[property];}return result;
}
function validate(input){
 if(!object(input)||input.version!==1||Object.keys(input).some(key=>!['version','styles'].includes(key))||!Array.isArray(input.styles)||input.styles.length>MAX_STYLES)fail('Invalid text style library.');
 const ids=new Set(),names=new Set(),styles=input.styles.map(style=>{
  if(!object(style)||Object.keys(style).some(key=>!['id','name','properties'].includes(key))||typeof style.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(style.id)||ids.has(style.id))fail('Invalid or duplicate text style ID.');
  const label=name(style.name),key=label.toLowerCase();if(names.has(key))fail('Text style names must be unique.');ids.add(style.id);names.add(key);return {id:style.id,name:label,properties:values(style.properties)};
 });return {version:1,styles};
}
function paths(root){
 const actual=fs.realpathSync(root),directory=path.join(actual,'.retouch'),file=path.join(directory,'text-styles.json');
 for(const [entry,isDirectory]of [[directory,true],[file,false]]){let stat;try{stat=fs.lstatSync(entry);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(stat.isSymbolicLink()||(isDirectory?!stat.isDirectory():!stat.isFile()))fail('The text style library must use regular project files.',409);if(!isDirectory&&stat.size>LIMIT)fail('The text style library is too large.',413);}
 return {directory,file};
}
const revision=source=>source===null?null:crypto.createHash('sha256').update(source).digest('hex');
function read(root){
 const {file}=paths(root);let source;try{source=fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')return {version:1,styles:[],revision:null};throw error;}
 let parsed;try{parsed=JSON.parse(source);}catch{fail('The text style library is not valid JSON.',409);}return {...validate(parsed),revision:revision(source)};
}
function planChange(root,operation){
 if(!object(operation)||!['create','update','delete'].includes(operation.type)||Object.keys(operation).some(key=>!['type','revision','id','name','properties'].includes(key)))fail('Invalid text style operation.');
 const {directory,file}=paths(root),source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,current=read(root);
 if(operation.revision!==current.revision||revision(source)!==current.revision)fail('Text styles changed. Reload the library before saving.',409);
 const styles=current.styles.map(style=>({...style}));let id=operation.id;
 if(operation.type==='create'){if(id!==undefined)fail('New style IDs are assigned by the library.');if(styles.length>=MAX_STYLES)fail('The library supports up to 100 text styles.');id=crypto.randomUUID();styles.push({id,name:name(operation.name),properties:values(operation.properties)});}
 else{const index=styles.findIndex(style=>style.id===id);if(index<0)fail('That text style no longer exists.',409);if(operation.type==='delete')styles.splice(index,1);else styles[index]={id,name:name(operation.name),properties:values(operation.properties)};}
 const library=validate({version:1,styles}),after=JSON.stringify(library,null,2)+'\n';if(Buffer.byteLength(after)>LIMIT)fail('The text style library is too large.',413);
 return {ok:true,edits:source===after?[]:[{file,before:source,after}],result:{...library,revision:revision(after),id}};
}
function change(root,operation){
 const plan=planChange(root,operation),{directory}=paths(root);
 fs.mkdirSync(directory,{recursive:true});paths(root);
 const applied=applyPlan(root,plan);if(!applied.ok)fail(applied.reason,409);
 return plan.result;
}
module.exports={read,change,planChange,validate,properties,LIMIT};
