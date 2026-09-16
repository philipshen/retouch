'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/vue.cjs'), sfc = require('@vue/compiler-sfc');
const { Index } = require('../src/indexer.cjs'), { SourceHistory } = require('../src/history.cjs');
const original = '<script setup>const active = true;</script>\n<template><main><h1 class="title">Hello</h1><p>Paragraph</p></main></template>\n<style scoped>.title { color: red; }</style>\n<style module>.card { display: grid; }</style>';
function fixture(t, source = original) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-css-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); fs.writeFileSync(file, source);
  const index = new Index(root, adapter); index.scanAll();
  return { root, file, read: () => fs.readFileSync(file, 'utf8'), resolve(tag = 'h1') { index.indexFile(file); const element = adapter.collect(fs.readFileSync(file, 'utf8'), 'App.vue').elements.find(element => element.tag === tag); return index.resolve(element.id); } };
}
test('Vue responsive CSS preserves scripts and author styles, compiles, and has exact undo/redo', t => {
  const { root, file, read, resolve } = fixture(t), history = new SourceHistory(), first = resolve();
  const result = history.commit(root, adapter.planOp(first, { type: 'setCSS', fileHash: first.hash, width: 0, changes: { color: '#123456', 'font-size': '28px', padding: '12px' } }));
  assert.equal(result.ok, true, result.reason);
  const changed = read(), parsed = sfc.parse(changed).descriptor;
  assert.equal(parsed.scriptSetup.content, sfc.parse(original).descriptor.scriptSetup.content);
  assert.deepEqual(parsed.styles.slice(0, 2).map(style => style.content), sfc.parse(original).descriptor.styles.map(style => style.content));
  assert.equal(parsed.styles.length, 3);
  assert.deepEqual(sfc.compileStyle({ source: parsed.styles[2].content, filename: file, id: 'test' }).errors, []);
  const info = adapter.describe(resolve());
  assert.deepEqual(info.cssRules[0], { color: '#123456', 'font-size': '28px', padding: '12px' });
  assert.equal(info.cssRendering.hash, adapter.contentHash(changed));
  assert.equal(info.cssRendering.attribute, 'data-rt-revision');
  assert.ok(parsed.styles[2].content.includes(info.cssRendering.value));
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(read(), original);
  assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.equal(read(), changed);
});
test('Vue dev stamping keeps the owned stylesheet slot stable through first edit and final undo', t => {
  const { root, file, read, resolve } = fixture(t), history = new SourceHistory();
  const compile = text => sfc.parse(adapter.stamp(text, file, root).code).descriptor.styles;
  const before = compile(original); assert.equal(before.length, 3); assert.equal(read(), original);
  const result = history.commit(root, adapter.planOp(resolve(), { type: 'setCSS', width: 0, property: 'width', value: '320px' }));
  assert.equal(result.ok, true, result.reason); assert.equal(compile(read()).length, before.length);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(compile(read()).length, before.length);
  assert.equal(sfc.parse(read()).descriptor.styles.length, 2);
});
test('Vue virtual style replacement preserves source maps for following script blocks', t => {
  const { root, file, read, resolve } = fixture(t, '<template><h1>Hello</h1></template>');
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 0, property: 'color', value: 'red' }).ok, true);
  const text=read()+'\n<script setup>const after = 42;</script>',custom=adapter.create({styleModule:()=> 'virtual:retouch-test.css'}),result=custom.stamp(text,file,root);
  assert.ok(result.code.includes('<style src="virtual:retouch-test.css"></style>'));
  const position=(input,offset)=>{const lines=input.slice(0,offset).split('\n');return {line:lines.length,column:lines.at(-1).length};};
  const map=new (require('source-map-js').SourceMapConsumer)(JSON.parse(result.map.toString()));
  const actual=map.originalPositionFor(position(result.code,result.code.indexOf('const after'))),expected=position(text,text.indexOf('const after'));
  assert.equal(actual.line,expected.line);assert.equal(actual.column,expected.column);
});
test('Vue screen-specific rules retain base styles and reset only the selected scope', t => {
  const { resolve } = fixture(t);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 0, changes: { color: 'red', padding: '10px' } }).ok, true);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 768, changes: { color: 'blue', 'font-size': '42px' } }).ok, true);
  let info = adapter.describe(resolve()); assert.equal(info.cssRules[0].color, 'red'); assert.equal(info.cssRules[768].color, 'blue');
  assert.match(info.cssRuleTexts[768], /^@media \(min-width: 768px\)/);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 768, resetScope: true }).ok, true);
  info = adapter.describe(resolve()); assert.deepEqual(Object.keys(info.cssRules), ['0']); assert.equal(info.cssRules[0].color, 'red');
});
test('Vue CSS refuses changed owned rules, invalid values and ambiguous or dynamic ownership', t => {
  const { file, read, resolve } = fixture(t);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 0, property: 'color', value: 'red' }).ok, true);
  fs.writeFileSync(file, read().replace('color:red !important;', 'color:blue !important;'));
  assert.equal(adapter.planOp(resolve(), { type: 'setCSS', width: 0, property: 'color', value: 'green' }).refused, true);
  assert.match(adapter.describe(resolve()).cssReason, /changed outside/);
  for (const template of ['<h1 :style="styles">Hi</h1>', '<h1 data-rt-style="">Hi</h1>', '<h1 :data-rt-style="id">Hi</h1>', '<h1 data-rt-style="abcdef0123">Hi</h1><p data-rt-style="abcdef0123">Other</p>']) {
    const other = fixture(t, '<template>' + template + '</template>');
    assert.equal(adapter.planOp(other.resolve(), { type: 'setCSS', width: 0, property: 'color', value: 'red' }).refused, true);
  }
  const clean = fixture(t);
  for (const changes of [{ color: 'red;}</style><script>evil()</script>' }, { 'font-size': '-12px' }]) assert.equal(adapter.planOp(clean.resolve(), { type: 'setCSS', width: 0, changes }).refused, true);
  assert.equal(adapter.planOp(clean.resolve(), { type: 'setCSS', width: -1, property: 'color', value: 'red' }).refused, true);
  assert.equal(adapter.planOp(clean.resolve(), { type: 'setCSS', width: 0, property: 'color', value: 'red', fileHash: 'stale' }).refused, true);
});
test('Vue CSS preserves inline priority and shared shorthand normalization', t => {
  const { resolve } = fixture(t, '<template><h1 style="padding: 8px !important">Hi</h1></template>');
  assert.equal(adapter.planOp(resolve(), { type: 'setCSS', width: 0, property: 'padding-left', value: '20px' }).refused, true);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 0, changes: { 'border-left-width': '2px', color: 'red' } }).ok, true);
  assert.equal(adapter.applyOp(resolve(), { type: 'setCSS', width: 0, property: 'border-width', value: '4px' }).ok, true);
  const rules = adapter.describe(resolve()).cssRules[0]; assert.equal(rules['border-width'], '4px'); assert.equal(rules['border-left-width'], undefined); assert.equal(rules.color, 'red');
});
test('Vue selection styling is one atomic transaction and an invalid target leaves source unchanged', t => {
  const { root, read, resolve } = fixture(t), first = resolve(), second = resolve('p'), ids = [first.element.id, second.element.id], history = new SourceHistory();
  const result = history.commit(root, adapter.planOp(first, { type: 'setCSSSelection', ids, fileHash: first.hash, width: 0, changesById: { [ids[0]]: { color: 'red' }, [ids[1]]: { color: 'blue' } } }));
  assert.equal(result.ok, true, result.reason); assert.equal(result.edits.length, 1); assert.equal(result.selection.length, 2);
  assert.equal(adapter.describe(resolve()).cssRules[0].color, 'red'); assert.equal(adapter.describe(resolve('p')).cssRules[0].color, 'blue');
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(read(), original);
  const bad = adapter.planOp(resolve(), { type: 'setCSSSelection', ids, fileHash: resolve().hash, width: 0, changesById: { [ids[0]]: { color: 'red' }, [ids[1]]: { color: 'invalid;value' } } });
  assert.equal(bad.refused, true); assert.equal(read(), original);
});
