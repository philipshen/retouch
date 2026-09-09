'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('../shell/svg-path.js'),html=require('../src/adapters/html.cjs'),react=require('../src/adapters/react.cjs'),ids=require('../src/id.cjs');
const nodes=[{x:0,y:0,in:{x:0,y:-50},out:{x:0,y:50}},{x:100,y:0,in:{x:100,y:50},out:{x:100,y:-50}}];
test('Cubic paths preserve independent handles, mixed segments and curved closure',()=>{
  assert.equal(path.serialize(nodes,false),'M 0 0 C 0 50 100 50 100 0');
  assert.equal(path.serialize(nodes,true),'M 0 0 C 0 50 100 50 100 0 C 100 -50 0 -50 0 0 Z');
  assert.equal(path.serialize([{x:0,y:0},{x:20,y:20},{x:40,y:0,in:{x:30,y:30}}]),'M 0 0 L 20 20 C 20 20 30 30 40 0');
  for(const value of [null,[],[nodes[0]],Array(513).fill(nodes[0]),[nodes[0],{x:Infinity,y:0}],[nodes[0],{x:100,y:0,in:{x:'1" onload="x',y:0}}],[nodes[0],{x:100,y:0,out:{x:100001,y:0}}],Array(2)])assert.equal(path.serialize(value),null);
  assert.equal(path.serialize(nodes,'true'),null);assert.equal(path.serialize([{x:0,y:0},{x:1,y:1}],true),null);
});
for(const kind of ['html','react'])test(kind+' path insertion preserves source identities and refuses invalid handles',()=>{
  const source=kind==='html'?'<svg><g></g><circle r="5"/></svg>':'export default()=> <svg><g></g><circle r="5"/></svg>',adapter=kind==='html'?html:react,relPath=kind==='html'?'index.html':'page.jsx';
  const collect=s=>kind==='html'?html.collect(s,relPath).elements:ids.collectElements(s,relPath).elements,elements=collect(source),tag=e=>kind==='html'?e.tag:ids.jsxElementName(e.node);
  const r={source,elements,element:elements.find(e=>tag(e)==='g'),hash:kind==='html'?html.contentHash(source):ids.contentHash(source),file:'/tmp/'+relPath,relPath};
  for(const closed of [false,true]){
    const result=adapter.planOp(r,{type:'insertSVG',preset:'path',nodes,closed,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes('d="'+path.serialize(nodes,closed)+'"'));const next=collect(result.edits[0].after);assert.equal(next.length,elements.length+1);assert.ok(elements.every(e=>next.some(n=>n.id===e.id&&tag(n)===tag(e))));assert.equal(tag(next.find(e=>e.id===result.createdId)),'path');
  }
  for(const op of [{nodes:[{x:0,y:0}]},{nodes:[nodes[0],{x:10,y:0,out:{x:NaN,y:0}}]},{fileHash:'stale'},{closed:'true'}])assert.equal(adapter.planOp(r,{type:'insertSVG',preset:'path',nodes,closed:false,fileHash:r.hash,...op}).refused,true);
});
