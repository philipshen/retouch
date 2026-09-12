'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),convert=require('../src/svg-convert.cjs'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid'])test(kind+' converts primitives with stable identities and styling',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');
 for(const [tag,attrs]of [['rect','x="10" y="20" width="80" height="40" rx="8"'],['circle','cx="50" cy="60" r="25"'],['ellipse','cx="50" cy="60" rx="25" ry="15"'],['line','x1="10" y1="20" x2="80" y2="90"']]){
  const source=(kind==='react'?'export default()=>':'')+'<svg><'+tag+' '+attrs+' fill="red" aria-label="Keep" /><path d="M 1 1 L 2 2"/></svg>',relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'main.liquid':'index.html',elements=adapter.collect(source,relPath).elements,element=elements.find(e=>(kind==='react'?ids.jsxElementName(e.node):e.tag)===tag),r={source,elements,element,relPath,file:'/tmp/'+relPath,hash:ids.contentHash(source)};
  const description=convert.describe(r);assert.ok(description);const result=adapter.planOp(r,{type:'convertSVGToPath',fileHash:r.hash});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after;assert.ok(after.includes('fill="red" aria-label="Keep"'));assert.ok(after.includes('d="'+description.path+'"'));const next=adapter.collect(after,relPath).elements;assert.deepEqual(next.map(e=>e.id),elements.map(e=>e.id));assert.equal(kind==='react'?ids.jsxElementName(next.find(e=>e.id===element.id).node):next.find(e=>e.id===element.id).tag,'path');assert.equal(adapter.planOp(r,{type:'convertSVGToPath',fileHash:'stale'}).refused,true);
 }
});
test('conversion rejects dynamic geometry and uses exact clamped rounded-rect arcs',()=>{
 const shape=require('../src/svg-geometry.cjs'),fields=(tag,attrs)=>shape.describe({tag,node:{namespaceURI:'http://www.w3.org/2000/svg',attrs:Object.entries(attrs).map(([name,value])=>({name,value}))}}).fields;
 for(const [tag,attrs]of [['rect',{width:'100%',height:'20'}],['circle',{r:'0'}],['ellipse',{rx:'-1',ry:'2'}],['line',{}]])assert.equal(convert.pathFor(tag,fields(tag,attrs)),null);
 const d=convert.pathFor('rect',fields('rect',{x:'10',y:'20',width:'80',height:'40',rx:'50'}));assert.match(d,/A 40 20 0 0 1/);assert.equal((d.match(/A /g)||[]).length,4);
 for(const kind of ['react','liquid']){const a=require('../src/adapters/'+kind+'.cjs'),s=(kind==='react'?'export default()=>':'')+'<svg><rect width="40" height="20" '+(kind==='react'?'x={position}':'x="{{ position }}"')+'/></svg>',relPath='main.'+(kind==='react'?'jsx':'liquid'),elements=a.collect(s,relPath).elements,r={source:s,relPath,elements,element:elements.find(e=>(kind==='react'?ids.jsxElementName(e.node):e.tag)==='rect')};assert.equal(convert.describe(r),null);}
});
test('paired tags preserve closing names; child content and generated geometry are refused',()=>{
 for(const kind of ['html','react','liquid']){
  const a=require('../src/adapters/'+kind+'.cjs'),relPath='main.'+(kind==='react'?'jsx':kind==='liquid'?'liquid':'html'),resolve=body=>{const source=(kind==='react'?'export default()=>':'')+'<svg>'+body+'</svg>',elements=a.collect(source,relPath).elements;return {source,elements,relPath,file:'/tmp/'+relPath,hash:ids.contentHash(source),element:elements.find(e=>(kind==='react'?ids.jsxElementName(e.node):e.tag)==='rect')};};
  const r=resolve('<rect width="40" height="20"> </rect>'),result=convert.plan(r,{fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/<path[^>]*> <\/path>/);
  assert.equal(convert.describe(resolve('<rect width="40" height="20"><title>Keep metadata</title></rect>')),null);assert.equal(convert.describe(resolve('<rect width="40" height="20" d="M0 0L1 1"/>')),null);
 }
 const html=require('../src/adapters/html.cjs'),source='<svg><g v-for="item in items"><rect width="40" height="20"/></g></svg>',elements=html.collect(source,'index.html').elements;assert.equal(convert.describe({source,relPath:'index.html',elements,element:elements.find(e=>e.tag==='rect')}),null);
});
