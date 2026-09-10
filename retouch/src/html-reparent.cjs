'use strict';
const MagicString=require('magic-string');
function plan(resolved,op){
 const html=require('./adapters/html.cjs'),structure=require('./structure.cjs'),insertion=require('./html-insert.cjs');
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const items=structure.htmlRange(resolved),range=items.find(r=>r.selected);
  if(!range)return refuse('The selected layer is not a complete source region.');
  const position=op.position??'inside';
  if(!['inside','before','after'].includes(position))return refuse('Choose inside, before or after the destination.');
  const target=resolved.elements.find(e=>e.id===op.destinationId);
  if(!target)return refuse('Choose a layer in the same HTML document.');
  if(target.node===resolved.element.node)return refuse('A layer cannot be moved relative to itself.');
  const destination=position==='inside'?target:resolved.elements.find(e=>e.node===target.node.parentNode);
  if(!destination)return refuse('Choose a container in the same HTML document.');
  let anchor;
  if(position==='inside'){const capability=insertion.describe({...resolved,element:destination});if(!capability.canInsert)return refuse(capability.insertReason);}
  else {anchor=structure.htmlRange({...resolved,element:target}).find(r=>r.selected);if(!anchor)return refuse('The destination is not a complete source region.');}
  for(let node=destination.node;node;node=node.parentNode)if(node===resolved.element.node)return refuse('A layer cannot contain itself.');
  if(position==='inside'&&destination.node===resolved.element.node.parentNode)return refuse('The layer is already in that container.');
  const ancestors=new Set();for(let node=resolved.element.node.parentNode;node;node=node.parentNode)ancestors.add(node);
  let common=destination.node;while(common&&!ancestors.has(common))common=common.parentNode;
  const parentId=resolved.elements.find(e=>e.node===common)?.id;if(!parentId)return refuse('The shared parent has no authored source identity.');
  const source=resolved.source,chunk=source.slice(range.start,range.end),offset=position==='inside'?destination.location.endTag.startOffset:position==='before'?anchor.start:anchor.end,prefix='\n  ';
  const out=new MagicString(source);out.remove(range.start,range.end);out.appendLeft(offset,prefix+chunk+'\n');
  const after=out.toString(),elements=html.collect(after,resolved.relPath).elements;
  const movedStart=offset-(range.start<offset?range.end-range.start:0)+prefix.length;
  const moved=elements.find(e=>e.location.startOffset===movedStart),newParent=elements.find(e=>e.node===moved?.node.parentNode);
  const expectedParentStart=destination.location.startOffset-(range.end<=destination.location.startOffset?range.end-range.start:0);
  if(newParent?.location.startOffset!==expectedParentStart)return refuse('This move changes the parsed parent.');
  if(elements.length!==resolved.elements.length||!moved||!newParent||newParent.tag!==destination.tag||moved.tag!==resolved.element.tag)return refuse('This move changes the parsed HTML structure.');
  const sourceIdMap=[],mapped=new Set();
  for(const element of resolved.elements){const before=element.location.startOffset,inMoved=before>=range.start&&before<range.end,shifted=inMoved?movedStart+before-range.start:before-(before>=range.end?chunk.length:0)+(before>=offset?prefix.length+chunk.length+1:0),next=elements.find(item=>item.location.startOffset===shifted&&item.tag===element.tag);if(!next||mapped.has(next.id))return refuse('An original layer lost its source identity.');mapped.add(next.id);if(next.id!==element.id)sourceIdMap.push([element.id,next.id]);}
  return {ok:true,sourceIdMap,hash:html.contentHash(after),parentId,movedId:moved.id,destinationId:newParent.id,structural:true,edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
