'use strict';
const MagicString=require('magic-string'),path=require('node:path');
const {contentHash,collectElements}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function inspect(resolved,name,definition){
 if(resolved.element.kind!=='instance'||typeof name!=='string'||!/^[$A-Z_a-z][$\w]*$/.test(name)||['key','ref','children','__proto__','__self','__source'].includes(name)||name.startsWith('data-rt'))return null;
 const def=definition||require('./components.cjs').definition(resolved);let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;if(param?.type!=='ObjectPattern')return null;
 const fields=param.properties.filter(p=>p.type==='ObjectProperty'&&!p.computed&&(p.key.name??p.key.value)===name);if(fields.length!==1||fields[0].value.type!=='AssignmentPattern')return null;
 const node=fields[0].value.right,value=require('./component-props.cjs').literal({value:node});if(!value)return null;
 const choice=require('./component-prop-choices.cjs').property(resolved,name,def);if(choice&&choice.type!==value.type)return null;
 // A declared but unsupported type must not be weakened by editing its default.
 if(param.typeAnnotation&&!choice)return null;
 const revision=contentHash(JSON.stringify([def.file,contentHash(def.source),choice?.revision||null]));
 return {def,node,choice,editor:{...value,choices:choice?.choices,revision}};
}
function describe(resolved,name,definition){try{return inspect(resolved,name,definition)?.editor||null;}catch{return null;}}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before editing its default.');
 try{
  const dependencies=new Map([[resolved.file,resolved.source]]),checks=new Map();let invalid=null;
  const audit={path(file){try{const check=require('./source-path-checks.cjs').snapshot(resolved.appRoot,file),old=checks.get(file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component resolution changed.');checks.set(file,check);if(checks.size>1000)throw Error('Too many component dependencies.');}catch(error){invalid=error;throw error;}},read(file,source){const real=checks.get(file)?.realPath||file,old=dependencies.get(real);if(old!==undefined&&old!==source){invalid=Error('A component dependency changed.');throw invalid;}dependencies.set(real,source);}};
  const def=require('./components.cjs').definition(resolved,audit);if(invalid)throw invalid;
  const state=inspect(resolved,op.name,def);if(!state)return refuse('This property has no editable literal default.');
  if(op.revision!==state.editor.revision)return refuse('The shared default or its type changed. Re-select the component.');
  const {type,choices}=state.editor;if(typeof op.value!==type||type==='number'&&!Number.isFinite(op.value)||type==='string'&&op.value.length>100000||choices&&!choices.includes(op.value))return refuse('Choose a valid '+type+' default'+(choices?' from its declared choices.':'.'));
  for(const dependency of state.choice?.dependencies||[]){const old=dependencies.get(dependency.file);if(old!==undefined&&old!==dependency.source)throw Error('A component dependency changed.');dependencies.set(dependency.file,dependency.source);}
  for(const check of state.choice?.pathChecks||[]){const old=checks.get(check.file);if(old&&JSON.stringify(old)!==JSON.stringify(check))throw Error('Component type resolution changed.');checks.set(check.file,check);}
  dependencies.set(def.file,def.source);
  const code=JSON.stringify(op.value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'),next=op.value===state.editor.value?def.source:new MagicString(def.source).overwrite(state.node.start,state.node.end,code).toString();
  const rel=path.relative(resolved.appRoot,def.file).split(path.sep).join('/'),roots=require('./component-return-roots.cjs')(def.fn),root=collectElements(def.source,rel).elements.find(element=>element.kind==='host'&&roots.some(node=>element.node.start>=node.start&&element.node.end<=node.end));
  if(!root)return refuse('This component has no source layer to refresh after changing its default.');
  return {ok:true,hash:contentHash(def.file===resolved.file?next:resolved.source),componentDefault:{instanceId:resolved.element.id,definitionId:root.id},edits:[...dependencies].map(([file,before])=>({file,before,after:file===def.file?next:before})),pathChecks:[...checks.values()]};
 }catch(error){return refuse('Could not edit the shared default: '+error.message);}
}
module.exports={describe,plan};
