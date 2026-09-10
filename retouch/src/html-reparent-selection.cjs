'use strict';
const MagicString=require('magic-string'),crypto=require('node:crypto');
const html=require('./adapters/html.cjs'),structure=require('./structure.cjs'),insertion=require('./html-insert.cjs');
const contains=(parent,node)=>{for(let current=node;current;current=current.parentNode)if(current===parent)return true;return false;};
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 2–100 distinct layers in the same HTML document.');
  const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,selected=op.ids.map(id=>elements.find(e=>e.id===id));
  if(selected.some(e=>!e))return refuse('A selected layer no longer resolves.');
  const roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other.node,e.node))),position=op.position??'inside';
  if(!['inside','before','after'].includes(position))return refuse('Choose inside, before or after the destination.');
  const target=elements.find(e=>e.id===op.destinationId);if(!target)return refuse('Choose a destination in the same HTML document.');
  if(roots.some(root=>contains(root.node,target.node)))return refuse('The destination cannot belong to the selected subtrees.');
  const destination=position==='inside'?target:elements.find(e=>e.node===target.node.parentNode);if(!destination)return refuse('The destination parent has no source identity.');
  let offset;
  if(position==='inside'){const capability=insertion.describe({...resolved,element:destination});if(!capability.canInsert)return refuse(capability.insertReason);offset=destination.location.endTag.startOffset;}
  else {const anchor=structure.htmlRange({...resolved,elements,element:target}).find(r=>r.selected);if(!anchor)return refuse('The destination is not a complete source region.');offset=position==='before'?anchor.start:anchor.end;}
  const ranges=roots.map(element=>{
   if(['html','body','head'].includes(element.tag))throw Error('The document root cannot be moved.');
   const range=structure.htmlRange({...resolved,elements,element}).find(r=>r.selected);if(!range)throw Error('A selected layer is not a complete source region.');return {...range,element};
  }).sort((a,b)=>a.start-b.start);
  let common=destination.node;while(common&&!roots.every(root=>contains(common,root.node)))common=common.parentNode;
  const parentId=elements.find(e=>e.node===common)?.id;if(!parentId)return refuse('The shared parent has no source identity.');
  let marker;do{marker='data-rt-move-'+crypto.randomBytes(6).toString('hex');}while(resolved.source.includes(marker));
  const out=new MagicString(resolved.source),chunks=[];
  for(const [index,element]of elements.entries())if(!ranges.some(range=>element.location.startOffset>=range.start&&element.location.startOffset<range.end))out.appendLeft(element.location.startTag.startOffset+1+element.tag.length,` ${marker}="o${index}"`);
  for(const range of ranges){
   const chunk=new MagicString(resolved.source.slice(range.start,range.end));
   for(const [index,element]of elements.entries())if(element.location.startOffset>=range.start&&element.location.startOffset<range.end)chunk.appendLeft(element.location.startTag.startOffset-range.start+1+element.tag.length,` ${marker}="o${index}"`);
   chunks.push(chunk.toString());out.remove(range.start,range.end);
  }
  out.appendLeft(offset,'\n  '+chunks.join('\n  ')+'\n');
  let after=out.toString();const parsed=html.collect(after,resolved.relPath).elements,marked=value=>parsed.find(e=>e.node.attrs.some(a=>a.name===marker&&a.value===value)),parent=marked('o'+elements.indexOf(destination));
  if(parsed.length!==elements.length||!parent)return refuse('This move changes the parsed HTML structure.');
  const moved=ranges.map(range=>{const element=marked('o'+elements.indexOf(range.element));if(!element||element.tag!==range.element.tag||element.node.parentNode!==parent.node)throw Error('A moved layer changed its parsed parent.');return element;});
  const siblings=parent.node.childNodes.filter(node=>node.tagName),first=siblings.indexOf(moved[0].node);
  if(moved.some((element,index)=>siblings[first+index]!==element.node))return refuse('The moved layers do not retain their source order.');
  const sourceIdMap=elements.flatMap((element,index)=>{const next=marked('o'+index);if(!next||next.tag!==element.tag)throw Error('An original layer lost its source identity.');return next.id===element.id?[]:[[element.id,next.id]];});
  const clean=new MagicString(after);for(const element of parsed){const attr=element.location.attrs?.[marker];if(attr)clean.remove(attr.startOffset-1,attr.endOffset);}after=clean.toString();
  if(after.includes(marker))return refuse('The temporary move identity could not be removed.');
  const final=html.collect(after,resolved.relPath).elements,selectionIds=moved.map(e=>e.id);
  if(final.length!==elements.length||selectionIds.some(id=>!final.some(e=>e.id===id)))return refuse('The moved selection could not be preserved.');
  const mapping=new Map(sourceIdMap);if(elements.some(element=>!final.some(next=>next.id===(mapping.get(element.id)||element.id))))return refuse('An original layer could not be preserved.');
  return {ok:true,sourceIdMap,hash:html.contentHash(after),parentId,selectionIds,rootCount:roots.length,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
