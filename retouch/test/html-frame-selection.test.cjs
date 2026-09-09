'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),frames=require('../src/html-frame-selection.cjs');
function resolve(source,tag='h1'){const elements=html.collect(source,'index.html').elements;return {source,hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html',elements,element:elements.find(e=>e.tag===tag)};}
function wrap(r,tags=['h1','p']){return frames.plan(r,{type:'frameSelection',ids:r.elements.filter(e=>tags.includes(e.tag)).map(e=>e.id).reverse(),fileHash:r.hash});}
test('Frame selection wraps in source order, retains responsive styles and unwraps byte exactly',()=>{
 let source='<html><head></head><body><main><h1 id="title">Title <em>here</em></h1>\n  <p>Paragraph</p><img src="one.svg"></main></body></html>';
 source=css.plan(resolve(source),{property:'width',value:'240px',width:768}).edits[0].after;
 const r=resolve(source),result=wrap(r);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.rootCount,2);
 const fresh=resolve(result.edits[0].after,'div');assert.equal(fresh.element.id,result.selectionIds[0]);assert.equal(fresh.element.node.parentNode.tagName,'main');assert.deepEqual(fresh.element.node.childNodes.filter(n=>n.tagName).map(n=>n.tagName),['h1','p']);
 assert.deepEqual(css.describe({...fresh,element:fresh.elements.find(e=>e.tag==='h1')}).cssRules,{768:{width:'240px'}});assert.equal(fresh.elements.find(e=>e.tag==='img').node.parentNode.tagName,'main');assert.equal(frames.describe(fresh).canRemoveFrame,true);
 const unwrapped=frames.plan(fresh,{type:'removeFrame',fileHash:fresh.hash});assert.equal(unwrapped.ok,true,unwrapped.reason);assert.equal(unwrapped.edits[0].after,source);assert.deepEqual(unwrapped.selectionIds,r.elements.filter(e=>['h1','p'].includes(e.tag)).map(e=>e.id));
});
test('Frame selection supports a single subtree and normalizes nested selections',()=>{
 const r=resolve('<html><body><main><h1>Title <em>here</em></h1><p>Paragraph</p></main></body></html>');
 for(const tags of [['h1'],['h1','em']]){const result=wrap(r,tags);assert.equal(result.ok,true,result.reason);assert.equal(result.rootCount,1);}
});
test('Frame selection refuses stale, nonconsecutive, cross-parent and invalid HTML edits atomically',()=>{
 for(const source of [
  '<html><body><main><h1>T</h1><img src="x"><p>P</p></main></body></html>',
  '<html><body><main><h1>T</h1><aside><p>P</p></aside></main></body></html>',
  '<html><body><main><h1>T</h1>mixed<p>P</p></main></body></html>',
  '<html><body><main v-for="item in items"><h1>T</h1><p>P</p></main></body></html>'
 ]){const result=wrap(resolve(source));assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 const r=resolve('<html><body><main><h1>T</h1><p>P</p></main></body></html>');
 for(const op of [{type:'frameSelection',fileHash:'stale',ids:[r.element.id]},{type:'removeFrame',fileHash:r.hash},{type:'frameSelection',fileHash:r.hash,ids:[r.element.id,'missing']}])assert.equal(frames.plan(r,op).refused,true);
 const list=resolve('<html><body><ul><li>One</li><li>Two</li></ul></body></html>','li');assert.equal(wrap(list,['li']).refused,true,'a div cannot replace list items');
});
