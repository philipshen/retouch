'use strict';
const MagicString=require('magic-string'),structure=require('./structure.cjs'),insertion=require('./native-insert.cjs');
function helpers(language){const react=language==='react';return {react,start:e=>react?e.node.start:e.tagStart,end:e=>react?e.node.end:e.closeEnd,parent:(e,elements)=>react?elements.find(p=>p.node.children?.includes(e.node)):e.parent,isFrame:e=>react?e.node.openingElement.name.name==='div'&&e.node.openingElement.attributes.some(a=>a.name?.name==='data-rt-frame'):e.tag==='div'&&e.attributes.some(a=>a.name==='data-rt-frame')};}
function describe(resolved,language){
 try{const h=helpers(language),ranges=structure.ranges(resolved,language),parent=resolved.elements.find(e=>e.id===ranges.parentId);return {canFrame:!!parent&&insertion.describe({...resolved,element:parent},language).canInsert,canRemoveFrame:h.isFrame(resolved.element)};}catch{return {canFrame:false,canRemoveFrame:false};}
}
function plan(resolved,op,language){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  if(!['frameSelection','removeFrame'].includes(op.type))return refuse('Choose frame selection or remove frame.');
  const h=helpers(language),elements=resolved.elements,adapter=require('./adapters/'+language+'.cjs'),contains=(a,b)=>h.start(a)<=h.start(b)&&h.end(a)>=h.end(b);
  let roots,parent,start,end,removed=null,opening='',closing='';
  if(op.type==='frameSelection'){
   if(!Array.isArray(op.ids)||!op.ids.length||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(resolved.element.id))return refuse('Choose 1–100 distinct layers in the same source file.');
   const selected=op.ids.map(id=>elements.find(e=>e.id===id));if(selected.some(e=>!e||e.kind!=='host'))return refuse('Choose native layers in the same source file.');
   roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other,e))).sort((a,b)=>h.start(a)-h.start(b));parent=h.parent(roots[0],elements);
   if(!parent||roots.some(e=>h.parent(e,elements)!==parent))return refuse('Frame selection requires sibling layers in one container.');
   const capability=insertion.describe({...resolved,element:parent},language);if(!capability.canInsert)return refuse(capability.insertReason);
   const ranges=structure.ranges({...resolved,element:roots[0]},language),indices=roots.map(e=>ranges.findIndex(r=>r.start===h.start(e)));
   if(indices.some((at,index)=>at<0||at!==indices[0]+index))return refuse('Select consecutive sibling layers to frame without reordering other content.');
   start=ranges[indices[0]].start;end=ranges[indices.at(-1)].end;opening='<div data-rt-frame="" aria-label="Frame">';closing='</div>';
  }else{
   removed=resolved.element;if(removed.kind!=='host'||!h.isFrame(removed))return refuse('Choose a frame created from a layer selection.');
   structure.ranges(resolved,language);parent=h.parent(removed,elements);if(!parent)return refuse('The frame parent has no source identity.');
   start=h.react?removed.node.openingElement.end:removed.openEnd;end=h.react?removed.node.closingElement?.start:removed.closeStart;
   if(!Number.isInteger(end))return refuse('Choose a frame with an explicit closing tag.');
   roots=elements.filter(e=>h.parent(e,elements)===removed);
   if(roots.length)require('./native-parent-proof.cjs').prove(resolved,roots,parent,language);
  }
  const out=new MagicString(resolved.source);
  if(removed){out.remove(h.start(removed),start);out.remove(end,h.end(removed));}else{out.appendLeft(start,opening);out.appendLeft(end,closing);}
  const after=out.toString(),final=adapter.collect(after,resolved.relPath).elements;
  if(final.length!==elements.length+(removed?-1:1))return refuse('Framing changed the source layer structure.');
  const shifted=at=>removed?at-(at>=start?start-h.start(removed):0)-(at>=h.end(removed)?h.end(removed)-end:0):at+(at>=start?opening.length:0)+(at>=end?closing.length:0),mapping=new Map(),used=new Set();
  for(const old of elements){if(old===removed)continue;const next=final.find(e=>h.start(e)===shifted(h.start(old))&&e.kind===old.kind);if(!next||used.has(next.id))return refuse('An existing layer lost its source identity.');mapping.set(old,next);used.add(next.id);}
  const frame=removed?null:final.find(e=>h.start(e)===start&&h.isFrame(e));if(!removed&&(!frame||h.parent(frame,final)!==mapping.get(parent)))return refuse('The frame changed its source parent.');
  for(const old of elements){if(old===removed)continue;const expected=roots.includes(old)?(removed?mapping.get(parent):frame):mapping.get(h.parent(old,elements));if(expected&&h.parent(mapping.get(old),final)!==expected)return refuse('Framing moved an unrelated layer.');}
  if(frame)require('./native-parent-proof.cjs').prove({...resolved,source:after,elements:final},[frame],mapping.get(parent),language);
  return {ok:true,hash:adapter.contentHash(after),structural:true,parentId:mapping.get(parent).id,rootCount:roots.length,selectionIds:removed?(roots.length?roots.map(e=>mapping.get(e).id):[mapping.get(parent).id]):[frame.id],sourceIdMap:[...mapping].filter(([a,b])=>a.id!==b.id).map(([a,b])=>[a.id,b.id]),removedSourceIds:removed?[removed.id]:[],edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
