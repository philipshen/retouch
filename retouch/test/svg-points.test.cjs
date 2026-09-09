'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),points=require('../shell/svg-points.js'),html=require('../src/adapters/html.cjs'),react=require('../src/adapters/react.cjs'),ids=require('../src/id.cjs');
test('SVG point lists parse numbers and exponents without accepting attribute injection or incomplete pairs',()=>{
  assert.deepEqual(points.parse(' -1.5,2e1  .5,-4E-2 '),[{x:-1.5,y:20},{x:.5,y:-.04}]);
  for(const value of ['',null,'1,2,3','1,,2','1,2,','NaN 2','1e999 2','100001 2','1px 2','1 2" onload="x','1 2;3 4','1 2 '.repeat(513)])assert.equal(points.parse(value),null,String(value).slice(0,50));
  assert.equal(points.format([{x:1.00000001,y:-0},{x:3.5,y:-2.125}]),'1.00000001,0 3.5,-2.125');
});
for(const kind of ['html','react'])test(kind+' polygon/polyline edits preserve source identity and reject dynamic, stale or injected points',()=>{
  for(const tag of ['polygon','polyline']){
    const source=kind==='html'?'<html><body><svg><'+tag+' points="0,0 30,0 20,40" fill="red"/></svg><p>Keep</p></body></html>':'export default()=> <svg><'+tag+' points={"0,0 30,0 20,40"} fill="red"/></svg>;',adapter=kind==='html'?html:react;
    const elements=kind==='html'?html.collect(source,'index.html').elements:ids.collectElements(source,'page.jsx').elements;
    const r={source,elements,element:elements.find(e=>(kind==='html'?e.tag:ids.jsxElementName(e.node))===tag),hash:adapter.contentHash?adapter.contentHash(source):ids.contentHash(source),file:kind==='html'?'/tmp/index.html':'/tmp/page.jsx',relPath:kind==='html'?'index.html':'page.jsx'};
    const op={type:'setSVGGeometry',property:'points',value:'-10,5 30,0 20,40',fileHash:r.hash};
    const result=adapter.planOp(r,op);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes('points="-10,5 30,0 20,40"'));assert.ok(result.edits[0].after.includes('fill="red"'));const next=kind==='html'?html.collect(result.edits[0].after,r.relPath).elements:ids.collectElements(result.edits[0].after,r.relPath).elements;assert.deepEqual(next.map(e=>e.id),elements.map(e=>e.id));
    for(const invalid of [{value:'1,2,3'},{value:'1 2" onclick="x'},{fileHash:'stale'}])assert.equal(adapter.planOp(r,{...op,...invalid}).refused,true);
    if(kind==='react'){
      const dynamic=source.replace('{"0,0 30,0 20,40"}','{vertices}'),items=ids.collectElements(dynamic,'page.jsx').elements;
      const resolved={...r,source:dynamic,elements:items,element:items.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(dynamic)};
      assert.equal(adapter.planOp(resolved,{...op,fileHash:resolved.hash}).refused,true);
    }
  }
});
