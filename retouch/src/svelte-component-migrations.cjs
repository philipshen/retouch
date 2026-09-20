'use strict';
const fs=require('node:fs'),path=require('node:path'),source=require('./svelte-source.cjs');
// Retain bounded history proofs for exact undo/redo, but publish only the most
// recent committed transition. External edits cannot reuse a stale cached map.
const records=new Map(),pending=new Map(),limit=200;
function record(root,plan){
 if(!plan?.ok)return;
 const structural=!!(plan.duplicatedComponent||plan.deletedComponent||plan.copiedComponents||plan.deletedComponentIds),mapping=new Map(plan.duplicatedComponent?.sourceIdMap||plan.sourceIdMap||[]),removed=new Set(plan.deletedComponent?.removedSourceIds||plan.removedSourceIds||[]);
 for(const edit of plan.edits||[]){
  if(!edit.file.endsWith('.svelte')||typeof edit.before!=='string'||typeof edit.after!=='string'||edit.before===edit.after)continue;
  let file;
  try{
   file=fs.realpathSync(edit.file);pending.delete(file);
   const beforeRevision=source.contentHash(edit.before),afterRevision=source.contentHash(edit.after);
   if(structural){
    const relative=path.relative(fs.realpathSync(root),file).split(path.sep).join('/'),before=source.textSnapshot(edit.before,relative),after=source.textSnapshot(edit.after,relative),pairs=[];
    for(const old of before.components){if(removed.has(old.id))continue;const id=mapping.get(old.id)||old.id,next=after.components.find(e=>e.id===id&&e.tag===old.tag);if(!next)throw Error('Incomplete component mapping');pairs.push([old.id,id]);}
    if(new Set(pairs.map(pair=>pair[1])).size!==pairs.length)continue;
    const from=source.contentHash(before.signature),to=source.contentHash(after.signature);if(from===to)continue;
    for(const [revision,edge]of [[afterRevision,{beforeRevision,from,to,pairs,ids:before.components.map(e=>e.id)}],[beforeRevision,{beforeRevision:afterRevision,from:to,to:from,pairs:pairs.map(([a,b])=>[b,a]),ids:after.components.map(e=>e.id)}]]){const key=file+'|'+revision,prior=records.get(key)||[];records.delete(key);records.set(key,[...prior.filter(item=>item.beforeRevision!==edge.beforeRevision),edge].slice(-20));}
    while(records.size>limit)records.delete(records.keys().next().value);
   }
   const edge=records.get(file+'|'+afterRevision)?.find(edge=>edge.beforeRevision===beforeRevision);
   if(edge)pending.set(file,{beforeRevision,afterRevision,edge});
   while(pending.size>limit)pending.delete(pending.keys().next().value);
  }catch{if(file)pending.delete(file);}
 }
}
function observe(file,beforeRevision,afterRevision){if(beforeRevision===afterRevision)return;try{const real=fs.realpathSync(file),entry=pending.get(real);if(entry&&(entry.beforeRevision!==beforeRevision||entry.afterRevision!==afterRevision))pending.delete(real);}catch{}}
function read(file,revision){try{const entry=pending.get(fs.realpathSync(file));return entry?.afterRevision===revision?[entry.edge]:[];}catch{return [];}}
module.exports={record,read,observe};
