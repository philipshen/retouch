'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),selection=require('../src/html-structure-selection.cjs');
const original='<html><head></head><body><main><section><h1>Title</h1></section><aside><p>Paragraph</p></aside><img src="x.png"></main></body></html>';
function resolve(source,tag='h1'){const elements=html.collect(source,'index.html').elements;return {source,hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html',elements,element:elements.find(e=>e.tag===tag)};}
function op(r,type,tags=['h1','p']){return {type,ids:r.elements.filter(e=>tags.includes(e.tag)).map(e=>e.id),fileHash:r.hash};}
test('Multiple HTML duplication creates independent styled copies in different parents',()=>{
 let source=css.plan(resolve(original),{width:768,property:'width',value:'240px'}).edits[0].after;
 const r=resolve(source),result=selection.plan(r,op(r,'duplicateSelection'));assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.rootCount,2);assert.equal(result.selectionIds.length,2);assert.equal(result.edits[0].before,source);
 const fresh=resolve(result.edits[0].after),copies=result.selectionIds.map(id=>fresh.elements.find(e=>e.id===id));assert.deepEqual(copies.map(e=>e.tag),['h1','p']);assert.deepEqual(copies.map(e=>e.node.parentNode.tagName),['section','aside']);
 assert.deepEqual(css.describe({...fresh,element:copies[0]}).cssRules,{768:{width:'240px'}});
 const headings=fresh.elements.filter(e=>e.tag==='h1');assert.notEqual(...headings.map(e=>e.node.attrs.find(a=>a.name==='data-rt-style').value));
 assert.equal(fresh.elements.find(e=>e.id===result.parentId).tag,'main');assert.ok(!result.edits[0].after.includes('data-rt-copy-'));
 const independently=css.plan({...fresh,element:copies[0]},{width:768,property:'width',value:'120px'});assert.equal(independently.ok,true);
 const updated=resolve(independently.edits[0].after);assert.deepEqual(css.describe(updated).cssRules,{768:{width:'240px'}});
});
test('Nested HTML selections duplicate or delete each outer subtree exactly once',()=>{
 const r=resolve(original,'section');
 for(const type of ['duplicateSelection','deleteSelection']){
  const result=selection.plan(r,op(r,type,['section','h1']));assert.equal(result.ok,true,result.reason);assert.equal(result.rootCount,1);
  const fresh=resolve(result.edits[0].after);assert.equal(fresh.elements.filter(e=>e.tag==='section').length,type==='duplicateSelection'?2:0);assert.equal(fresh.elements.filter(e=>e.tag==='h1').length,type==='duplicateSelection'?2:0);
  assert.equal(fresh.elements.filter(e=>e.tag==='aside').length,1);
 }
});
test('Multiple HTML deletion keeps unselected siblings and refuses stale or invalid selections atomically',()=>{
 const r=resolve(original),deleted=selection.plan(r,op(r,'deleteSelection'));assert.equal(deleted.ok,true);
 const fresh=resolve(deleted.edits[0].after);assert.equal(fresh.elements.filter(e=>['h1','p'].includes(e.tag)).length,0);assert.equal(fresh.elements.filter(e=>e.tag==='img').length,1);
 assert.equal(selection.plan(r,{...op(r,'deleteSelection'),fileHash:'stale'}).refused,true);
 assert.equal(selection.plan(r,{...op(r,'deleteSelection'),ids:[r.element.id,'0000000000']}).refused,true);
 const invalid=resolve(original.replace('<p>','Text<p>'));const refusal=selection.plan(invalid,op(invalid,'deleteSelection'));assert.equal(refusal.refused,true);assert.equal(refusal.edits,undefined);
 const identified=resolve(original.replace('<p>','<p id="unique">'));assert.equal(selection.plan(identified,op(identified,'duplicateSelection')).refused,true);
 const root=resolve(original,'body');assert.equal(selection.plan(root,op(root,'deleteSelection',['body','h1'])).refused,true);
});
test('Multi-layer edits map original survivors, remove complete subtrees, and leave no temporary attributes',()=>{
 const r=resolve(original,'section');
 for(const type of ['duplicateSelection','deleteSelection']){
  const result=selection.plan(r,op(r,type,['section','aside']));assert.equal(result.ok,true,result.reason);
  const fresh=resolve(result.edits[0].after),mapping=new Map(result.sourceIdMap),survivors=r.elements.filter(e=>!result.removedSourceIds.includes(e.id)),ids=survivors.map(e=>mapping.get(e.id)||e.id);assert.equal(new Set(ids).size,ids.length);
  for(const element of survivors){const next=fresh.elements.find(e=>e.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(next.tag,element.tag);}
  assert.ok(mapping.has(r.elements.find(e=>e.tag==='img').id));assert.ok(!result.edits[0].after.includes('data-rt-copy-'));
  if(type==='deleteSelection'){assert.deepEqual(result.removedSourceIds.map(id=>r.elements.find(e=>e.id===id).tag),['section','h1','aside','p']);assert.deepEqual(ids.sort(),fresh.elements.map(e=>e.id).sort());}
  else assert.ok(result.selectionIds.every(id=>!ids.includes(id)));
 }
});
