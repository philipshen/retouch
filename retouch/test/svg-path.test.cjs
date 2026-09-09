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
  for(const d of ['M0 0L1','M0 0C1 2 3','M,0 0L1 2','M0,,0L1 2','M0 0,L1 2','M0 0L1 2,','M0 0L1 2ZL2 2','M0 0L1 2M3 4L5 6','M0 0A1 1 0 2 0 2 3','M0 0LInfinity 0','M0 0L100001 0','M0 0L1 2" onload="x'])assert.equal(path.parse(d),null,d);
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
  for(const bad of ['M0 0M10 10L20 20','M0 0L10 10 M2 2A1 1 0 2 0 3 3','M0 0L10 10Z L20 20'])assert.equal(path.parseCompound(bad),null,bad);
  assert.equal(path.serializeCompound({subpaths:Array(129).fill(doc.subpaths[0])}),null);
  assert.equal(path.serializeCompound({subpaths:Array(128).fill({nodes:Array.from({length:5},(_,i)=>({x:i,y:i})),closed:false})}),null);
});
for(const kind of ['html','react'])test(kind+' compound geometry edits preserve holes, paint and surrounding source identity',()=>{
  const before='M0 0H100V100H0Z M20 20V80H80V20Z',after='M0 0H100V100H0Z M25 20V80H80V20Z';
  const source=kind==='html'?'<svg><path d="'+before+'" fill-rule="evenodd" fill="red"/><circle r="5"/></svg>':'export default()=> <svg><path d="'+before+'" fillRule="evenodd" fill="red"/><circle r="5"/></svg>',adapter=kind==='html'?html:react,relPath=kind==='html'?'index.html':'page.jsx';
  const collect=s=>kind==='html'?html.collect(s,relPath).elements:ids.collectElements(s,relPath).elements,elements=collect(source),tag=e=>kind==='html'?e.tag:ids.jsxElementName(e.node),r={source,elements,element:elements.find(e=>tag(e)==='path'),hash:kind==='html'?html.contentHash(source):ids.contentHash(source),file:'/tmp/'+relPath,relPath};
  const result=adapter.planOp(r,{type:'setSVGGeometry',property:'d',value:after,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace(before,after));assert.deepEqual(collect(result.edits[0].after).map(e=>e.id),elements.map(e=>e.id));
});

test('Contour restructuring deep-copies duplicates, preserves other contours and validates limits',()=>{
  const doc=path.parseCompound('M0 0H60V60H0Z M10 10V50H50V10Z'),before=JSON.stringify(doc),copy=path.editContour(doc,1,'duplicate');
  assert.equal(copy.selected,2);assert.deepEqual(copy.subpaths.slice(0,2),doc.subpaths);assert.deepEqual(copy.subpaths[2].nodes,doc.subpaths[1].nodes.map(p=>path.translate(p,10,10)));
  assert.deepEqual(path.editContour(copy,2,'delete').subpaths,doc.subpaths);assert.equal(path.editContour({subpaths:[doc.subpaths[0]]},0,'delete'),null);
  assert.equal(path.editContour(doc,0,'unknown'),null);assert.equal(path.editContour(doc,-1,'reverse'),null);
  assert.equal(path.editContour({subpaths:[{closed:false,nodes:[{x:99999,y:0},{x:100000,y:0}]}]},0,'duplicate'),null);
  assert.equal(JSON.stringify(doc),before);
});
test('Reversing cubic contours preserves geometry and reversing twice restores exact nodes',()=>{
  const evaluate=(a,b,t)=>{const u=1-t,c=a.out||a,d=b.in||b;return{x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};};
  for(const closed of [false,true]){
    const doc={subpaths:[{nodes,closed}]},reversed=path.editContour(doc,0,'reverse');assert.deepEqual(path.editContour(reversed,0,'reverse').subpaths,doc.subpaths);
    const r=reversed.subpaths[0].nodes;
    for(let i=0;i<(closed?2:1);i++)for(let j=0;j<=20;j++){const a=nodes[i],b=nodes[(i+1)%2],ra=closed?r[(1-i+2)%2]:r[0],rb=closed?r[(2-i)%2]:r[1],p=evaluate(a,b,j/20),q=evaluate(ra,rb,1-j/20);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-9);}
  }
});
test('Opening removes only closing handles and closing makes a straight connection',()=>{
  const doc={subpaths:[{nodes,closed:true}]},opened=path.editContour(doc,0,'open').subpaths[0];assert.equal(opened.closed,false);assert.equal(opened.nodes[0].in,undefined);assert.equal(opened.nodes[1].out,undefined);assert.deepEqual(opened.nodes[0].out,nodes[0].out);assert.deepEqual(opened.nodes[1].in,nodes[1].in);
  const closed=path.editContour({subpaths:[opened]},0,'close').subpaths[0];assert.equal(closed.closed,true);assert.equal(closed.nodes[0].in,undefined);assert.equal(closed.nodes[1].out,undefined);
});

