'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const compiler = require('svelte/compiler');
const source = require('../src/svelte-source.cjs');
const styles = require('../src/svelte-css.cjs');
function resolve(text) {
  const relPath = 'App.svelte', elements = source.collect(text, relPath).elements;
  return { source: text, relPath, file: '/tmp/App.svelte', elements, element: elements.find(e => e.tag === 'h1'), hash: source.contentHash(text) };
}
function edit(text, changes, width = 0) {
  const r = resolve(text), result = styles.plan(r, { fileHash: r.hash, width, changes });
  assert.equal(result.ok, true, result.reason);
  return result.edits[0]?.after || text;
}
test('Svelte responsive CSS preserves authored styles, source structure and production compilation', () => {
  for (const original of ['<h1>Hello</h1>', '<h1>Hello</h1>\n<style>/* original */h1 { color: red; }</style>\n']) {
    const base = edit(original, { color: '#112233', padding: '12px' });
    const desktop = edit(base, { color: '#445566' }, 1024);
    const r = resolve(desktop), state = styles.inspect(r);
    assert.equal((desktop.match(/<style>/g) || []).length, 1);
    assert.deepEqual(state.model.layers[state.id], { 0: { color: '#112233', padding: '12px' }, 1024: { color: '#445566' } });
    assert.ok(styles.stylesheet(state.model).includes('@media (min-width: 1024px)'));
    assert.equal(styles.strip(desktop, r.relPath), original.replace('<h1', `<h1 data-rt-style="${r.element.id}"`));
    const compiled = compiler.compile(desktop, { filename: 'App.svelte', generate: 'client' });
    assert.ok(compiled.css.code.includes(`[data-rt-style="${state.id}"]`));
    assert.ok(compiled.css.code.includes('!important'));
    const reset = styles.plan(r, { fileHash: r.hash, width: 1024, resetScope: true });
    assert.equal(reset.ok, true, reset.reason);
    assert.equal(reset.edits[0].after, base);
    const rr = resolve(base), cleared = styles.plan(rr, { fileHash: rr.hash, width: 0, resetScope: true });
    assert.equal(cleared.ok, true, cleared.reason);
    assert.equal(cleared.edits[0].after, styles.strip(base, rr.relPath));
  }
});
test('Svelte CSS source plans refuse stale, conflicting and computed styles atomically', () => {
  for (const original of ['<h1 style={styles}>Hello</h1>', '<h1 style:color={color}>Hello</h1>', '<h1 style="color: red !important">Hello</h1>', '<h1 data-rt-style={id}>Hello</h1>', '<h1 data-rt-style="bad">Hello</h1>', '<h1 data-rt-style="aaaaaaaaaa">Hello</h1><Widget data-rt-style="aaaaaaaaaa"/>', '<h1 data-rt-style="aaaaaaaaaa">Hello</h1><div {...props} data-rt-style="aaaaaaaaaa"/>']) {
    const r = resolve(original), result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { color: '#112233' } });
    assert.equal(result.ok, false, original); assert.equal(result.edits, undefined);
  }
  const r = resolve('<h1>Hello</h1>');
  assert.equal(styles.plan(r, { fileHash: 'stale', width: 0, changes: { color: '#112233' } }).ok, false);
  assert.equal(styles.plan(r, { fileHash: r.hash, width: -1, changes: { color: '#112233' } }).ok, false);
});
test('Svelte CSS managed source detects tampering, missing owners and duplicate blocks', () => {
  const original = edit('<h1>Hello</h1>', { color: '#112233' });
  for (const changed of [original.replace('#112233', '#abcdef'), original.replace('data-rt-style=', 'data-other='), original.replace('</style>', 'h1{color:blue}</style>'), original.replace('/* /retouch-responsive */', '/* removed */'), original.replace('</style>', original.slice(original.indexOf('\n/* retouch-responsive:'), original.indexOf('</style>')) + '</style>')]) {
    const r = resolve(changed), result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { padding: '4px' } });
    assert.equal(result.ok, false, changed); assert.equal(result.edits, undefined);
  }
});
test('Svelte style identity collisions allocate a unique owner and unchanged writes are no-ops', () => {
  const original = '<h1>Hello</h1>', id = resolve(original).element.id;
  const withCollision = original + `<div data-rt-style="${id}">Other</div>`;
  const after = edit(withCollision, { color: '#112233' });
  const state = styles.inspect(resolve(after)); assert.notEqual(state.id, id);
  assert.equal(edit(after, { color: '#112233' }), after);
});
test('Svelte selection style plans are atomic across screen scopes and per-layer values', () => {
  const original = '<h1>Hello</h1><p>World</p><style>p{margin:0}</style>', r = resolve(original), ids = r.elements.map(e => e.id);
  const result = styles.planSelection(r, { fileHash: r.hash, width: 768, ids, changesById: { [ids[0]]: { color: '#112233' }, [ids[1]]: { padding: '8px' } } });
  assert.equal(result.ok, true, result.reason); assert.equal(result.edits.length, 1); assert.equal(result.edits[0].before, original);
  const after = result.edits[0].after, state = styles.documentState(after, r.relPath);
  assert.deepEqual(state.model.layers[ids[0]], { 768: { color: '#112233' } });
  assert.deepEqual(state.model.layers[ids[1]], { 768: { padding: '8px' } });
  compiler.compile(after, { filename: 'App.svelte', generate: 'client' });
  const rr = resolve(after), reset = styles.planSelection(rr, { fileHash: rr.hash, width: 768, ids, resetScope: true });
  assert.equal(reset.ok, true, reset.reason); assert.ok(reset.edits[0].after.endsWith('<style>p{margin:0}</style>'));
  for (const override of [{ fileHash: 'stale' }, { ids: [ids[0], ids[0]] }, { ids: [ids[0], 'aaaaaaaaaa'] }, { changesById: { [ids[0]]: { color: '#112233' }, [ids[1]]: { bogus: 'invalid' } } }]) {
    const refused = styles.planSelection(r, { fileHash: r.hash, width: 768, ids, changes: { padding: '8px' }, ...override });
    assert.equal(refused.ok, false); assert.equal(refused.edits, undefined);
  }
  const conflict = resolve('<h1>Hello</h1><p style="padding:1px!important">World</p>');
  const refused = styles.planSelection(conflict, { fileHash: conflict.hash, width: 768, ids: conflict.elements.map(e => e.id), changes: { padding: '8px' } });
  assert.equal(refused.ok, false); assert.match(refused.reason, /important inline/); assert.equal(refused.edits, undefined);
});
test('Svelte CSS refuses preprocessor blocks whose compilation cannot be proven', () => {
  const r = resolve('<h1>Hello</h1><style lang="scss">h1{color:red}</style>');
  const result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { color: '#112233' } });
  assert.equal(result.ok, false); assert.match(result.reason, /local CSS/);
});
