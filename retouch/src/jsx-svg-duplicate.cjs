'use strict';
const ids=require('./id.cjs'),deletion=require('./jsx-svg-delete.cjs'),{literal}=require('./jsx-svg-geometry.cjs');
const tags=new Set(['svg','g','rect','circle','ellipse','line','path','polyline','polygon']);
function describe(resolved){
 if(!deletion.describe(resolved))return null;
 function complete(node){
  if(node.type==='JSXText'||node.type==='JSXExpressionContainer'&&node.expression.type==='JSXEmptyExpression')return true;
  return node.type==='JSXElement'&&tags.has(ids.jsxElementName(node))&&node.openingElement.attributes.every(a=>a.type==='JSXAttribute'&&!['id','key','ref','dangerouslySetInnerHTML'].includes(a.name.name)&&literal(a)!==undefined)&&node.children.every(complete);
 }
 return complete(resolved.element.node)?{canDuplicate:true,canCopy:false}:null;
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});if(!describe(resolved))return refuse('Choose a literal SVG subtree without authored IDs, refs, spreads or dynamic expressions.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const source=resolved.source,{start,end}=resolved.element.node,chunk=source.slice(start,end),after=source.slice(0,end)+chunk+source.slice(end),next=ids.collectElements(after,resolved.relPath).elements,mapping=new Map(),before=resolved.elements,originals=before.filter(e=>e.node.start>=start&&e.node.start<end),copies=next.filter(e=>e.node.start>=end&&e.node.start<end+chunk.length);
 for(const old of before){const offset=old.node.start+(old.node.start>=end?chunk.length:0),fresh=next.find(e=>e.node.start===offset&&ids.jsxElementName(e.node)===ids.jsxElementName(old.node));if(!fresh)return refuse('The copy would change surrounding JSX structure.');mapping.set(old.id,fresh.id);}
 const oldParents=deletion.parents(before),newParents=deletion.parents(next),copyMapping=new Map(originals.map((e,i)=>[e.id,copies[i]?.id]));
 if(next.length!==before.length+originals.length||copies.length!==originals.length||before.some(e=>newParents.get(mapping.get(e.id))!==(mapping.get(oldParents.get(e.id))??null))||originals.some((e,i)=>ids.jsxElementName(e.node)!==ids.jsxElementName(copies[i].node)||newParents.get(copies[i].id)!==(copyMapping.get(oldParents.get(e.id))??mapping.get(oldParents.get(e.id))??null)))return refuse('The copied SVG ancestry could not be preserved.');
 return {ok:true,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),hash:ids.contentHash(after),parentId:mapping.get(oldParents.get(resolved.element.id)),createdId:copies[0].id,structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
