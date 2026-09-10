'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs'),batch=require('../src/liquid-class-selection.cjs'),paint=require('../src/color-override-selection.cjs'),engine=new(require('liquidjs').Liquid)();
const source='<h1 class="{% if active %}font-bold{% else %}font-normal{% endif %}">First</h1><p class="{% if active %}tracking-wide{% else %}tracking-normal{% endif %}">Second</p>';
const resolve=source=>{const elements=liquid.collect(source,'main.liquid').elements;return {source,elements,element:elements[0],file:'/tmp/main.liquid',relPath:'main.liquid',hash:liquid.contentHash(source)};};
function op(source){const r=resolve(source),ids=r.elements.map(element=>element.id);return {ids,fileHash:r.hash,contexts:{[ids[0]]:{className:'font-bold'},[ids[1]]:{className:'tracking-wide'}},classesById:{[ids[0]]:'font-bold md:opacity-50',[ids[1]]:'tracking-wide md:p-4'}};}
test('Liquid class selections plan one snapshot and keep independent conditional branches',async()=>{
 const applied=batch.plan(resolve(source),op(source));assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits.length,1);assert.ok(applied.selection.every(info=>info.classSelection&&info.contextSelection));
 const after=applied.edits[0].after;for(const active of [true,false]){const rendered=await engine.parseAndRender(after,{active}),hosts=liquid.collect(rendered,'main.liquid').elements;assert.ok(hosts[0].classAttr.value.includes(active?'font-bold':'font-normal'));assert.ok(hosts[1].classAttr.value.includes(active?'tracking-wide':'tracking-normal'));assert.ok(hosts[0].classAttr.value.includes('md:opacity-50'));assert.ok(hosts[1].classAttr.value.includes('md:p-4'));assert.ok(!hosts[0].classAttr.value.includes('tracking-'));assert.ok(!hosts[1].classAttr.value.includes('font-'));}
 assert.deepEqual(batch.plan(resolve(after),op(after)).edits,[]);
 const unchanged=op(source);unchanged.classesById[unchanged.ids[0]]=null;const partial=batch.plan(resolve(source),unchanged);assert.equal(partial.ok,true);assert.ok(partial.edits[0].after.startsWith(source.slice(0,source.indexOf('<p'))));
 const painted=paint.plan(resolve(source),{...op(source),property:'color',value:'#123456ff',scope:'md:'},liquid);assert.equal(painted.ok,true,painted.reason);for(const info of painted.selection)assert.ok(info.className.includes('md:![color:#123456ff]'));
});
test('Liquid class selection refuses stale, malformed and unsupported later layers without partial edits',()=>{
 const request=op(source);
 for(const extra of [{fileHash:'stale'},{ids:[request.ids[0],request.ids[0]]},{contexts:{[request.ids[0]]:request.contexts[request.ids[0]]}},{classesById:{...request.classesById,[request.ids[1]]:'bad"class'}}]){const result=batch.plan(resolve(source),{...request,...extra});assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 for(const bad of [source.replace('<p class=','<p class="duplicate" class='),source.replace('<p class=','<p {{ attributes }} class=')]){const result=batch.plan(resolve(bad),op(bad));assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const missing=op(source);missing.contexts[missing.ids[1]]={};const result=batch.plan(resolve(source),missing);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
});
