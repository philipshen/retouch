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
 for(const [source,tag]of [['<p>Hello</p>','p'],['<div {...props}/>','div'],['<svg><main/></svg>','main'],['<svg {...props}></svg>','svg'],['<svg children={content}></svg>','svg'],['<svg dangerouslySetInnerHTML={html}></svg>','svg'],['<svg><foreignObject><g></g></foreignObject></svg>','g']]){const r=resolve('export default()=> '+source,tag);assert.equal(react.describe(r).svgInsertion,null);assert.equal(react.planOp(r,{type:'insertSVG',preset:'rectangle',fileHash:r.hash}).refused,true);}
 const r=resolve('export default()=> <svg></svg>');for(const op of [{preset:'script',fileHash:r.hash},{preset:'circle'},{preset:'circle',fileHash:'stale'},{preset:'rectangle',fileHash:r.hash,points:[0,0,0,0]},{preset:'line',fileHash:r.hash,points:[0,0,Infinity,1]}]){const result=react.planOp(r,{type:'insertSVG',...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});

test('JSX pen insertion preserves surrounding IDs and emits JSX stroke attributes',()=>{
 const r=resolve('export default()=> <svg><g></g><circle r="5"/></svg>','g');
 for(const preset of ['polygon','polyline']){
  const result=react.planOp(r,{type:'insertSVG',preset,fileHash:r.hash,points:[10,20,60,30,40,80]});assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/points="10,20 60,30 40,80"/);assert.match(result.edits[0].after,/strokeWidth="2"/);const next=resolve(result.edits[0].after,'g');assert.ok(r.elements.every(e=>next.elements.some(n=>n.id===e.id)));assert.equal(ids.jsxElementName(next.elements.find(e=>e.id===result.createdId).node),preset);
  for(const points of [undefined,[1,2,3],[1,2,1,2,1,2],[1,2,3,4,NaN,5]])assert.equal(react.planOp(r,{type:'insertSVG',preset,fileHash:r.hash,points}).refused,true);
 }
});

test('JSX shapes create viewports and expand self-closing containers without changing expressions or IDs',()=>{
 for(const markup of ['<main/>','<main>{title}<Widget /></main>','<svg/>','<svg><g /></svg>'])for(const preset of ['rectangle','circle','ellipse','line']){
  const tag=markup.includes('<main')?'main':markup.includes('<g')?'g':'svg',source='export default()=> <>'+markup+'<aside>Keep</aside></>',r=resolve(source,tag),result=react.planOp(r,{type:'insertSVG',preset,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const next=resolve(result.edits[0].after,tag),created=next.elements.find(e=>e.id===result.createdId),canvas=next.elements.find(e=>ids.jsxElementName(e.node)==='svg');
  assert.equal(next.elements.length,r.elements.length+(tag==='main'?2:1));assert.ok(r.elements.every(e=>next.elements.some(n=>n.id===e.id)));assert.ok(next.source.includes('<aside>Keep</aside>'));assert.equal(result.parentId,r.element.id);
  if(tag==='main'){assert.ok(canvas.node.children.includes(created.node));assert.match(next.source,/viewBox="0 0 200 200"/);if(markup.includes('{title}'))assert.ok(next.source.includes('{title}<Widget />'));assert.equal(react.describe(r).svgInsertion.createsViewport,true);for(const op of [{preset:'rectangle',points:[0,0,10,10]},{preset:'path',nodes:[{x:0,y:0},{x:10,y:10}]}])assert.equal(react.planOp(r,{type:'insertSVG',fileHash:r.hash,...op}).refused,true);}
  else assert.equal(react.describe(r).svgInsertion.createsViewport,false);
 }
});

test('A JSX viewport created inside foreignObject uses its own coordinates',()=>{
 const r=resolve('export default()=> <svg viewBox="50 100 400 300"><foreignObject><main /></foreignObject></svg>','main'),result=react.planOp(r,{type:'insertSVG',preset:'rectangle',fileHash:r.hash});assert.equal(result.ok,true,result.reason);
 assert.match(result.edits[0].after,/<main ><svg width="200" height="200" viewBox="0 0 200 200" aria-label="Shapes"><rect x="20" y="20" width="160" height="120"/);
});
