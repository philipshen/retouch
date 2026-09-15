'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
for(const name of ['react','liquid']){
 const adapter=require('../src/adapters/'+name+'.cjs'),wrap=html=>name==='react'?'export default function Page(){return '+html+'}':html,tag=el=>name==='react'?el.node.openingElement.name.name:el.tag;
 const setup=source=>{const relPath=name==='react'?'page.jsx':'sections/main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/project/'+relPath,elements,element:elements.find(el=>tag(el)==='b'),hash:adapter.contentHash(source)};};
 const run=(r,type,tags=['b','i'])=>adapter.planOp(r,{type,ids:r.elements.filter(el=>tags.includes(tag(el))).map(el=>el.id),fileHash:r.hash});
 test(name+' selection duplication/deletion compose exact source and final identities',()=>{
  const source=wrap('<main>\n  <a>A</a>\n  <b><em>B</em></b>\n  <i>I</i>\n  <u>U</u>\n</main>'),r=setup(source),dup=run(r,'duplicateSelection');assert.equal(dup.ok,true,dup.reason);assert.equal(dup.edits.length,1);assert.equal(dup.edits[0].before,source);assert.equal(dup.edits[0].after,source.replace('<b><em>B</em></b>','<b><em>B</em></b>\n  <b><em>B</em></b>').replace('<i>I</i>','<i>I</i>\n  <i>I</i>'));assert.equal(dup.rootCount,2);const final=adapter.collect(dup.edits[0].after,r.relPath).elements;assert.deepEqual(dup.selectionIds.map(id=>tag(final.find(el=>el.id===id))),['b','i']);const map=new Map(dup.sourceIdMap);for(const el of r.elements)assert.equal(tag(final.find(item=>item.id===(map.get(el.id)||el.id))),tag(el));
  const del=run(r,'deleteSelection');assert.equal(del.ok,true,del.reason);assert.equal(del.edits[0].after,source.replace('<b><em>B</em></b>','').replace('<i>I</i>',''));assert.equal(del.removedSourceIds.length,3);assert.equal(del.selectionIds.length,1);
 });
 test(name+' selection handles nested selection once and composes separate parents',()=>{
  const r=setup(wrap('<main><section><b><em>B</em></b></section><aside><i>I</i></aside></main>'));for(const type of ['duplicateSelection','deleteSelection']){const plan=run(r,type,['b','em','i']);assert.equal(plan.ok,true,plan.reason);assert.equal(plan.rootCount,2);assert.equal(plan.edits.length,1);}
 });
 test(name+' selection refuses stale identities and any unsafe member atomically',()=>{
  const r=setup(wrap('<main><b>B</b><i id="authored">I</i></main>'));const refused=run(r,'duplicateSelection');assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);const late=run(setup(wrap('<main><b id="authored">B</b><i>I</i></main>')),'duplicateSelection');assert.equal(late.refused,true);assert.equal(late.edits,undefined);
  for(const ids of [[],[r.element.id,r.element.id],[r.element.id,'missing']])assert.equal(adapter.planOp(r,{type:'deleteSelection',ids,fileHash:r.hash}).refused,true);
  assert.equal(adapter.planOp(r,{type:'deleteSelection',ids:r.elements.filter(el=>['b','i'].includes(tag(el))).map(el=>el.id),fileHash:'stale'}).refused,true);
  const unsafe=setup(wrap(name==='react'?'<main><b>B</b><i>{value}</i></main>':'<main><b>B</b><i>{{ value }}</i></main>'));assert.equal(run(unsafe,'deleteSelection').refused,true);
 });
}
