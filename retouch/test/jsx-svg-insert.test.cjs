'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),react=require('../src/adapters/react.cjs');
function resolve(source,tag='svg'){const elements=ids.collectElements(source,'app/page.jsx').elements;return {source,elements,element:elements.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(source),relPath:'app/page.jsx',file:'/tmp/page.jsx'};}
test('JSX SVG insertion supports preset and drawn geometry without changing existing IDs',()=>{
 const source='export default()=> <main><svg viewBox={"50 100 200 100"}><g transform="translate(10 20)">{shown && <path d="M0 0"/>}</g></svg><p>After</p></main>';
 for(const tag of ['svg','g'])for(const preset of ['rectangle','circle','ellipse','line'])for(const points of [undefined,[10,20,60,70]]){
  const r=resolve(source,tag),result=react.planOp(r,{type:'insertSVG',preset,points,fileHash:r.hash});assert.equal(result.ok,true,result.reason);const next=resolve(result.edits[0].after,tag);assert.equal(next.elements.length,r.elements.length+1);assert.ok(r.elements.every(e=>next.elements.some(n=>n.id===e.id)));assert.ok(next.elements.some(e=>e.id===result.createdId));assert.ok(next.source.includes('{shown && <path d="M0 0"/>}'));assert.ok(next.source.includes('<p>After</p>'));
  if(preset==='line'){assert.ok(next.source.includes('strokeWidth='));assert.ok(!next.source.includes('stroke-width='));}
  if(preset==='rectangle')assert.ok(next.source.includes(points?'<rect x="10" y="20" width="50" height="50"':'<rect x="70" y="110" width="160" height="60"'));
 }
});
test('JSX SVG insertion refuses unsupported containers, controlled children and invalid draws',()=>{
 for(const [source,tag]of [['<svg/>','svg'],['<div></div>','div'],['<svg {...props}></svg>','svg'],['<svg children={content}></svg>','svg'],['<svg dangerouslySetInnerHTML={html}></svg>','svg'],['<svg><foreignObject><g></g></foreignObject></svg>','g']]){const r=resolve('export default()=> '+source,tag);assert.equal(react.describe(r).svgInsertion,null);assert.equal(react.planOp(r,{type:'insertSVG',preset:'rectangle',fileHash:r.hash}).refused,true);}
 const r=resolve('export default()=> <svg></svg>');for(const op of [{preset:'script',fileHash:r.hash},{preset:'circle'},{preset:'circle',fileHash:'stale'},{preset:'rectangle',fileHash:r.hash,points:[0,0,0,0]},{preset:'line',fileHash:r.hash,points:[0,0,Infinity,1]}]){const result=react.planOp(r,{type:'insertSVG',...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});
