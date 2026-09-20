'use strict';
const source=require('./svelte-source.cjs'),compiler=require('svelte/compiler'),MagicString=require('magic-string');
function context(r){
 const ast=source.collect(r.source,r.relPath).ast;let siblings;
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='Fragment'&&node.nodes.some(n=>n.start===r.element.start)){siblings=node.nodes.filter(n=>n.type!=='Comment'&&!(n.type==='Text'&&!n.data.trim()));return;}for(const [key,value]of Object.entries(node)){if(['metadata','loc'].includes(key))continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}
 walk(ast.fragment);if(!siblings)throw Error('This component has no source siblings to reorder.');return {siblings,index:siblings.findIndex(n=>n.start===r.element.start)};
}
function describe(r){try{const {siblings,index}=context(r),ids=siblings.map(n=>r.elements.find(e=>e.start===n.start)?.id||null);return {ok:true,fileHash:r.hash,siblingIds:ids,targets:ids.filter(id=>id&&id!==r.element.id),canMoveBefore:index>0,canMoveAfter:index<siblings.length-1,canMoveFirst:index>0,canMoveLast:index<siblings.length-1};}catch(error){return {ok:false,reason:error.message,fileHash:r.hash,targets:[]};}}
function plan(r,op,adapter){try{
 if(op.fileHash!==r.hash)throw Error('The source changed. Re-select the component.');
 if(!['before','after','first','last'].includes(op.direction))throw Error('Choose an earlier or later sibling position.');
 const selection=['moveComponentSelection','reparentComponentSelection'].includes(op.type),ids=selection?op.ids:[r.element.id];
 if(!Array.isArray(ids)||ids.length<(selection?2:1)||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(r.element.id))throw Error('Choose distinct component usages from one source file.');
 const elements=adapter.collect(r.source,r.relPath).elements,members=ids.map(id=>elements.find(e=>e.id===id));if(members.some(e=>e?.kind!=='instance'))throw Error('Select component usages in this source file.');
 const roots=members.filter(e=>!members.some(p=>p!==e&&p.start<e.start&&p.end>=e.end)).sort((a,b)=>a.start-b.start),{siblings}=context({...r,element:roots[0]}),starts=new Set(roots.map(e=>e.start));
 if(roots.some(e=>!siblings.some(n=>n.start===e.start)))throw Error('Choose component usages in the same source container.');
 let target,direction=op.direction;
 if(op.destinationId!==undefined){if(!['before','after'].includes(direction))throw Error('Choose before or after the destination.');const destination=elements.find(e=>e.id===op.destinationId);target=siblings.find(n=>n.start===destination?.start);if(!target||starts.has(target.start))throw Error('Choose an unselected sibling layer.');}
 else{const first=siblings.findIndex(n=>starts.has(n.start)),last=siblings.findLastIndex(n=>starts.has(n.start));target=direction==='first'?siblings.find(n=>!starts.has(n.start)):direction==='last'?siblings.findLast(n=>!starts.has(n.start)):direction==='before'?siblings[first-1]:siblings[last+1];direction=['first','before'].includes(direction)?'before':'after';}
 const reordered=siblings.filter(n=>!starts.has(n.start));if(target)reordered.splice(reordered.indexOf(target)+(direction==='after'?1:0),0,...siblings.filter(n=>starts.has(n.start)));
 if(!target||reordered.every((n,i)=>n===siblings[i]))return {ok:true,unchanged:true,hash:r.hash,selectionIds:roots.map(e=>e.id),sourceIdMap:[],rootCount:roots.length,edits:[]};
 const out=new MagicString(r.source),positions=[];let shift=0;
 for(let i=0;i<siblings.length;i++){const slot=siblings[i],replacement=reordered[i],chunk=r.source.slice(replacement.start,replacement.end);positions.push({original:replacement,start:slot.start+shift});if(slot!==replacement)out.overwrite(slot.start,slot.end,chunk);shift+=chunk.length-(slot.end-slot.start);}
 const after=out.toString();compiler.compile(after,{filename:r.relPath,generate:false});const next=adapter.collect(after,r.relPath).elements,mapping=new Map(),mapped=new Set();
 for(const old of elements){const position=positions.find(p=>old.start>=p.original.start&&old.end<=p.original.end),start=position?position.start+old.start-position.original.start:old.start,n=next.find(e=>e.start===start&&e.kind===old.kind&&e.tag===old.tag);if(!n||mapped.has(n.id))throw Error('A moved source layer could not be mapped.');mapping.set(old.id,n.id);mapped.add(n.id);}
 if(mapped.size!==next.length)throw Error('Moving changed the number of source layers.');const sourceIdMap=[...mapping].filter(([a,b])=>a!==b);
 return {ok:true,hash:source.contentHash(after),...(selection?{movedComponentIds:roots.map(e=>e.id),selectionIds:roots.map(e=>mapping.get(e.id)),sourceIdMap,rootCount:roots.length}:{movedComponent:{instanceId:mapping.get(r.element.id),previousInstanceId:r.element.id,sourceIdMap}}),edits:[{file:r.file,before:r.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={describe,plan};
