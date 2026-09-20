'use strict';
const path=require('node:path');
// Collection propagation preserves host identity. Expose only hashes and IDs,
// never source text, so the client can recognize the complete rendered restore.
module.exports=function historyRenderRevisions(root,edits,adapter){
 if(!['react','vue','svelte'].includes(adapter.name)||!edits.some(edit=>path.relative(root,edit.file)==='.retouch/variables.json'))return null;
 const groups=[];
 for(const edit of edits){
  const relative=path.relative(root,edit.file);
  if(relative==='.retouch/variables.json')continue;
  if(!adapter.matches(edit.file)||typeof edit.before!=='string'||typeof edit.after!=='string')return null;
  const hosts=source=>adapter.collect(source,relative).elements.filter(element=>element.kind==='host').map(element=>element.id).sort();
  const before=hosts(edit.before),after=hosts(edit.after);
  if(!after.length||JSON.stringify(before)!==JSON.stringify(after))return null;
  const hash=adapter.contentHash(edit.after);let css;
  if(['vue','svelte'].includes(adapter.name)){
   const elements=adapter.collect(edit.after,relative).elements;
   let rendering;for(const element of elements){rendering=require('./'+adapter.name+'-css.cjs').describe({source:edit.after,file:edit.file,relPath:relative,element,hash},adapter).cssRendering;if(rendering)break;}
   if(!rendering)return null;
   css={selector:rendering.selector,property:rendering.property,value:rendering.value};
  }
  groups.push({ids:after,hash,...(css?{css}:{})});
 }
 return {attribute:'data-rt-revision',groups,...(['vue','svelte'].includes(adapter.name)?{renderer:adapter.name}:{})};
};
