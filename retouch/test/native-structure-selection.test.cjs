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
for(const language of ['react','liquid','html']){
 const adapter=require('../src/adapters/'+language+'.cjs'),wrap=html=>language==='react'?'const view='+html:html,tag=el=>language==='react'?el.node.openingElement.name.name:el.tag;
 const plan=(r,op)=>language==='html'?require('../src/native-structure-selection.cjs').plan(r,op,language):adapter.planOp(r,op);
 const setup=(body,tags)=>{const source=wrap(body),relPath=language==='react'?'view.jsx':'sections/view.liquid',elements=adapter.collect(source,relPath).elements,selected=elements.filter(el=>tags.includes(tag(el)));return {source,relPath,file:'/project/'+relPath,hash:adapter.contentHash(source),elements,element:selected[0],ids:selected.map(el=>el.id)};};
 test(language+' multi-layer ordering preserves selected order, spacing and every source identity',()=>{
  const r=setup('<main>\n <a>A</a>\n <b>B</b>\n <i>I</i>\n <u>U</u>\n <s>S</s>\n</main>',['b','u']);
  for(const [direction,expected]of [['before','b a u i s'],['after','a i b s u'],['first','b u a i s'],['last','a i s b u']]){const result=plan(r,{type:'moveSelection',direction,ids:r.ids,fileHash:r.hash});assert.equal(result.ok,true,result.reason);const final=adapter.collect(result.edits[0].after,r.relPath).elements;assert.equal(final.filter(el=>tag(el)!=='main').map(tag).join(' '),expected);assert.deepEqual(result.selectionIds.map(id=>tag(final.find(el=>el.id===id))),['b','u']);const map=new Map(result.sourceIdMap);for(const el of r.elements)assert.equal(tag(final.find(item=>item.id===(map.get(el.id)||el.id))),tag(el));assert.equal(result.edits[0].after.split('\n').length,r.source.split('\n').length);}
 });
 test(language+' ordering moves contiguous groups once and refuses boundaries and different parents',()=>{
  const r=setup('<main><a>A</a><b>B</b><i>I</i><u>U</u></main>',['b','i']);for(const [direction,expected]of [['before','b i a u'],['after','a u b i']]){const result=plan(r,{type:'moveSelection',direction,ids:r.ids,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(adapter.collect(result.edits[0].after,r.relPath).elements.filter(el=>tag(el)!=='main').map(tag).join(' '),expected);}
  const all=setup('<main><b>B</b><i>I</i></main>',['b','i']);for(const direction of ['before','after','first','last','invalid']){const result=plan(all,{type:'moveSelection',direction,ids:all.ids,fileHash:all.hash});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
  const separate=setup('<main><section><b>B</b></section><aside><i>I</i></aside></main>',['b','i']);assert.equal(plan(separate,{type:'moveSelection',direction:'first',ids:separate.ids,fileHash:separate.hash}).refused,true);
 });
}
