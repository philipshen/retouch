'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../shell/svg-parametric.js'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid'])test(kind+' arrow path conversion retains editable heads and source identity',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'page.jsx':kind==='html'?'index.html':'main.liquid',wrap=s=>kind==='react'?'export default()=>('+s+');':s;
 const resolve=source=>{const elements=adapter.collect(source,relPath).elements;return{source,relPath,file:'/tmp/'+relPath,elements,element:elements.find(e=>['polyline','path'].includes(kind==='react'?ids.jsxElementName(e.node):e.tag)),hash:ids.contentHash(source)};};
 for(const startArrow of [false,true])for(const endArrow of [false,true]){
  const points=model.generate({kind:'arrow',x1:20,y1:30,x2:120,y2:30,headLength:12,headWidth:16,startArrow,endArrow,startHeadLength:8,startHeadWidth:10}),source=wrap('<svg><polyline data-rt-shape="arrow" points="'+points+'" fill="none" stroke="black" stroke-dasharray="8 6" stroke-dashoffset="3" transform="translate(2 3)"><title>Flow</title></polyline><circle r="5"/></svg>'),r=resolve(source),result=adapter.planOp(r,{type:'convertSVGToPath',fileHash:r.hash});
  assert.equal(result.ok,true,result.reason);const next=resolve(result.edits[0].after),description=adapter.describe(next).svgGeometry;
  assert.equal(next.element.id,r.element.id);assert.equal(model.pointsFromPath(description.fields[0].value),points);assert.ok(next.source.includes('<title>Flow</title>'));assert.ok(next.source.includes('transform="translate(2 3)"'));assert.ok(next.source.includes('<circle r="5"/>'));assert.ok(next.source.includes('stroke-dasharray="8 6" stroke-dashoffset="3"'));
  const changed=model.changeArrow(points,{endArrow:true,headWidth:20}),d=model.arrowPath(changed),edited=adapter.planOp(next,{type:'setSVGGeometry',property:'d',value:d,fileHash:next.hash});assert.equal(edited.ok,true,edited.reason);assert.equal(adapter.describe(resolve(edited.edits[0].after)).svgGeometry.parametric.headWidth,20);
  const filled=resolve(source.replace('fill="none"','fill="red"'));assert.equal(adapter.planOp(filled,{type:'convertSVGToPath',fileHash:filled.hash}).refused,true);
 }
});
test('Arrow path recognition refuses curves, closed heads and extra subpaths',()=>{
 for(const d of ['M0 0C10 10 20 20 100 0','M0 0L100 0 M80 10L100 0L80 -10Z','M0 0L100 0 M80 10L100 0L80 -10 M1 1L2 2'])assert.equal(model.pointsFromPath(d),null);
});
