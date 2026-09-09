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

test('Path parser normalizes relative, implicit, smooth and quadratic segments and round-trips closure',()=>{
  assert.deepEqual(path.parse(path.serialize(nodes,true)),{nodes,closed:true});
  assert.equal(path.serialize(path.parse('m10 10 20 0h10v20l-10 0z').nodes,true),'M 10 10 L 30 10 L 40 10 L 40 30 L 30 30 Z');
  const smooth=path.parse('M0 0C0 10 10 10 10 0s10-10 10 0');assert.deepEqual(smooth.nodes[1].out,{x:10,y:-10});
  const q=path.parse('M0 0Q15 30 30 0T60 0');assert.deepEqual(q.nodes[0].out,{x:10,y:20});assert.deepEqual(q.nodes[1].out,{x:40,y:-20});
  assert.deepEqual(path.parse('M.5.5L1e1-2').nodes,[{x:.5,y:.5},{x:10,y:-2}]);
  for(const d of ['M0 0L1','M0 0C1 2 3','M,0 0L1 2','M0,,0L1 2','M0 0,L1 2','M0 0L1 2,','M0 0L1 2ZL2 2','M0 0L1 2M3 4L5 6','M0 0A1 1 0 0 0 2 3','M0 0LInfinity 0','M0 0L100001 0','M0 0L1 2" onload="x'])assert.equal(path.parse(d),null,d);
});
test('Splitting a cubic preserves its geometry, including a curved closing edge',()=>{
  const evaluate=(a,b,t)=>{const u=1-t,c=a.out||a,d=b.in||b;return{x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};};
  for(const closed of [false,true])for(const index of closed?[0,1]:[0]){
    const split=path.split(nodes,index,closed);assert.equal(split.length,3);for(let i=0;i<=20;i++){const t=i/20,a=nodes[index],b=nodes[(index+1)%2],expected=evaluate(a,b,t),actual=t<=.5?evaluate(split[index],split[index+1],t*2):evaluate(split[index+1],split[(index+2)%3],(t-.5)*2);assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-9);}
  }
  const moved=path.translate(nodes[0],10,-5);assert.deepEqual(moved,{x:10,y:-5,in:{x:10,y:-55},out:{x:10,y:45}});assert.equal(nodes[0].x,0);
});
