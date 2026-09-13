'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const proof=require('../src/range-style-source.cjs');
for(const kind of ['html','liquid'])test(kind+' range style evidence excludes attributes, bindings, mixed CSS and nested content',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');
 const source='<p><span style="font-weight: 400;">plain</span><span class="owned" style="font-weight:400">owned</span><span style="font-weight:400;color:red">color</span><span style="font-style:normal"><b>nested</b></span><span style="font-style:italic">italic</span></p>';
 const elements=adapter.collect(source,'test.'+(kind==='html'?'html':'liquid')).elements;
 const result=proof.describe({source,elements,element:elements.find(el=>el.tag==='p')},kind);
 assert.deepEqual(Object.values(result.rangeStyleIds),[{property:'font-weight',value:'400'},{property:'font-style',value:'italic'}]);
 if(kind==='liquid')for(const markup of ['<span style="font-weight: {{ weight }};">x</span>','<span style="font-weight:400">{{ label }}</span>','<span {% if active %}class="bound"{% endif %} style="font-weight:400">x</span>']){
  const element=adapter.collect(markup,'test.liquid').elements.find(el=>el.tag==='span');assert.equal(proof.style(element,markup,kind),null);
 }
});

for(const kind of ['html','liquid'])test(kind+' recognizes literal composite styles but excludes unknown properties and duplicates',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');
 for(const [style,expected]of [['font-size:24px;color:#11223380',{properties:{'font-size':'24px',color:'#11223380'}}],['font-size:24px;position:fixed',null],['font-size:24px;font-size:32px',null]]){
  const source='<span style="'+style+'">Text</span>',element=adapter.collect(source,'test.'+kind).elements.find(el=>el.tag==='span');assert.deepEqual(proof.style(element,source,kind),expected);
 }
});
