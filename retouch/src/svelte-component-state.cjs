'use strict';
const parser=require('@babel/parser'),MagicString=require('magic-string'),source=require('./svelte-source.cjs');
function metadata(text,file){
 const ast=source.collect(text,file).ast,names=[];
 for(const statement of ast.instance?.content.body||[])if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations){const call=declaration.init,callee=call?.callee;if(declaration.id.type==='Identifier'&&call?.type==='CallExpression'&&(callee?.type==='Identifier'&&callee.name==='$state'||callee?.type==='MemberExpression'&&callee.object.name==='$state'&&callee.property.name==='raw'))names.push(declaration.id.name);}
 return {revision:source.contentHash(text),script:source.contentHash(JSON.stringify([ast.instance,ast.module].map(node=>node?text.slice(node.start,node.end):null))),names};
}
// Per-instance captures are weakly keyed by Svelte's HMR-stable props object.
// Script edits and same-revision dependency reloads deliberately initialize anew.
function createRegistry(){
 const files=new Map();
 return function componentState(file,script,revision,props){
  let instances=files.get(file);if(!instances)files.set(file,instances=new WeakMap());
  const old=instances.get(props),retain=old&&old.script===script&&old.revision!==revision;
  const record={script,revision,values:new Map()};instances.set(props,record);
  return {read(name,initialize){if(retain&&old.values.has(name)){const getter=old.values.get(name);old.values.delete(name);return getter();}return initialize();},capture(name,getter){record.values.set(name,getter);}};
 };
}
function transform(code,file,info){
 if(!info.names.length)return null;
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
 if(!patched.length)return null;
 const props=target.params[1]?.name||binding+'_props';if(!target.params[1])out.appendLeft(target.params[0].end,','+props);
 out.prepend('import {componentState as '+binding+'_create} from "virtual:retouch-svelte-source";\n');out.appendLeft(target.body.start+1,'\nconst '+binding+' = '+binding+'_create('+[file,info.script,info.revision].map(JSON.stringify).join(',')+','+props+');\n');
 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={metadata,transform,createRegistry};
