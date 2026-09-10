'use strict';
const MagicString=require('magic-string'),html=require('./adapters/html.cjs'),structure=require('./structure.cjs'),insertion=require('./html-insert.cjs');
const contains=(parent,node)=>{for(let current=node;current;current=current.parentNode)if(current===parent)return true;return false;};
const isFrame=element=>element.tag==='div'&&element.node.attrs.some(a=>a.name==='data-rt-frame');
function describe(resolved){
 try{structure.htmlRange(resolved);const parent=resolved.elements.find(e=>e.node===resolved.element.node.parentNode);return {canFrame:!!parent&&insertion.describe({...resolved,element:parent}).canInsert,canRemoveFrame:isFrame(resolved.element)};}
 catch{return {canFrame:false,canRemoveFrame:false};}
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!['frameSelection','removeFrame'].includes(op.type))return refuse('Choose frame selection or remove frame.');
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements;
  let roots,parent,start,end,opening='',closing='',removed=null;
  if(op.type==='frameSelection'){
   if(!Array.isArray(op.ids)||!op.ids.length||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 1–100 distinct layers in the same HTML document.');
   const selected=op.ids.map(id=>elements.find(e=>e.id===id));if(selected.some(e=>!e))return refuse('A selected layer no longer resolves.');
   roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other.node,e.node))).sort((a,b)=>a.location.startOffset-b.location.startOffset);
   parent=elements.find(e=>e.node===roots[0].node.parentNode);
   if(!parent||roots.some(e=>e.node.parentNode!==parent.node))return refuse('Frame selection requires sibling layers in one container.');
   const capability=insertion.describe({...resolved,element:parent});if(!capability.canInsert)return refuse(capability.insertReason);
   const ranges=structure.htmlRange({...resolved,elements,element:roots[0]}),indices=roots.map(e=>ranges.findIndex(r=>r.start===e.location.startOffset));
   if(indices.some((at,index)=>at<0||at!==indices[0]+index))return refuse('Select consecutive sibling layers to frame without reordering other content.');
   start=ranges[indices[0]].start;end=ranges[indices.at(-1)].end;
   opening='<div data-rt-frame="" aria-label="Frame">';closing='</div>';
  }else{
   removed=resolved.element;if(!isFrame(removed))return refuse('Choose a frame created from a layer selection.');
   structure.htmlRange({...resolved,elements});parent=elements.find(e=>e.node===removed.node.parentNode);
   if(!parent||!removed.location.endTag)return refuse('This frame is not a complete source container.');
   roots=elements.filter(e=>e.node.parentNode===removed.node);
   start=removed.location.startTag.endOffset;end=removed.location.endTag.startOffset;
  }
  const out=new MagicString(resolved.source);
  if(removed){out.remove(removed.location.startTag.startOffset,start);out.remove(end,removed.location.endTag.endOffset);}
  else{out.appendLeft(start,opening);out.appendLeft(end,closing);}
  const after=out.toString(),parsed=html.collect(after,resolved.relPath).elements;
  if(parsed.length!==elements.length+(removed?-1:1))return refuse('Framing would change the parsed HTML structure.');
  // Track every original node by its shifted source offset, not by structural
  // IDs, which legitimately change when a wrapper changes sibling routes.
  const shifted=offset=>removed?offset-(offset>=start?start-removed.location.startTag.startOffset:0)-(offset>=removed.location.endTag.endOffset?removed.location.endTag.endOffset-end:0):offset+(offset>=start?opening.length:0)+(offset>=end?closing.length:0);
  const mapped=new Map();
  for(const element of elements){if(element===removed)continue;const next=parsed.find(e=>e.location.startOffset===shifted(element.location.startOffset)&&e.tag===element.tag);if(!next)return refuse('An existing layer changed its parsed identity.');mapped.set(element.node,next);}
  const frame=removed?null:parsed.find(e=>e.location.startOffset===start&&isFrame(e));
  if(!removed&&(!frame||frame.node.parentNode!==mapped.get(parent.node)?.node))return refuse('The frame changed its parsed parent.');
  for(const element of elements){if(element===removed)continue;const next=mapped.get(element.node),expected=roots.includes(element)?(removed?mapped.get(parent.node):frame):mapped.get(element.node.parentNode);if(expected&&next.node.parentNode!==expected.node)return refuse('Framing would move an unrelated layer.');}
  const selectionIds=removed?(roots.length?roots.map(e=>mapped.get(e.node).id):[mapped.get(parent.node).id]):[frame.id];
  const sourceIdMap=elements.filter(element=>element!==removed).flatMap(element=>{const id=mapped.get(element.node).id;return id===element.id?[]:[[element.id,id]];}),removedSourceIds=removed?[removed.id]:[];
  return {ok:true,hash:html.contentHash(after),sourceIdMap,removedSourceIds,parentId:parent.id,selectionIds,rootCount:roots.length,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
