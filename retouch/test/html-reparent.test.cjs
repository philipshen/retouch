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
test('HTML layer placement reorders siblings and moves between parents in both directions',()=>{
 for(const position of ['before','after'])for(const markup of [
  '<main><h1>Title</h1><p>Anchor</p><aside></aside></main>',
  '<main><p>Anchor</p><aside></aside><h1>Title</h1></main>',
  '<main><section><h1>Title</h1></section><aside><p>Anchor</p></aside></main>',
  '<main><aside><p>Anchor</p></aside><section><h1>Title</h1></section></main>'
 ]){
  const source='<html><body>'+markup+'</body></html>',resolved=resolve(source,'h1'),target=resolved.elements.find(e=>e.tag==='p');
  const result=html.planOp(resolved,{type:'reparentElement',destinationId:target.id,position});assert.equal(result.ok,true,result.reason);
  const fresh=resolve(result.edits[0].after,'h1'),anchor=fresh.elements.find(e=>e.tag==='p');
  assert.equal(fresh.element.node.parentNode,anchor.node.parentNode);
  const siblings=anchor.node.parentNode.childNodes.filter(n=>n.tagName),index=siblings.indexOf(anchor.node);
  assert.equal(siblings[index+(position==='before'?-1:1)],fresh.element.node);
  assert.equal(result.movedId,fresh.element.id);
 }
});
test('HTML relative placement supports list siblings and refuses invalid placements',()=>{
 const resolved=resolve('<html><body><main><ul><li>First</li><li>Second</li></ul><p>Outside</p></main></body></html>','li');
 const target=resolved.elements.filter(e=>e.tag==='li')[1];
 assert.equal(html.planOp(resolved,{type:'reparentElement',destinationId:target.id,position:'after'}).ok,true);
 for(const [destinationId,position] of [[target.id,'invalid'],[resolved.element.id,'before'],[resolved.elements.find(e=>e.tag==='ul').id,'inside']]){
  // Moving a list item inside its current parent is also refused.
  assert.equal(html.planOp(resolved,{type:'reparentElement',destinationId,position}).refused,true);
 }
 const outer=resolve('<html><body><main><section><p>Nested</p></section><aside></aside></main></body></html>','section');
 assert.equal(html.planOp(outer,{type:'reparentElement',destinationId:outer.elements.find(e=>e.tag==='p').id,position:'after'}).refused,true);
});
test('Single-layer moves map nested descendants and every sibling across placements',()=>{
 for(const position of ['inside','before','after'])for(const markup of ['<section><h1>Title</h1><em>Child</em></section><p>Stays</p><aside><span>Anchor</span><b>Other</b></aside>','<aside><span>Anchor</span><b>Other</b></aside><p>Stays</p><section><h1>Title</h1><em>Child</em></section>']){
  const r=resolve('<html><body><main>'+markup+'</main></body></html>','section'),result=html.planOp(r,{type:'reparentElement',destinationId:r.elements.find(e=>e.tag===(position==='inside'?'aside':'span')).id,position,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const fresh=html.collect(result.edits[0].after,r.relPath).elements,mapping=new Map(result.sourceIdMap);assert.deepEqual(r.elements.map(e=>mapping.get(e.id)||e.id).sort(),fresh.map(e=>e.id).sort());
  for(const element of r.elements)assert.equal(fresh.find(e=>e.id===(mapping.get(element.id)||element.id)).tag,element.tag);
  assert.equal(mapping.get(r.element.id),result.movedId);assert.ok(mapping.has(r.elements.find(e=>e.tag==='h1').id));
 }
});
