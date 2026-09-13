'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),draw=require('../shell/svg-draw.js');
const points=value=>value.trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
test('Triangle and canonical five-point star geometry fit drag bounds in every quadrant',()=>{
 for(const preset of ['triangle','star'])for(const sx of [-1,1])for(const sy of [-1,1]){
  const a={x:20,y:30},b={x:20+sx*80,y:30+sy*60},result=points(draw.geometry(preset,a,b).points);assert.equal(result.length,preset==='triangle'?3:10);
  const xs=result.map(p=>p[0]),ys=result.map(p=>p[1]);assert.equal(Math.min(...xs),Math.min(a.x,b.x));assert.equal(Math.max(...xs),Math.max(a.x,b.x));assert.equal(Math.min(...ys),Math.min(a.y,b.y));assert.equal(Math.max(...ys),Math.max(a.y,b.y));
  const centered=points(draw.geometry(preset,...draw.constrained(preset,a,b,{shiftKey:true,altKey:true})).points);assert.equal(Math.min(...centered.map(p=>p[0])),-60);assert.equal(Math.max(...centered.map(p=>p[0])),100);assert.equal(Math.min(...centered.map(p=>p[1])),-50);assert.equal(Math.max(...centered.map(p=>p[1])),110);
 }
});
for(const language of ['html','react','liquid'])test(language+' triangle/star insertion preserves source identities and exposes editable polygon vertices',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),ids=require('../src/id.cjs'),tag=e=>language==='react'?ids.jsxElementName(e.node):e.tag,relPath=language==='react'?'app/page.jsx':language==='liquid'?'main.liquid':'index.html';
 const markup='<main><svg viewBox="50 100 200 100"><g></g></svg><p>Keep</p></main>',source=language==='react'?'export default()=>'+markup:markup,elements=adapter.collect(source,relPath).elements;
 for(const container of ['main','svg','g'])for(const preset of ['triangle','star'])for(const coords of container==='main'?[undefined]:[undefined,[70,60,10,20]]){
  const r={source,relPath,file:'/tmp/'+relPath,elements,element:elements.find(e=>tag(e)===container),hash:adapter.contentHash(source)},result=adapter.planOp(r,{type:'insertSVG',preset,points:coords,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const after=result.edits[0].after,next=adapter.collect(after,relPath).elements,created=next.find(e=>e.id===result.createdId);assert.equal(tag(created),'polygon');assert.equal(next.length,elements.length+(container==='main'?2:1));assert.ok(elements.every(e=>next.some(n=>e.id===n.id&&tag(e)===tag(n))));assert.ok(after.includes('<p>Keep</p>'));assert.equal(result.edits[0].before,source);
  const geometry=adapter.describe({...r,source:after,elements:next,element:created,hash:result.hash}).svgGeometry;assert.ok(geometry.fields.some(f=>f.name==='points'));const value=/points="([^"]+)"/.exec(after)[1];assert.equal(points(value).length,preset==='triangle'?3:10);
  if(coords)assert.equal(value,draw.geometry(preset,{x:70,y:60},{x:10,y:20}).points);
  for(const invalid of [[0,0,0,10],[0,0,Infinity,10],[0,0,'"/>',10]])assert.equal(adapter.planOp(r,{type:'insertSVG',preset,points:invalid,fileHash:r.hash}).refused,true);
 }
});
