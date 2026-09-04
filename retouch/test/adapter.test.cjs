'use strict';
// The adapter seam (DR-0015): the core depends only on this interface, so an
// adapter is contract-testable in isolation, and the Index works with any
// adapter passed in.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { getAdapter, defaultAdapter, register } = require('../src/adapter.cjs');
const { Index, makeApp, cleanup } = require('./helpers.cjs');

test('the default adapter is react and implements the interface', () => {
  const a = defaultAdapter();
  assert.strictEqual(a.name, 'react');
  for (const m of ['matches', 'stamp', 'collect', 'contentHash', 'describe', 'applyOp']) {
    assert.strictEqual(typeof a[m], 'function', `adapter.${m} is a function`);
  }
  assert.ok(a.capabilities && Array.isArray(a.capabilities.ops));
});

test('react.matches accepts tsx/jsx and rejects others and node_modules', () => {
  const a = getAdapter('react');
  assert.ok(a.matches('/app/Page.tsx'));
  assert.ok(a.matches('/app/Card.jsx'));
  assert.ok(!a.matches('/app/util.ts'));
  assert.ok(!a.matches('/app/node_modules/x/Y.tsx'));
});

test('the Index drives an arbitrary adapter, not JSX directly', () => {
  // A tiny fake adapter over a made-up ".lines" format: each non-empty line is
  // an element whose id is its line number. Proves the Index is language-blind.
  const fake = {
    name: 'lines',
    matches: (f) => f.endsWith('.lines'),
    collect: (src) => ({
      elements: src.split('\n').map((l, i) => ({ id: String(i).padStart(10, '0'), text: l }))
        .filter((e) => e.text.trim() !== ''),
    }),
    contentHash: (s) => 'h' + s.length,
    describe: (r) => ({ id: r.element.id, text: r.element.text }),
    applyOp: () => ({ ok: true, hash: 'x' }),
    stamp: () => null,
    capabilities: { ops: [] },
  };
  const root = makeApp({ 'a.lines': 'one\n\nthree', 'ignore.txt': 'x' });
  const idx = new Index(root, fake);
  const n = idx.scanAll();
  assert.strictEqual(n, 1); // only a.lines matched
  assert.strictEqual(idx.idToFile.size, 2); // "one" and "three"
  const r = idx.resolve('0000000000');
  assert.strictEqual(r.element.text, 'one');
  assert.strictEqual(r.hash, 'h' + 'one\n\nthree'.length);
  cleanup(root);
});

test('unknown adapter name throws', () => {
  assert.throws(() => getAdapter('does-not-exist'));
});
