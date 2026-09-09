'use strict';
const MagicString=require('magic-string');
function plan(resolved,op){
 const html=require('./adapters/html.cjs'),structure=require('./structure.cjs'),insertion=require('./html-insert.cjs');
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layer.');
  const items=structure.htmlRange(resolved),range=items.find(r=>r.selected);
  if(!range)return refuse('The selected layer is not a complete source region.');
  const destination=resolved.elements.find(e=>e.id===op.destinationId);
  if(!destination)return refuse('Choose a container in the same HTML document.');
  const capability=insertion.describe({...resolved,element:destination});if(!capability.canInsert)return refuse(capability.insertReason);
  for(let node=destination.node;node;node=node.parentNode)if(node===resolved.element.node)return refuse('A layer cannot contain itself.');
  if(destination.node===resolved.element.node.parentNode)return refuse('The layer is already in that container.');
  const ancestors=new Set();for(let node=resolved.element.node.parentNode;node;node=node.parentNode)ancestors.add(node);
  let common=destination.node;while(common&&!ancestors.has(common))common=common.parentNode;
  const parentId=resolved.elements.find(e=>e.node===common)?.id;if(!parentId)return refuse('The shared parent has no authored source identity.');
  const source=resolved.source,chunk=source.slice(range.start,range.end),offset=destination.location.endTag.startOffset,prefix='\n  ';
  const out=new MagicString(source);out.remove(range.start,range.end);out.appendLeft(offset,prefix+chunk+'\n');
  const after=out.toString(),elements=html.collect(after,resolved.relPath).elements;
  const movedStart=offset-(range.start<offset?range.end-range.start:0)+prefix.length;
  const moved=elements.find(e=>e.location.startOffset===movedStart),newParent=elements.find(e=>e.node===moved?.node.parentNode);
  if(elements.length!==resolved.elements.length||!moved||!newParent||newParent.tag!==destination.tag||moved.tag!==resolved.element.tag)return refuse('This move changes the parsed HTML structure.');
  return {ok:true,hash:html.contentHash(after),parentId,movedId:moved.id,destinationId:newParent.id,structural:true,edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
