'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs');
function target(source,tag='main'){const elements=html.collect(source,'index.html').elements;return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),elements,element:elements.find(e=>e.tag===tag)};}
test('HTML insertion creates selectable text and frames inside empty and populated containers',()=>{
 for(const source of ['<html><body><main></main></body></html>','<html><body><main><p>Existing</p></main><aside>Keep</aside></body></html>'])for(const preset of ['text','frame']){
  const resolved=target(source),result=html.planOp(resolved,{type:'insertElement',preset});assert.equal(result.ok,true);
  const after=result.edits[0].after,elements=html.collect(after,'index.html').elements,created=elements.find(e=>e.id===result.createdId);
  assert.equal(created.tag,preset==='text'?'p':'div');assert.equal(created.node.parentNode.tagName,'main');assert.equal(result.parentId,resolved.element.id);
  assert.ok(after.includes(preset==='text'?'New text':'aria-label="Frame"'));
  for(const old of resolved.elements)assert.ok(elements.some(e=>e.id===old.id&&e.tag===old.tag));
 }
});
test('HTML insertion refuses stale sources, unsafe parent contexts and unsupported markup',()=>{
 for(const [source,tag]of [['<p>Text</p>','p'],['<table></table>','table'],['<div v-for="x in xs"></div>','div'],['<div>','div']])assert.equal(html.planOp(target(source,tag),{type:'insertElement',preset:'frame'}).refused,true);
 const resolved=target('<main></main>');assert.equal(html.planOp(resolved,{type:'insertElement',preset:'script'}).refused,true);
 assert.equal(html.planOp(resolved,{type:'insertElement',preset:'text',fileHash:'stale'}).refused,true);
});
