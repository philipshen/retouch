'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const links=require('../shell/link-values.js'),rich=require('../src/rich-text.cjs'),source=require('../src/rich-text-source.cjs');
test('text link URLs admit web, contact and relative references without executable schemes',()=>{
 for(const value of ['https://example.test/a?x=1&y=2','http://example.test','/about','#section','../page','mailto:a@example.test','tel:+123'])assert.equal(links.valid(value),true,value);
 for(const value of ['',null,'javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,test','file:///tmp/file','https://example.test/ x','java\nscript:alert(1)','\\example.test'])assert.equal(links.valid(value),false,String(value));
});
test('text link markup escapes source syntax and rejects nested or source-owned link contents',()=>{
 const node={t:'link',href:'/a?x="<&q={{value}}',children:[{t:'text',value:'Read'}]};
 assert.equal(rich.validateChildrenTree([node],0),null);
 const output=source.rewrite('Read','source',[node]);assert.match(output,/href="\/a\?x=&quot;&lt;&amp;q=&#123;&#123;value&#125;&#125;"/);
 assert.match(rich.linkMarkup(node,'Read',true),/href=\{/);
 assert.match(rich.validateChildrenTree([{...node,children:[node]}],0),/nested/);
 assert.match(rich.validateChildrenTree([{...node,children:[{t:'keep',id:'1234567890'}]}],0),/Source-owned/);
 const html='<a href="/old" id="owned">Read</a>',anchor=source.describe(html,'source').descriptor.children[0];
 assert.throws(()=>source.rewrite(html,'source',[{t:'keep',id:anchor.id,children:[node]}]),/nested/);
});
test('link reconstruction proof excludes dynamic URLs and attributed source anchors',()=>{
 const markup='<p><a href="/plain?a=1&amp;b=2">plain</a><a href="{{ url }}">dynamic</a><a href="/owned" id="owned">owned</a></p>';
 for(const kind of ['html','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),{elements}=adapter.collect(markup,'x.'+kind);
  const resolved={source:markup,elements,element:elements.find(e=>e.tag==='p')};
  assert.deepEqual(require('../src/link-source.cjs').describe(resolved,kind).plainLinkIds,[elements.find(e=>e.tag==='a').id],kind);
 }
 const descriptor=source.describe(markup,'source').descriptor.children[0].children;
 assert.deepEqual(descriptor.map(node=>node.plainLink),[true,false,false]);
});
