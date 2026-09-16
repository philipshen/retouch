'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const adapter = require('../src/adapters/vue.cjs'), { SourceHistory } = require('../src/history.cjs');
const original = '<script setup>const count = 2</script>\r\n<template><main>\n  <div data-rt-name="First"><span>{{ count }}</span></div>\n  <div data-rt-name="Second">Two</div>\n  <div data-rt-name="Third">Three</div>\n</main></template>\r\n<style scoped>div { padding: 4px; }</style>';
function resolve(source = original, name = 'First') {
  const elements = adapter.collect(source, 'App.vue').elements;
  return { file: '/app/App.vue', relPath: 'App.vue', source, elements, hash: adapter.contentHash(source),
    element: elements.find(element => element.attributes.some(attribute => attribute.name === 'data-rt-name' && attribute.value === name)) };
}
test('Vue sibling ordering preserves expressions, source bytes, CSS ownership and descendant identity mapping', () => {
  let before = resolve();
  const styled = adapter.planOp(before, { type: 'setCSS', fileHash: before.hash, width: 768, property: 'padding', value: '16px' });
  assert.equal(styled.ok, true, styled.reason);
  before = resolve(styled.edits[0].after);
  const result = adapter.planOp(before, { type: 'moveElement', direction: 'last', fileHash: before.hash });
  assert.equal(result.ok, true, result.reason);
  const after = result.edits[0].after, next = resolve(after);
  const fragment = before.source.slice(before.element.start, before.element.end);
  const second = '<div data-rt-name="Second">Two</div>', third = '<div data-rt-name="Third">Three</div>';
  assert.equal(after, before.source.replace(fragment + '\n  ' + second + '\n  ' + third, second + '\n  ' + third + '\n  ' + fragment));
  assert.equal(result.movedId, next.element.id);
  assert.deepEqual(adapter.describe(next).cssRules, { 768: { padding: '16px' } });
  const oldSpan = before.elements.find(element => element.tag === 'span'), newSpan = next.elements.find(element => element.tag === 'span');
  assert.ok(result.sourceIdMap.some(([from, to]) => from === oldSpan.id && to === newSpan.id));
  assert.equal(new Set(result.sourceIdMap.map(([, to]) => to)).size, result.sourceIdMap.length);
  assert.equal(adapter.describe(next).structure.canMoveLast, false);
  assert.equal(adapter.describe(next).structure.canMoveFirst, true);
});
test('Vue moves in each direction produce exact history snapshots', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-order-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const direction of ['before', 'after', 'first', 'last']) {
    fs.writeFileSync(file, original);
    const before = { ...resolve(original, 'Second'), file }, history = new SourceHistory();
    const result = history.commit(root, adapter.planOp(before, { type: 'moveElement', direction, fileHash: before.hash }));
    assert.equal(result.ok, true, result.reason);
    const after = fs.readFileSync(file, 'utf8');
    assert.notEqual(after, original);
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true);
    assert.equal(fs.readFileSync(file, 'utf8'), after);
  }
});
test('Vue ordering refuses ambiguous and control-flow sibling boundaries before writing', () => {
  for (const sibling of ['<div v-if="ready">Conditional</div>', '<div v-for="x in list">Repeat</div>', '<Widget/>', '<template v-if="ready"><div/></template>', '{{ value }}', 'mixed text', '<!-- attached comment -->', '<div v-bind="attrs"/>', '<svg/>']) {
    const before = resolve('<template><main><div data-rt-name="First">One</div>' + sibling + '</main></template>');
    assert.equal(adapter.describe(before).structure.canMoveAfter, false, sibling);
    assert.equal(adapter.planOp(before, { type: 'moveElement', direction: 'after', fileHash: before.hash }).refused, true, sibling);
  }
  const before = resolve();
  for (const op of [{ direction: 'after' }, { direction: 'last', fileHash: 'stale' }, { direction: 'invalid', fileHash: before.hash }, { direction: 'before', fileHash: before.hash }])
    assert.equal(adapter.planOp(before, { type: 'moveElement', ...op }).refused, true);
});
