'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { capture, restore, reconcile, sync } = require('../shell/render-sync.js');
function node(tag, children = [], values = {}) {
  const attrs = new Map(Object.entries(values));
  const n = { nodeType: tag ? 1 : 3, tagName: tag?.toUpperCase(), nodeValue: tag ? null : '', childNodes: [],
    get attributes() { return [...attrs].map(([name, value]) => ({ name, value })); },
    getAttribute: name => attrs.get(name) ?? null, hasAttribute: name => attrs.has(name),
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    insertBefore(child, before) { child.parentNode?.removeChild(child); const at = before ? this.childNodes.indexOf(before) : this.childNodes.length; this.childNodes.splice(at, 0, child); child.parentNode = this; },
    removeChild(child) { const at = this.childNodes.indexOf(child); assert.notEqual(at, -1); this.childNodes.splice(at, 1); child.parentNode = null; },
    querySelectorAll() { return []; },
  };
  if (!tag) delete n.attributes;
  children.forEach(c => n.insertBefore(c, null)); return n;
}
function text(value) { const n = node(null); n.nodeValue = value; return n; }
test('inline-edit rollback restores retained framework nodes and original nested state', () => {
  const a = text('hello '), b = text('world'), bold = node('strong', [b], { class: 'original' }), heading = node('h1', [a, bold]);
  const snapshot = capture(heading);
  heading.removeChild(a); heading.removeChild(bold);
  heading.insertBefore(node('em', [text('replacement')]), null);
  bold.setAttribute('class', 'temporary'); b.nodeValue = 'changed'; heading.setAttribute('contenteditable', 'true');
  restore(snapshot);
  assert.equal(heading.childNodes[0], a); assert.equal(heading.childNodes[1], bold); assert.equal(bold.childNodes[0], b);
  assert.equal(b.nodeValue, 'world'); assert.equal(bold.getAttribute('class'), 'original'); assert.equal(heading.hasAttribute('contenteditable'), false);
});
test('authoritative server reconciliation retains keyed node identity while reordering', () => {
  const a = node('p', [text('A')], { 'data-rt': 'a' }), b = node('p', [text('B')], { 'data-rt': 'b' });
  const parent = node('div', [a, b]);
  reconcile(parent, node('div', [node('p', [text('B new')], { 'data-rt': 'b' }), node('p', [text('A')], { 'data-rt': 'a' })]));
  assert.equal(parent.childNodes[0], b); assert.equal(parent.childNodes[1], a); assert.equal(b.childNodes[0].nodeValue, 'B new');
});
test('React waits for every live instance without fetching or navigating', async () => {
  const d = {}, values = ['new', 'old']; let polls = 0;
  const frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' } } };
  const result = await sync({ frame, timeout: 1000, select: current => { assert.equal(current, d); if (++polls > 1) values[1] = 'new'; return values; }, matches: value => value === 'new', fetcher: () => { throw new Error('React must use HMR'); } });
  assert.equal(result.method, 'hmr'); assert.equal(frame.contentDocument, d); assert.equal(polls, 2);
});
test('missing HMR reports stale preview without replacing the document', async () => {
  const d = {}, frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' } } };
  await assert.rejects(sync({ frame, timeout: 10, select: () => ['old'], matches: value => value === 'new' }), /Source saved, but the preview did not update/);
  assert.equal(frame.contentDocument, d);
});
test('Liquid reconciliation uses fetched renderer output without a document navigation', async () => {
  const live = node('h1', [text('old')], { 'data-rt': 'title' }), fresh = node('h1', [text('new')], { 'data-rt': 'title' });
  const d = { dispatchEvent() {} }, rendered = {};
  const savedParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) { assert.equal(html, 'authoritative response'); return rendered; } };
  const frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' }, CustomEvent: class {} } };
  try {
    const result = await sync({ frame, serverRendered: true, select: doc => [doc === rendered ? fresh : live], matches: el => el.childNodes[0].nodeValue === 'new', fetcher: async () => ({ ok: true, text: async () => 'authoritative response' }) });
    assert.equal(result.method, 'server'); assert.equal(live.childNodes[0].nodeValue, 'new'); assert.equal(frame.contentDocument, d);
  } finally { globalThis.DOMParser = savedParser; }
});
