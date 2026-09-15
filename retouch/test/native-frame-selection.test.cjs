'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
for(const language of ['react','liquid']){
 const adapter=require('../src/adapters/'+language+'.cjs'),tag=e=>language==='react'?e.node.openingElement.name.name:e.tag;
 const setup=markup=>{const source=language==='react'?'const view='+markup:markup,relPath=language==='react'?'view.jsx':'view.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/p/'+relPath,elements,element:elements.find(e=>tag(e)==='b'),hash:adapter.contentHash(source)};};
 const frame=(r,tags)=>adapter.planOp(r,{type:'frameSelection',ids:r.elements.filter(e=>tags.includes(tag(e))).map(e=>e.id),fileHash:r.hash});
 test(language+' framing preserves source, descendants and every original identity; release restores exact source',()=>{
  const r=setup('<main>\n <a>A</a>\n <b id="bold"><em>B</em></b>\n <i>I</i>\n <u>U</u>\n</main>'),result=frame(r,['b','em','i']);assert.equal(result.ok,true,result.reason);assert.equal(result.rootCount,2);assert.equal(result.edits[0].after,r.source.replace('<b id="bold">','<div data-rt-frame="" aria-label="Frame"><b id="bold">').replace('</i>','</i></div>'));const next=result.edits[0].after,elements=adapter.collect(next,r.relPath).elements,map=new Map(result.sourceIdMap);for(const old of r.elements)assert.equal(tag(elements.find(e=>e.id===(map.get(old.id)||old.id))),tag(old));const element=elements.find(e=>e.id===result.selectionIds[0]),removed=adapter.planOp({...r,source:next,elements,element,hash:result.hash},{type:'removeFrame',fileHash:result.hash});assert.equal(removed.ok,true,removed.reason);assert.equal(removed.edits[0].after,r.source);assert.deepEqual(removed.selectionIds,r.elements.filter(e=>['b','i'].includes(tag(e))).map(e=>e.id));assert.deepEqual(removed.removedSourceIds,[element.id]);
 });
 test(language+' refuses separated and cross-parent selections, stale files and dynamic frame contents',()=>{
  const r=setup('<main><b>B</b><i>I</i><u>U</u></main>');assert.equal(frame(r,['b','u']).refused,true);const cross=setup('<main><section><b>B</b></section><aside><i>I</i></aside></main>');assert.equal(frame(cross,['b','i']).refused,true);assert.equal(adapter.planOp(r,{type:'frameSelection',ids:[r.element.id],fileHash:'old'}).refused,true);
  const dynamic=setup(language==='react'?'<main><b>{value}</b></main>':'<main><b>{{ value }}</b></main>');assert.equal(frame(dynamic,['b']).refused,true);assert.equal(adapter.planOp(r,{type:'removeFrame',fileHash:r.hash}).refused,true);
 });
 test(language+' releasing a styled empty frame selects its surviving parent',()=>{
  const r=setup('<main><div data-rt-frame="" class="p-4"></div><b>B</b></main>');r.element=r.elements.find(e=>tag(e)==='div');const result=adapter.planOp(r,{type:'removeFrame',fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,r.source.replace('<div data-rt-frame="" class="p-4"></div>',''));assert.deepEqual(result.selectionIds,[r.elements[0].id]);
 });
}
