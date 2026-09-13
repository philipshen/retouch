'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),values=require('../shell/html-css-values.js');
function resolve(source){return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')};}
function edit(source,property,value){const result=css.plan(resolve(source),{width:0,property,value});assert.equal(result.ok,true,result.reason);return result.edits[0]?.after||source;}
test('text truncation retains existing HTML layout declarations and restores them on reset',()=>{
 const original='<html><head></head><body><h1>Full text stays in the source</h1></body></html>';
 let source=edit(original,'display','inline-block');source=edit(source,'overflow','auto');const baseline=source;
 source=edit(source,'line-clamp','2');assert.deepEqual(css.describe(resolve(source)).cssRules[0],{display:'inline-block',overflow:'auto','line-clamp':'2'});assert.match(source,/-webkit-line-clamp:2 !important/);assert.match(source,/Full text stays in the source/);
 source=edit(source,'line-clamp','none');assert.match(source,/-webkit-line-clamp:unset !important/);source=edit(source,'line-clamp',null);assert.equal(source,baseline);
});
test('text truncation validates counts and refuses important inline dependencies',()=>{
 for(const count of ['1','2','1000','none',null])assert.equal(values.valid('line-clamp',count),true);
 for(const count of ['0','-1','1.5','1001','2;display:none','var(--count)',2])assert.equal(values.valid('line-clamp',count),false);
 for(const property of ['display','overflow','overflow-x','overflow-y','-webkit-line-clamp','-webkit-box-orient']){
  assert.equal(values.overlaps(property,'line-clamp'),true);
  const source='<html><head></head><body><h1 style="'+property+':initial !important">Text</h1></body></html>';
  assert.equal(css.plan(resolve(source),{width:0,property:'line-clamp',value:'2'}).refused,true);
 }
});
