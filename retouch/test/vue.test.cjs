'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const adapter = require('../src/adapters/vue.cjs');
const { Index } = require('../src/indexer.cjs');
const { SourceHistory } = require('../src/history.cjs');
const source = '<script setup lang="ts">const title: string = "Keep";</script>\r\n<template><main><h1 title="a > b" :class="title">Hello &amp; Vue</h1><img src="/old.png"/><p></p><span>{{ title }}</span></main></template>\r\n<style scoped>h1 { color: red; }</style>';
function fixture(t, text = source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-write-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(file, text);
  const index = new Index(root, adapter); index.scanAll();
  return { root, file, index, resolve(tag) { index.indexFile(file); const element = adapter.collect(fs.readFileSync(file, 'utf8'), 'App.vue').elements.find(item => item.tag === tag); return index.resolve(element.id); } };
}
test('Vue text edits preserve bindings and other SFC blocks with exact undo and redo', t => {
  const { root, file, resolve } = fixture(t), history = new SourceHistory(), before = resolve('h1');
  const result = history.commit(root, adapter.planOp(before, { type: 'setText', text: '<b>{{ title }}</b> & 😀', fileHash: before.hash }));
  assert.equal(result.ok, true, result.reason);
  const changed = fs.readFileSync(file, 'utf8');
  assert.equal(changed, source.replace('Hello &amp; Vue', '&lt;b&gt;&#123;&#123; title &#125;&#125;&lt;/b&gt; &amp; 😀'));
  assert.equal(adapter.describe(resolve('h1')).text, '<b>{{ title }}</b> & 😀');
  assert.equal(resolve('h1').element.id, before.element.id);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), changed);
});
test('Vue empty text, literal images, layer names and heading tags use source locations', t => {
  const { file, resolve } = fixture(t);
  assert.equal(adapter.applyOp(resolve('p'), { type: 'setText', text: 'New paragraph' }).ok, true);
  assert.equal(adapter.applyOp(resolve('h1'), { type: 'setTag', tag: 'h2' }).ok, true);
  assert.equal(adapter.applyOp(resolve('h2'), { type: 'renameElement', name: 'Hero "title"' }).ok, true);
  assert.equal(adapter.describe(resolve('h2')).layerName, 'Hero "title"');
  assert.equal(adapter.applyOp(resolve('img'), { type: 'setSrc', src: '/image.png?x=1&y=2' }).ok, true);
  assert.equal(adapter.describe(resolve('img')).src, '/image.png?x=1&y=2');
  const changed = fs.readFileSync(file, 'utf8');
  assert.ok(changed.includes('<p>New paragraph</p>'));
  assert.ok(changed.includes('</h2>'));
  assert.ok(changed.includes(':class="title"'));
  assert.equal(adapter.applyOp(resolve('h2'), { type: 'renameElement', name: '' }).ok, true);
  assert.equal(adapter.describe(resolve('h2')).layerName, '');
});
test('Vue refuses expression replacement, stale source, unsafe image schemes and unsupported operations', t => {
  const { file, resolve } = fixture(t);
  for (const op of [{ type: 'setText', text: 'Replace expression' }, { type: 'setTag', tag: 'p' }]) assert.equal(adapter.planOp(resolve('span'), op).refused, true);
  assert.equal(adapter.planOp(resolve('h1'), { type: 'setText', text: 'x', fileHash: 'stale' }).refused, true);
  assert.equal(adapter.planOp(resolve('img'), { type: 'setSrc', src: 'javascript:alert(1)' }).refused, true);
  assert.equal(adapter.planOp(resolve('h1'), { type: 'setClasses', classes: 'new' }).refused, true);
  const old = resolve('h1'); fs.appendFileSync(file, '\n<!-- external -->');
  assert.equal(adapter.applyOp(old, { type: 'setText', text: 'stale' }).refused, true);
  assert.equal(fs.readFileSync(file, 'utf8'), source + '\n<!-- external -->');
});
test('Vue dynamic and responsive image sources, text directives and bound names retain ownership', t => {
  for (const template of ['<img :src="url"/>', '<img src="x" :srcset="set"/>', '<picture><img src="x"/></picture>', '<img src="one" SRC="two"/>']) {
    const { resolve } = fixture(t, '<template>' + template + '</template>');
    assert.equal(adapter.describe(resolve('img')).canSetSrc, false);
    assert.equal(adapter.planOp(resolve('img'), { type: 'setSrc', src: '/new.png' }).refused, true);
  }
  for (const template of ['<p v-html="html"/>', '<p v-text="text">Old</p>', '<p><strong>Nested</strong></p>']) {
    const { resolve } = fixture(t, '<template>' + template + '</template>');
    assert.equal(adapter.describe(resolve('p')).text, null);
    assert.equal(adapter.planOp(resolve('p'), { type: 'setText', text: 'x' }).refused, true);
  }
  const { resolve } = fixture(t, '<template><p :data-rt-name="name">Text</p></template>');
  assert.equal(adapter.planOp(resolve('p'), { type: 'renameElement', name: 'New' }).refused, true);
});
test('Vue adapter preserves custom interpolation delimiters as literal edited text', () => {
  const custom = adapter.create({ compilerOptions: { delimiters: ['[[', ']]'] } });
  const source = '<template><p>Literal</p></template>', elements = custom.collect(source, 'App.vue');
  const resolved = { file: '/app/App.vue', relPath: 'App.vue', source, hash: custom.contentHash(source), element: elements.elements[0] };
  const changed = custom.planOp(resolved, { type: 'setText', text: '[[ dangerous() ]] & <b>' });
  assert.equal(changed.ok, true, changed.reason);
  assert.ok(changed.edits[0].after.includes('&#91;&#91; dangerous() ]] &amp; &lt;b&gt;'));
  assert.equal(custom.planOp(resolved, { type: 'setText', text: 'Ordinary text' }).ok, true);
});
test('Vue descriptions provide compiler-normalized text for retained-document history verification', t => {
  const { resolve } = fixture(t, '<template><main><h1>First\n   line</h1><p>   </p></main></template>');
  assert.equal(adapter.describe(resolve('h1')).text, 'First\n   line');
  assert.equal(adapter.describe(resolve('h1')).renderedText, 'First line');
  assert.equal(adapter.describe(resolve('p')).renderedText, '');
  const preserve = adapter.create({ compilerOptions: { whitespace: 'preserve' } });
  assert.equal(preserve.describe(resolve('h1')).renderedText, 'First\n   line');
});
