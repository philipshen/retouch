'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs'),{plan}=require('../src/liquid-group-scale.cjs');
const source='{% for item in items %}<section><div data-rt-group=""><h1>{{ item.title | escape }}</h1><p>{{ item.text }}</p></div><p>Outside</p></section>{% endfor %}{% schema %}{"name":"Example"}{% endschema %}';
const resolve=source=>{const relPath='sections/main.liquid',elements=liquid.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(e=>e.tag==='div'),file:'/site/sections/main.liquid',hash:liquid.contentHash(source)};};
test('Liquid scaling preserves template expressions and stable identities across responsive source edits',()=>{
 const r=resolve(source),first=plan(r,{fileHash:r.hash,width:0,factor:1.5});assert.equal(first.ok,true,first.reason);assert.equal(first.edits[0].before,source);const next=resolve(first.edits[0].after),second=plan(next,{fileHash:next.hash,width:1100,factor:2});assert.equal(second.ok,true,second.reason);
 for(const result of [first,second]){const saved=result.edits[0].after,state=resolve(saved);assert.deepEqual(state.elements.map(e=>e.id),r.elements.map(e=>e.id));for(const token of ['{% for item in items %}','{{ item.title | escape }}','{{ item.text }}','{% endfor %}','{% schema %}{"name":"Example"}{% endschema %}'])assert.ok(saved.includes(token));assert.equal((saved.match(/data-rt-scale-runtime=/g)||[]).length,1);assert.ok(saved.endsWith('{% endraw %}'));}
 const metadata=JSON.parse(require('parse5').parseFragment('<textarea>'+resolve(second.edits[0].after).element.attributes.find(a=>a.name==='data-rt-scale').value+'</textarea>').childNodes[0].childNodes[0].value);assert.deepEqual(metadata.ranges,{0:1.5,1100:3});
});
test('Liquid prototype refuses ambiguous runtime ownership and generated child identities',()=>{
 for(const input of [source.replace('<h1>','{% for child in children %}<h1>').replace('</h1>','</h1>{% endfor %}'),source.replace('<h1>','<h1 {% if enabled %}data-rt-scale-member="x"{% endif %}>'),source.replace('<h1>','<h1 data-rt-scale="{}">')]){const r=resolve(input),result=plan(r,{fileHash:r.hash,width:0,factor:1.5});assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const r=resolve(source);assert.equal(plan(r,{fileHash:'stale',width:0,factor:1.5}).ok,false);for(const factor of [0,Infinity,'2',101])assert.equal(plan(r,{fileHash:r.hash,width:0,factor}).ok,false);
 const saved=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,edited=resolve(saved.replace('data-rt-scale-runtime="1"','data-rt-scale-runtime="2"'));assert.match(plan(edited,{fileHash:edited.hash,width:0,factor:2}).reason,/outside/);
});
