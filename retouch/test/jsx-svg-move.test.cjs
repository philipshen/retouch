'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),react=require('../src/adapters/react.cjs');
function resolve(source,tag='rect'){const elements=ids.collectElements(source,'app/page.jsx').elements;return {source,elements,element:elements.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(source),relPath:'app/page.jsx',file:'/tmp/page.jsx'};}
test('React SVG stacking swaps exact sibling subtrees and retains comments and dynamic attributes',()=>{
 const a='<rect width={size} fill="red"/>',gap='\n{/* stacking */}\n',b='<g transform={matrix}><circle r={10}/></g>',source='export default()=> <svg>'+a+gap+b+'<line/></svg>';
 for(const [tag,direction]of [['rect','after'],['g','before']]){const r=resolve(source,tag),result=react.planOp(r,{type:'moveElement',direction,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace(a+gap+b,b+gap+a));const fresh=ids.collectElements(result.edits[0].after,r.relPath).elements;assert.equal(fresh.length,r.elements.length);assert.equal(ids.jsxElementName(fresh.find(e=>e.id===result.movedId).node),tag);assert.equal(ids.jsxElementName(fresh.find(e=>e.id===result.parentId).node),'svg');}
});
test('React SVG stacking refuses expression/component boundaries, edge moves and stale hashes',()=>{
 for(const middle of ['{visible && <circle/>}','<Icon/>','<defs></defs>','text']){const r=resolve('export default()=> <svg><rect/>'+middle+'<line/></svg>');assert.equal(react.describe(r).structure.canMoveAfter,false);assert.equal(react.planOp(r,{type:'moveElement',direction:'after',fileHash:r.hash}).refused,true);}
 const r=resolve('export default()=> <svg><rect/><circle/></svg>');for(const op of [{direction:'before',fileHash:r.hash},{direction:'last',fileHash:r.hash},{direction:'after'},{direction:'after',fileHash:'stale'}]){const result=react.planOp(r,{type:'moveElement',...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 assert.equal(react.describe(resolve('export default()=> <svg>{items.map(x=><g><rect/><circle/></g>)}</svg>')).svgMovement,null);
});
