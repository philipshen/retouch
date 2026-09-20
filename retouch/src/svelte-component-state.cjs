'use strict';
const parser=require('@babel/parser'),MagicString=require('magic-string'),source=require('./svelte-source.cjs');
function metadata(text,file){
 const ast=source.collect(text,file).ast,names=[];
 for(const statement of ast.instance?.content.body||[])if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations){const call=declaration.init,callee=call?.callee;if(declaration.id.type==='Identifier'&&call?.type==='CallExpression'&&(callee?.type==='Identifier'&&callee.name==='$state'||callee?.type==='MemberExpression'&&callee.object.name==='$state'&&callee.property.name==='raw'))names.push(declaration.id.name);}
 return {shape:source.contentHash(source.textSnapshot(text,file).signature),revision:source.contentHash(text),script:source.contentHash(JSON.stringify([ast.instance,ast.module].map(node=>node?text.slice(node.start,node.end):null))),names};
}
// Own-module captures use the HMR-stable props object. Committed source-ID
// proofs additionally migrate surviving child scopes during parent remounts.
// Only exact editor-proved script transitions can retain state across script
// changes. Ordinary runtime mounts and external script edits initialize anew.
function createRegistry(){
 const files=new Map(),active=new Set();let updating=false,generation=0,ordinal=0;
 function componentState(file,script,revision,props,options={}){
  let instances=files.get(file);if(!instances)files.set(file,instances=new WeakMap());
  const parent=options.parent,id=props?.['data-rt-i'];
  const identity=props&&(typeof props==='object'||typeof props==='function')?props:options.anchor&&typeof options.anchor==='object'?options.anchor:{};
  let old=instances.get(identity),transferred=false;
  if(!old&&updating&&parent?.resume&&typeof id==='string'){
   const candidates=parent.resume.get(id),candidate=candidates?.shift();
   if(candidate?.file===file&&candidate.script===script){old=candidate;transferred=true;}
  }
  const provedScript=updating&&old&&(options.migrations||[]).some(edge=>edge.from===old.shape&&edge.to===options.shape&&edge.fromScript===old.script&&edge.toScript===script);
  const retain=old&&(old.script===script||provedScript)&&(transferred||old.revision!==revision);
  const record={file,script,revision,shape:options.shape,id,anchor:options.anchor,ordinal:++ordinal,values:new Map(),children:new Set(),resume:null,snapshot:null,lineage:transferred?[...(parent?.lineage||[])]:[]};
  if(retain&&updating&&old.snapshot?.generation===generation){
   const edge=(options.migrations||[]).find(edge=>edge.from===old.shape&&edge.to===options.shape);
   const sameShape=transferred&&old.shape===options.shape;
   if(edge||sameShape){
    const mapping=new Map(edge?.pairs||[]);if(edge)record.lineage.push({ids:new Set(edge.ids||edge.pairs.map(pair=>pair[0])),mapping});record.resume=new Map();
    for(const child of old.snapshot.children){const owner=sameShape&&record.lineage.find(edge=>edge.ids.has(child.id)),next=sameShape?(owner?owner.mapping.get(child.id):child.id):mapping.get(child.id);if(!next)continue;const list=record.resume.get(next)||[];list.push(child);record.resume.set(next,list);}
   }
  }
  instances.set(identity,record);active.add(record);parent?.children.add(record);
  return {scope:record,dispose(){active.delete(record);parent?.children.delete(record);},read(name,initialize){if(retain&&old.values.has(name)){const getter=old.values.get(name);old.values.delete(name);return options.readValue?options.readValue(getter):getter();}return initialize();},capture(name,getter){record.values.set(name,getter);}};
 }
 componentState.begin=()=>{
  updating=true;generation++;
  for(const record of active)record.snapshot={generation,children:[...record.children].sort((a,b)=>{const position=a.anchor?.compareDocumentPosition?.(b.anchor);return position&&!(position&1)?position&4?-1:position&2?1:a.ordinal-b.ordinal:a.ordinal-b.ordinal;})};
 };
 componentState.end=()=>{updating=false;for(const record of active){record.snapshot=null;record.resume=null;record.lineage=[];}};
 return componentState;
}
function transform(code,file,info){
 const ast=parser.parse(code,{sourceType:'module'}),ns=ast.program.body.find(n=>n.type==='ImportDeclaration'&&n.source.value==='svelte/internal/client')?.specifiers.find(n=>n.type==='ImportNamespaceSpecifier')?.local.name;if(!ns)return null;
 const functions=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&n.params[0]?.type==='Identifier'&&(!n.params[1]||n.params[1].type==='Identifier'));
 const target=functions.find(fn=>code.includes(fn.id.name+' = '+ns+'.hmr('+fn.id.name+')'));if(!target)return null;
 let binding='__retouch_component_state';while(code.includes(binding))binding+='_';const out=new MagicString(code),patched=[];
 for(const statement of target.body.body){if(statement.type!=='VariableDeclaration')continue;for(const declaration of statement.declarations){if(declaration.id.type!=='Identifier'||!info.names.includes(declaration.id.name))continue;let call=declaration.init;
  if(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name===ns&&call.callee.property.name==='tag')call=call.arguments[0];
  const signal=call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name===ns&&call.callee.property.name==='state';
  if(signal&&call.arguments.length>1||!declaration.init)continue;
  const initial=signal?call.arguments[0]:declaration.init,name=JSON.stringify(declaration.id.name),read=binding+'.read('+name+',()=>('+(initial?code.slice(initial.start,initial.end):'undefined')+'))';
  if(initial)out.overwrite(initial.start,initial.end,read);else out.appendLeft(call.end-1,read);
  out.appendLeft(statement.end,'\n'+binding+'.capture('+name+',()=>'+(signal?ns+'.get('+declaration.id.name+')':declaration.id.name)+');');patched.push(declaration.id.name);
 }}
 if(!patched.length&&info.names.length)return null;
 const props=target.params[1]?.name||binding+'_props';if(!target.params[1])out.appendLeft(target.params[0].end,','+props);
 const push=target.body.body.find(statement=>statement.type==='ExpressionStatement'&&statement.expression.type==='CallExpression'&&statement.expression.callee.type==='MemberExpression'&&statement.expression.callee.object.name===ns&&statement.expression.callee.property.name==='push');
 out.prepend('import {componentState as '+binding+'_create} from "virtual:retouch-svelte-source";\n');
 const initialize='\nconst '+binding+' = '+binding+'_create('+[file,info.script,info.revision].map(JSON.stringify).join(',')+','+props+','+target.params[0].name+','+JSON.stringify({shape:info.shape,migrations:info.migrations||[]})+');\n'+ns+'.render_effect(()=>'+binding+'.dispose);\n';
 if(push)out.appendLeft(push.end,initialize);
 else{out.appendLeft(target.body.start+1,'\n'+ns+'.push('+props+',true);try{'+initialize);out.appendLeft(target.body.end-1,'}finally{'+ns+'.pop();}');}
 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={metadata,transform,createRegistry};
