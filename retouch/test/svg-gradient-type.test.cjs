'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),wrap=s=>kind==='react'?'export default()=>('+s+');':s;
 const original=wrap('<svg><defs><linearGradient id="paint" x1="12%" x2="80%" cx="30%" gradientUnits="userSpaceOnUse" gradientTransform="rotate(12)" spreadMethod="reflect"><stop offset="0" '+(kind==='react'?'stopColor':'stop-color')+'="red"/><!-- keep --><stop offset="1"/></linearGradient></defs><rect fill="url(#paint)"/><circle stroke="url(#paint)"/></svg>').replace('<!-- keep -->',kind==='react'?'{/* keep */}':'<!-- keep -->');
 const resolve=source=>{const relPath=kind==='react'?'page.jsx':kind==='html'?'index.html':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),file:'/tmp/'+relPath,hash:ids.contentHash(source)};};
 const change=(source,value,extra={})=>{const r=resolve(source);return adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'setType',value,...extra});};
 test(kind+' gradient type retains stops, shared references and reversible coordinates',()=>{
  const r=change(original,'radialGradient');assert.equal(r.ok,true,r.reason);const after=r.edits[0].after;assert.equal(after,original.replaceAll('linearGradient','radialGradient'));
  const fresh=resolve(after);assert.equal(adapter.describe(fresh).svgGradients[0].type,'radialGradient');assert.equal(fresh.element.id,resolve(original).element.id);
  const back=change(after,'linearGradient');assert.equal(back.ok,true,back.reason);assert.equal(back.edits[0].after,original);
  assert.deepEqual(change(original,'linearGradient').edits,[]);
 });
 test(kind+' gradient type rejects stale, mixed and unsupported operations',()=>{
  for(const [value,extra]of [['conicGradient',{}],['radialGradient',{fileHash:'stale'}],['radialGradient',{stop:0}],['radialGradient',{changes:{x1:'0'}}]])assert.equal(change(original,value,extra).refused,true);
  assert.equal(change(original.replace('id="paint"','id="paint" href="#other"'),'radialGradient').refused,true);
 });
}
