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
test('Vue duplicates responsive styles independently, including nested styles and a block before the template', () => {
  let before = resolve();
  const apply = (resolved, changes) => {
    const result = adapter.planOp(resolved, { ...changes, fileHash: resolved.hash });
    assert.equal(result.ok, true, result.reason); return result.edits[0].after;
  };
  before = resolve(apply(before, { type: 'setCSS', width: 0, property: 'padding', value: '12px' }));
  before = resolve(apply(before, { type: 'setCSS', width: 768, property: 'padding', value: '24px' }));
  const child = before.elements.find(element => element.tag === 'span');
  before = resolve(apply({ ...before, element: child }, { type: 'setCSS', width: 0, property: 'color', value: '#ff0000' }));
  const css = require('../src/vue-css.cjs'), block = css.documentState(before.source, before.relPath).block;
  before = resolve(block.loc.source + before.source.replace(block.loc.source, ''));
  const result = adapter.planOp(before, { type: 'duplicateElement', fileHash: before.hash });
  assert.equal(result.ok, true, result.reason);
  const after = result.edits[0].after, parsed = resolve(after), copy = parsed.elements.find(element => element.id === result.createdId);
  assert.notEqual(copy.id, parsed.element.id);
  assert.deepEqual(adapter.describe({ ...parsed, element: copy }).cssRules, adapter.describe(parsed).cssRules);
  const markers = parsed.elements.flatMap(element => element.attributes.filter(attribute => attribute.name === 'data-rt-style').map(attribute => attribute.value));
  assert.equal(new Set(markers).size, 4);
  assert.equal(Object.keys(css.documentState(after, 'App.vue').model.layers).length, 4);
  const changed = apply({ ...parsed, element: copy }, { type: 'setCSS', width: 0, property: 'padding', value: '40px' });
  assert.equal(adapter.describe(resolve(changed)).cssRules[0].padding, '12px');
  const next = resolve(changed);
  assert.equal(adapter.describe({ ...next, element: next.elements.find(element => element.id === result.createdId) }).cssRules[0].padding, '40px');
  const oldSecond = before.elements.find(element => element.attributes.some(attribute => attribute.value === 'Second'));
  assert.ok(result.sourceIdMap.some(([id]) => id === oldSecond.id));
});
test('Vue deletion prunes only removed styles and restores exact source through history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-delete-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let before = resolve();
  const styled = adapter.planOp(before, { type: 'setCSS', fileHash: before.hash, width: 0, property: 'padding', value: '12px' });
  before = { ...resolve(styled.edits[0].after), file };
  fs.writeFileSync(file, before.source);
  const history = new SourceHistory(), result = history.commit(root, adapter.planOp(before, { type: 'deleteElement', fileHash: before.hash }));
  assert.equal(result.ok, true, result.reason);
  const after = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(after, /data-rt-vue-css|First|<span>/);
  assert.equal(result.removedSourceIds.length, 2);
  const surviving = resolve(after, 'Second');
  assert.equal(result.sourceIdMap.find(([from]) => from === before.elements.find(element => element.attributes.some(attribute => attribute.value === 'Second')).id)[1], surviving.element.id);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), before.source);
  assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), after);
});
test('Vue copy/paste validates the source parent, stale clipboard and unique authored identities', () => {
  const before = resolve(), second = resolve(original, 'Second');
  const result = adapter.planOp(second, { type: 'pasteElement', fileHash: second.hash, copiedId: before.element.id, copiedHash: before.hash });
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.edits[0].after.includes('<div data-rt-name="Second">Two</div><div data-rt-name="First">'));
  for (const extras of [{ copiedHash: 'stale' }, { copiedId: before.elements.find(element => element.tag === 'span').id }])
    assert.equal(adapter.planOp(second, { type: 'pasteElement', fileHash: second.hash, copiedId: before.element.id, copiedHash: before.hash, ...extras }).refused, true);
  for (const attribute of ['id="unique"', 'ref="control"', ':key="key"', ':id="id"', ':ref="ref"', ':data-rt-style="styleOwner"', 'v-bind="attrs"', 'v-bind:[name]="value"']) {
    const item = resolve('<template><main><div data-rt-name="First"><span ' + attribute + '>Text</span></div><div>Other</div></main></template>');
    assert.equal(adapter.describe(item).structure.canDuplicate, false, attribute);
    assert.equal(adapter.planOp(item, { type: 'duplicateElement', fileHash: item.hash }).refused, true, attribute);
    assert.equal(adapter.planOp(item, { type: 'deleteElement', fileHash: item.hash }).ok, true, attribute);
  }
});
test('Vue copies reset style markers and refuses tampered owned styles before structural writes', () => {
  let before = resolve();
  const styled = adapter.planOp(before, { type: 'setCSS', fileHash: before.hash, width: 0, property: 'padding', value: '12px' });
  before = resolve(styled.edits[0].after);
  const reset = adapter.planOp(before, { type: 'setCSS', fileHash: before.hash, width: 0, resetScope: true });
  const empty = resolve(reset.edits[0].after), copied = adapter.planOp(empty, { type: 'duplicateElement', fileHash: empty.hash });
  assert.equal(copied.ok, true, copied.reason);
  const markers = [...copied.edits[0].after.matchAll(/data-rt-style="([a-f0-9]+)"/g)].map(match => match[1]);
  assert.equal(new Set(markers).size, 2);
  const tampered = resolve(before.source.replace('padding:12px', 'padding:13px'));
  for (const type of ['duplicateElement', 'deleteElement']) assert.equal(adapter.planOp(tampered, { type, fileHash: tampered.hash }).refused, true);
});
