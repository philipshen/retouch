'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const language of ['html','liquid'])test(language+' unchanged literal text preserves entity spellings and surrounding source bytes',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),relPath=language==='html'?'index.html':'main.liquid';
 for(const inner of ['&quot;Hello&quot; &#x1F44B; &nbsp; &#169; &amp;lt;','\n  Formatted &amp; text\n','&nbsp;','']){
  const source='<main><p class="caption">'+inner+'</p><aside>Keep</aside></main>',elements=adapter.collect(source,relPath).elements,resolved={source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements,element:elements.find(e=>e.tag==='p')},text=adapter.describe(resolved).text;
  assert.equal(typeof text,'string');const noop=adapter.planOp(resolved,{type:'setText',text,fileHash:resolved.hash});assert.equal(noop.ok,true,noop.reason);assert.ok(noop.edits.every(edit=>edit.after===source),'An unchanged field must not normalize authored entities or whitespace');
  const changed=adapter.planOp(resolved,{type:'setText',text:text+'!',fileHash:resolved.hash});assert.equal(changed.ok,true,changed.reason);const after=changed.edits[0].after;assert.notEqual(after,source);assert.ok(after.includes('<aside>Keep</aside>'));assert.deepEqual(adapter.collect(after,relPath).elements.map(e=>e.id),elements.map(e=>e.id));
 }
});
