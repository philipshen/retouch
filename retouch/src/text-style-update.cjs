'use strict';
const fs=require('node:fs'),path=require('node:path');
function sourceInventory(root,renderer){
 const pages=[],skip=new Set(['node_modules','dist','build','out','public','coverage']);let truncated=false;
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.isSymbolicLink()||skip.has(entry.name))continue;const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&(renderer==='liquid'?/\.liquid$/:/\.(jsx|tsx)$/).test(entry.name)){pages.push({path:path.relative(root,file).split(path.sep).join('/')});if(pages.length>1000){truncated=true;return;}}if(truncated)return;}}
 walk(root);return {pages:pages.sort((a,b)=>a.path.localeCompare(b.path)),truncated};
}
// Compose the complete project change before any source or catalog write.
// Use the HTML site's page inventory, including pages not visited in the editor.
function plan(root,operation,renderer='html',family='text'){
 const catalog=family==='color'?require('./color-styles.cjs'):family==='effect'?require('./effect-styles.cjs'):require('./text-styles.cjs');
 try{
  if(!['html','react','liquid'].includes(renderer))throw Error('Unsupported text style renderer.');
  const linked=require(family==='effect'?(renderer==='react'?'./jsx-effect-styles.cjs':renderer==='liquid'?'./liquid-effect-styles.cjs':'./html-effect-styles.cjs'):family==='color'?(renderer==='react'?'./jsx-color-styles.cjs':renderer==='liquid'?'./liquid-color-styles.cjs':'./html-color-styles.cjs'):renderer==='react'?'./jsx-text-styles.cjs':renderer==='liquid'?'./liquid-text-styles.cjs':'./html-text-styles.cjs');
  if(operation?.type!=='update')throw Error('Use a text style update operation.');
  const before=catalog.read(root),change=catalog.planChange(root,operation);
  const previous=before.styles.find(style=>style.id===operation.id),next=change.result.styles.find(style=>style.id===operation.id);
  if(JSON.stringify(previous.properties)===JSON.stringify(next.properties))return {...change,updated:0,pages:0};
  const inventory=renderer==='html'?require('./html-pages.cjs').list(root):sourceInventory(root,renderer);
  if(inventory.truncated)throw Error('This project exceeds the 1,000-file text style update limit. No changes were saved.');
  let bytes=0,updated=0,pages=0;const edits=[...change.edits];
  for(const page of inventory.pages){
   const file=path.join(root,page.path),stat=fs.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('A project page is no longer a regular file. Reload before updating.');
   bytes+=stat.size;if(bytes>32*1024*1024)throw Error('Project source exceeds the 32 MB text style update limit. No changes were saved.');
   const source=fs.readFileSync(file,'utf8'),planned=linked.planFile(file,page.path,source,next);
   if(!planned.ok)throw Error(page.path+': '+planned.reason);
   edits.push(...planned.edits);updated+=planned.updated;if(planned.updated)pages++;
  }
  return {...change,edits,updated,pages};
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
module.exports={plan,sourceInventory};
