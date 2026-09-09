'use strict';
const ids=require('./id.cjs'),deletion=require('./jsx-svg-delete.cjs');
function context(resolved){
 const cap=deletion.describe(resolved),parent=(resolved.elements||[]).find(e=>e.id===cap?.parentId);if(!parent||!['svg','g'].includes(ids.jsxElementName(parent.node)))return null;
 const siblings=parent.node.children.filter(n=>!(n.type==='JSXText'&&!n.value.trim())&&!(n.type==='JSXExpressionContainer'&&n.expression.type==='JSXEmptyExpression')),index=siblings.findIndex(n=>n.start===resolved.element.node.start);
 // Direct siblings share the already-validated SVG parent and expression boundary.
 const neighbor=delta=>{const node=siblings[index+delta],element=(resolved.elements||[]).find(e=>e.node.start===node?.start);return element&&deletion.supportsNode(element.node)?element:null;};
 const movable=siblings.map((_,i)=>neighbor(i-index));
 const first=index>0&&movable.slice(0,index).every(Boolean)?movable[0]:null,last=index>=0&&index<siblings.length-1&&movable.slice(index+1).every(Boolean)?movable.at(-1):null;
 return {parent,before:neighbor(-1),after:neighbor(1),first,last,movable,index};
}
function describe(resolved){const ctx=context(resolved);return ctx?{canMoveBefore:!!ctx.before,canMoveAfter:!!ctx.after,canMoveFirst:!!ctx.first,canMoveLast:!!ctx.last}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),ctx=context(resolved),other=ctx?.[op.direction];if(!['before','after','first','last'].includes(op.direction)||!other)return refuse('There is no movable SVG sibling in that direction.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const source=resolved.source,target=ctx.movable.indexOf(other),lo=Math.min(ctx.index,target),hi=Math.max(ctx.index,target);
 const ordered=require('./source-order.cjs').reorder(source,ctx.movable.slice(lo,hi+1).map(e=>({start:e.node.start,end:e.node.end})),ctx.index-lo,target-lo),after=ordered.after,next=ids.collectElements(after,resolved.relPath).elements,mapping=new Map();
 for(const e of resolved.elements){const offset=ordered.offset(e.node.start),fresh=next.find(n=>n.node.start===offset&&ids.jsxElementName(n.node)===ids.jsxElementName(e.node));if(!fresh)return refuse('The move would change surrounding JSX structure.');mapping.set(e.id,fresh.id);}
 const oldParents=deletion.parents(resolved.elements),newParents=deletion.parents(next);if(next.length!==resolved.elements.length||resolved.elements.some(e=>newParents.get(mapping.get(e.id))!==(mapping.get(oldParents.get(e.id))??null)))return refuse('The move would change surrounding JSX ancestry.');
 return {ok:true,hash:ids.contentHash(after),parentId:mapping.get(ctx.parent.id),movedId:mapping.get(resolved.element.id),structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
