'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
function resolve(source,tag){const elements=html.collect(source,'index.html').elements;return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),elements,element:elements.find(e=>e.tag===tag)};}
test('HTML reparenting moves a complete styled subtree to earlier or later containers',()=>{
 for(const inside of ['<section><h1>Title</h1></section><aside></aside>','<aside></aside><section><h1>Title</h1></section>']){
  let source='<html><head></head><body><main>'+inside+'</main></body></html>';
  source=css.plan(resolve(source,'h1'),{width:768,property:'width',value:'240px'}).edits[0].after;
  const resolved=resolve(source,'h1'),destination=resolved.elements.find(e=>e.tag==='aside');
  const result=html.planOp(resolved,{type:'reparentElement',destinationId:destination.id});assert.equal(result.ok,true);
  const fresh=resolve(result.edits[0].after,'h1');assert.equal(fresh.element.node.parentNode.tagName,'aside');assert.equal(result.movedId,fresh.element.id);
  assert.equal(fresh.elements.find(e=>e.id===result.parentId).tag,'main');assert.deepEqual(css.describe(fresh).cssRules,{768:{width:'240px'}});
 }
});
test('HTML reparenting refuses cycles, stale source, unknown targets and parser-changing destinations',()=>{
 const source='<html><body><main><section><div>Nested</div></section><aside></aside></main></body></html>',resolved=resolve(source,'section');
 for(const destinationId of [resolved.element.id,resolved.elements.find(e=>e.tag==='div').id,'unknown'])assert.equal(html.planOp(resolved,{type:'reparentElement',destinationId}).refused,true);
 assert.equal(html.planOp(resolved,{type:'reparentElement',destinationId:resolved.elements.find(e=>e.tag==='aside').id,fileHash:'stale'}).refused,true);
 const nested=resolve('<html><body><main><form><p>Form</p></form><section><form></form></section></main></body></html>','form');
 assert.equal(html.planOp(nested,{type:'reparentElement',destinationId:nested.elements.filter(e=>e.tag==='form')[1].id}).refused,true);
});
