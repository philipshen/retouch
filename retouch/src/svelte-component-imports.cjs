'use strict';
const fs=require('node:fs'),path=require('node:path'),checks=require('./source-path-checks.cjs');
// Resolve source modules without executing project configuration. Preserve every
// attempted path: creating a preferred alias target must invalidate a saved plan.
module.exports=function componentImports(appRoot){
 const root=fs.realpathSync(appRoot),snapshots=new Map();let paths;
 return {
  resolve(from,specifier){
   if(typeof specifier!=='string'||!specifier.endsWith('.svelte'))throw Error('Choose an explicit Svelte source import.');
   const candidates=/^\.\.?\//.test(specifier)?[path.resolve(path.dirname(from),specifier)]:(paths??=require('./component-type-paths.cjs')(root)).candidates(specifier);
   for(const candidate of candidates){
    if(!candidate.endsWith('.svelte'))throw Error('Component aliases must resolve to Svelte source files.');
    const check=checks.snapshot(root,candidate),previous=snapshots.get(candidate);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(check))throw Error('Component resolution changed during planning.');
    snapshots.set(candidate,check);
    if(snapshots.size>1000)throw Error('Too many component resolution paths.');
    if(check.kind==='unresolved-link'||check.realPath&&check.realPath!==candidate)throw Error('Component dependencies must be project files without symlinks.');
    if(check.kind==='file')return candidate;
   }
   throw Error('The Svelte import does not resolve through project source paths.');
  },
  dependencies(){return paths?.dependencies()||[];},
  pathChecks(){return [...snapshots.values()];}
 };
};
