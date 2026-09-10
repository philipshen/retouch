'use strict';
const ids=require('./id.cjs'),traverse=require('@babel/traverse').default;
const tags=new Set(['svg','g','rect','circle','ellipse','line','path','polyline','polygon']);
function supportsNode(node){return tags.has(ids.jsxElementName(node));}
function describe(resolved){
 const node=resolved.element.node,tag=ids.jsxElementName(node);if(!supportsNode(node))return null;
 let target;traverse(ids.parseSource(resolved.source),{JSXElement(p){if(p.node.start===node.start){target=p;p.stop();}}});
 if(!target||target.parent.type!=='JSXElement')return null;
 let boundary=tag==='svg'?'svg':null;
 for(let p=target.parentPath;p;p=p.parentPath){if(p.type==='JSXExpressionContainer')return null;if(!boundary&&p.type==='JSXElement'&&['svg','foreignObject'].includes(ids.jsxElementName(p.node)))boundary=ids.jsxElementName(p.node);}
 if(boundary!=='svg')return null;
 const parent=(resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements).find(e=>e.node.start===target.parent.start);if(!parent)return null;
 return {canDelete:true,parentId:parent.id};
}
function parents(elements){const result=new Map(),stack=[];for(const e of elements){while(stack.length&&stack.at(-1).node.end<=e.node.start)stack.pop();result.set(e.id,stack.at(-1)?.id??null);stack.push(e);}return result;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);if(!cap)return refuse('Select an SVG child outside a rendered expression.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const {start,end}=resolved.element.node,after=resolved.source.slice(0,start)+resolved.source.slice(end),before=resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements,next=ids.collectElements(after,resolved.relPath).elements,retained=before.filter(e=>e.node.start<start||e.node.start>=end),mapping=new Map();
 for(const old of retained){const offset=old.node.start-(old.node.start>=end?end-start:0),fresh=next.find(e=>e.node.start===offset&&ids.jsxElementName(e.node)===ids.jsxElementName(old.node));if(!fresh)return refuse('The deletion would change surrounding JSX structure.');mapping.set(old.id,fresh.id);}
 const oldParents=parents(before),newParents=parents(next);if(next.length!==retained.length||retained.some(e=>newParents.get(mapping.get(e.id))!==(mapping.get(oldParents.get(e.id))??null)))return refuse('The deletion would change surrounding JSX ancestry.');
 return {ok:true,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:before.filter(e=>e.node.start>=start&&e.node.start<end).map(e=>e.id),hash:ids.contentHash(after),parentId:mapping.get(cap.parentId),structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan,parents,supportsNode};
