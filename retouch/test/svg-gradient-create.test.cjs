'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),wrap=s=>kind==='react'?'export default()=>('+s+');':s,original=wrap('<svg><rect fill="red" width="40"/><circle r="10"/></svg>');
 const resolve=source=>{const relPath=kind==='react'?'page.jsx':kind==='html'?'index.html':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),file:'/tmp/'+relPath,hash:ids.contentHash(source)};};
 const create=(source,extra={})=>{const r=resolve(source);return adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'create',value:{type:'linearGradient',color:'#ff0000'},...extra});};
 test(kind+' creates fill/stroke gradients from solid paint without changing existing identities',()=>{
  for(const paint of ['fill','stroke'])for(const type of ['linearGradient','radialGradient']){const result=create(original,{paint,value:{type,color:'rgb(255, 0, 0)'}});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,r=resolve(after),g=adapter.describe(r).svgGradients[0];assert.equal(g.type,type);assert.equal(g.paint,paint);assert.deepEqual(g.stops,[{offset:'0',color:'rgb(255, 0, 0)',opacity:null},{offset:'1',color:'rgb(255, 0, 0)',opacity:'0'}]);assert.equal(r.element.id,resolve(original).element.id);assert.ok(after.includes('<circle r="10"/>'));assert.equal(create(after,{paint}).refused,true);}
 });
 test(kind+' creation rejects stale, dynamic, styled and invalid values',()=>{
  for(const extra of [{fileHash:'stale'},{paint:'color'},{stop:0},{changes:{x1:'0'}},{value:{type:'conicGradient',color:'red'}},{value:{type:'linearGradient',color:'red" onclick="x'}}])assert.equal(create(original,extra).refused,true);
  assert.equal(create(original.replace('fill="red"','style="fill:red"')).refused,true);assert.equal(create(original.replace('fill="red"','class="fill-red"')).refused,true);
 });
 test(kind+' creation preserves unrelated classes and distinguishes fill from stroke utilities',()=>{
  const name=kind==='react'?'className':'class',source=original.replace('<rect ','<rect '+name+'="layout-marker opacity-50 stroke-2" '),result=create(source);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(name+'="layout-marker opacity-50 stroke-2"'));
  for(const token of ['fill-red-500','md:fill-red-500','hover:!fill-current','[&:hover]:[fill:blue]']){const source=original.replace('<rect ','<rect '+name+'="'+token+'" ');assert.equal(create(source).refused,true);const stroke=create(source,{paint:'stroke'});assert.equal(stroke.ok,true,stroke.reason);}
 });
 test(kind+' creation appends into the nearest nested SVG and preserves siblings',()=>{const source=wrap('<svg><svg><rect/></svg><circle r="10"/></svg>'),result=create(source);assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/<\/defs><\/svg><circle/);});
}
