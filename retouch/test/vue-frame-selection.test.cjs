'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/vue.cjs'), { SourceHistory } = require('../src/history.cjs');
const original = '<template><main><section><div aria-label="A"><span>A</span></div>\n<div aria-label="B">B</div><div aria-label="C">C</div></section></main></template><style scoped>section{padding:4px}</style>';
function resolve(source = original, name = 'A') {
  const elements = adapter.collect(source, 'App.vue').elements;
  return { source, elements, relPath: 'App.vue', file: '/app/App.vue', hash: adapter.contentHash(source), element: elements.find(element => element.attributes.some(attr => attr.name === 'aria-label' && attr.value === name)) };
}
function style(text, name, value) {
  const r = resolve(text, name), result = adapter.planOp(r, { type: 'setCSS', fileHash: r.hash, property: 'padding', width: 768, value });
  assert.equal(result.ok, true, result.reason); return result.edits[0].after;
}
test('Vue framing and grouping preserve selected subtrees, source identities and exact history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-frame-')), file = path.join(root, 'App.vue'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const type of ['frameSelection', 'groupSelection']) {
    const text = style(original, 'A', '17px'), before = { ...resolve(text), file }, history = new SourceHistory(); fs.writeFileSync(file, text);
    const result = history.commit(root, adapter.planOp(before, { type, fileHash: before.hash, ids: [resolve(text, 'B').element.id, before.element.id] }));
    assert.equal(result.ok, true, result.reason); assert.equal(result.rootCount, 2);
    const after = fs.readFileSync(file, 'utf8'), frame = resolve(after, type === 'groupSelection' ? 'Group' : 'Frame');
    assert.equal(result.selectionIds[0], frame.element.id);
    assert.deepEqual(frame.element.node.children.filter(node => node.type === 1).map(node => node.props.find(prop => prop.name === 'aria-label').value.content), ['A', 'B']);
    assert.deepEqual(adapter.describe(resolve(after, 'A')).cssRules, adapter.describe(resolve(text, 'A')).cssRules);
    for (const old of before.elements) {
      const id = result.sourceIdMap.find(([from]) => from === old.id)?.[1] || old.id;
      const next = frame.elements.find(element => element.id === id); assert.equal(next.tag, old.tag);
      assert.deepEqual(next.attributes, old.attributes.map(attr => ({ ...attr, start: attr.start + next.start - old.start, end: attr.end + next.start - old.start })));
    }
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), text);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), after);
    const released = adapter.planOp(frame, { type: 'removeFrame', fileHash: frame.hash });
    assert.equal(released.ok, true, released.reason); assert.equal(released.edits[0].after, text);
    assert.deepEqual(released.selectionIds, ['A', 'B'].map(name => resolve(text, name).element.id));
  }
});
test('Vue frame release removes only wrapper responsive styles and retains child styles with exact undo', t => {
  const before = resolve(style(original, 'A', '17px'));
  const created = adapter.planOp(before, { type: 'frameSelection', fileHash: before.hash, ids: [before.element.id] }); assert.equal(created.ok, true, created.reason);
  let text = style(created.edits[0].after, 'Frame', '29px');
  // Exercise cleanup when the managed style block precedes the template.
  const block = text.match(/<style data-rt-vue-css[\s\S]*?<\/style>/)[0]; text = block + text.replace(block, '');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vue-release-')), file = path.join(root, 'App.vue'); t.after(() => fs.rmSync(root, { recursive: true, force: true })); fs.writeFileSync(file, text);
  const r = { ...resolve(text, 'Frame'), file }, history = new SourceHistory();
  const result = history.commit(root, adapter.planOp(r, { type: 'removeFrame', fileHash: r.hash })); assert.equal(result.ok, true, result.reason);
  const after = fs.readFileSync(file, 'utf8'); assert.doesNotMatch(after, /29px/); assert.match(after, /17px/);
  assert.equal(result.removedSourceIds[0], r.element.id);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), text);
});
test('Vue frames normalize nested selections and refuse nonconsecutive, cross-parent and directive-bound wrappers', () => {
  const r = resolve(), op = { type: 'frameSelection', fileHash: r.hash, ids: [r.element.id, r.elements.find(element => element.tag === 'span').id] };
  const result = adapter.planOp(r, op); assert.equal(result.ok, true, result.reason); assert.equal(result.rootCount, 1);
  for (const ids of [[r.element.id, resolve(original, 'C').element.id], [r.element.id, r.elements.find(element => element.tag === 'main').id], []])
    assert.equal(adapter.planOp(r, { ...op, ids }).refused, true);
  assert.equal(adapter.planOp(r, { ...op, fileHash: 'stale' }).refused, true);
  for (const attr of ['v-if="show"', 'v-pre', ':style="dynamic"']) {
    const bound = resolve(result.edits[0].after.replace('data-rt-frame=""', 'data-rt-frame="" ' + attr), 'Frame');
    assert.equal(adapter.planOp(bound, { type: 'removeFrame', fileHash: bound.hash }).refused, true);
    assert.equal(adapter.describe(bound).structure.canRemoveFrame, false);
  }
});
