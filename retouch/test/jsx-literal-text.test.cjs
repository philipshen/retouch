'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),writer=require('../src/writer.cjs');
function target(inner){const source='export default()=> <p>'+inner+'</p>',relPath='page.jsx',elements=ids.collectElements(source,relPath).elements;return {source,relPath,file:'/tmp/page.jsx',hash:ids.contentHash(source),elements,element:elements[0]};}
test('JSX literal text reads named and numeric entities exactly once',()=>{
 for(const [inner,visible]of [['&quot;Hello&quot; &#x1F44B; &nbsp; &#169; &amp;lt;','"Hello" 👋 \u00a0 © &lt;'],['&nbsp;','\u00a0'],['&#x7b;value&#125;','{value}'],['&amp;amp;','&amp;']]){
  const resolved=target(inner);assert.equal(writer.describeElement(resolved).text,visible);const noop=writer.planOp(resolved,{type:'setText',text:visible,fileHash:resolved.hash});assert.equal(noop.ok,true);assert.ok(noop.edits.every(edit=>edit.after===resolved.source),'Applying unchanged rendered text preserves authored entity spellings');
  const changed=writer.planOp(resolved,{type:'setText',text:visible+'!',fileHash:resolved.hash});assert.equal(changed.ok,true,changed.reason);const elements=ids.collectElements(changed.edits[0].after,resolved.relPath).elements;assert.equal(writer.describeElement({...resolved,source:changed.edits[0].after,elements,element:elements[0]}).text,visible+'!');
 }
});
test('JSX literal text follows rendered line folding while preserving authored inline spaces',()=>{
 for(const [inner,visible]of [['  inline  ','  inline  '],['\n    Hello\n    world\n  ','Hello world'],['First\n\n  second','First second'],['\tHello\tworld\t',' Hello world '],['\n &nbsp; \n','\u00a0']])assert.equal(writer.describeElement(target(inner)).text,visible);
});
