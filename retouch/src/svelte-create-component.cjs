'use strict';
const fs=require('node:fs'),path=require('node:path'),MagicString=require('magic-string'),compiler=require('svelte/compiler'),source=require('./svelte-source.cjs'),css=require('./svelte-css.cjs');
function plan(r,op,adapter){try{
 if(op.fileHash!==r.hash)throw Error('The source changed. Re-select the layer.');
 if(r.element.kind!=='host')throw Error('Select a native layer to create a component.');
 if(typeof op.name!=='string'||!/^[A-Z][A-Za-z0-9_$]{0,79}$/.test(op.name))throw Error('Use a component name starting with a capital letter.');
 const root=fs.realpathSync(r.appRoot),file=fs.realpathSync(r.file),createdFile=path.join(path.dirname(file),op.name+'.svelte'),relative=path.relative(root,createdFile).split(path.sep).join('/');
 if(!file.startsWith(root+path.sep)||fs.lstatSync(createdFile,{throwIfNoEntry:false}))throw Error('Choose a new component filename inside this project.');
 const parsed=adapter.collect(r.source,r.relPath),selected=parsed.elements.find(e=>e.id===r.element.id),state=css.documentState(r.source,r.relPath);
 if(!selected||selected.scope.svg||selected.scope.slotted||parsed.ast.options)throw Error('This layer depends on a template namespace or component context.');
 const stripped=css.strip(r.source,r.relPath),clean=source.collect(stripped,r.relPath);if(clean.ast.css&&stripped.slice(clean.ast.css.content.start,clean.ast.css.content.end).trim())throw Error('This file has authored scoped CSS. Extract those selectors with the component before creating it.');
 function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['loc','metadata'].includes(key))continue;if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}}
 let collision=false;walk(parsed.ast,n=>{if(n.name===op.name)collision=true;});if(collision)throw Error('That name is already used in this file.');
 const captures=[],fragment=new MagicString(r.source.slice(selected.start,selected.end)),used=new Set();walk(selected.node,n=>{if(typeof n.name==='string')used.add(n.name);});
 function capture(expression,bindable=false){
  let unsafe=false;walk(expression,n=>{if(['AssignmentExpression','UpdateExpression','AwaitExpression','YieldExpression','CallExpression','NewExpression','ThisExpression','Super','MetaProperty'].includes(n.type))unsafe=true;});
  // A callback remains an expression at the original call site, retaining its
  // closure, mutations and event arguments. Other evaluated side effects stay put.
  if(unsafe&&!['ArrowFunctionExpression','FunctionExpression'].includes(expression.type))throw Error('Move side effects into a callback before creating this component.');
  const named=expression.type==='Identifier'&&/^[A-Za-z_][\w$]*$/.test(expression.name)&&!['children','__proto__'].includes(expression.name);
  let name=named?expression.name:'value'+(captures.length+1);
  const existing=expression.type==='Identifier'&&captures.find(c=>c.expression===expression.name);if(existing){if(bindable)existing.bindable=true;return existing.name;}
  if(!named)while(used.has(name))name+='Value';used.add(name);
  captures.push({name,expression:r.source.slice(expression.start,expression.end),bindable});return name;
 }
 function template(node){
  if(node.type==='Text'||node.type==='Comment')return;
  if(node.type==='ExpressionTag'){fragment.overwrite(node.expression.start-selected.start,node.expression.end-selected.start,capture(node.expression));return;}
  if(node.type!=='RegularElement'||['script','style','slot'].includes(node.name))throw Error('Extract native markup first; this subtree contains template control flow or component context.');
  for(const a of node.attributes){
   if(a.type==='BindDirective'&&((a.name==='value'&&['input','textarea','select'].includes(node.name))||(a.name==='checked'&&node.name==='input'))){
    if(a.modifiers?.length||!['Identifier','MemberExpression'].includes(a.expression?.type))throw Error('This form binding needs a directly assignable parent value.');
    const name=capture(a.expression,true);fragment.overwrite(a.start-selected.start,a.end-selected.start,'bind:'+a.name+'={'+name+'}');continue;
   }
   if(a.type!=='Attribute')throw Error('This subtree uses a binding, directive or spread that needs its original component context.');
   if(/^(?:data-rt(?:$|-revision)|__retouch)/.test(a.name))throw Error('This subtree contains reserved source markers.');
   if(a.value===true)continue;
   if(a.value?.type==='ExpressionTag')template(a.value);else for(const part of a.value||[])if(part.type==='ExpressionTag')template(part);
  }
  for(const child of node.fragment.nodes)template(child);
 }
 template(selected.node);
 const moved=parsed.elements.filter(e=>e.start>=selected.start&&e.end<=selected.end),owners=css.ownership(state),layers={},remaining={...state.model.layers};
 for(const e of moved){const id=e.attributes?.find(a=>a.name==='data-rt-style')?.value;if(!id)continue;if(owners.get(id)!==1)throw Error('A managed style identity has multiple owners.');if(remaining[id]){layers[id]=remaining[id];delete remaining[id];}}
 let moduleSource=(captures.length?'<script>let { '+captures.map(c=>c.name+(c.bindable?' = $bindable()':'')).join(', ')+' } = $props();</script>\n':'')+fragment.toString()+'\n';moduleSource=css.replaceModel(moduleSource,relative,{...state.model,layers});
 const replacement='<'+op.name+captures.map(c=>' '+(c.bindable?'bind:':'')+c.name+'={'+c.expression+'}').join('')+'/>',declaration='import '+op.name+' from '+JSON.stringify('./'+op.name+'.svelte')+';',out=new MagicString(r.source);
 out.overwrite(selected.start,selected.end,replacement);if(parsed.ast.instance)out.appendLeft(parsed.ast.instance.content.start,'\n'+declaration+'\n');else out.prepend('<script>'+declaration+'</script>\n');
 const after=css.replaceModel(out.toString(),r.relPath,{...state.model,layers:remaining});compiler.compile(moduleSource,{filename:relative,generate:false});compiler.compile(after,{filename:r.relPath,generate:false});
 const next=adapter.collect(after,r.relPath),definition=adapter.collect(moduleSource,relative).elements,instance=next.elements.find(e=>e.kind==='instance'&&e.tag===op.name);if(!instance||!definition.length)throw Error('The created component could not be mapped.');
 const beforeOutside=parsed.elements.filter(e=>!moved.includes(e)),afterOutside=next.elements.filter(e=>e!==instance);if(beforeOutside.length!==afterOutside.length||moved.length!==definition.length)throw Error('The extracted source identities could not be mapped.');
 const sourceIdMap=[[selected.id,instance.id]];for(let i=0;i<beforeOutside.length;i++){if(beforeOutside[i].kind!==afterOutside[i].kind||beforeOutside[i].tag!==afterOutside[i].tag)throw Error('An existing layer changed identity.');sourceIdMap.push([beforeOutside[i].id,afterOutside[i].id]);}for(let i=1;i<moved.length;i++){if(moved[i].tag!==definition[i].tag)throw Error('A moved layer changed identity.');sourceIdMap.push([moved[i].id,definition[i].id]);}
 return {ok:true,hash:source.contentHash(after),createdFile,createdHash:source.contentHash(moduleSource),createdComponent:{name:op.name,file:relative,props:captures.map(c=>({name:c.name,local:c.expression})),instanceId:instance.id,definitionId:definition[0].id,formSourceIdMap:sourceIdMap.map(([a,b])=>[a,a===selected.id?definition[0].id:b]),sourceIdMap,preserveScriptState:true},edits:[{file:createdFile,before:null,after:moduleSource},{file,before:r.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan};
