'use strict';
// Fast DOM->op-tree tests using a tiny fake DOM (no browser). Covers the
// rich-text serialization that maps in-place edits back to source ops.
const { test } = require('node:test');
const assert = require('node:assert');
const { serializeChildren } = require('../shell/serialize.js');

// Minimal DOM node factory matching what serializeChildren reads.
function text(value) {
  return { nodeType: 3, textContent: value };
}
function el(tag, children, attrs) {
  attrs = attrs || {};
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    childNodes: children || [],
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    get textContent() {
      return (this.childNodes || []).map((c) => c.textContent).join('');
    },
  };
  return node;
}

test('plain text run', () => {
  const tree = serializeChildren(el('h1', [text('Hello world')]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'Hello world' }]);
});

test('bold wrap becomes a strong node', () => {
  const tree = serializeChildren(el('h1', [text('a '), el('strong', [text('b')]), text(' c')]));
  assert.deepStrictEqual(tree, [
    { t: 'text', value: 'a ' },
    { t: 'wrap', tag: 'strong', children: [{ t: 'text', value: 'b' }] },
    { t: 'text', value: ' c' },
  ]);
});

test('b/i/strike map to the canonical vocabulary', () => {
  const tree = serializeChildren(el('p', [el('b', [text('x')]), el('i', [text('y')]), el('strike', [text('z')])]));
  assert.deepStrictEqual(tree.map((n) => n.tag), ['strong', 'em', 's']);
});

test('an unchanged stamped child becomes a bare keep', () => {
  const span = el('span', [text('styled')], { 'data-rt': '0123456789' });
  const snap = new Map([['0123456789', 'styled']]);
  const tree = serializeChildren(el('h1', [text('a '), span, text(' b')]), snap);
  assert.deepStrictEqual(tree[1], { t: 'keep', id: '0123456789' });
});

test('an edited stamped child keeps its id and recurses', () => {
  const span = el('span', [text('CHANGED')], { 'data-rt': '0123456789' });
  const snap = new Map([['0123456789', 'styled']]);
  const tree = serializeChildren(el('h1', [span]), snap);
  assert.deepStrictEqual(tree[0], { t: 'keep', id: '0123456789', children: [{ t: 'text', value: 'CHANGED' }] });
});
test('formatting inside a preserved span is serialized even when its text is unchanged',()=>{
  const span=el('span',[el('strong',[text('same')])],{'data-rt-keep':'0123456789'});
  span.innerHTML='<strong>same</strong>';
  const snapshot=new Map([['0123456789',{html:'same'}]]);
  assert.deepStrictEqual(serializeChildren(el('p',[span]),snapshot),[{t:'keep',id:'0123456789',children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'same'}]}]}]);
});

test('deleting a stamped span leaves only surrounding text', () => {
  // The span node is simply absent from childNodes after deletion.
  const tree = serializeChildren(el('h1', [text('a '), text('b')]), new Map([['0123456789', 'styled']]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'a ' }, { t: 'text', value: 'b' }]);
});

test('unknown wrapper (paste artifact) flattens to its content', () => {
  const tree = serializeChildren(el('h1', [el('div', [el('font', [text('pasted')])])]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'pasted' }]);
});

test('nested formatting is preserved', () => {
  const tree = serializeChildren(el('p', [el('strong', [text('a '), el('em', [text('b')])])]));
  assert.deepStrictEqual(tree, [
    { t: 'wrap', tag: 'strong', children: [
      { t: 'text', value: 'a ' },
      { t: 'wrap', tag: 'em', children: [{ t: 'text', value: 'b' }] },
    ] },
  ]);
});

test('un-wrapping a bold run leaves plain text runs (adjacent text merges in the writer)', () => {
  // After un-bold, the DOM is the surrounding text plus the freed inner text.
  const tree = serializeChildren(el('h1', [text('Plain start'), text(' rest')]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'Plain start' }, { t: 'text', value: ' rest' }]);
});

test('empty text nodes are dropped', () => {
  const tree = serializeChildren(el('p', [text(''), text('x')]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'x' }]);
});


test('superscript and subscript retain selected text without attributes',()=>{
 const tree=serializeChildren(el('p',[text('H'),el('sub',[text('2')],{onclick:'bad'}),text('O x'),el('sup',[text('2')])]));
 assert.deepStrictEqual(tree,[{t:'text',value:'H'},{t:'wrap',tag:'sub',children:[{t:'text',value:'2'}]},{t:'text',value:'O x'},{t:'wrap',tag:'sup',children:[{t:'text',value:'2'}]}]);
 assert.equal(require('../src/rich-text.cjs').validateChildrenTree(tree,0),null);
});

