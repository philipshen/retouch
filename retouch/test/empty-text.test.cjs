'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const language of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+language+'.cjs'),relPath=language==='react'?'page.jsx':language==='liquid'?'main.liquid':'index.html';
 const target=source=>{const elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements.find(e=>language==='react'?e.node.openingElement.name.name==='p':e.tag==='p')};};
 test(language+' empty text can be filled and cleared while preserving its source identity',()=>{
  for(const inner of ['','   ']){
   const original=language==='react'?'export default ()=> <p>'+inner+'</p>':'<p>'+inner+'</p>',resolved=target(original);
   assert.equal(adapter.describe(resolved).text.trim(),'');
   const result=adapter.planOp(resolved,{type:'setText',text:'Recovered <label> & {value}',fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);
   const next=target(result.edits[0].after);assert.equal(next.element.id,resolved.element.id);assert.equal(adapter.describe(next).text,'Recovered <label> & {value}');
   const cleared=adapter.planOp(next,{type:'setText',text:'',fileHash:next.hash});assert.equal(cleared.ok,true,cleared.reason);assert.equal(adapter.describe(target(cleared.edits[0].after)).text,'');
  }
 });
}

for(const language of ['react','liquid'])test(language+' empty text keeps bound, self-closing and non-text elements guarded',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),relPath=language==='react'?'page.jsx':'main.liquid';
 const cases=language==='react'?['<p/>','<p children={value}></p>','<p {...props}></p>','<p dangerouslySetInnerHTML={{__html:value}}></p>','<section></section>']:['<p/>','<p x-text="value"></p>','<p>{{ value }}</p>','<section></section>'];
 for(const markup of cases){const source=language==='react'?'export default ()=>'+markup:markup,elements=adapter.collect(source,relPath).elements,resolved={source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements[0]};assert.equal(adapter.describe(resolved).text,null,markup);}
});
