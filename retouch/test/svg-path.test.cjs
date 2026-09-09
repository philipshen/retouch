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

test('Handle movement preserves independent, aligned-length and mirrored constraints without mutating input',()=>{
  const node={x:20,y:30,in:{x:10,y:30},out:{x:40,y:30}},point={x:20,y:50};
  assert.deepEqual(path.moveHandle(node,'out',point),{...node,out:point});
  assert.deepEqual(path.moveHandle(node,'out',point,'aligned'),{...node,in:{x:20,y:20},out:point});
  assert.deepEqual(path.moveHandle(node,'out',point,'mirrored'),{...node,in:{x:20,y:10},out:point});
  assert.deepEqual(path.moveHandle(node,'in',{x:20,y:10},'aligned').out,{x:20,y:50});
  assert.deepEqual(path.moveHandle(node,'out',node,'aligned').in,node.in);
  assert.deepEqual(path.moveHandle(node,'out',node,'mirrored').in,{x:20,y:30});
  assert.deepEqual(node,{x:20,y:30,in:{x:10,y:30},out:{x:40,y:30}});
  assert.equal(path.moveHandle(node,'out',{x:100001,y:0}),null);
  assert.equal(path.moveHandle({x:99999,y:0,in:{x:99998,y:0},out:{x:100000,y:0}},'in',{x:0,y:0},'mirrored'),null);
});
test('Corner and smooth conversion handle interior points, endpoints and two-anchor loops',()=>{
  const line=[{x:0,y:0},{x:30,y:30},{x:60,y:0}],middle=path.smooth(line,1);
  assert.ok(Math.abs(middle.in.x-(30-Math.sqrt(200)))<1e-9);assert.equal(middle.in.y,30);assert.equal(middle.out.y,30);
  assert.deepEqual(path.corner(middle),line[1]);assert.deepEqual(line[1],{x:30,y:30});
  assert.deepEqual(path.smooth(line,0),{x:0,y:0,out:{x:10,y:10}});
  assert.deepEqual(path.smooth(line,2),{x:60,y:0,in:{x:50,y:10}});
  const loop=path.smooth(nodes,0,true);assert.deepEqual(loop,nodes[0]);
  assert.equal(path.smooth(line,-1),null);
});

test('Compound paths preserve contour order, closure and relative moveto origins',()=>{
  const d='M10 20h80v60h-80z m20 20h40v20h-40z M150 20q20 30 40 0t40 0',doc=path.parseCompound(d);
  assert.equal(doc.subpaths.length,3);assert.deepEqual(doc.subpaths.map(p=>p.closed),[true,true,false]);assert.deepEqual(doc.subpaths[1].nodes[0],{x:30,y:40});
  assert.equal(path.parse(d),null);assert.ok(path.equivalentCompound(doc,path.parseCompound(path.serializeCompound(doc))));
  assert.deepEqual(path.parseCompound('m10 20l30 10m20 30l10 0').subpaths[1].nodes[0],{x:60,y:60});
  const unchanged=JSON.parse(JSON.stringify(doc.subpaths[0]));doc.subpaths[1].nodes[0]=path.translate(doc.subpaths[1].nodes[0],3,4);assert.deepEqual(doc.subpaths[0],unchanged);
  for(const bad of ['M0 0M10 10L20 20','M0 0L10 10 M2 2A1 1 0 0 0 3 3','M0 0L10 10Z L20 20'])assert.equal(path.parseCompound(bad),null,bad);
  assert.equal(path.serializeCompound({subpaths:Array(129).fill(doc.subpaths[0])}),null);
  assert.equal(path.serializeCompound({subpaths:Array(128).fill({nodes:Array.from({length:5},(_,i)=>({x:i,y:i})),closed:false})}),null);
});
for(const kind of ['html','react'])test(kind+' compound geometry edits preserve holes, paint and surrounding source identity',()=>{
  const before='M0 0H100V100H0Z M20 20V80H80V20Z',after='M0 0H100V100H0Z M25 20V80H80V20Z';
  const source=kind==='html'?'<svg><path d="'+before+'" fill-rule="evenodd" fill="red"/><circle r="5"/></svg>':'export default()=> <svg><path d="'+before+'" fillRule="evenodd" fill="red"/><circle r="5"/></svg>',adapter=kind==='html'?html:react,relPath=kind==='html'?'index.html':'page.jsx';
  const collect=s=>kind==='html'?html.collect(s,relPath).elements:ids.collectElements(s,relPath).elements,elements=collect(source),tag=e=>kind==='html'?e.tag:ids.jsxElementName(e.node),r={source,elements,element:elements.find(e=>tag(e)==='path'),hash:kind==='html'?html.contentHash(source):ids.contentHash(source),file:'/tmp/'+relPath,relPath};
  const result=adapter.planOp(r,{type:'setSVGGeometry',property:'d',value:after,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace(before,after));assert.deepEqual(collect(result.edits[0].after).map(e=>e.id),elements.map(e=>e.id));
});
