'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const kind of ['html','react','liquid'])test(kind+' native drawings preserve source containers and normalize positioned SVG geometry',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),ids=kind==='react'?require('../src/id.cjs'):adapter;
 const collect=kind==='react'?ids.collectElements:ids.collect,tag=e=>kind==='react'?ids.jsxElementName(e.node):e.tag;
 const source=kind==='react'?'export default()=> <div><main style={{position:"relative",padding:20}}/><p>Keep</p></div>':'<div><main style="position:relative;padding:20px">'+(kind==='liquid'?'{{ title }}':'Keep inside')+'</main><p>Keep</p></div>';
 const elements=collect(source,'page.'+kind).elements,r={source,elements,element:elements.find(e=>tag(e)==='main'),hash:ids.contentHash(source),relPath:'page.'+kind,file:'/tmp/page.'+kind};
 for(const preset of ['rectangle','circle','ellipse','line','triangle','star']){
  const result=adapter.planOp(r,{type:'insertSVG',preset,points:[170,160,20,30],nativeCanvas:true,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const after=result.edits[0].after,next=collect(after,r.relPath).elements;assert.equal(next.length,elements.length+2);assert.ok(elements.every(e=>next.some(n=>n.id===e.id&&tag(n)===tag(e))));assert.ok(next.some(e=>e.id===result.createdId));assert.ok(after.includes('<p>Keep</p>'));assert.ok(after.includes(kind==='react'?'style={{position:"relative",padding:20}}':'style="position:relative;padding:20px"'));
  assert.match(after,/position[":]+absolute/);assert.match(after,preset==='line'?/viewBox="0 0 152 132"/:/viewBox="0 0 150 130"/);
  if(preset==='rectangle')assert.match(after,/<rect x="0" y="0" width="150" height="130"/);
 }
 for(const points of [[],[0,0,0,0],[1,2,Infinity,5],[0,0,100001,20],[0,0,'20',20]]){const result=adapter.planOp(r,{type:'insertSVG',preset:'rectangle',points,nativeCanvas:true,fileHash:r.hash});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 const horizontal=adapter.planOp(r,{type:'insertSVG',preset:'line',points:[20,30,70,30],nativeCanvas:true,fileHash:r.hash});assert.equal(horizontal.ok,true,horizontal.reason);assert.match(horizontal.edits[0].after,/viewBox="0 0 52 2"/);assert.match(horizontal.edits[0].after,/<line x1="1" y1="1" x2="51" y2="1"/);
 assert.equal(adapter.planOp(r,{type:'insertSVG',preset:'rectangle',points:[0,0,20,30],nativeCanvas:true,fileHash:'stale'}).refused,true);
});