test('Appending drawn contours preserves existing geometry and removes unused open endpoint handles',()=>{
  const doc=path.parseCompound('M0 0H100V100H0Z'),before=JSON.stringify(doc),added=path.appendContour(doc,nodes,false);
  assert.equal(added.selected,1);assert.deepEqual(added.subpaths[0],doc.subpaths[0]);assert.equal(added.subpaths[1].nodes[0].in,undefined);assert.equal(added.subpaths[1].nodes[1].out,undefined);assert.deepEqual(added.subpaths[1].nodes[0].out,nodes[0].out);assert.equal(JSON.stringify(doc),before);
  assert.ok(path.equivalentCompound(added,path.parseCompound(path.serializeCompound(added))));
  const closed=path.appendContour(doc,nodes,true);assert.deepEqual(closed.subpaths[1],{nodes,closed:true});assert.ok(path.equivalentCompound(closed,path.parseCompound(path.serializeCompound(closed))));
  assert.equal(path.appendContour(doc,[{x:0,y:0}],false),null);assert.equal(path.appendContour({subpaths:Array(128).fill({nodes:[{x:0,y:0},{x:1,y:1}],closed:false})},nodes,false),null);
});

test('Contour translation moves every anchor and handle without changing shape or mutating input',()=>{
  const part={nodes,closed:true},moved=path.translateContour(part,12,-7);assert.equal(moved.closed,true);
  for(let i=0;i<nodes.length;i++)for(const key of ['', 'in', 'out']){const a=key?nodes[i][key]:nodes[i],b=key?moved.nodes[i][key]:moved.nodes[i];assert.equal(b.x-a.x,12);assert.equal(b.y-a.y,-7);}
  assert.deepEqual(path.translateContour(moved,-12,7),part);assert.equal(nodes[0].x,0);
  assert.equal(path.translateContour(part,100001,0),null);assert.equal(path.translateContour(part,NaN,0),null);
});

test('Arc parsing preserves A commands, relative endpoints, packed flags and curved closures',()=>{
  const parsed=path.parse('M10 20a30 15 25 01100 40');assert.deepEqual(parsed.nodes[1],{x:110,y:60,arc:{rx:30,ry:15,rotation:25,large:0,sweep:1}});assert.equal(path.serialize(parsed.nodes),'M 10 20 A 30 15 25 0 1 110 60');
  const loop=path.parse('M0 0A30 20 0 0 1 60 0A30 20 0 0 1 0 0Z');assert.equal(loop.nodes.length,2);assert.ok(loop.nodes[0].arc);assert.ok(path.equivalent(loop,path.parse(path.serialize(loop.nodes,true))));
  for(const d of ['M0 0A10 10 0 2 0 30 0','M0 0A10 10 0 -1 0 30 0','M0 0A10 10 0 0 1e2 30 0','M0 0A100001 10 0 0 1 30 0'])assert.equal(path.parse(d),null,d);
  assert.equal(path.parse('M0 0A-10 -20 0 0 1 30 0').nodes[1].arc.rx,10);
});
test('Arc subdivision and reversal preserve circular and rotated elliptical geometry',()=>{
  for(const large of [0,1])for(const sweep of [0,1])for(const [rx,ry,rotation] of [[40,40,0],[60,25,35],[5,3,-40]]){
    const original=path.parse(`M10 20A${rx} ${ry} ${rotation} ${large} ${sweep} 70 50`),a=original.nodes[0],b=original.nodes[1],center=path.arcCenter(a,b),split=path.split(original.nodes,0,false);assert.equal(split.length,3);
    for(let i=0;i<=20;i++){const t=i/20,p=path.arcPoint(center,t),part=t<=.5?[split[0],split[1],t*2]:[split[1],split[2],(t-.5)*2],q=path.arcPoint(path.arcCenter(part[0],part[1]),part[2]);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-5,JSON.stringify({rx,ry,rotation,large,sweep,t,p,q}));}
    const reversed=path.editContour({subpaths:[original]},0,'reverse').subpaths[0],rc=path.arcCenter(...reversed.nodes);for(let i=0;i<=20;i++){const p=path.arcPoint(center,i/20),q=path.arcPoint(rc,1-i/20);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-5);}
    assert.deepEqual(path.editContour({subpaths:[reversed]},0,'reverse').subpaths[0],original);
  }
});
test('Arc translation and opening retain the intended segments without sharing descriptors',()=>{
  const part=path.parse('M0 0A30 20 0 0 1 60 0A30 20 0 0 1 0 0Z'),moved=path.translateContour(part,10,15);assert.deepEqual(moved.nodes[0].arc,part.nodes[0].arc);assert.notEqual(moved.nodes[0].arc,part.nodes[0].arc);
  const opened=path.editContour({subpaths:[part]},0,'open').subpaths[0];assert.equal(opened.nodes[0].arc,undefined);assert.deepEqual(opened.nodes[1].arc,part.nodes[1].arc);
  const split=path.split(part.nodes,1,true);assert.equal(split.length,3);assert.ok(split[0].arc);assert.ok(split[2].arc);assert.equal(path.smooth(part.nodes,0,true),null);
  const zero=path.parse('M0 0A0 10 0 0 1 40 20');assert.deepEqual(path.segmentMiddle(...zero.nodes),{x:20,y:10});assert.ok(path.split(zero.nodes,0,false));
});
