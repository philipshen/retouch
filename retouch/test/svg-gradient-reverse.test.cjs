'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),color=kind==='react'?'stopColor':'stop-color',opacity=kind==='react'?'stopOpacity':'stop-opacity',wrap=s=>kind==='react'?'export default()=>('+s.replace('<!-- keep -->','{/* keep */}')+');':s;
 const original=wrap('<svg><defs><linearGradient id="paint" x2="80%"><stop offset="0" '+color+'="red"/><!-- keep --><stop offset="25%" '+color+'="green" '+opacity+'="0.3"/><stop offset="1" '+color+'="blue"/></linearGradient></defs><rect fill="url(#paint)"/><circle stroke="url(#paint)"/></svg>');
 const resolve=source=>{const relPath=kind==='react'?'page.jsx':kind==='html'?'index.html':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),file:'/tmp/'+relPath,hash:ids.contentHash(source)};};
 const reverse=(source,extra={})=>{const r=resolve(source);return adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'reverse',...extra});};
 const stops=source=>adapter.describe(resolve(source)).svgGradients[0].stops;
 test(kind+' reverse reflects asymmetric stop positions and preserves opacity, comments and geometry',()=>{
  for(const source of [original,original.replaceAll('linearGradient','radialGradient')]){const result=reverse(source);assert.equal(result.ok,true,result.reason);const after=result.edits[0].after;assert.deepEqual(stops(after),[{offset:'0',color:'blue',opacity:null},{offset:'75%',color:'green',opacity:'0.3'},{offset:'1',color:'red',opacity:null}]);assert.equal(resolve(after).element.id,resolve(source).element.id);assert.ok(after.includes('x2="80%"'));assert.ok(after.includes(kind==='react'?'{/* keep */}':'<!-- keep -->'));assert.equal(reverse(after).edits[0].after,source);}
 });
 test(kind+' reverse uses effective SVG positions for missing, clamped and decreasing offsets',()=>{
  const source=original.replace('offset="0"','').replace('offset="25%"','offset="80%"').replace('offset="1"','offset="0.3"'),r=reverse(source);assert.equal(r.ok,true,r.reason);assert.deepEqual(stops(r.edits[0].after).map(s=>s.offset),['0.2','20%','1']);
  const clamped=reverse(original.replace('offset="0"','offset="-1"').replace('offset="1"','offset="2"'));assert.equal(clamped.ok,true);assert.deepEqual(stops(clamped.edits[0].after).map(s=>s.offset),['0','75%','1']);
 });
 test(kind+' reverse refuses stale, mixed, inherited and invalid offset edits',()=>{
  for(const extra of [{fileHash:'stale'},{stop:0},{value:'x'},{changes:{x1:'0'}}])assert.equal(reverse(original,extra).refused,true);
  assert.equal(reverse(original.replace('offset="25%"','offset="bogus"')).refused,true);assert.equal(reverse(original.replace('id="paint"','id="paint" href="#other"')).refused,true);
 });
}
