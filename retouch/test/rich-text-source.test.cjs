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

test('range styles serialize only enumerated weight and style values',()=>{
 const children=[{t:'style',property:'font-weight',value:'400',children:[{t:'style',property:'font-style',value:'normal',children:[{t:'text',value:'<regular>'}]}]}];
 assert.equal(rewrite('Text','source',children),'<span style="font-weight: 400;"><span style="font-style: normal;">&lt;regular&gt;</span></span>');
 for(const [property,value]of [['constructor','400'],['__proto__','normal'],['background','url(javascript:alert(1))'],['font-weight','400; color:red'],['font-style','expression(alert(1))']])assert.throws(()=>rewrite('Text','source',[{t:'style',property,value,children:[]}]),/Unsupported text range style/);
});

test('text range font size writes a constrained pixel style',()=>{
 const children=[{t:'style',property:'font-size',value:'24.5px',children:[{t:'text',value:'Sized'}]}];
 assert.equal(rewrite('Text','source',children),'<span style="font-size: 24.5px;">Sized</span>');
 assert.throws(()=>rewrite('Text','source',[{...children[0],value:'var(--size)'}]),/Unsupported text range style/);
});

test('range color styles preserve explicit alpha and gamut in source',()=>{
 for(const value of ['#12345680','color(display-p3 1 0.2 0.3 / 0.5)'])assert.equal(rewrite('Text','source',[{t:'style',property:'color',value,children:[{t:'text',value:'Color'}]}]),'<span style="color: '+value+';">Color</span>');
});

test('range font family quotes are escaped in HTML source',()=>{
 const children=[{t:'style',property:'font-family',value:'"Page Face", serif',children:[{t:'text',value:'Text'}]}];
 assert.equal(rewrite('Text','source',children),'<span style="font-family: &quot;Page Face&quot;, serif;">Text</span>');
});

test('combined range styles write one escaped span and reject invalid properties',()=>{
 const node={t:'styles',properties:{color:'#11223380','font-size':'24px','font-family':'"Page Face", serif','font-weight':'537.25'},children:[{t:'text',value:'Text'}]};
 assert.equal(rewrite('Text','source',[node]),'<span style="font-family: &quot;Page Face&quot;, serif; font-weight: 537.25; font-size: 24px; color: #11223380;">Text</span>');
 for(const properties of [{},[],{color:'#123456',position:'fixed'},{'font-weight':'400; color:red'},JSON.parse('{"__proto__":"x"}')])assert.throws(()=>rewrite('Text','source',[{...node,properties}]),/Unsupported text range style/);
});

test('line breaks use fixed HTML markup and cannot carry attributes or content',()=>{
 assert.equal(rewrite('old','source',[{t:'text',value:'one'},{t:'break'},{t:'wrap',tag:'strong',children:[{t:'text',value:'two'},{t:'break'}]}]),'one<br><strong>two<br></strong>');
 for(const node of [{t:'break',children:[]},{t:'break',onclick:'bad'}])assert.throws(()=>rewrite('old','source',[node]),/Bad line break/);
});
