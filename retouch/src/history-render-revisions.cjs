'use strict';
const path=require('node:path');
// Collection propagation preserves host identity. Expose only hashes and IDs,
// never source text, so the client can recognize the complete rendered restore.
module.exports=function historyRenderRevisions(root,edits,adapter){
 if(adapter.name!=='react'||!edits.some(edit=>path.relative(root,edit.file)==='.retouch/variables.json'))return null;
 const groups=[];
 for(const edit of edits){
  const relative=path.relative(root,edit.file);
  if(relative==='.retouch/variables.json')continue;
  if(!adapter.matches(edit.file)||typeof edit.before!=='string'||typeof edit.after!=='string')return null;
  const hosts=source=>adapter.collect(source,relative).elements.filter(element=>element.kind==='host').map(element=>element.id).sort();
  const before=hosts(edit.before),after=hosts(edit.after);
  if(!after.length||JSON.stringify(before)!==JSON.stringify(after))return null;
  groups.push({ids:after,hash:adapter.contentHash(edit.after)});
 }
 return {attribute:'data-rt-revision',groups};
};
