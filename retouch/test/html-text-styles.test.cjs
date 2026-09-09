'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),linked=require('../src/html-text-styles.cjs');
const original='<html><head></head><body><h1>Title</h1><p>Body</p></body></html>';
const style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-size':'32px','font-weight':'700','font-family':'"Geist", sans-serif'}};
const resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')});
const apply=(source,width=0)=>linked.plan(resolve(source),{type:'applyTextStyle',width},style);
test('linked typography writes source declarations and durable per-screen references in one edit',()=>{
 const base=apply(original);assert.equal(base.ok,true);assert.equal(base.edits.length,1);assert.equal(base.edits[0].before,original);
 const after=apply(base.edits[0].after,768).edits[0].after,r=resolve(after);
 assert.deepEqual(css.describe(r).cssRules,{0:style.properties,768:style.properties});
 assert.deepEqual(linked.links(r),{0:{id:style.id,properties:style.properties},768:{id:style.id,properties:style.properties}});
 assert.ok(after.includes('<p>Body</p>'));assert.deepEqual(apply(after,768).edits,[]);
});
test('detaching a scope retains rendered declarations and other links',()=>{
 const after=apply(apply(original).edits[0].after,768).edits[0].after;
 const detached=linked.plan(resolve(after),{type:'detachTextStyle',width:768}).edits[0].after;
 assert.deepEqual(css.describe(resolve(detached)).cssRules,css.describe(resolve(after)).cssRules);assert.deepEqual(Object.keys(linked.links(resolve(detached))),['0']);
 const last=linked.plan(resolve(detached),{type:'detachTextStyle',width:0}).edits[0].after;assert.deepEqual(linked.links(resolve(last)),{});assert.ok(!last.includes('data-rt-text-styles'));
});
test('manual typography edits retain the applied baseline for future override-aware propagation',()=>{
 const after=apply(original).edits[0].after;
 const manual=css.plan(resolve(after),{width:0,property:'font-size',value:'40px'}).edits[0].after;
 assert.equal(css.describe(resolve(manual)).cssRules[0]['font-size'],'40px');assert.equal(linked.links(resolve(manual))[0].properties['font-size'],'32px');
});
test('invalid links, stale source, invalid widths and important inline conflicts refuse',()=>{
 assert.equal(linked.plan(resolve(original),{type:'applyTextStyle',width:0,fileHash:'stale'},style).ok,false);
 for(const width of [-1,1.5,8000])assert.equal(apply(original,width).ok,false);
 assert.equal(apply(original.replace('<h1>','<h1 data-rt-text-styles="garbage">')).ok,false);
 assert.equal(apply(original.replace('<h1>','<h1 style="font-size:20px!important">')).ok,false);
});
