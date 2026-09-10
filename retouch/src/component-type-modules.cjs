'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseSource,contentHash}=require('./id.cjs');
// A bounded, source-only module graph. Each AST node keeps its lexical module;
// identical private type names in different files must never share a binding.
module.exports=function typeModules(resolved,def,ast){
 const modules=new Map(),owners=new WeakMap();
 function mark(node,mod){if(!node||typeof node!=='object')return;owners.set(node,mod);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>mark(child,mod));else if(value&&typeof value==='object')mark(value,mod);}}
 function register(file,source,tree){
  if(modules.size>=40)throw Error('Too many type modules');
  const mod={file,source,declarations:new Map(),imports:new Map(),exports:new Map(),shadowed:new Set()};modules.set(file,mod);mark(tree,mod);
  for(const item of tree.program.body){
   if(item.type==='ImportDeclaration')for(const spec of item.specifiers){mod.shadowed.add(spec.local.name);if(spec.type!=='ImportNamespaceSpecifier')mod.imports.set(spec.local.name,{source:item.source.value,name:spec.type==='ImportDefaultSpecifier'?'default':spec.imported.name??spec.imported.value});}
   const declaration=['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(item.type)?item.declaration:item;
   if(declaration?.id?.name){const name=declaration.id.name;mod.shadowed.add(name);if(['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(declaration.type)){if(mod.declarations.has(name))throw Error('Merged type declarations are unsupported');mod.declarations.set(name,declaration);if(item.type==='ExportNamedDeclaration')mod.exports.set(name,{local:name});if(item.type==='ExportDefaultDeclaration')mod.exports.set('default',{local:name});}}
   if(item.type==='ExportNamedDeclaration')for(const spec of item.specifiers){if(spec.type!=='ExportSpecifier')continue;mod.exports.set(spec.exported.name??spec.exported.value,{local:spec.local.name??spec.local.value,source:item.source?.value});}
  }
  return mod;
 }
 const main=register(def.file,def.source,ast);mark(def.fn,main);
 function imported(mod,specifier){
  // Config aliases and package resolution require additional config dependency
  // tracking. Relative local imports have an explicit source boundary.
  if(!specifier.startsWith('.'))throw Error('Only relative type imports are supported');
  const base=path.resolve(path.dirname(mod.file),specifier),root=fs.realpathSync(resolved.appRoot);
  for(const suffix of ['', '.ts','.tsx','/index.ts','/index.tsx']){
   const candidate=base+suffix;if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile()||! /\.[jt]sx?$/.test(candidate))continue;
   const file=fs.realpathSync(candidate);if(!file.startsWith(root+path.sep)||file.split(path.sep).includes('node_modules'))throw Error('Type module is outside this project');
   if(modules.has(file))return modules.get(file);
   const source=fs.readFileSync(file,'utf8');if(source.length>1000000)throw Error('Type module is too large');return register(file,source,parseSource(source));
  }
  throw Error('Type module is missing');
 }
 function binding(mod,name,seen=new Set()){
  const key=String(mod.file)+'#local#'+name;if(seen.has(key)||seen.size>=40)return null;const next=new Set(seen);next.add(key);
  if(mod.declarations.has(name))return mod.declarations.get(name);
  const link=mod.imports.get(name);return link?exported(imported(mod,link.source),link.name,next):null;
 }
 function exported(mod,name,seen){
  const key=String(mod.file)+'#export#'+name;if(seen.has(key)||seen.size>=40)return null;const next=new Set(seen);next.add(key);
  const link=mod.exports.get(name);if(!link)return null;
  return link.source?exported(imported(mod,link.source),link.local,next):binding(mod,link.local,next);
 }
 return {
  lookup(node,name){return binding(owners.get(node)||main,name);},
  builtin(node,name){return !(owners.get(node)||main).shadowed.has(name);},
  inherit(node,from){owners.set(node,owners.get(from)||main);return node;},
  metadata(){const dependencies=[...modules.values()].map(({file,source})=>({file,source}));return {dependencies,revision:dependencies.length===1?contentHash(def.source):contentHash(JSON.stringify(dependencies.map(d=>[d.file,contentHash(d.source)]).sort((a,b)=>a[0].localeCompare(b[0]))))};}
 };
};
