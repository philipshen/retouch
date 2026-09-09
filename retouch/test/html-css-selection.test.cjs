'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),selection=require('../src/html-css-selection.cjs');
const source='<html><head></head><body><main><h1>Title</h1><p>Paragraph</p><img src="x.png"></main></body></html>';
function resolve(source){const elements=html.collect(source,'index.html').elements;return {source,hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html',elements,element:elements.find(e=>e.tag==='h1')};}
function operation(r,extra={}){return {ids:r.elements.filter(e=>['h1','p'].includes(e.tag)).map(e=>e.id),fileHash:r.hash,width:768,property:'width',value:'240px',...extra};}
test('HTML shared styling returns one atomic source edit with isolated responsive identities',()=>{
 const r=resolve(source),result=selection.plan(r,operation(r));assert.equal(result.ok,true);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);
 for(const info of result.selection)assert.deepEqual(info.cssRules,{768:{width:'240px'}});
 const fresh=resolve(result.edits[0].after);assert.deepEqual(css.describe({...fresh,element:fresh.elements.find(e=>e.tag==='img')}).cssRules,{});
 assert.equal(new Set(result.selection.map(info=>fresh.elements.find(e=>e.id===info.id).node.attrs.find(a=>a.name==='data-rt-style').value)).size,2);
 const noop=selection.plan(fresh,operation(fresh));assert.deepEqual(noop.edits,[]);
 const reset=selection.plan(fresh,operation(fresh,{value:null}));assert.equal(reset.ok,true);for(const info of reset.selection)assert.deepEqual(info.cssRules,{});
});
test('HTML shared styling refuses the entire edit when any selected layer conflicts',()=>{
 const r=resolve(source.replace('<p>','<p style="width:100px !important">'));
 const result=selection.plan(r,operation(r));assert.equal(result.refused,true);assert.equal(result.edits,undefined);assert.equal(r.source,source.replace('<p>','<p style="width:100px !important">'));
 const invalid=selection.plan(r,operation(r,{property:'color',value:'red;display:none'}));assert.equal(invalid.refused,true);
});
test('HTML shared styling refuses stale, unknown, duplicate and non-body selections',()=>{
 const r=resolve(source),ids=operation(r).ids;
 for(const extra of [{fileHash:'stale'},{fileHash:undefined},{ids:[ids[0],ids[0]]},{ids:[ids[0],'0000000000']},{ids:[ids[0],r.elements.find(e=>e.tag==='head').id]},{ids:[ids[0]]},{ids:['not-an-id',ids[0]]}])assert.equal(selection.plan(r,operation(r,extra)).refused,true);
});
