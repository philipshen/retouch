'use strict';
const deletion=require('./svg-delete.cjs');
function context(resolved){
 const el=resolved.element,parent=el.node.parentNode;
 if(!deletion.describe(resolved)||parent?.namespaceURI!=='http://www.w3.org/2000/svg'||!['svg','g'].includes(parent.tagName))return null;
 const siblings=(parent.childNodes||[]).filter(n=>n.tagName),index=siblings.indexOf(el.node);
 const neighbor=delta=>{const element=resolved.elements.find(e=>e.node===siblings[index+delta]);return element&&deletion.describe({...resolved,element})?element:null;};
 const movable=siblings.map((_,i)=>neighbor(i-index));
 const first=index>0&&movable.slice(0,index).every(Boolean)?movable[0]:null,last=index>=0&&index<siblings.length-1&&movable.slice(index+1).every(Boolean)?movable.at(-1):null;
 return {before:neighbor(-1),after:neighbor(1),first,last,movable,index};
}
function describe(resolved){const ctx=context(resolved);return ctx?{canMoveBefore:!!ctx.before,canMoveAfter:!!ctx.after,canMoveFirst:!!ctx.first,canMoveLast:!!ctx.last}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),ctx=context(resolved),other=ctx?.[op.direction];
 if(!['before','after','first','last'].includes(op.direction)||!other)return refuse('There is no movable SVG sibling in that direction.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const html=require('./adapters/html.cjs'),source=resolved.source;
 const target=ctx.movable.indexOf(other),lo=Math.min(ctx.index,target),hi=Math.max(ctx.index,target);
 const ordered=require('./source-order.cjs').reorder(source,ctx.movable.slice(lo,hi+1).map(e=>({start:e.location.startOffset,end:e.location.endOffset})),ctx.index-lo,target-lo),after=ordered.after;
 const next=html.collect(after,resolved.relPath).elements,mapped=new Map();
 for(const e of resolved.elements){
  const offset=ordered.offset(e.location.startOffset);
  const fresh=next.find(n=>n.location.startOffset===offset&&n.tag===e.tag&&n.node.namespaceURI===e.node.namespaceURI);
  if(!fresh)return refuse('The move would change the surrounding document structure.');mapped.set(e.node,fresh);
 }
 if(next.length!==resolved.elements.length||resolved.elements.some(e=>mapped.has(e.node.parentNode)&&mapped.get(e.node).node.parentNode!==mapped.get(e.node.parentNode).node))return refuse('The move would change the surrounding document structure.');
 return {ok:true,hash:html.contentHash(after),parentId:mapped.get(resolved.element.node.parentNode).id,movedId:mapped.get(resolved.element.node).id,structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
