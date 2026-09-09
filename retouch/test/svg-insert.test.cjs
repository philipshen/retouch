'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),insert=require('../src/svg-insert.cjs');
function resolve(source,tag){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(e=>e.tag===tag),hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html'};}
test('SVG insertion creates a selected shape in a new viewport without changing existing IDs',()=>{
 for(const preset of ['rectangle','circle','ellipse','line']){
  const r=resolve('<html><head></head><body><div>Before</div><p>After</p></body></html>','div'),result=insert.plan(r,{preset,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const fresh=resolve(result.edits[0].after,'div');assert.equal(fresh.elements.length,r.elements.length+2);assert.ok(r.elements.every(e=>fresh.elements.some(n=>n.id===e.id&&n.tag===e.tag)));
  const selected=fresh.elements.find(e=>e.id===result.createdId);assert.equal(selected.node.namespaceURI,'http://www.w3.org/2000/svg');assert.equal(selected.node.parentNode.tagName,'svg');assert.ok(fresh.source.includes('<p>After</p>'));
 }
});
test('SVG insertion fits a translated icon viewBox and supports explicit groups',()=>{
 for(const tag of ['svg','g']){
  const r=resolve('<html><head></head><body><svg viewBox="50 100 20 10"><g></g><path d="M0 0"/></svg></body></html>',tag),result=insert.plan(r,{preset:'rectangle',fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const fresh=resolve(result.edits[0].after,tag),created=fresh.elements.find(e=>e.id===result.createdId);assert.equal(created.node.parentNode.tagName,tag);assert.match(fresh.source,/<rect x="52" y="101" width="16" height="6"/);assert.equal(fresh.elements.length,r.elements.length+1);
 }
});
test('SVG insertion refuses stale hashes, template containers, implicit and non-container targets',()=>{
 for(const [source,tag]of [['<div v-for="a in b"></div>','div'],['<svg><g x-if="shown"></g></svg>','g'],['<svg/>','svg'],['<svg><rect/></svg>','rect'],['<p>Hello</p>','p']]){const r=resolve(source,tag);assert.equal(insert.describe(r),null);assert.equal(insert.plan(r,{preset:'circle',fileHash:r.hash}).refused,true);}
 const r=resolve('<div></div>','div');for(const op of [{preset:'circle',fileHash:'stale'},{preset:'script',fileHash:r.hash},{preset:'circle'}]){const result=insert.plan(r,op);assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});
