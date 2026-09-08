'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {describe,rewrite}=require('../src/rich-text-source.cjs');
test('backed HTML keeps attributes and opaque interpolation while formatting nested text',()=>{
  const html='<p>Hello <a href="/saved" class="brand"><span style="color:red">friend</span></a> {{ name }}.</p>';
  const options={tokens:['{{ name }}']};
  const root=describe(html,'source',options).descriptor.children[0],link=root.children[1],span=link.children[0];
  const token=root.children[2].parts.find(p=>p.t==='token');
  const result=rewrite(html,'source',[{t:'keep',id:root.id,children:[{t:'text',value:'Hello '},{t:'keep',id:link.id,children:[{t:'keep',id:span.id,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'friend'}]}]}]},{t:'text',value:' '},{t:'keep',id:token.id},{t:'text',value:'.'}]}],options);
  assert.equal(result,html.replace('>friend</span>','><strong>friend</strong></span>'));
  assert.throws(()=>rewrite(html,'source',[{t:'keep',id:'0000000000'}],options),/not unique/);
  assert.throws(()=>rewrite(html,'source',[{t:'keep',id:token.id,children:[{t:'text',value:'changed'}]}],options),/cannot have editable/);
});
test('new text cannot introduce executable markup or interpolation',()=>{
  const result=rewrite('Hello','source',[{t:'text',value:'<script>{{ name }}</script>'}]);
  assert.equal(result,'&lt;script&gt;&#123;&#123; name &#125;&#125;&lt;/script&gt;');
});
test('plain text preparation tolerates Liquid indentation without mutating text or allowing a content mismatch',()=>{
  const {prepare}=require('../shell/rich-text-source.js');
  const descriptor={children:[{t:'text',value:'A heading',parts:[{t:'text',value:'A heading'}]}]};
  const node={nodeType:3,textContent:'\n    A heading\n  '};
  const el={ownerDocument:{},childNodes:[node]};
  prepare(el,descriptor);
  assert.equal(node.textContent,'\n    A heading\n  ');
  assert.throws(()=>prepare({ownerDocument:{},childNodes:[{nodeType:3,textContent:'Different heading'}]},descriptor),/differs from its source/);
});
test('text commits remove only retained renderer padding, preserving whitespace stored in the source',()=>{
 const {storedText}=require('../shell/rich-text-source.js');
 assert.equal(storedText('\n    New heading','\n    Old heading\n  ','Old heading'),'New heading');
 assert.equal(storedText('\n    New heading\n  ','\n    Old heading\n  ','Old heading'),'New heading');
 assert.equal(storedText('  New heading  ','Old heading','Old heading'),'  New heading  ');
 assert.equal(storedText('\n      New heading  \n','\n      Old heading  \n','  Old heading  '),'  New heading  ');
});
