'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { stampMod } = require('./helpers.cjs');
const { stamp } = stampMod;

const ROOT = '/app';
const file = path.join(ROOT, 'C.tsx');

test('stamps host elements with data-rt and instances with data-rt-i', () => {
  const src = `export const C = () => <div><h2>x</h2><Button>y</Button></div>;`;
  const out = stamp(src, file, ROOT);
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 2); // div, h2
  assert.strictEqual((out.code.match(/data-rt-i="/g) || []).length, 1); // Button
});

test('never stamps a fragment', () => {
  const src = `export const C = () => <><span>x</span></>;`;
  const out = stamp(src, file, ROOT);
  assert.ok(!/<>\s*data-rt/.test(out.code));
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 1); // span only
});

test('returns null for files with no JSX', () => {
  assert.strictEqual(stamp('export const x = 1;', file, ROOT), null);
});

test('skips node_modules', () => {
  const nm = path.join(ROOT, 'node_modules', 'pkg', 'C.tsx');
  assert.strictEqual(stamp('export const C = () => <div/>;', nm, ROOT), null);
});

test('skips non-tsx/jsx files', () => {
  assert.strictEqual(stamp('<div/>', path.join(ROOT, 'x.ts'), ROOT), null);
});

test('is idempotent on IDs: stamping twice yields the same IDs', () => {
  const src = `export const C = () => <div><h2>x</h2></div>;`;
  const a = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  const b = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  assert.deepStrictEqual(a, b);
});

test('produces a source map', () => {
  const out = stamp(`export const C = () => <div/>;`, file, ROOT);
  assert.ok(out.map && out.map.mappings);
});
