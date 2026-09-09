'use strict';
const deletion=require('./svg-delete.cjs');
function context(resolved){
 const el=resolved.element,parent=el.node.parentNode;
 if(!deletion.describe(resolved)||parent?.namespaceURI!=='http://www.w3.org/2000/svg'||!['svg','g'].includes(parent.tagName))return null;
 const siblings=(parent.childNodes||[]).filter(n=>n.tagName),index=siblings.indexOf(el.node);
 const neighbor=delta=>{const element=resolved.elements.find(e=>e.node===siblings[index+delta]);return element&&deletion.describe({...resolved,element})?element:null;};
 return {before:neighbor(-1),after:neighbor(1)};
}
function describe(resolved){const ctx=context(resolved);return ctx?{canMoveBefore:!!ctx.before,canMoveAfter:!!ctx.after}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),ctx=context(resolved),other=ctx?.[op.direction];
 if(!['before','after'].includes(op.direction)||!other)return refuse('There is no movable SVG sibling in that direction.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const html=require('./adapters/html.cjs'),source=resolved.source;
 const [a,b]=[resolved.element,other].sort((a,b)=>a.location.startOffset-b.location.startOffset).map(e=>e.location);
 if(a.endOffset>b.startOffset)return refuse('The SVG siblings overlap in source.');
 const lenA=a.endOffset-a.startOffset,lenB=b.endOffset-b.startOffset,gap=b.startOffset-a.endOffset;
 const after=source.slice(0,a.startOffset)+source.slice(b.startOffset,b.endOffset)+source.slice(a.endOffset,b.startOffset)+source.slice(a.startOffset,a.endOffset)+source.slice(b.endOffset);
 const next=html.collect(after,resolved.relPath).elements,mapped=new Map();
 for(const e of resolved.elements){
  const old=e.location.startOffset,offset=old>=a.startOffset&&old<a.endOffset?old+lenB+gap:old>=b.startOffset&&old<b.endOffset?old-(lenA+gap):old>=a.endOffset&&old<b.startOffset?old+lenB-lenA:old;
  const fresh=next.find(n=>n.location.startOffset===offset&&n.tag===e.tag&&n.node.namespaceURI===e.node.namespaceURI);
  if(!fresh)return refuse('The move would change the surrounding document structure.');mapped.set(e.node,fresh);
 }
 if(next.length!==resolved.elements.length||resolved.elements.some(e=>mapped.has(e.node.parentNode)&&mapped.get(e.node).node.parentNode!==mapped.get(e.node.parentNode).node))return refuse('The move would change the surrounding document structure.');
 return {ok:true,hash:html.contentHash(after),parentId:mapped.get(resolved.element.node.parentNode).id,movedId:mapped.get(resolved.element.node).id,structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
