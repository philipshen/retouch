'use strict';
const MagicString=require('magic-string'),crypto=require('node:crypto');
const html=require('./adapters/html.cjs'),structure=require('./structure.cjs'),css=require('./html-css.cjs');
const contains=(parent,node)=>{for(let current=node;current;current=current.parentNode)if(current===parent)return true;return false;};
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!['duplicateSelection','deleteSelection'].includes(op.type))return refuse('Choose duplicate or delete.');
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 2–100 distinct layers in the same HTML document.');
  const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,selected=op.ids.map(id=>elements.find(e=>e.id===id));
  if(selected.some(e=>!e))return refuse('A selected layer no longer resolves in this document.');
  const roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other.node,e.node)));
  const ranges=roots.map(element=>{
   if(['html','body','head'].includes(element.tag))throw Error('The document root cannot be duplicated or deleted.');
   const range=structure.htmlRange({...resolved,elements,element}).find(r=>r.selected);if(!range)throw Error('A layer is not a complete source region.');
   if(op.type==='duplicateSelection'&&!structure.describe({...resolved,elements,element},'html').canDuplicate)throw Error('A selected layer cannot be duplicated, including layers with authored IDs, keys or refs.');
   return {...range,element};
  }).sort((a,b)=>a.start-b.start);
  let common=roots[0].node.parentNode;while(common&&!roots.every(e=>contains(common,e.node)))common=common.parentNode;
  const parentId=elements.find(e=>e.node===common)?.id;if(!parentId)return refuse('The shared parent has no source identity.');
  const out=new MagicString(resolved.source),clones=[];
  let marker;do{marker='data-rt-copy-'+crypto.randomBytes(6).toString('hex');}while(resolved.source.includes(marker));
  const removedSourceIds=op.type==='deleteSelection'?elements.filter(e=>roots.some(root=>contains(root.node,e.node))).map(e=>e.id):[];
  const originals=elements.filter(e=>!removedSourceIds.includes(e.id));
  for(const [index,element]of originals.entries())out.appendLeft(element.location.startTag.startOffset+1+element.tag.length,` ${marker}="o${index}"`);
  for(const [index,range]of ranges.entries()){
   if(op.type==='deleteSelection'){out.remove(range.start,range.end);continue;}
   const clone=css.clone({...resolved,elements},range);clones.push(clone);
   const chunk=new MagicString(clone.chunk);chunk.appendLeft(range.element.tag.length+1,` ${marker}="c${index}"`);
   const indent=resolved.source.slice(0,range.start).match(/(?:^|\n)([ \t]*)$/)?.[1]||'';
   out.appendLeft(range.end,'\n'+indent+chunk.toString());
  }
  let after=out.toString();for(const clone of clones)after=clone.append(after);
  const parsed=html.collect(after,resolved.relPath).elements,subtreeCount=elements.filter(e=>roots.some(root=>contains(root.node,e.node))).length;
  if(parsed.length!==elements.length+(op.type==='duplicateSelection'?subtreeCount:-subtreeCount))return refuse('The operation changes the parsed HTML structure.');
  const marked=value=>parsed.find(e=>e.node.attrs.some(a=>a.name===marker&&a.value===value));
  const sourceIdMap=originals.flatMap((element,index)=>{const target=marked('o'+index);if(!target||target.tag!==element.tag)throw Error('An original layer lost its source identity.');return target.id===element.id?[]:[[element.id,target.id]];});
  let selectionIds=[parentId];
  if(op.type==='duplicateSelection'){
   selectionIds=ranges.map((range,index)=>{const copy=marked('c'+index),parent=marked('o'+originals.findIndex(element=>element.node===range.element.node.parentNode));if(!copy||!parent||copy.node.parentNode!==parent.node||copy.tag!==range.element.tag)throw Error('A copy changed its parsed parent.');return copy.id;});
  }
  const clean=new MagicString(after);for(const element of parsed){const attr=element.location.attrs?.[marker];if(attr)clean.remove(attr.startOffset-1,attr.endOffset);}after=clean.toString();
  if(after.includes(marker))return refuse('The temporary layer identity could not be removed.');
  const final=html.collect(after,resolved.relPath).elements,mapping=new Map(sourceIdMap),finalIds=new Set(final.map(element=>element.id));
  if(final.length!==parsed.length||selectionIds.some(id=>!finalIds.has(id)))return refuse('The resulting selection could not be preserved.');
  if(originals.some(element=>!finalIds.has(mapping.get(element.id)||element.id)))return refuse('An original layer could not be preserved.');
  // Validate copied style ownership and managed rule metadata after combining
  // all clones, including identities allocated by separate subtree copies.
  if(op.type==='duplicateSelection')for(const element of final)if(element.node.attrs.some(a=>a.name==='data-rt-style')){const state=css.describe({...resolved,source:after,elements:final,element});if(state.cssReason)throw Error(state.cssReason);}
  return {ok:true,hash:html.contentHash(after),sourceIdMap,removedSourceIds,parentId,selectionIds,rootCount:roots.length,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
