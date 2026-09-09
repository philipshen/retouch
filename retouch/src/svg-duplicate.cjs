'use strict';
const deletion=require('./svg-delete.cjs'),css=require('./html-css.cjs');
function describe(resolved){
 if(!deletion.describe(resolved))return null;
 const known=new Set(resolved.elements.map(e=>e.node));
 function complete(node){return !node.tagName||known.has(node)&&!(node.attrs||[]).some(a=>['id','key','ref','v-for','v-if','x-for','x-if'].includes(a.name))&&(node.childNodes||[]).every(complete);}
 if(!complete(resolved.element.node))return null;
 try{css.clone(resolved,{start:resolved.element.location.startOffset,end:resolved.element.location.endOffset});}catch{return null;}
 return {canDuplicate:true,canCopy:false};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 if(!describe(resolved))return refuse('Choose a complete SVG layer without authored IDs, template content or unsupported descendants.');
 try{
  const html=require('./adapters/html.cjs'),{startOffset:start,endOffset:end}=resolved.element.location;
  const copy=css.clone(resolved,{start,end}),source=resolved.source;
  const inserted=source.slice(0,end)+copy.chunk+source.slice(end),next=html.collect(inserted,resolved.relPath).elements;
  const originals=resolved.elements.filter(e=>e.location.startOffset>=start&&e.location.startOffset<end),mapped=new Map();
  for(const e of resolved.elements){const offset=e.location.startOffset+(e.location.startOffset>=end?copy.chunk.length:0),fresh=next.find(n=>n.location.startOffset===offset&&n.tag===e.tag&&n.node.namespaceURI===e.node.namespaceURI);if(!fresh)return refuse('The copy would change the surrounding document structure.');mapped.set(e.node,fresh);}
  const copies=next.filter(e=>e.location.startOffset>=end&&e.location.startOffset<end+copy.chunk.length),created=copies[0];
  if(next.length!==resolved.elements.length+originals.length||copies.length!==originals.length||!created||created.node.parentNode!==mapped.get(resolved.element.node.parentNode)?.node||originals.some((e,i)=>e.tag!==copies[i].tag||e.node.namespaceURI!==copies[i].node.namespaceURI)||resolved.elements.some(e=>mapped.has(e.node.parentNode)&&mapped.get(e.node).node.parentNode!==mapped.get(e.node.parentNode).node))return refuse('The copied SVG structure could not be preserved.');
  for(let i=1;i<originals.length;i++){const parentIndex=originals.findIndex(e=>e.node===originals[i].node.parentNode);if(parentIndex<0||copies[i].node.parentNode!==copies[parentIndex].node)return refuse('The copied SVG nesting changed.');}
  const after=copy.append(inserted),final=html.collect(after,resolved.relPath).elements;
  if(final.length!==next.length||next.some((e,i)=>e.id!==final[i].id||e.tag!==final[i].tag))return refuse('The copied styles would change document identities.');
  return {ok:true,hash:html.contentHash(after),parentId:mapped.get(resolved.element.node.parentNode).id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
