'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseSource,contentHash}=require('./id.cjs');
// A bounded, source-only module graph. Each AST node keeps its lexical module;
// identical private type names in different files must never share a binding.
module.exports=function typeModules(resolved,def,ast){
 const modules=new Map(),owners=new WeakMap(),pathChecks=new Map();
 function mark(node,mod){if(!node||typeof node!=='object')return;owners.set(node,mod);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>mark(child,mod));else if(value&&typeof value==='object')mark(value,mod);}}
 function register(file,source,tree){
  if(modules.size>=40)throw Error('Too many type modules');
  const mod={file,source,declarations:new Map(),imports:new Map(),exports:new Map(),stars:[],shadowed:new Set()};modules.set(file,mod);mark(tree,mod);
  for(const item of tree.program.body){
   if(item.type==='ImportDeclaration')for(const spec of item.specifiers){mod.shadowed.add(spec.local.name);mod.imports.set(spec.local.name,{source:item.source.value,namespace:spec.type==='ImportNamespaceSpecifier',name:spec.type==='ImportDefaultSpecifier'?'default':spec.imported?.name??spec.imported?.value});}
   if(item.type==='ExportAllDeclaration')mod.stars.push(item.source.value);
   const declaration=['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(item.type)?item.declaration:item;
   if(declaration?.id?.name){const name=declaration.id.name;mod.shadowed.add(name);if(['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(declaration.type)){if(mod.declarations.has(name))throw Error('Merged type declarations are unsupported');mod.declarations.set(name,declaration);if(item.type==='ExportNamedDeclaration')mod.exports.set(name,{local:name});if(item.type==='ExportDefaultDeclaration')mod.exports.set('default',{local:name});}}
   if(item.type==='ExportNamedDeclaration')for(const spec of item.specifiers){if(spec.type!=='ExportSpecifier'){if(spec.exported)mod.exports.set(spec.exported.name??spec.exported.value,spec.type==='ExportNamespaceSpecifier'&&item.source?{namespace:true,source:item.source.value}:{unsupported:true});continue;}mod.exports.set(spec.exported.name??spec.exported.value,{local:spec.local.name??spec.local.value,source:item.source?.value});}
  }
  return mod;
 }
 const main=register(def.file,def.source,ast);mark(def.fn,main);let paths;
 function imported(mod,specifier){
  const root=fs.realpathSync(resolved.appRoot);
  const bases=specifier.startsWith('.')?[path.resolve(path.dirname(mod.file),specifier)]:(paths||(paths=require('./component-type-paths.cjs')(resolved.appRoot))).candidates(specifier);
  for(const base of bases)for(const suffix of ['', '.ts','.tsx','/index.ts','/index.tsx']){
   const candidate=base+suffix;if(!/\.[jt]sx?$/.test(candidate))continue;
   if(pathChecks.size>=1000&&!pathChecks.has(candidate))throw Error('Too many type resolution candidates');
   const check=require('./source-path-checks.cjs').snapshot(root,candidate),previous=pathChecks.get(candidate);
   if(previous&&JSON.stringify(previous)!==JSON.stringify(check))throw Error('Type resolution changed during inspection');pathChecks.set(candidate,check);
   if(check.kind!=='file')continue;const file=check.realPath;
   if(modules.has(file))return modules.get(file);
   const source=fs.readFileSync(file,'utf8');if(source.length>1000000)throw Error('Type module is too large');return register(file,source,parseSource(source));
  }
  throw Error('Type module is missing');
 }
 function namespace(mod){return mod.namespace||(mod.namespace={type:'RetouchTypeNamespace',module:mod});}
 let resolutionVisits=0;
 function binding(mod,name,seen=new Set()){
  if(++resolutionVisits>2000)throw Error('Type module resolution is too complex');
  const key=String(mod.file)+'#local#'+name;if(seen.has(key)||seen.size>=40)return null;const next=new Set(seen);next.add(key);
  if(mod.declarations.has(name))return mod.declarations.get(name);
  const link=mod.imports.get(name);if(!link)return null;const target=imported(mod,link.source);return link.namespace?namespace(target):exported(target,link.name,next);
 }
 function exported(mod,name,seen){
  if(++resolutionVisits>2000)throw Error('Type module resolution is too complex');
  const key=String(mod.file)+'#export#'+name;if(seen.has(key)||seen.size>=40)return null;const next=new Set(seen);next.add(key);
  const link=mod.exports.get(name);
  if(link){if(link.namespace)return namespace(imported(mod,link.source));if(link.unsupported)throw Error('Unsupported explicit type export');const result=link.source?exported(imported(mod,link.source),link.local,next):binding(mod,link.local,next);if(!result)throw Error('Explicit type export does not resolve');return result;}
  // Star exports do not forward default. Check every branch, including branches
  // without this name: a later addition there can make today's result ambiguous.
  if(name==='default')return null;
  const candidates=new Set();for(const source of mod.stars){const result=exported(imported(mod,source),name,next);if(result)candidates.add(result);}
  if(candidates.size>1)throw Error('Ambiguous type export');return [...candidates][0]||null;
 }
 return {
  lookup(node){
   const mod=owners.get(node)||main,parts=[];let typeName=node.typeName;
   while(typeName?.type==='TSQualifiedName'){
    if(parts.length>=20||typeName.right.type!=='Identifier')return null;
    parts.unshift(typeName.right.name);typeName=typeName.left;
   }
   if(typeName?.type!=='Identifier')return null;
   let result=binding(mod,typeName.name);
   for(const name of parts){if(result?.type!=='RetouchTypeNamespace')return null;result=exported(result.module,name,new Set());}
   return ['TSTypeAliasDeclaration','TSInterfaceDeclaration'].includes(result?.type)?result:null;
  },
  builtin(node,name){return !(owners.get(node)||main).shadowed.has(name);},
  inherit(node,from){owners.set(node,owners.get(from)||main);return node;},
  metadata(){
   const dependencies=[...modules.values()].map(({file,source})=>({file,source})).concat(paths?.dependencies()||[]),checks=[...pathChecks.values()].sort((a,b)=>a.file.localeCompare(b.file));
   const revisions=dependencies.map(d=>[d.file,d.source===null?null:contentHash(d.source)]).sort((a,b)=>a[0].localeCompare(b[0]));
   return {dependencies,pathChecks:checks,revision:dependencies.length===1&&!checks.length?contentHash(def.source):contentHash(JSON.stringify([revisions,checks]))};
  }
 };
};
