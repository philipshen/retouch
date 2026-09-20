'use strict';
const fs=require('node:fs'),path=require('node:path'),source=require('./svelte-source.cjs'),markers=require('./svelte-component-markers.cjs'),props=require('./svelte-component-props.cjs');
const refused=reason=>({ok:false,refused:true,reason});
function definition(r){
 const parsed=source.collect(r.source,r.relPath),element=parsed.components.find(e=>e.id===r.element.id);
 if(!element)throw Error('Select a Svelte component usage.');
 const name=element.tag;if(!/^[A-Za-z_$][\w$]*$/.test(name))throw Error('Select a directly imported Svelte component.');
 const imports=[...(parsed.ast.instance?.content.body||[]),...(parsed.ast.module?.content.body||[])].filter(n=>n.type==='ImportDeclaration').flatMap(n=>n.specifiers.filter(s=>s.type==='ImportDefaultSpecifier'&&s.local.name===name).map(()=>n.source.value));
 if(imports.length!==1||!/^\.\.?\//.test(imports[0])||!imports[0].endsWith('.svelte'))throw Error('This component needs a relative Svelte source import.');
 // A template or script binding may shadow the imported component name.
 function binds(node){if(!node||typeof node!=='object')return false;if(node.type==='Identifier')return node.name===name;if(node.type==='RestElement')return binds(node.argument);if(node.type==='AssignmentPattern')return binds(node.left);if(node.type==='ObjectPattern')return node.properties.some(p=>binds(p.value||p.argument));if(node.type==='ArrayPattern')return node.elements.some(binds);return false;}
 function shadow(node){if(!node||typeof node!=='object'||node.type==='ImportDeclaration')return false;if(node.type==='VariableDeclarator'&&binds(node.id)||/^(?:Function|Class)(?:Declaration|Expression)$/.test(node.type)&&binds(node.id)||node.params?.some(binds)||node.type==='EachBlock'&&(binds(node.context)||node.index===name)||node.type==='AwaitBlock'&&(binds(node.value)||binds(node.error))||node.type==='SnippetBlock'&&(binds(node.expression)||node.parameters?.some(binds)))return true;return Object.values(node).some(v=>Array.isArray(v)?v.some(shadow):v&&typeof v==='object'&&shadow(v));}
 if(shadow(parsed.ast))throw Error('A local binding shadows this imported component.');
 const root=fs.realpathSync(r.appRoot||path.dirname(r.file)),candidate=path.resolve(fs.realpathSync(path.dirname(r.file)),imports[0]),file=fs.realpathSync(candidate),relative=path.relative(root,file);
 if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||relative.split(path.sep).includes('node_modules')||file!==candidate||!fs.statSync(file).isFile())throw Error('The component definition must be a project source file without symlinks.');
 const text=fs.readFileSync(file,'utf8'),rel=relative.split(path.sep).join('/'),meta=markers.metadata(text,rel);
 return {name,file,rel,text,meta};
}
function describeComponent(r){try{
 const def=definition(r),info=props.describe(r),roots=def.meta.roots;
 return {ok:true,name:def.name,file:def.rel,hash:source.contentHash(def.text),usageHash:r.hash,source:def.text,explicitComponent:true,definitionId:roots[0]?.id||null,definitionIds:roots.map(e=>e.id),rootGroups:roots.length&&!roots.some(e=>e.scope.conditional||e.scope.repeated)?[roots.map(e=>e.id)]:undefined,canDetach:false,canDuplicate:false,reason:'Svelte component detach and duplication are not available yet.',props:info.props.map(prop=>({name:prop.name,value:prop.value===undefined?'Expression':String(prop.value),default:'—',editor:prop}))};
 }catch(error){return refused(error.message);}}
function create(base){
 const host=r=>({...r,elements:r.elements.filter(e=>e.kind==='host')});
 const adapter={...base,
  collect(text,relative){const parsed=source.collect(text,relative);return {...parsed,elements:[...parsed.elements,...parsed.components].sort((a,b)=>a.start-b.start)};},
  describeComponent,
  describe(r){if(r.element.kind!=='instance')return base.describe(host(r));return {id:r.element.id,kind:'instance',tag:r.element.tag,file:r.relPath,hash:r.hash,renderRevisionAttribute:'data-rt-i-revision',context:r.context||null,canRename:false,textDynamic:true,classNameDynamic:true,structure:{},component:describeComponent(r)};},
  planOp(r,op){if(r.element.kind!=='instance')return base.planOp(host(r),op);if(op.type!=='setComponentProp')return refused('Choose a supported component property edit.');const component=describeComponent(r);if(!component.ok)return component;return props.plan(r,op);},
  capabilities:{...base.capabilities,ops:[...base.capabilities.ops,'setComponentProp']}
 };
 adapter.applyOp=(r,op)=>require('./transactions.cjs').applyPlan(r.appRoot||path.dirname(r.file),adapter.planOp(r,op));return adapter;
}
module.exports={create,definition,describeComponent};
