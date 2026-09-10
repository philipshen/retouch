'use strict';
const fs=require('node:fs'),path=require('node:path'),library=require('./variable-library.cjs');
// Plan every linked page before committing either the catalog or source changes.
function plan(root,operation,renderer='html'){
 try{
  if(!['html','react','liquid'].includes(renderer))throw Error('Unsupported variable binding renderer.');
  const linked=require(renderer==='react'?'./jsx-variable-bindings.cjs':renderer==='liquid'?'./liquid-variable-bindings.cjs':'./html-variable-bindings.cjs');
  const change=library.planChange(root,operation),next=change.result;
  const model={version:next.version,collections:next.collections,variables:next.variables};
  const inventory=renderer!=='html'?require('./text-style-update.cjs').sourceInventory(root,renderer):require('./html-pages.cjs').list(root);
  if(inventory.truncated)throw Error('This project exceeds the 1,000-page variable update limit. No changes were saved.');
  let bytes=0,updated=0,pages=0;const edits=[...change.edits];
  for(const page of inventory.pages){
   const file=path.join(root,page.path),stat=fs.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('A project page is no longer a regular file. Reload before updating.');
   bytes+=stat.size;if(bytes>32*1024*1024)throw Error('Project source exceeds the 32 MB variable update limit. No changes were saved.');
   const result=linked.planFile(file,page.path,fs.readFileSync(file,'utf8'),model);
   if(!result.ok)throw Error(page.path+': '+result.reason);
   edits.push(...result.edits);updated+=result.updated;if(result.edits.length)pages++;
  }
  return {...change,edits,updated,pages};
 }catch(error){return {ok:false,refused:true,reason:error.message,statusCode:error.statusCode||409};}
}
module.exports={plan};
