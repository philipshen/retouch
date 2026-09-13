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
test('kept HTML link URL changes preserve all other attributes and refuse dynamic or ambiguous hrefs',()=>{
 const original=`<a id='owned' href='/old' class="site" target="_blank">Read <em>more</em></a>`,node=source.describe(original,'s').descriptor.children[0];
 assert.equal(node.editableLink,true);const changed=source.rewrite(original,'s',[{t:'keep',id:node.id,href:'/new?x="&y={{value}}'}]);
 assert.equal(changed,`<a id='owned' href="/new?x=&quot;&amp;y=&#123;&#123;value&#125;&#125;" class="site" target="_blank">Read <em>more</em></a>`);
 assert.match(source.rewrite(original,'s',[{t:'keep',id:node.id,href:'/new',children:[{t:'text',value:'Changed'}]}]),/>Changed<\/a>$/);
 for(const html of ['<a href="{{ url }}">x</a>','<a href="/one" href="/two">x</a>','<span href="/old">x</span>']){
  const kept=source.describe(html,'s').descriptor.children[0];assert.equal(kept.plainLink,false);for(const href of ['/new',null])assert.throws(()=>source.rewrite(html,'s',[{t:'keep',id:kept.id,href}]),/controlled/);
 }
 assert.match(rich.validateChildrenTree([{t:'keep',id:node.id,href:'javascript:alert(1)'}],0),/Invalid/);
});
test('kept HTML links remove and restore href without replacing the anchor',()=>{
 const initial=`<a id='owned' href='/old' class="site">Read</a>`,id=source.describe(initial,'s').descriptor.children[0].id;
 const removed=source.rewrite(initial,'s',[{t:'keep',id,href:null}]);assert.equal(removed,`<a id='owned'  class="site">Read</a>`);
 const next=source.describe(removed,'s').descriptor.children[0];assert.equal(next.editableLink,true);
 assert.equal(source.rewrite(removed,'s',[{t:'keep',id:next.id,href:'/new'}]),`<a id='owned'  class="site" href="/new">Read</a>`);
 assert.equal(source.rewrite(removed,'s',[{t:'keep',id:next.id,href:null}]),removed);
});
