'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/vue.cjs'), { SourceHistory } = require('../src/history.cjs');
const source = '<template><main><section><div aria-label="A"><span>A</span></div><div aria-label="B">B</div></section><section><div aria-label="C">C</div><div aria-label="D" ref="unique">D</div></section></main></template><style scoped>section{padding:4px}</style>';
function resolve(text = source, name = 'A') {
  const elements = adapter.collect(text, 'App.vue').elements;
  return { source: text, relPath: 'App.vue', file: '/app/App.vue', hash: adapter.contentHash(text), elements,
    element: elements.find(element => element.attributes.some(attribute => attribute.name === 'aria-label' && attribute.value === name)) };
}
function operation(before, type, names = ['A', 'C']) { return { type, fileHash: before.hash, ids: names.map(name => resolve(before.source, name).element.id) }; }
function styled() {
  let text = source;
  for (const [name, width, value] of [['A', 0, '12px'], ['C', 768, '24px']]) {
    const before = resolve(text, name), result = adapter.planOp(before, { type: 'setCSS', width, property: 'padding', value, fileHash: before.hash });
    assert.equal(result.ok, true, result.reason); text = result.edits[0].after;
  }
  return text;
}
test('Vue duplicates roots across parents with independent responsive styles and a combined identity map', () => {
  const before = resolve(styled()), result = adapter.planOp(before, operation(before, 'duplicateSelection'));
  assert.equal(result.ok, true, result.reason); assert.equal(result.rootCount, 2); assert.equal(result.selectionIds.length, 2);
  const after = result.edits[0].after, next = resolve(after);
  assert.equal(next.elements.length, before.elements.length + 3);
  assert.equal(new Set(next.elements.flatMap(element => element.attributes.filter(attribute => attribute.name === 'data-rt-style').map(attribute => attribute.value))).size, 4);
  for (const [index, name] of ['A', 'C'].entries()) {
    const element = next.elements.find(element => element.id === result.selectionIds[index]);
    assert.deepEqual(adapter.describe({ ...next, element }).cssRules, adapter.describe(resolve(after, name)).cssRules);
  }
  for (const old of before.elements) {
    const id = result.sourceIdMap.find(([id]) => id === old.id)?.[1] || old.id;
    assert.ok(next.elements.some(element => element.id === id && element.tag === old.tag));
  }
  const copy = next.elements.find(element => element.id === result.selectionIds[0]);
  const changed = adapter.planOp({ ...next, element: copy }, { type: 'setCSS', width: 0, property: 'padding', value: '30px', fileHash: next.hash });
  assert.equal(changed.ok, true, changed.reason);
  assert.equal(adapter.describe(resolve(changed.edits[0].after)).cssRules[0].padding, '12px');
});
test('Vue batch delete cleans subtree styles and duplicate/delete each restore in one history step', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-batch-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const type of ['duplicateSelection', 'deleteSelection']) {
    const text = styled(), before = { ...resolve(text), file }, history = new SourceHistory(); fs.writeFileSync(file, text);
    const result = history.commit(root, adapter.planOp(before, operation(before, type)));
    assert.equal(result.ok, true, result.reason);
    const after = fs.readFileSync(file, 'utf8');
    if (type === 'deleteSelection') {
      assert.equal(result.removedSourceIds.length, 3); assert.doesNotMatch(after, /data-rt-vue-css|data-rt-style/);
      assert.equal(result.selectionIds[0], result.parentId);
    }
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), text);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), after);
  }
});
test('Vue batch actions normalize ancestor/descendant selections and refuse the whole edit if a later root is invalid', t => {
  const before = resolve(), child = before.elements.find(element => element.tag === 'span');
  const nested = adapter.planOp(before, { type: 'duplicateSelection', ids: [child.id, before.element.id], fileHash: before.hash });
  assert.equal(nested.ok, true, nested.reason); assert.equal(nested.rootCount, 1); assert.equal(nested.selectionIds.length, 1);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-batch-refuse-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); fs.writeFileSync(file, source);
  const current = { ...before, file }, result = new SourceHistory().commit(root, adapter.planOp(current, operation(current, 'duplicateSelection', ['A', 'D'])));
  assert.equal(result.refused, true); assert.equal(fs.readFileSync(file, 'utf8'), source);
  for (const extras of [{ fileHash: 'stale' }, { ids: [before.element.id] }, { ids: [before.element.id, before.element.id] }, { ids: [before.element.id, '0123456789'] }])
    assert.equal(adapter.planOp(before, { ...operation(before, 'deleteSelection'), ...extras }).refused, true);
});
test('Vue batch ordering preserves sparse selection order in every direction with exact history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-batch-order-')), file = path.join(root, 'App.vue');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = '<template><main>' + ['A', 'B', 'C', 'D', 'E'].map(name => '<div aria-label="' + name + '"><span>' + name + '</span></div>').join('\n ') + '</main></template>';
  for (const [direction, expected] of Object.entries({ before: ['B', 'A', 'D', 'C', 'E'], after: ['A', 'C', 'B', 'E', 'D'], first: ['B', 'D', 'A', 'C', 'E'], last: ['A', 'C', 'E', 'B', 'D'] })) {
    const before = { ...resolve(original, 'B'), file }, history = new SourceHistory(); fs.writeFileSync(file, original);
    const result = history.commit(root, adapter.planOp(before, { ...operation(before, 'moveSelection', ['D', 'B']), direction }));
    assert.equal(result.ok, true, result.reason);
    const after = fs.readFileSync(file, 'utf8'), next = resolve(after, 'B');
    assert.deepEqual(next.elements.filter(element => element.tag === 'div').map(element => element.attributes.find(attribute => attribute.name === 'aria-label').value), expected);
    assert.deepEqual(result.selectionIds.map(id => next.elements.find(element => element.id === id).attributes.find(attribute => attribute.name === 'aria-label').value), ['B', 'D']);
    for (const old of before.elements) assert.ok(next.elements.some(element => element.id === (result.sourceIdMap.find(([from]) => from === old.id)?.[1] || old.id) && element.tag === old.tag));
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), after);
  }
});
test('Vue batch ordering treats adjacent roots as a block and refuses cross-parent or ineffective moves', () => {
  const text = '<template><main>' + ['A', 'B', 'C', 'D'].map(name => '<div aria-label="' + name + '">' + name + '</div>').join('') + '</main></template>';
  const before = resolve(text, 'B');
  for (const [direction, expected] of [['before', 'BCAD'], ['after', 'ADBC']]) {
    const result = adapter.planOp(before, { ...operation(before, 'moveSelection', ['B', 'C']), direction });
    assert.equal(result.ok, true, result.reason);
    assert.equal(resolve(result.edits[0].after).elements.filter(element => element.tag === 'div').map(element => element.attributes[0].value).join(''), expected);
  }
  for (const direction of ['before', 'after', 'first', 'last']) assert.equal(adapter.planOp(before, { ...operation(before, 'moveSelection', ['A', 'B', 'C', 'D']), direction }).refused, true);
  const cross = resolve(); assert.equal(adapter.planOp(cross, { ...operation(cross, 'moveSelection'), direction: 'first' }).refused, true);
  assert.equal(adapter.planOp(before, { ...operation(before, 'moveSelection', ['B', 'C']), direction: 'bad' }).refused, true);
});
