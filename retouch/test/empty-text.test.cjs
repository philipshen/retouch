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

for(const language of ['react','liquid'])test(language+' empty text preserves unsupported child bindings and element guards',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),relPath=language==='react'?'page.jsx':'main.liquid';
 const cases=language==='react'?['<p children={value}/>','<p children={value}></p>','<p {...props}></p>','<p dangerouslySetInnerHTML={{__html:value}}></p>','<section></section>']:['<p/>','<p x-text="value"></p>','<p>{{ value }}</p>','<section></section>'];
 for(const markup of cases){const source=language==='react'?'export default ()=>'+markup:markup,elements=adapter.collect(source,relPath).elements,resolved={source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements[0]};assert.equal(adapter.describe(resolved).text,null,markup);}
});

test('self-closing JSX text expands without changing props or sibling identities',()=>{
 const adapter=require('../src/adapters/react.cjs'),source='export default ()=> <main><p className="text-lg" aria-label="Caption" /><aside>Keep</aside></main>',relPath='page.jsx',elements=adapter.collect(source,relPath).elements,resolved={source,relPath,file:'/tmp/page.jsx',hash:adapter.contentHash(source),elements,element:elements.find(e=>e.node.openingElement.name.name==='p')};
 assert.equal(adapter.describe(resolved).text,'');
 const result=adapter.planOp(resolved,{type:'setText',text:'New <label> & {value}',fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,next=adapter.collect(after,relPath).elements;assert.ok(after.includes('<p className="text-lg" aria-label="Caption" >New &lt;label&gt; &amp; &#123;value&#125;</p>'));assert.ok(after.includes('<aside>Keep</aside>'));assert.deepEqual(next.map(e=>e.id),elements.map(e=>e.id));
 const noop=adapter.planOp(resolved,{type:'setText',text:'',fileHash:resolved.hash});assert.equal(noop.ok,true);assert.ok(noop.edits.every(edit=>edit.after===source));
});
