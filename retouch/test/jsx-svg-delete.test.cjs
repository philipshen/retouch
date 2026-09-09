'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),react=require('../src/adapters/react.cjs');
function resolve(source,tag='rect'){const elements=ids.collectElements(source,'app/page.jsx').elements;return {source,elements,element:elements.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(source),relPath:'app/page.jsx',file:'/tmp/page.jsx'};}
test('React SVG deletion removes exact child/group/canvas spans despite dynamic sibling attributes',()=>{
 const source='export default()=> <main><svg viewBox="0 0 100 100"><rect x={offset} fill="red"/><g>{visible && <circle r={10}/>}</g><line x2={width}/></svg><p>After</p></main>';
 for(const tag of ['rect','g','svg']){const r=resolve(source,tag),result=react.planOp(r,{type:'deleteElement',fileHash:r.hash});assert.equal(react.describe(r).structure.canDelete,true);assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.slice(0,r.element.node.start)+source.slice(r.element.node.end));const after=ids.collectElements(result.edits[0].after,r.relPath).elements;assert.ok(after.some(e=>e.id===result.parentId));assert.ok(result.edits[0].after.includes('<p>After</p>'));}
});
test('React SVG deletion rejects component roots and expression-controlled selections',()=>{
 for(const [source,tag]of [['export default()=> <svg></svg>','svg'],['export default()=> <svg>{visible && <rect/>}</svg>','rect'],['export default()=> <svg>{items.map(x=><g><rect/></g>)}</svg>','rect'],['export default()=> <svg><foreignObject><rect/></foreignObject></svg>','rect']])assert.equal(react.describe(resolve(source,tag)).svgDeletion,null);
 const r=resolve('export default()=> <svg><rect/></svg>');for(const fileHash of [undefined,'stale']){const result=react.planOp(r,{type:'deleteElement',fileHash});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});
