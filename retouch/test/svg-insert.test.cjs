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

test('Drawn SVG insertion preserves explicit coordinates and rejects invalid geometry atomically',()=>{
 const r=resolve('<svg viewBox="50 100 200 100"><g transform="scale(2)"></g></svg>','g');
 const cases={rectangle:'<rect x="10" y="20" width="60" height="40"',circle:'<circle cx="40" cy="40" r="20"',ellipse:'<ellipse cx="40" cy="40" rx="30" ry="20"',line:'<line x1="70" y1="60" x2="10" y2="20"'};
 for(const [preset,expected]of Object.entries(cases)){const result=insert.plan(r,{preset,fileHash:r.hash,points:[70,60,10,20]});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(expected));assert.ok(result.edits[0].after.includes('transform="scale(2)"'));}
 for(const points of [null,[],[1,2,3],[0,0,0,0],[0,0,5,0],[0,0,Infinity,10],[0,0,100001,10],[0,0,'5',10],[0,0,'"/>',10]]){const result=insert.plan(r,{preset:'rectangle',fileHash:r.hash,points});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 const container=resolve('<div></div>','div');assert.equal(insert.plan(container,{preset:'rectangle',fileHash:container.hash,points:[0,0,10,10]}).refused,true);
});

test('Pen insertion accepts bounded open and closed vectors and rejects incomplete or injected lists',()=>{
 const r=resolve('<svg viewBox="0 0 200 100"><g></g></svg>','g');
 for(const preset of ['polygon','polyline']){
  const result=insert.plan(r,{preset,fileHash:r.hash,points:[10,20,60,30,40,80]});assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/points="10,20 60,30 40,80"/);const next=resolve(result.edits[0].after,'g');assert.ok(r.elements.every(e=>next.elements.some(n=>n.id===e.id)));assert.equal(next.elements.find(e=>e.id===result.createdId).tag,preset);
  for(const points of [undefined,[],[1,2,3],[1,2,1,2,1,2],[1,2,3,4,Infinity,5],[1,2,3,4,'1" onload="x',5],Array(1026).fill(1)])assert.equal(insert.plan(r,{preset,fileHash:r.hash,points}).refused,true);
 }
 assert.equal(insert.plan(r,{preset:'polyline',fileHash:r.hash,points:[1,2,3,4]}).ok,true);assert.equal(insert.plan(r,{preset:'polygon',fileHash:r.hash,points:[1,2,3,4]}).refused,true);
});
