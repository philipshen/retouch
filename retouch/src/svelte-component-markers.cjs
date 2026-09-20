'use strict';
const parser=require('@babel/parser'),MagicString=require('magic-string'),source=require('./svelte-source.cjs');
const names=['data-rt-i','data-rt-i-revision'];
function metadata(text,relative){
 const parsed=source.collect(text,relative),roots=[],hosts=new Map(parsed.elements.map(element=>[element.node,element]));
 const safe=node=>!node.attributes.some(attribute=>attribute.type==='SpreadAttribute'||names.includes(attribute.name?.toLowerCase()));
 function walk(fragment){for(const node of fragment?.nodes||[]){
  if(node.type==='RegularElement'){const element=hosts.get(node);if(element&&safe(node))roots.push(element);continue;}
  if(['Component','SvelteComponent','SvelteElement','SnippetBlock','SvelteHead','SvelteBody','SvelteWindow','SvelteDocument'].includes(node.type))continue;
  for(const key of ['fragment','body','consequent','alternate','pending','then','catch','fallback'])if(node[key]?.type==='Fragment')walk(node[key]);
 }}walk(parsed.ast.fragment);
 let binding='__retouch_component_marker_'+source.contentHash(relative).slice(0,10);while(text.includes(binding))binding+='_';
 const legacyDefaults={};for(const statement of parsed.ast.instance?.content.body||[])if(statement.type==='ExportNamedDeclaration'&&statement.declaration?.kind==='let')for(const declaration of statement.declaration.declarations||[]){if(declaration.id.type!=='Identifier'||!declaration.init)continue;const value=require('./svelte-component-props.cjs').literal({type:'Attribute',value:{type:'ExpressionTag',expression:declaration.init}});if(value)Object.defineProperty(legacyDefaults,declaration.id.name,{value:Object.is(value.value,-0)?'-0':JSON.stringify(value.value),enumerable:true});}
 return {binding,roots,legacyDefaults,rootGroups:require('./svelte-component-root-groups.cjs')(parsed.ast,roots),components:parsed.components.filter(element=>safe(element.node))};
}
function stamp(out,info,revision){
 for(const element of info.components)out.appendLeft(element.start+1+element.tag.length,' data-rt-i="'+element.id+'" data-rt-i-revision={'+revision+'}');
 for(const element of info.roots)for(const name of names)out.appendLeft(element.start+1+element.tag.length,' '+name+'={'+info.binding+'('+JSON.stringify(name)+')}');
}
// Svelte's compiled component already receives its complete props object. Read
// the private editor markers there, avoiding a second $props() declaration or
// changes to authored destructuring/rest props and legacy component semantics.
function transform(code,file,info){
 if(!info.roots.length&&!Object.keys(info.legacyDefaults||{}).length)return null;
 const ast=parser.parse(code,{sourceType:'module'}),ns=ast.program.body.find(node=>node.type==='ImportDeclaration'&&node.source.value==='svelte/internal/client')?.specifiers.find(node=>node.type==='ImportNamespaceSpecifier')?.local.name;
 const target=ns&&ast.program.body.find(node=>node.type==='FunctionDeclaration'&&node.params[0]?.type==='Identifier'&&(!node.params[1]||node.params[1].type==='Identifier')&&code.includes(node.id.name+' = '+ns+'.hmr('+node.id.name+')'));
 if(!target)throw Error('The Svelte component marker transform could not identify its compiled component.');
 const props=target.params[1]?.name||info.binding+'_props',out=new MagicString(code);
 if(!target.params[1])out.appendLeft(target.params[0].end,','+props);
 out.appendLeft(target.body.start+1,'\nconst '+info.binding+' = name => '+props+'?.[name];\n');
 // The authored template sees an external helper, so Svelte emits these
 // attributes as static assignments. Run them in tracked effects: the props
 // getters read the parent's source store and must update without a remount.
 function track(node,inEffect=false){
  if(!node||typeof node!=='object')return;
  const call=node.type==='ExpressionStatement'&&node.expression;
  if(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name===ns&&['set_attribute','set_custom_element_data'].includes(call.callee.property.name)&&names.includes(call.arguments[1]?.value)&&call.arguments[2]?.callee?.name===info.binding&&!inEffect){out.appendLeft(call.start,ns+'.template_effect(() => ');out.appendLeft(call.end,')');return;}
  const effect=inEffect||node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name===ns&&['template_effect','render_effect'].includes(node.callee.property.name);
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>track(child,effect));else if(value&&typeof value==='object')track(value,effect);}
 }track(target.body);
 let legacy=false;
 for(const statement of target.body.body)if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations){const call=declaration.init,name=call?.arguments?.[1]?.value;if(call?.type==='CallExpression'&&call.callee.type==='MemberExpression'&&call.callee.object.name===ns&&call.callee.property.name==='prop'&&Object.hasOwn(info.legacyDefaults||{},name)){
  out.appendLeft(call.start,info.binding+'_legacy(');out.appendLeft(call.end,','+props+','+JSON.stringify(name)+','+info.legacyDefaults[name]+')');legacy=true;
 }}
 if(legacy)out.prepend('import {legacyProp as '+info.binding+'_legacy} from "virtual:retouch-svelte-source";\n');


 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={metadata,stamp,transform};
