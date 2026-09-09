'use strict';
const ids=require('./id.cjs'),deletion=require('./jsx-svg-delete.cjs');
function context(resolved){
 const cap=deletion.describe(resolved),parent=(resolved.elements||[]).find(e=>e.id===cap?.parentId);if(!parent||!['svg','g'].includes(ids.jsxElementName(parent.node)))return null;
 const siblings=parent.node.children.filter(n=>!(n.type==='JSXText'&&!n.value.trim())&&!(n.type==='JSXExpressionContainer'&&n.expression.type==='JSXEmptyExpression')),index=siblings.findIndex(n=>n.start===resolved.element.node.start);
 const neighbor=delta=>{const node=siblings[index+delta],element=(resolved.elements||[]).find(e=>e.node.start===node?.start);return element&&deletion.describe({...resolved,element})?element:null;};
 return {parent,before:neighbor(-1),after:neighbor(1)};
}
function describe(resolved){const ctx=context(resolved);return ctx?{canMoveBefore:!!ctx.before,canMoveAfter:!!ctx.after}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),ctx=context(resolved),other=ctx?.[op.direction];if(!['before','after'].includes(op.direction)||!other)return refuse('There is no movable SVG sibling in that direction.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const source=resolved.source,[a,b]=[resolved.element.node,other.node].sort((a,b)=>a.start-b.start),lenA=a.end-a.start,lenB=b.end-b.start,gap=b.start-a.end;
 const after=source.slice(0,a.start)+source.slice(b.start,b.end)+source.slice(a.end,b.start)+source.slice(a.start,a.end)+source.slice(b.end),next=ids.collectElements(after,resolved.relPath).elements,mapping=new Map();
 for(const e of resolved.elements){const old=e.node.start,offset=old>=a.start&&old<a.end?old+lenB+gap:old>=b.start&&old<b.end?old-lenA-gap:old>=a.end&&old<b.start?old+lenB-lenA:old,fresh=next.find(n=>n.node.start===offset&&ids.jsxElementName(n.node)===ids.jsxElementName(e.node));if(!fresh)return refuse('The move would change surrounding JSX structure.');mapping.set(e.id,fresh.id);}
 const oldParents=deletion.parents(resolved.elements),newParents=deletion.parents(next);if(next.length!==resolved.elements.length||resolved.elements.some(e=>newParents.get(mapping.get(e.id))!==(mapping.get(oldParents.get(e.id))??null)))return refuse('The move would change surrounding JSX ancestry.');
 return {ok:true,hash:ids.contentHash(after),parentId:mapping.get(ctx.parent.id),movedId:mapping.get(resolved.element.id),structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
