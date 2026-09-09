'use strict';
const namespace='http://www.w3.org/2000/svg';
function describe(resolved){
 const el=resolved.element,loc=el.location;
 if(el.node.namespaceURI!==namespace||!loc.startTag||!Number.isInteger(loc.endOffset))return null;
 const closed=loc.endTag||/\/\s*>$/.test(resolved.source.slice(loc.startTag.startOffset,loc.startTag.endOffset));
 if(!closed)return null;
 for(let node=el.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))return null;
 const parent=resolved.elements?.find(e=>e.node===el.node.parentNode);
 if(!parent)return null;
 return {canDelete:true,parentId:parent.id};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);
 if(!cap)return refuse('Select a complete SVG layer inside an editable parent.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const html=require('./adapters/html.cjs'),{startOffset:start,endOffset:end}=resolved.element.location;
 const after=resolved.source.slice(0,start)+resolved.source.slice(end),next=html.collect(after,resolved.relPath).elements;
 const retained=resolved.elements.filter(e=>e.location.startOffset<start||e.location.startOffset>=end),mapped=new Map();
 for(const e of retained){const offset=e.location.startOffset-(e.location.startOffset>=end?end-start:0),fresh=next.find(n=>n.location.startOffset===offset&&n.tag===e.tag&&n.node.namespaceURI===e.node.namespaceURI);if(!fresh)return refuse('The deletion would change the surrounding document structure.');mapped.set(e.node,fresh);}
 if(next.length!==retained.length||retained.some(e=>mapped.has(e.node.parentNode)&&mapped.get(e.node).node.parentNode!==mapped.get(e.node.parentNode).node))return refuse('The deletion would change the surrounding document structure.');
 const parent=mapped.get(resolved.element.node.parentNode);
 return {ok:true,hash:html.contentHash(after),parentId:parent.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
