'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const language of ['react','liquid']){
 const adapter=require('../src/adapters/'+language+'.cjs');
 const wrap=markup=>language==='react'?'export default function Page(){return <>'+markup+'</>}':markup;
 const target=source=>{const relPath=language==='react'?'page.jsx':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements.find(e=>language==='react'?e.node.openingElement.name.name==='main':e.tag==='main')};};
 test(language+' text/frame insertion preserves expressions, siblings and selectable source identities',()=>{
  for(const markup of ['<main></main><aside>Keep</aside>','<main><p>Existing</p></main><aside>Keep</aside>',language==='react'?'<main>{value}<Widget /></main><aside>Keep</aside>':'<main>{{ value }}{% if ok %}<p>Conditional</p>{% endif %}</main><aside>Keep</aside>',...(language==='react'?['<main /><aside>Keep</aside>']:[])])for(const preset of ['text','frame']){
   const source=wrap(markup),resolved=target(source),result=adapter.planOp(resolved,{type:'insertElement',preset,fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);
   const after=result.edits[0].after,next=adapter.collect(after,resolved.relPath).elements;assert.equal(next.length,resolved.elements.length+1);assert.ok(next.some(e=>e.id===result.createdId));assert.equal(result.parentId,resolved.element.id);assert.ok(after.includes('<aside>Keep</aside>'));
   for(const el of resolved.elements)assert.ok(next.some(e=>e.id===el.id));assert.equal(result.edits[0].before,source);
  }
 });
 test(language+' insertion rejects stale source and invalid presets without edits',()=>{
  const resolved=target(wrap('<main></main>'));
  for(const op of [{preset:'text',fileHash:'stale'},{preset:'script',fileHash:resolved.hash}]){const result=adapter.planOp(resolved,{type:'insertElement',...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 });
 test(language+' insertion refuses children bindings and invalid container markup',()=>{
  const cases=language==='react'?['<main {...props} />','<main children={value} />','<main dangerouslySetInnerHTML={{__html:value}} />','<svg><main /></svg>']:['{% if ok %}<main>{% endif %}</main>','<main>{% if ok %}</main>{% endif %}','<main>{% else %}</main>','<main>','<main/>','<main x-html="value"></main>','<div v-for="item in items"><main></main></div>','<svg><main></main></svg>'];
  for(const markup of cases){const resolved=target(wrap(markup)),result=adapter.planOp(resolved,{type:'insertElement',preset:'text',fileHash:resolved.hash});assert.equal(result.refused,true,markup);assert.equal(result.edits,undefined);}
 });
}
