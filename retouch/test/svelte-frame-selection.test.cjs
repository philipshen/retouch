'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/svelte.cjs'), { SourceHistory } = require('../src/history.cjs');
const original = '<main><section><div aria-label="A"><span>A</span></div>\n<div aria-label="B">B</div><div aria-label="C">C</div></section></main><style>section{padding:4px}</style>';
function resolve(source = original, name = 'A') {
  const elements = adapter.collect(source, 'App.svelte').elements;
  return { source, elements, relPath: 'App.svelte', file: '/app/App.svelte', hash: adapter.contentHash(source), element: elements.find(element => element.attributes.some(attr => attr.name === 'aria-label' && attr.value === name)) };
}
function style(text, name, value) {
  const r = resolve(text, name), result = adapter.planOp(r, { type: 'setCSS', fileHash: r.hash, property: 'padding', width: 768, value });
  assert.equal(result.ok, true, result.reason); return result.edits[0].after;
}
test('Svelte framing and grouping preserve selected subtrees, source identities and exact history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-svelte-frame-')), file = path.join(root, 'App.svelte'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const type of ['frameSelection', 'groupSelection']) {
    const text = style(original, 'A', '17px'), before = { ...resolve(text), file }, history = new SourceHistory(); fs.writeFileSync(file, text);
    const result = history.commit(root, adapter.planOp(before, { type, fileHash: before.hash, ids: [resolve(text, 'B').element.id, before.element.id] }));
    assert.equal(result.ok, true, result.reason); assert.equal(result.rootCount, 2);
    const after = fs.readFileSync(file, 'utf8'); require('svelte/compiler').compile(after, {filename:'App.svelte'}); const frame = resolve(after, type === 'groupSelection' ? 'Group' : 'Frame');
    assert.equal(result.selectionIds[0], frame.element.id);
    assert.deepEqual(frame.element.node.fragment.nodes.filter(node => node.type === 'RegularElement').map(node => node.attributes.find(prop => prop.name === 'aria-label').value[0].data), ['A', 'B']);
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
test('Svelte frame release removes only wrapper responsive styles and retains child styles with exact undo', t => {
  const before = resolve(style(original, 'A', '17px'));
  const created = adapter.planOp(before, { type: 'frameSelection', fileHash: before.hash, ids: [before.element.id] }); assert.equal(created.ok, true, created.reason);
  let text = style(created.edits[0].after, 'Frame', '29px');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-svelte-release-')), file = path.join(root, 'App.svelte'); t.after(() => fs.rmSync(root, { recursive: true, force: true })); fs.writeFileSync(file, text);
  const r = { ...resolve(text, 'Frame'), file }, history = new SourceHistory();
  const result = history.commit(root, adapter.planOp(r, { type: 'removeFrame', fileHash: r.hash })); assert.equal(result.ok, true, result.reason);
  const after = fs.readFileSync(file, 'utf8'); assert.doesNotMatch(after, /29px/); assert.match(after, /17px/);
  assert.equal(result.removedSourceIds[0], r.element.id);
  assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.equal(fs.readFileSync(file, 'utf8'), text);
});
test('Svelte frames normalize nested selections and refuse nonconsecutive, cross-parent and directive-bound wrappers', () => {
  const r = resolve(), op = { type: 'frameSelection', fileHash: r.hash, ids: [r.element.id, r.elements.find(element => element.tag === 'span').id] };
  const result = adapter.planOp(r, op); assert.equal(result.ok, true, result.reason); assert.equal(result.rootCount, 1);
  for (const ids of [[r.element.id, resolve(original, 'C').element.id], [r.element.id, r.elements.find(element => element.tag === 'main').id], []])
    assert.equal(adapter.planOp(r, { ...op, ids }).refused, true);
  assert.equal(adapter.planOp(r, { ...op, fileHash: 'stale' }).refused, true);
  for (const attr of ['onclick={handler}', 'bind:this={frame}', 'style={dynamic}']) {
    const bound = resolve(result.edits[0].after.replace('data-rt-frame=""', 'data-rt-frame="" ' + attr), 'Frame');
    assert.equal(adapter.planOp(bound, { type: 'removeFrame', fileHash: bound.hash }).refused, true);
    assert.equal(adapter.describe(bound).structure.canRemoveFrame, false);
  }
});
test('Svelte groups preserve bound events and control flow while frame release protects declaration scope', () => {
  const text = '<script>let count=$state(0);</script><main><section><div aria-label="A" onclick={()=>count++}>{#if count}<span>{count}</span>{/if}</div><div aria-label="B">B</div></section></main>';
  const r=resolve(text), result=adapter.planOp(r,{type:'groupSelection',fileHash:r.hash,ids:[r.element.id,resolve(text,'B').element.id]});
  assert.equal(result.ok,true,result.reason);require('svelte/compiler').compile(result.edits[0].after,{filename:'App.svelte'});
  assert.ok(result.edits[0].after.includes(text.slice(r.element.start,r.element.end)));
  const group=resolve(result.edits[0].after,'Group'),released=adapter.planOp(group,{type:'removeFrame',fileHash:group.hash});
  assert.equal(released.ok,true,released.reason);assert.equal(released.edits[0].after,text);
  const scoped=resolve('<main><div data-rt-frame="" aria-label="Frame">{#snippet local()}<b>Local</b>{/snippet}{@render local()}</div><p>After</p></main>','Frame');
  require('svelte/compiler').compile(scoped.source,{filename:'App.svelte'});
  assert.equal(adapter.planOp(scoped,{type:'removeFrame',fileHash:scoped.hash}).refused,true);
  assert.equal(adapter.describe(scoped).structure.canRemoveFrame,false);
  const empty=resolve('<main><div data-rt-frame="" aria-label="Frame"></div></main>','Frame');
  const removed=adapter.planOp(empty,{type:'removeFrame',fileHash:empty.hash});assert.equal(removed.ok,true,removed.reason);assert.equal(removed.edits[0].after,'<main></main>');
});
