'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),geometry=require('../src/svg-geometry.cjs');
const source='<html><head></head><body><svg viewBox="0 0 200 100"><g><rect x="5" width="40" height="20"/><circle cx="100" cy="50" r="10"/><ellipse rx="10" ry="5"/><line x1="0" y1="0" x2="10" y2="20"/></g><defs><circle id="definition" r="3"/></defs></svg><p>After</p></body></html>';
function resolve(text=source,tag='rect'){const elements=html.collect(text,'index.html').elements;return {source:text,elements,element:elements.find(e=>e.tag===tag),hash:html.contentHash(text),file:'/tmp/index.html',relPath:'index.html'};}
test('Inline SVG shapes receive stable source identities and served stamps without indexing definitions',()=>{
 const r=resolve();assert.deepEqual(r.elements.filter(e=>e.node.namespaceURI==='http://www.w3.org/2000/svg').map(e=>e.tag),['svg','g','rect','circle','ellipse','line']);
 const stamped=html.stamp(source,'/tmp/index.html','/tmp').code;assert.match(stamped,/<rect data-rt="[a-f0-9]{10}"/);assert.ok(stamped.includes('<circle id="definition" r="3"/>'));assert.equal(html.describe(r).textDynamic,true);
 const without=resolve(source.replace(/<svg[\s\S]*<\/svg>/,'<svg></svg>'));assert.equal(r.elements.find(e=>e.tag==='p').id,without.elements.find(e=>e.tag==='p').id);
});
test('SVG geometry edits and resets preserve the rest of the document and source IDs',()=>{
 for(const [tag,property,value]of [['rect','width','75'],['circle','r','20%'],['ellipse','rx','12px'],['line','x1','-10']]){
  const r=resolve(source,tag),result=geometry.plan(r,{property,value,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);const fresh=resolve(result.edits[0].after,tag);assert.deepEqual(fresh.elements.map(e=>e.id),r.elements.map(e=>e.id));assert.equal(geometry.describe(fresh.element).fields.find(f=>f.name===property).value,value);assert.ok(fresh.source.includes('<p>After</p>'));
  const reset=geometry.plan(fresh,{property,value:null,fileHash:fresh.hash});assert.equal(reset.ok,true);assert.equal(geometry.describe(resolve(reset.edits[0].after,tag).element).fields.find(f=>f.name===property).value,null);
 }
});
test('SVG geometry refuses stale, unsupported, negative sizes and injected values atomically',()=>{
 const r=resolve();for(const op of [{property:'width',value:'-1'},{property:'onclick',value:'1'},{property:'width',value:'1" onload="x'},{property:'width',value:'calc(1)'},{property:'width',value:'100001'},{property:'width',value:'10',fileHash:'stale'}]){const result=geometry.plan(r,{fileHash:r.hash,...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});
