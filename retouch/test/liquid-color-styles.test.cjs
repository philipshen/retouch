'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs'),links=require('../src/liquid-color-styles.cjs'),engine=new(require('liquidjs').Liquid)();
const source='<p class="{% if active %}bg-red-500{% else %}bg-blue-500{% endif %} border-2">{{ title }}</p>',style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#12345678'}};
function resolve(source,context){const elements=liquid.collect(source,'main.liquid').elements;return {source,file:'/tmp/main.liquid',relPath:'main.liquid',element:elements[0],elements,hash:liquid.contentHash(source),context};}
async function attrs(source,active){return Object.fromEntries(require('parse5').parseFragment(await engine.parseAndRender(source,{active,title:'Title'})).childNodes[0].attrs.map(a=>[a.name,a.value]));}
test('Liquid color links preserve conditional branches and refresh unopened owned class patches',async()=>{
 assert.equal(links.plan(resolve(source),{type:'applyColorStyle',property:'background-color'},style).ok,false);
 const result=links.plan(resolve(source,{className:'bg-red-500 border-2'}),{type:'applyColorStyle',property:'background-color',scope:'md:'},style);assert.equal(result.ok,true,result.reason);const before=result.edits[0].after;
 assert.ok(before.includes('{% if active %}bg-red-500{% else %}bg-blue-500{% endif %} border-2'));
 const update=links.planFile('/tmp/main.liquid','main.liquid',before,{...style,properties:{color:'#ff000080'}});assert.equal(update.ok,true,update.reason);assert.equal(update.updated,1);
 for(const active of [false,true]){const rendered=await attrs(update.edits[0].after,active);assert.ok(rendered.class.includes(active?'bg-red-500':'bg-blue-500'));assert.ok(rendered.class.includes('md:![background-color:#ff000080]'));assert.equal(JSON.parse(rendered['data-rt-color-styles'])['md:']['background-color'].value,'#ff000080');}
 assert.deepEqual(links.planFile('/tmp/main.liquid','main.liquid',update.edits[0].after,{...style,properties:{color:'#ff000080'}}).edits,[]);
});
test('Liquid color override refresh preserves local paint until reset and detach leaves paint intact',()=>{
 const plain='<p class="border-2">Paint</p>',applied=links.plan(resolve(plain),{type:'applyColorStyle',property:'color'},style).edits[0].after,local=applied.replace('![color:#12345678]','![color:#ff0000]'),next={...style,properties:{color:'#00ff00'}};
 const refreshed=links.planFile('/tmp/main.liquid','main.liquid',local,next);assert.equal(refreshed.ok,true,refreshed.reason);let r=resolve(refreshed.edits[0].after);assert.deepEqual(links.describe(r).colorStyleOverrides[''],['color']);assert.ok(liquid.describe(r).className.includes('![color:#ff0000]'));
 const reset=links.plan(r,{type:'resetColorStyle',property:'color'},next);assert.equal(reset.ok,true,reset.reason);r=resolve(reset.edits[0].after);assert.deepEqual(links.describe(r).colorStyleOverrides[''],[]);const before=liquid.describe(r).className,detach=links.plan(r,{type:'detachColorStyle',property:'color'});assert.equal(detach.ok,true,detach.reason);assert.equal(liquid.describe(resolve(detach.edits[0].after)).className,before);
});
test('Liquid color metadata refuses stale or generated input without partial source edits',()=>{
 for(const bad of ['<p {{ attrs }}>Text</p>','<p class="a" class="b">Text</p>','<p data-rt-color-styles="{{ links }}">Text</p>','<p data-rt-color-styles="bad">Text</p>']){const result=links.plan(resolve(bad),{type:'applyColorStyle',property:'color'},style);assert.equal(result.ok,false,bad);assert.equal(result.edits,undefined);}
 assert.equal(links.plan(resolve('<p>Text</p>'),{type:'applyColorStyle',property:'color',fileHash:'stale'},style).ok,false);
});
