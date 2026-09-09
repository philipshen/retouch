'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),selection=require('../src/html-reparent-selection.cjs');
function resolve(source,tag='h1'){const elements=html.collect(source,'index.html').elements;return {source,hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html',elements,element:elements.find(e=>e.tag===tag)};}
function op(r,position='inside',tags=['h1','p']){return {type:'reparentSelection',ids:r.elements.filter(e=>tags.includes(e.tag)).map(e=>e.id).reverse(),destinationId:r.elements.find(e=>e.tag===(position==='inside'?'aside':'h2')).id,position,fileHash:r.hash};}
test('HTML selection moves preserve source order and linked responsive styles for all placements',()=>{
 for(const position of ['inside','before','after'])for(const content of [
  '<section><h1>Title</h1></section><p>Paragraph</p><aside><h2>Anchor</h2></aside>',
  '<aside><h2>Anchor</h2></aside><section><h1>Title</h1></section><p>Paragraph</p>'
 ]){
  let source='<html><head></head><body><main>'+content+'</main></body></html>';
  source=css.plan(resolve(source),{property:'width',value:'240px',width:768}).edits[0].after;
  const r=resolve(source),result=selection.plan(r,op(r,position));assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);
  const fresh=resolve(result.edits[0].after),moved=result.selectionIds.map(id=>fresh.elements.find(e=>e.id===id));assert.deepEqual(moved.map(e=>e.tag),['h1','p']);assert.ok(moved.every(e=>e.node.parentNode.tagName==='aside'));
  const children=moved[0].node.parentNode.childNodes.filter(n=>n.tagName).map(n=>n.tagName);assert.deepEqual(children,position==='before'?['h1','p','h2']:['h2','h1','p']);
  assert.deepEqual(css.describe({...fresh,element:moved[0]}).cssRules,{768:{width:'240px'}});assert.equal(fresh.elements.find(e=>e.id===result.parentId).tag,'main');assert.ok(!result.edits[0].after.includes('data-rt-move-'));
 }
});
test('HTML selection moves normalize nested selections and refuse cycles and partial invalidity',()=>{
 const source='<html><body><main><section><h1>Title</h1></section><p>Paragraph</p><aside><h2>Anchor</h2></aside></main></body></html>',r=resolve(source,'section');
 const moved=selection.plan(r,op(r,'inside',['section','h1']));assert.equal(moved.ok,true,moved.reason);assert.equal(moved.rootCount,1);assert.equal(moved.selectionIds.length,1);
 for(const destinationId of [r.element.id,r.elements.find(e=>e.tag==='h1').id])assert.equal(selection.plan(r,{...op(r,'inside',['section','h1']),destinationId}).refused,true);
 const invalid=resolve(source.replace('<p>','Text<p>'));const refusal=selection.plan(invalid,op(invalid));assert.equal(refusal.refused,true);assert.equal(refusal.edits,undefined);
 assert.equal(selection.plan(r,{...op(r,'inside',['section','h1']),fileHash:'stale'}).refused,true);
});
test('HTML selection moves refuse parser-changing nested forms without a source edit',()=>{
 const r=resolve('<html><body><main><form>First</form><p>Paragraph</p><aside><form>Second</form></aside></main></body></html>','form');
 const result=selection.plan(r,{type:'reparentSelection',ids:[r.element.id,r.elements.find(e=>e.tag==='p').id],destinationId:r.elements.filter(e=>e.tag==='form')[1].id,position:'inside',fileHash:r.hash});assert.equal(result.refused,true);assert.equal(result.edits,undefined);
});