test('new and mounted text range styles retain their constrained style tree',()=>{
 for(const [property,value]of [['font-weight','400'],['font-style','normal'],['font-size','24.5px']]){
  const span=el('SPAN',[text('selected')]);span.style={length:1,0:property,getPropertyValue:key=>key===property?value:''};
  const root=el('P',[span]);
  assert.deepStrictEqual(serializeChildren(root),[{t:'style',property,value,children:[{t:'text',value:'selected'}]}]);
 }
});

test('source-approved range wrapper changes bypass keep without losing its text',()=>{
 const span=el('SPAN',[text('selected')],{'data-rt':'0123456789'});span.style={length:1,0:'font-weight',getPropertyValue:()=> '700'};
 const snapshot=new Map([['0123456789','selected']]);
 assert.deepStrictEqual(serializeChildren(el('P',[span]),snapshot),[{t:'keep',id:'0123456789'}]);
 span.__rtReplaceRangeStyle=true;span.__rtRangeStyle='font-weight';
 assert.deepStrictEqual(serializeChildren(el('P',[span]),snapshot),[{t:'style',property:'font-weight',value:'700',children:[{t:'text',value:'selected'}]}]);
});

test('source writes retain authored alpha while rendered comparisons use CSSOM values',()=>{
 const span=el('SPAN',[text('color')]);span.style={length:1,0:'color',getPropertyValue:()=> 'rgba(17, 34, 51, 0.502)'};
 span.__rtRangeStyle='color';span.__rtRangeStyleValue='#11223380';span.__rtRangeStyleCSS='rgba(17, 34, 51, 0.502)';
 assert.equal(serializeChildren(el('P',[span]),new Map())[0].value,'#11223380');
 assert.equal(serializeChildren(el('P',[span]))[0].value,'rgba(17, 34, 51, 0.502)');
});

test('combined range serialization is canonical and retains authored alpha only for source writes',()=>{
 const span=el('span',[text('Text')]);
 span.style={length:2,0:'color',1:'font-weight',getPropertyValue:property=>property==='color'?'rgba(17, 34, 51, 0.502)':'537.25'};
 span.__rtRangeStyleValues={color:{css:'rgba(17, 34, 51, 0.502)',value:'#11223380'}};
 const root=el('p',[span]);
 assert.deepStrictEqual(serializeChildren(root,new Map()),[{t:'styles',properties:{'font-weight':'537.25',color:'#11223380'},children:[{t:'text',value:'Text'}]}]);
 assert.deepStrictEqual(serializeChildren(root),[{t:'styles',properties:{'font-weight':'537.25',color:'rgba(17, 34, 51, 0.502)'},children:[{t:'text',value:'Text'}]}]);
});

test('line breaks serialize explicitly while editor-only trailing placeholders do not',()=>{
 const placeholder=el('br');placeholder.__rtCaretPlaceholder=true;
 assert.deepStrictEqual(serializeChildren(el('p',[text('one'),el('br'),text('two'),el('br'),placeholder])),[{t:'text',value:'one'},{t:'break'},{t:'text',value:'two'},{t:'break'}]);
});

test('new text links serialize a literal URL and preserved source links stay kept',()=>{
 const a=el('a',[text('Read')],{href:'/docs?a=1&b=2'});
 assert.deepEqual(serializeChildren(el('p',[a])),[{t:'link',href:'/docs?a=1&b=2',children:[{t:'text',value:'Read'}]}]);
 const invalid=el('a',[text('Read')],{href:'javascript:alert(1)'});assert.deepEqual(serializeChildren(el('p',[invalid])),[{t:'text',value:'Read'}]);
 const kept=el('a',[text('Read')],{href:'/source',id:'source-link','data-rt':'1234567890'});assert.deepEqual(serializeChildren(el('p',[kept]),new Map([['1234567890','Read']])),[{t:'keep',id:'1234567890'}]);
});
test('kept anchor href edits serialize even when its children remain unchanged',()=>{
 const id='abcdef0123',anchor=el('a',[text('Read')],{'data-rt':id,href:'/new'});anchor.__rtLinkHref='/new';
 assert.deepStrictEqual(serializeChildren(el('p',[anchor]),new Map([[id,'Read']])),[{t:'keep',id,href:'/new'}]);
});

test('returning a kept link to its initial href avoids rewriting original source syntax',()=>{
 const id='abcdef0123',anchor=el('a',[text('Read')],{'data-rt':id,href:'/old'});anchor.__rtLinkHref='/old';anchor.innerHTML='Read';
 assert.deepStrictEqual(serializeChildren(el('p',[anchor]),new Map([[id,{html:'Read',href:'/old'}]])),[{t:'keep',id}]);
});
