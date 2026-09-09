'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),del=require('../src/svg-delete.cjs');
const original='<html><head></head><body><svg><defs><linearGradient id="paint"/></defs><g><rect width="10" height="10"/><circle r="5"/></g><!--keep--><path d="M0 0"/></svg><p>After</p></body></html>';
function resolve(source=original,tag='rect'){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(e=>e.tag===tag),file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source)};}
test('SVG deletion removes exact primitive, group or viewport source and preserves surrounding content',()=>{
 for(const tag of ['rect','g','svg']){
  const r=resolve(original,tag),result=del.plan(r,{fileHash:r.hash});assert.equal(result.ok,true,result.reason);const {startOffset:start,endOffset:end}=r.element.location;
  assert.equal(result.edits[0].after,original.slice(0,start)+original.slice(end));const fresh=resolve(result.edits[0].after,'p');assert.ok(fresh.source.includes('<p>After</p>'));assert.ok(fresh.elements.some(e=>e.id===result.parentId));
  if(tag!=='svg')assert.ok(fresh.source.includes('<defs><linearGradient id="paint"/></defs>'));if(tag==='rect')assert.ok(fresh.source.includes('<circle r="5"/>'));
 }
});
test('SVG deletion refuses stale hashes, unclosed source, templates and HTML targets',()=>{
 for(const [source,tag]of [['<svg><g v-if="shown"><rect/></g></svg>','rect'],['<svg><rect>','rect'],['<p>Hello</p>','p']]){const r=resolve(source,tag);assert.equal(del.describe(r),null);assert.equal(del.plan(r,{fileHash:r.hash}).refused,true);}
 const r=resolve();for(const fileHash of [undefined,'stale'])assert.equal(del.plan(r,{fileHash}).refused,true);
});
