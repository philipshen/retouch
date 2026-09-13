'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../shell/svg-affine.js'),S=require('../shell/svg-selection.js');
test('Selection transforms conjugate through different parent coordinate systems',()=>{
 const global=A.parse('translate(20 10) rotate(30 100 100)'),own=A.parse('rotate(10) translate(4 6)');
 for(const parent of [A.identity(),A.parse('translate(15 20) scale(2 3) rotate(30)'),A.parse('scale(-1 1) skewX(10)')]){const next=S.transform(parent,global,own);assert.ok(A.equivalent(A.multiply(parent,next),A.multiply(global,A.multiply(parent,own))));}
 assert.equal(S.inverse([0,0,0,0,0,0]),null);
});
for(const kind of ['html','react','liquid'])test(kind+' vector selections form one atomic source edit',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),collect=(source,relPath)=>kind==='react'?require('../src/id.cjs').collectElements(source,relPath).elements:adapter.collect(source,relPath).elements,source=(kind==='react'?'export default()=>':'')+'<svg><rect width="20"/><circle transform="translate(2 3)" r="10"/><path d="M0 0L10 20"/></svg>',relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',elements=collect(source,relPath),chosen=elements.slice(1,3),ids=chosen.map(el=>el.id),resolved={source,relPath,elements,element:chosen[0],hash:adapter.contentHash(source),file:'/tmp/'+relPath},matrices=Object.fromEntries(ids.map(id=>[id,[1,0,0,1,20,30]])),op={type:'setSVGTransforms',ids,matrices,fileHash:resolved.hash};
 const result=adapter.planOp(resolved,op);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);assert.equal((result.edits[0].after.match(/matrix\(1 0 0 1 20 30\)/g)||[]).length,2);assert.ok(result.edits[0].after.includes('d="M0 0L10 20"'));
 for(const bad of [{fileHash:'stale'},{ids:[ids[0],ids[0]]},{matrices:{[ids[0]]:matrices[ids[0]]}},{matrices:{...matrices,[ids[1]]:[NaN,0,0,1,0,0]}}]){const refused=adapter.planOp(resolved,{...op,...bad});assert.equal(refused.ok,false);assert.equal(refused.edits,undefined);}
 const badId=elements[0].id,refused=adapter.planOp(resolved,{...op,ids:[ids[0],badId],matrices:{[ids[0]]:matrices[ids[0]],[badId]:A.identity()}});assert.equal(refused.ok,false,'an invalid final member refuses the whole batch');assert.equal(refused.edits,undefined);
});
test('Nested selection matrices apply a shared transform only to outermost members',()=>{
 const parent=A.parse('translate(10 20) rotate(12)'),outer=A.parse('rotate(30)'),child=A.parse('translate(5 6)'),grandchild=A.parse('scale(2 3)'),global=A.parse('rotate(40 50 60) scale(-1 1)');
 const members=[{info:{id:'outer',svgTransform:{matrix:outer}},parent},{info:{id:'child',svgTransform:{matrix:child}},parent:A.multiply(parent,outer),covered:true},{info:{id:'grandchild',svgTransform:{matrix:grandchild}},parent:A.multiply(A.multiply(parent,outer),child),covered:true}],result=S.matricesFor(members,global);
 assert.deepEqual(result.child,child);assert.deepEqual(result.grandchild,grandchild);assert.ok(A.equivalent(A.multiply(A.multiply(A.multiply(parent,result.outer),result.child),result.grandchild),A.multiply(global,A.multiply(A.multiply(A.multiply(parent,outer),child),grandchild))));
});
for(const kind of ['html','react','liquid'])test(kind+' nested selections preserve authored descendant transforms verbatim',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',source=(kind==='react'?'export default()=>':'')+'<svg><g transform="translate(10 20)"><g transform="rotate(12) scale(2)"><rect width="20"/></g></g></svg>',elements=kind==='react'?require('../src/id.cjs').collectElements(source,relPath).elements:adapter.collect(source,relPath).elements,chosen=elements.slice(1),ids=chosen.map(e=>e.id),r={source,relPath,elements,element:chosen[0],file:'/tmp/'+relPath,hash:adapter.contentHash(source)},matrices=Object.fromEntries(chosen.map(element=>[element.id,adapter.describe({...r,element}).svgTransform.matrix]));
 assert.deepEqual(adapter.planOp(r,{type:'setSVGTransforms',ids,matrices,fileHash:r.hash}).edits,[],'an unchanged selection has no source edits');matrices[ids[0]]=[1,0,0,1,30,40];const result=adapter.planOp(r,{type:'setSVGTransforms',ids,matrices,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace('translate(10 20)','matrix(1 0 0 1 30 40)'));
});

test('Selection proportions scale both axes about the top left and enforce both size limits',()=>{
 const box={left:20,top:-30,width:100,height:200};
 assert.deepEqual(S.resizeBounds(box,'width',150,true),[1.5,0,0,1.5,-10,15]);
 assert.deepEqual(S.resizeBounds(box,'height',100,true),[.5,0,0,.5,10,-15]);
 assert.deepEqual(S.resizeBounds(box,'height',100,false),[1,0,0,.5,0,-15]);
 for(const value of [0,-1,NaN,Infinity,100001])assert.equal(S.resizeBounds(box,'width',value,true),null);
 assert.equal(S.resizeBounds(box,'width',60000,true),null,'derived height exceeds limit');
 assert.equal(S.resizeBounds({...box,width:0},'height',100,true),null);
 assert.equal(S.selectionKey([{file:'a',id:'1'},{file:'a',id:'2'}]),S.selectionKey([{file:'a',id:'2'},{file:'a',id:'1'}]));
 assert.notEqual(S.selectionKey([{file:'a',id:'1'}]),S.selectionKey([{file:'b',id:'1'}]));
});

test('Canvas selection resize honors opposite anchors, center and live proportion modifiers',()=>{
 const b={left:20,top:30,width:100,height:200};
 assert.deepEqual(S.canvasResize(b,'nw',10,20),[.9,0,0,.9,12,23]);
 assert.deepEqual(S.canvasResize(b,'se',10,20,{altKey:true}),[1.2,0,0,1.2,-14,-26]);
 const locked=S.canvasResize(b,'se',50,10,{},true);assert.equal(locked[0],locked[3]);
 const shift=S.canvasResize(b,'se',50,10,{shiftKey:true});assert.equal(shift[0],shift[3]);
 const free=S.canvasResize(b,'se',50,10,{ctrlKey:true},true);assert.notEqual(free[0],free[3]);
 assert.equal(S.canvasResize({...b,width:0},'se',10,10),null);
});
