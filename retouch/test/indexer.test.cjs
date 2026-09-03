'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Index, makeApp, cleanup, id } = require('./helpers.cjs');

test('scanAll indexes every JSX file and skips ignored dirs', () => {
  const root = makeApp({
    'a/Page.tsx': `export const P = () => <div><h2>x</h2></div>;`,
    'b/Card.jsx': `export const C = () => <section/>;`,
    'node_modules/pkg/X.tsx': `export const X = () => <div/>;`,
    '.next/Y.tsx': `export const Y = () => <div/>;`,
    'notes.ts': `export const z = 1;`,
  });
  const idx = new Index(root);
  const count = idx.scanAll();
  assert.strictEqual(count, 2); // only a/Page.tsx and b/Card.jsx
  assert.ok(idx.idToFile.size >= 3); // div, h2, section
  cleanup(root);
});

test('resolve returns a fresh parse with the current hash', () => {
  const root = makeApp({ 'P.tsx': `export const P = () => <div className="a">x</div>;` });
  const idx = new Index(root); idx.scanAll();
  const anyId = [...idx.idToFile.keys()][0];
  const r = idx.resolve(anyId);
  assert.ok(r.element);
  assert.strictEqual(r.hash, id.contentHash(fs.readFileSync(path.join(root, 'P.tsx'), 'utf8')));
  cleanup(root);
});

test('resolve self-heals after an external edit (re-derives IDs)', () => {
  const root = makeApp({ 'P.tsx': `export const P = () => <div className="a">x</div>;` });
  const idx = new Index(root); idx.scanAll();
  const abs = path.join(root, 'P.tsx');
  const divId = [...idx.idToFile.keys()].find((k) => idx.idToFile.get(k) === abs);
  // Edit the class externally; the div's structural ID is unchanged.
  fs.writeFileSync(abs, `export const P = () => <div className="b c">x</div>;`);
  idx.indexFile(abs);
  const r = idx.resolve(divId);
  assert.ok(r, 'still resolves after external edit');
  cleanup(root);
});

test('unknown id resolves to null', () => {
  const root = makeApp({ 'P.tsx': `export const P = () => <div/>;` });
  const idx = new Index(root); idx.scanAll();
  assert.strictEqual(idx.resolve('ffffffffff'), null);
  cleanup(root);
});

test('a file that fails to parse is recorded, not fatal', () => {
  const root = makeApp({
    'Good.tsx': `export const G = () => <div/>;`,
    'Bad.tsx': `export const B = () => <div`,
  });
  const idx = new Index(root);
  assert.doesNotThrow(() => idx.scanAll());
  assert.ok(idx.errors.has(path.join(root, 'Bad.tsx')));
  assert.ok(idx.idToFile.size >= 1); // Good.tsx still indexed
  cleanup(root);
});

test('deleting a file removes its ids on re-index', () => {
  const root = makeApp({ 'P.tsx': `export const P = () => <div/>;` });
  const idx = new Index(root); idx.scanAll();
  const before = idx.idToFile.size;
  assert.ok(before >= 1);
  fs.rmSync(path.join(root, 'P.tsx'));
  idx.indexFile(path.join(root, 'P.tsx'));
  assert.strictEqual(idx.idToFile.size, 0);
  cleanup(root);
});
