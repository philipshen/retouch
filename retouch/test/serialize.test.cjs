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

test('empty text nodes are dropped', () => {
  const tree = serializeChildren(el('p', [text(''), text('x')]));
  assert.deepStrictEqual(tree, [{ t: 'text', value: 'x' }]);
});
