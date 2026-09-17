'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/vue.cjs'), { SourceHistory } = require('../src/history.cjs');
const source = '<script setup>const label="Keep"</script>\r\n<template><main><section id="from"><div id="mover"><span>{{ label }}</span></div><div id="neighbor"/></section><section id="to"/></main></template>\r\n<style scoped>section{padding:4px}</style>';
function resolve(text = source, id = 'mover') {
  const elements = adapter.collect(text, 'App.vue').elements;
  return { source: text, file: '/app/App.vue', relPath: 'App.vue', hash: adapter.contentHash(text), elements, element: elements.find(element => element.attributes.some(attribute => attribute.name === 'id' && attribute.value === id)) };
}
function move(before, id, position = 'inside') {
  return adapter.planOp(before, { type: 'reparentElement', destinationId: resolve(before.source, id).element.id, position, fileHash: before.hash });
}
test('Vue reparenting expands empty containers while retaining expressions, styles and source identity mapping', () => {
  let before = resolve();
  const styled = adapter.planOp(before, { type: 'setCSS', width: 768, property: 'padding', value: '20px', fileHash: before.hash });
  before = resolve(styled.edits[0].after);
  const result = move(before, 'to'); assert.equal(result.ok, true, result.reason);
  const after = result.edits[0].after, next = resolve(after), destination = resolve(after, 'to');
  assert.equal(result.movedId, next.element.id); assert.equal(result.destinationId, destination.element.id);
  assert.ok(destination.element.node.children.some(child => child.loc.start.offset === next.element.node.loc.start.offset));
  assert.deepEqual(adapter.describe(next).cssRules, { 768: { padding: '20px' } });
  assert.ok(after.includes('<section id="to">\r\n  '));
  assert.ok(after.endsWith(before.source.slice(before.source.indexOf('</template>'))));
  for (const old of before.elements) {
    const id = result.sourceIdMap.find(([from]) => from === old.id)?.[1] || old.id;
    assert.ok(next.elements.some(element => element.id === id && element.tag === old.tag));
  }
});
test('Vue supports before/after placement and exact undo/redo across containers', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-parent-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = source.replace('<section id="to"/>', '<section id="to"><div id="anchor"/></section>');
  for (const position of ['inside', 'before', 'after']) {
    fs.writeFileSync(file, original); const before = { ...resolve(original), file }, history = new SourceHistory();
    const result = history.commit(root, move(before, position === 'inside' ? 'to' : 'anchor', position));
    assert.equal(result.ok, true, result.reason);
    const after = fs.readFileSync(file, 'utf8'), next = resolve(after), anchor = resolve(after, 'anchor');
    assert.equal(next.element.start < anchor.element.start, position === 'before');
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), after);
  }
  const moved = move(resolve(original), 'to'), reverse = move(resolve(moved.edits[0].after), 'from');
  assert.equal(reverse.ok, true, reverse.reason);
});
test('Vue reparenting preserves lexical scope and refuses cycles, stale sources and generated destinations', () => {
  const before = resolve();
  for (const id of ['mover', 'from']) assert.equal(move(before, id).refused, true);
  assert.equal(adapter.planOp(before, { type: 'reparentElement', destinationId: resolve(source, 'to').element.id, fileHash: 'stale' }).refused, true);
  for (const destination of ['<section id="to" v-for="x in list"/>', '<section id="to" v-pre/>', '<Widget><section id="to"/></Widget>', '<section id="to" v-html="html"/>']) {
    const text = source.replace('<section id="to"/>', destination), item = resolve(text);
    assert.equal(move(item, 'to').refused, true, destination);
    assert.equal(adapter.describe(item).structure.reparentContainers.includes(resolve(text, 'to').element.id), false);
  }
  const sameLoop = '<template><main><section v-for="item in list" :key="item"><div id="from"><div id="mover">{{ item }}</div></div><div id="to"/></section></main></template>';
  assert.equal(move(resolve(sameLoop), 'to').ok, true);
  const pre = '<template><main><section v-pre><div id="from"><div id="mover">{{ literal }}</div></div><div id="to"/></section><div id="outside"/></main></template>';
  assert.equal(move(resolve(pre), 'to').ok, true);
  assert.equal(move(resolve(pre), 'outside').refused, true);
  const quoted = source.replace('id="to"', 'id="to" title="a > b v-pre"');
  assert.equal(move(resolve(quoted), 'to').ok, true);
});
