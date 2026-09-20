'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const adapter = require('../src/adapters/svelte.cjs'), factory = require('../src/svelte-linked-styles.cjs'), compiler = require('svelte/compiler');
const original = '<script>let count=$state(1);</script><main><p title={String(count)} onclick={()=>count++}>Hello {count}</p><p>Second</p></main><style>p{margin:0}</style>';
const definitions = { text: { 'font-size': '20px', 'font-weight': '400' }, color: { color: '#123456' }, effect: { 'box-shadow': '0px 2px 4px #000000', filter: 'blur(2px)' } };
function resolve(text = original, file = '/app/App.svelte') { const relPath = path.basename(file), elements = adapter.collect(text, relPath).elements; return { source: text, file, relPath, elements, element: elements.find(e => e.tag === 'p'), hash: adapter.contentHash(text) }; }
function after(result, text) { assert.equal(result.ok, true, result.reason); return result.edits[0]?.after || text; }
for (const family of factory.families) {
  const linked = factory.create(family, adapter), title = family[0].toUpperCase() + family.slice(1), style = { id: '11111111-1111-4111-8111-111111111111', name: 'Shared ' + family, properties: definitions[family] };
  const property = family === 'color' ? 'color' : family === 'text' ? 'font-size' : 'filter', changed = family === 'color' ? '#abcdef' : family === 'text' ? '24px' : 'blur(4px)', override = family === 'color' ? '#fedcba' : family === 'text' ? '31px' : 'blur(8px)';
  test('Svelte ' + family + ' styles compile literal metadata and retain local overrides through update, reset and detach', () => {
    let text = after(linked.plan(resolve(), { type: 'apply' + title + 'Style', width: 768, property }, style), original), r = resolve(text);
    assert.deepEqual(adapter.describe(r).cssRules[768], style.properties); assert.ok(linked.links(r)[768]); assert.match(text, /Hello \{count\}/); assert.match(text, /onclick=\{\(\)=>count\+\+\}/); assert.match(text, /&#123;/);
    compiler.compile(text, { filename: 'App.svelte', generate: 'client' });
    text = after(adapter.planOp(r, { type: 'setCSS', fileHash: r.hash, width: 768, property, value: override }), text); r = resolve(text);
    const revised = { ...style, properties: { ...style.properties, [property]: changed } };
    text = after(linked.plan(r, { type: 'refresh' + title + 'Style', width: 768, property }, revised), text); r = resolve(text); assert.equal(adapter.describe(r).cssRules[768][property], override);
    text = after(linked.plan(r, { type: 'reset' + title + 'Style', width: 768, property }, revised), text); r = resolve(text); assert.equal(adapter.describe(r).cssRules[768][property], changed);
    const visible = adapter.describe(r).cssRules; text = after(linked.plan(r, { type: 'detach' + title + 'Style', width: 768, property }), text);
    assert.deepEqual(linked.links(resolve(text)), {}); assert.deepEqual(adapter.describe(resolve(text)).cssRules, visible); compiler.compile(text, { filename: 'App.svelte', generate: 'client' });
  });
  test('Svelte ' + family + ' selection plans are atomic and reject bound or unsupported metadata owners', () => {
    const r = resolve(), ids = r.elements.filter(e => e.tag === 'p').map(e => e.id), selection = require('../src/text-style-selection.cjs');
    const result = selection.plan(r, { type: 'apply' + title + 'StyleSelection', ids, fileHash: r.hash, width: 0, property }, style, adapter, family);
    assert.equal(result.ok, true, result.reason); assert.equal(result.edits.length, 1); assert.equal(result.selection.length, 2);
    for (const info of result.selection) assert.equal(info.cssRules[0][property], style.properties[property]);
    const bad = resolve(original.replace('<p>Second', '<p style={computed}>Second'));
    assert.equal(selection.plan(bad, { type: 'apply' + title + 'StyleSelection', ids, fileHash: bad.hash, width: 0, property }, style, adapter, family).refused, true);
    assert.equal(linked.plan(resolve('<p data-rt-' + family + '-styles={links}>Text</p>'), { type: 'apply' + title + 'Style', width: 0, property }, style).refused, true);
    assert.equal(linked.plan(r, { type: 'apply' + title + 'Style', width: 0, property, fileHash: 'stale' }, style).refused, true);
    const marker = result.edits[0].after.match(new RegExp('data-rt-' + family + '-styles="[^"]*"'))[0];
    for (const text of ['<Widget ' + marker + '/>', '<p {...props} ' + marker + '>Hidden</p>', '<svelte:head><p ' + marker + '>Head</p></svelte:head>']) assert.equal(linked.planFile('/app/App.svelte', 'App.svelte', text, style).refused, true);
  });
  test('Svelte ' + family + ' catalog updates include unvisited components and exact shared undo', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-svelte-style-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const catalog = require('../src/' + family + '-styles.cjs'), saved = catalog.change(root, { type: 'create', revision: null, name: style.name, properties: style.properties }), definition = saved.styles[0];
    for (const name of ['App.svelte', 'Unvisited.svelte']) { const file = path.join(root, name); fs.writeFileSync(file, after(linked.plan(resolve(original, file), { type: 'apply' + title + 'Style', width: 0, property }, definition), original)); }
    fs.writeFileSync(path.join(root, 'Unlinked.svelte'), '<button {...props}>Unlinked</button>');
    const snapshot = () => Object.fromEntries(['App.svelte', 'Unvisited.svelte', '.retouch/' + family + '-styles.json'].map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')])), before = snapshot();
    const plan = require('../src/text-style-update.cjs').plan(root, { type: 'update', revision: saved.revision, id: saved.id, name: style.name, properties: { ...style.properties, [property]: changed } }, 'svelte', family, adapter);
    assert.equal(plan.ok, true, plan.reason); assert.equal(plan.updated, 2); assert.deepEqual(snapshot(), before);
    const history = new (require('../src/history.cjs').SourceHistory)(), result = history.commit(root, plan); assert.equal(result.ok, true, result.reason); const updated = snapshot();
    assert.equal(adapter.describe(resolve(updated['Unvisited.svelte'], path.join(root, 'Unvisited.svelte'))).cssRules[0][property], changed);
    assert.equal(history.apply(root, 'undo', result.undoId, adapter).ok, true); assert.deepEqual(snapshot(), before);
    assert.equal(history.apply(root, 'redo', result.undoId, adapter).ok, true); assert.deepEqual(snapshot(), updated);
  });
}
test('Svelte linked metadata uses reactive attributes without changing the mounted template signature', () => {
  const source = require('../src/svelte-source.cjs'), initial = source.textSnapshot(original, 'App.svelte'); let text = original;
  for (const family of factory.families) {
    const linked = factory.create(family), title = family[0].toUpperCase() + family.slice(1), r = resolve(text);
    const style = { id: '11111111-1111-4111-8111-111111111111', name: 'Reusable', properties: definitions[family] };
    text = after(linked.plan(r, { type: 'apply' + title + 'Style', width: 768, property: 'color' }, style), text);
    const snapshot = source.textSnapshot(text, 'App.svelte'); assert.equal(snapshot.signature, initial.signature);
    assert.ok(snapshot.styling.attributes[r.element.id + '|data-rt-' + family + '-styles']);
    const stamped = source.stamp(text, '/app/App.svelte', '/app', { runtime: true }); compiler.compile(stamped.code, { filename: 'App.svelte', generate: 'client' });
    assert.match(stamped.code, new RegExp('data-rt-' + family + '-styles=\\{'));
    text = after(linked.plan(resolve(text), { type: 'detach' + title + 'Style', width: 768, property: 'color' }), text);
    assert.equal(source.textSnapshot(text, 'App.svelte').signature, initial.signature);
  }
});
