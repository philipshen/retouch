'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Vue = require('vue'), dom = require('@vue/compiler-dom'), { renderToString } = require('vue/server-renderer');
const adapter = require('../src/adapters/vue.cjs'), { SourceHistory } = require('../src/history.cjs');
function resolve(source, tag = 'main', implementation = adapter) {
  const parsed = implementation.collect(source, 'App.vue');
  return { source, relPath: 'App.vue', file: '/app/App.vue', hash: implementation.contentHash(source), elements: parsed.elements, element: parsed.elements.find(element => element.tag === tag) };
}
test('Vue inserts text and frames without changing existing SFC blocks, expressions or source identities', () => {
  const source = '<script setup>const count = 2</script>\r\n<template>\r\n  <main title="a > b"><span>{{ count }}</span></main>\r\n</template>\r\n<style scoped>main{color:red}</style>';
  for (const preset of ['text', 'frame']) {
    const before = resolve(source), result = adapter.planOp(before, { type: 'insertElement', preset, fileHash: before.hash });
    assert.equal(result.ok, true, result.reason);
    const after = result.edits[0].after, next = resolve(after), created = next.elements.find(element => element.id === result.createdId);
    assert.equal(created.tag, preset === 'text' ? 'p' : 'div');
    assert.equal(result.parentId, before.element.id);
    assert.ok(next.element.node.children.includes(created.node));
    assert.equal(after.slice(0, source.indexOf('</main>')), source.slice(0, source.indexOf('</main>')));
    assert.ok(after.endsWith(source.slice(source.indexOf('</main>'))));
    assert.ok(after.includes('\r\n    <' + created.tag));
    assert.ok(before.elements.every(element => next.elements.some(candidate => candidate.id === element.id && candidate.tag === element.tag)));
  }
});
test('Vue expands self-closing native containers and restores exact snapshots', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-insert-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = '<template><main><div class="empty" /></main></template><style scoped>.empty{padding:4px}</style>';
  fs.writeFileSync(file, source);
  const before = { ...resolve(source, 'div'), file }, history = new SourceHistory();
  const result = history.commit(root, adapter.planOp(before, { type: 'insertElement', preset: 'text', fileHash: before.hash }));
  assert.equal(result.ok, true, result.reason);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /<div class="empty" >\n  <p>New text<\/p>\n<\/div>/);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), after);
});
test('Vue insertion retains parent loops and application compiler options', async () => {
  const custom = adapter.create({ compilerOptions: { delimiters: ['[[', ']]'] } });
  const before = resolve('<template><main><div v-for="item in items" :key="item">[[ item ]]</div></main></template>', 'div', custom);
  const result = custom.planOp(before, { type: 'insertElement', preset: 'text', fileHash: before.hash });
  assert.equal(result.ok, true, result.reason);
  const template = custom.collect(result.edits[0].after, 'App.vue').template.content;
  const render = new Function('Vue', dom.compile(template, { mode: 'function', delimiters: ['[[', ']]'] }).code)(Vue);
  const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ items: ['one', 'two'] }) }));
  assert.equal((html.match(/<p>New text<\/p>/g) || []).length, 2);
  assert.match(html, /one/); assert.match(html, /two/);
});
test('Vue text placement validates geometry and refuses overwritten or incompatible containers', () => {
  const before = resolve('<template><main/></template>');
  const result = adapter.planOp(before, { type: 'insertElement', preset: 'text', fileHash: before.hash, position: { x: 12.5, y: -4, width: 140, height: 80 } });
  assert.equal(result.ok, true, result.reason);
  assert.match(result.edits[0].after, /left:12.5px;top:-4px/);
  assert.match(result.edits[0].after, /width:140px;height:80px/);
  for (const op of [{ preset: 'unknown' }, { preset: 'frame', position: { x: 0, y: 0 } }, { preset: 'text', position: { x: NaN, y: 0 } }, { preset: 'text', position: { x: 0, y: 0, width: 0, height: 10 } }, { preset: 'text', fileHash: 'stale' }])
    assert.equal(adapter.planOp(before, { type: 'insertElement', fileHash: before.hash, ...op }).refused, true);
  for (const template of ['<main v-html="html"/>', '<main v-text="text"/>', '<p>Text</p>', '<img src="x"/>', '<svg><g/></svg>']) {
    const item = resolve('<template>' + template + '</template>', /^<([a-z]+)/.exec(template)[1]);
    assert.equal(adapter.describe(item).structure.canInsert, false);
    assert.equal(adapter.planOp(item, { type: 'insertElement', preset: 'text', fileHash: item.hash }).refused, true);
  }
});
