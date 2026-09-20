'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),planner=require('../src/layer-style-paste.cjs');
for(const renderer of ['react','liquid']){
 const adapter=require('../src/adapters/'+renderer+'.cjs'),source=renderer==='react'?'export default function Page(){return <main><p className="text-lg/8">One</p><p className="p-4">Two</p></main>}':'<p class="text-lg/8">One</p><p class="p-4">Two</p>';
 function resolve(source){const relPath=renderer==='react'?'Page.jsx':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements.find(e=>adapter.describe({source,relPath,elements,element:e}).tag==='p')};}
 function request(r){const ids=r.elements.filter(e=>adapter.describe({...r,element:e}).tag==='p').map(e=>e.id);return {ids,fileHash:r.hash,scope:'md:',contexts:Object.fromEntries(ids.map(id=>[id,{className:adapter.describe({...r,element:r.elements.find(e=>e.id===id)}).className}])),changesById:Object.fromEntries(ids.map(id=>[id,{color:'red','font-size':'24px',padding:'12px 18px'}]))};}
 test(renderer+' style paste writes one source transaction and keeps selection identity',()=>{
  const r=resolve(source),op=request(r),result=planner.plan(r,op,adapter);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.deepEqual(result.selection.map(e=>e.id),op.ids);for(const info of result.selection)assert.ok(info.className.includes('md:![padding:12px_18px]'));
  const next=resolve(result.edits[0].after);assert.deepEqual(planner.plan(next,request(next),adapter).edits,[]);
  const id=op.ids[0],single=planner.plan(r,{...op,ids:[id],changesById:{[id]:op.changesById[id]}},adapter);assert.equal(single.ok,true,single.reason);assert.ok(single.edits[0].after.includes(renderer==='react'?'className="p-4"':'class="p-4"'));
 });
 test(renderer+' refuses the whole paste when a later target fails or source is stale',()=>{
  const r=resolve(source),op=request(r);for(const patch of [{fileHash:'stale'},{ids:[op.ids[0],op.ids[0]]},{changesById:{...op.changesById,[op.ids[1]]:{color:'red;display:none'}}}]){const result=planner.plan(r,{...op,...patch},adapter);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
  const dynamic=resolve(source.replace(renderer==='react'?'className="p-4"':'class="p-4"',renderer==='react'?'className={classes}':'class="{{ classes }}"')),result=planner.plan(dynamic,request(dynamic),adapter);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
 });
}
