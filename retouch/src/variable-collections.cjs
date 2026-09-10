'use strict';
// Source format and resolver for linked collections. Rendering/binding adapters
// consume resolved typed values; names never become CSS identifiers.
const palette=require('../shell/palette-values.js');
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw Object.assign(Error(message),{statusCode:422});};
function shape(value,keys){if(!object(value)||Object.keys(value).some(key=>!keys.includes(key)))fail('Invalid variable collection structure.');}
function identifier(value){if(typeof value!=='string'||!UUID.test(value))fail('Invalid variable identity.');return value;}
function name(value){if(typeof value!=='string')fail('A variable or mode needs a name.');const result=value.trim().replace(/\s+/g,' ');if(!result||result.length>120||/[\u0000-\u001f\u007f]/.test(result))fail('Use a name between 1 and 120 characters.');return result;}
function unique(set,value,label){if(set.has(value))fail('Duplicate '+label+'.');set.add(value);}
function literal(type,value){
 if(type==='color'){if(typeof value!=='string'||!palette.valid(value))fail('Use an explicit sRGB or Display P3 color.');return palette.parse(value).value;}
 if(type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000000)fail('Use a finite variable number between -1000000 and 1000000.');return value;}
 if(type==='boolean'){if(typeof value!=='boolean')fail('Use a boolean variable value.');return value;}
 if(type==='string'){if(typeof value!=='string'||value.length>4096||value.includes('\0'))fail('Use a string variable value up to 4096 characters.');return value;}
 fail('Unsupported variable type.');
}
function validate(input){
 shape(input,['version','collections','variables']);if(input.version!==1||!Array.isArray(input.collections)||input.collections.length>32||!Array.isArray(input.variables)||input.variables.length>1000)fail('Invalid variable library or size limit.');
 if(Buffer.byteLength(JSON.stringify(input))>2*1024*1024)fail('Variable library exceeds 2 MiB.');
 const ids=new Set(),collectionNames=new Set(),byCollection=new Map();
 const collections=input.collections.map(collection=>{
  shape(collection,['id','name','defaultMode','modes']);const id=identifier(collection.id),label=name(collection.name);unique(ids,id,'identity');unique(collectionNames,label.toLowerCase(),'collection name');
  if(!Array.isArray(collection.modes)||!collection.modes.length||collection.modes.length>16)fail('Each collection needs 1 to 16 modes.');
  const modeNames=new Set(),modes=collection.modes.map(mode=>{shape(mode,['id','name']);const modeId=identifier(mode.id),label=name(mode.name);unique(ids,modeId,'identity');unique(modeNames,label.toLowerCase(),'mode name');return {id:modeId,name:label};});
  const defaultMode=identifier(collection.defaultMode);if(!modes.some(mode=>mode.id===defaultMode))fail('The default mode must belong to its collection.');
  const result={id,name:label,defaultMode,modes};byCollection.set(id,result);return result;
 });
 const variableNames=new Map();
 const variables=input.variables.map(variable=>{
  shape(variable,['id','collectionId','name','type','values']);const id=identifier(variable.id),collectionId=identifier(variable.collectionId),collection=byCollection.get(collectionId),label=name(variable.name);
  unique(ids,id,'identity');if(!collection)fail('A variable refers to a missing collection.');
  let names=variableNames.get(collectionId);if(!names)variableNames.set(collectionId,names=new Set());unique(names,label.toLowerCase(),'variable name within a collection');
  if(!['color','number','boolean','string'].includes(variable.type))fail('Unsupported variable type.');
  shape(variable.values,collection.modes.map(mode=>mode.id));if(Object.keys(variable.values).length!==collection.modes.length)fail('Every variable needs a value for every collection mode.');
  const values={};for(const mode of collection.modes){const value=variable.values[mode.id];if(object(value)){shape(value,['alias']);values[mode.id]={alias:identifier(value.alias)};}else values[mode.id]=literal(variable.type,value);}
  return {id,collectionId,name:label,type:variable.type,values};
 });
 const byId=new Map(variables.map(variable=>[variable.id,variable]));
 for(const variable of variables)for(const value of Object.values(variable.values))if(object(value)){const target=byId.get(value.alias);if(!target)fail('An alias refers to a missing variable.');if(target.type!==variable.type)fail('Variable aliases must reference the same type.');}
 return {version:1,collections,variables};
}
function resolver(input,modes={}){
 const library=validate(input),collections=new Map(library.collections.map(collection=>[collection.id,collection])),variables=new Map(library.variables.map(variable=>[variable.id,variable]));
 shape(modes,[...collections.keys()]);const selected=new Map();for(const collection of collections.values()){const id=Object.hasOwn(modes,collection.id)?modes[collection.id]:collection.defaultMode;if(!collection.modes.some(mode=>mode.id===id))fail('The selected mode does not belong to its collection.');selected.set(collection.id,id);}
 function resolve(id){
  if(!variables.has(id))fail('Unknown variable.');const initial=variables.get(id),path=[],seen=new Set();let current=initial;
  while(current){
   if(seen.has(current.id))fail('Variable alias cycle: '+[...path.map(item=>variables.get(item.variableId).name),current.name].join(' → '));seen.add(current.id);
   const modeId=selected.get(current.collectionId);path.push({variableId:current.id,collectionId:current.collectionId,modeId});const value=current.values[modeId];
   if(!object(value))return {id:initial.id,type:initial.type,value,path};current=variables.get(value.alias);
  }
 }
 return {library,resolve,resolveAll:()=>library.variables.map(variable=>resolve(variable.id))};
}
function cssName(id){return '--rt-v-'+identifier(id);}
module.exports={validate,resolver,cssName};
