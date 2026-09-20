'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const compiler = require('svelte/compiler');
const source = require('../src/svelte-source.cjs');
const styles = require('../src/svelte-css.cjs');
function resolve(text) {
  const relPath = 'App.svelte', elements = source.collect(text, relPath).elements;
  return { source: text, relPath, file: '/tmp/App.svelte', elements, element: elements.find(e => e.tag === 'h1'), hash: source.contentHash(text) };
}
function edit(text, changes, width = 0) {
  const r = resolve(text), result = styles.plan(r, { fileHash: r.hash, width, changes });
  assert.equal(result.ok, true, result.reason);
  return result.edits[0]?.after || text;
}
test('Svelte responsive CSS preserves authored styles, source structure and production compilation', () => {
  for (const original of ['<h1>Hello</h1>', '<h1>Hello</h1>\n<style>/* original */h1 { color: red; }</style>\n']) {
    const base = edit(original, { color: '#112233', padding: '12px' });
    const desktop = edit(base, { color: '#445566' }, 1024);
    const r = resolve(desktop), state = styles.inspect(r);
    assert.equal((desktop.match(/<style>/g) || []).length, 1);
    assert.deepEqual(state.model.layers[state.id], { 0: { color: '#112233', padding: '12px' }, 1024: { color: '#445566' } });
    assert.ok(styles.stylesheet(state.model).includes('@media (min-width: 1024px)'));
    assert.equal(styles.strip(desktop, r.relPath), original.replace('<h1', `<h1 data-rt-style="${r.element.id}"`));
    const compiled = compiler.compile(desktop, { filename: 'App.svelte', generate: 'client' });
    assert.ok(compiled.css.code.includes(`[data-rt-style="${state.id}"]`));
    assert.ok(compiled.css.code.includes('!important'));
    const reset = styles.plan(r, { fileHash: r.hash, width: 1024, resetScope: true });
    assert.equal(reset.ok, true, reset.reason);
    assert.equal(reset.edits[0].after, base);
    const rr = resolve(base), cleared = styles.plan(rr, { fileHash: rr.hash, width: 0, resetScope: true });
    assert.equal(cleared.ok, true, cleared.reason);
    assert.equal(cleared.edits[0].after, styles.strip(base, rr.relPath));
  }
});
test('Svelte CSS source plans refuse stale, conflicting and computed styles atomically', () => {
  for (const original of ['<h1 style={styles}>Hello</h1>', '<h1 style:color={color}>Hello</h1>', '<h1 style="color: red !important">Hello</h1>', '<h1 data-rt-style={id}>Hello</h1>', '<h1 data-rt-style="bad">Hello</h1>', '<h1 data-rt-style="aaaaaaaaaa">Hello</h1><Widget data-rt-style="aaaaaaaaaa"/>', '<h1 data-rt-style="aaaaaaaaaa">Hello</h1><div {...props} data-rt-style="aaaaaaaaaa"/>']) {
    const r = resolve(original), result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { color: '#112233' } });
    assert.equal(result.ok, false, original); assert.equal(result.edits, undefined);
  }
  const r = resolve('<h1>Hello</h1>');
  assert.equal(styles.plan(r, { fileHash: 'stale', width: 0, changes: { color: '#112233' } }).ok, false);
  assert.equal(styles.plan(r, { fileHash: r.hash, width: -1, changes: { color: '#112233' } }).ok, false);
});
test('Svelte CSS managed source detects tampering, missing owners and duplicate blocks', () => {
  const original = edit('<h1>Hello</h1>', { color: '#112233' });
  for (const changed of [original.replace('#112233', '#abcdef'), original.replace('data-rt-style=', 'data-other='), original.replace('</style>', 'h1{color:blue}</style>'), original.replace('/* /retouch-responsive */', '/* removed */'), original.replace('</style>', original.slice(original.indexOf('\n/* retouch-responsive:'), original.indexOf('</style>')) + '</style>')]) {
    const r = resolve(changed), result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { padding: '4px' } });
    assert.equal(result.ok, false, changed); assert.equal(result.edits, undefined);
  }
});
test('Svelte style identity collisions allocate a unique owner and unchanged writes are no-ops', () => {
  const original = '<h1>Hello</h1>', id = resolve(original).element.id;
  const withCollision = original + `<div data-rt-style="${id}">Other</div>`;
  const after = edit(withCollision, { color: '#112233' });
  const state = styles.inspect(resolve(after)); assert.notEqual(state.id, id);
  assert.equal(edit(after, { color: '#112233' }), after);
});
test('Svelte selection style plans are atomic across screen scopes and per-layer values', () => {
  const original = '<h1>Hello</h1><p>World</p><style>p{margin:0}</style>', r = resolve(original), ids = r.elements.map(e => e.id);
  const result = styles.planSelection(r, { fileHash: r.hash, width: 768, ids, changesById: { [ids[0]]: { color: '#112233' }, [ids[1]]: { padding: '8px' } } });
  assert.equal(result.ok, true, result.reason); assert.equal(result.edits.length, 1); assert.equal(result.edits[0].before, original);
  const after = result.edits[0].after, state = styles.documentState(after, r.relPath);
  assert.deepEqual(state.model.layers[ids[0]], { 768: { color: '#112233' } });
  assert.deepEqual(state.model.layers[ids[1]], { 768: { padding: '8px' } });
  compiler.compile(after, { filename: 'App.svelte', generate: 'client' });
  const rr = resolve(after), reset = styles.planSelection(rr, { fileHash: rr.hash, width: 768, ids, resetScope: true });
  assert.equal(reset.ok, true, reset.reason); assert.ok(reset.edits[0].after.endsWith('<style>p{margin:0}</style>'));
  for (const override of [{ fileHash: 'stale' }, { ids: [ids[0], ids[0]] }, { ids: [ids[0], 'aaaaaaaaaa'] }, { changesById: { [ids[0]]: { color: '#112233' }, [ids[1]]: { bogus: 'invalid' } } }]) {
    const refused = styles.planSelection(r, { fileHash: r.hash, width: 768, ids, changes: { padding: '8px' }, ...override });
    assert.equal(refused.ok, false); assert.equal(refused.edits, undefined);
  }
  const conflict = resolve('<h1>Hello</h1><p style="padding:1px!important">World</p>');
  const refused = styles.planSelection(conflict, { fileHash: conflict.hash, width: 768, ids: conflict.elements.map(e => e.id), changes: { padding: '8px' } });
  assert.equal(refused.ok, false); assert.match(refused.reason, /important inline/); assert.equal(refused.edits, undefined);
});
test('Svelte CSS refuses preprocessor blocks whose compilation cannot be proven', () => {
  const r = resolve('<h1>Hello</h1><style lang="scss">h1{color:red}</style>');
  const result = styles.plan(r, { fileHash: r.hash, width: 0, changes: { color: '#112233' } });
  assert.equal(result.ok, false); assert.match(result.reason, /local CSS/);
});
test('Svelte runtime CSS snapshots retain the exact text signature through first write, reset and undo', () => {
  for (const original of ['<script>let count=0;</script><h1>Hello</h1>', '<h1>Hello</h1><style>h1{color:red}</style>']) {
    const after = edit(original, { color: '#112233' }, 768), beforeSnapshot = source.textSnapshot(original, 'App.svelte'), afterSnapshot = source.textSnapshot(after, 'App.svelte');
    assert.equal(beforeSnapshot.signature, afterSnapshot.signature);
    assert.deepEqual(beforeSnapshot.styling.ids, afterSnapshot.styling.ids);
    assert.match(afterSnapshot.styling.css.text, /min-width: 768px/);
    const stamped = source.stamp(after, '/tmp/App.svelte', '/tmp', { runtime: true });
    assert.doesNotMatch(stamped.code, /retouch-responsive:/);
    assert.match(stamped.code, /data-rt-style=\{/);
    compiler.compile(stamped.code, { filename: 'App.svelte', generate: 'client' });
    assert.notEqual(source.textSnapshot(after.replace('Hello', 'Hello <b>child</b>'), 'App.svelte').signature, afterSnapshot.signature);
    if (original.includes('<style>')) assert.notEqual(source.textSnapshot(after.replace('color:red', 'color:blue'), 'App.svelte').signature, afterSnapshot.signature);
  }
});
test('Svelte adapter exposes responsive CSS and fresh descriptions for every styled selection member', () => {
  const adapter = require('../src/adapters/svelte.cjs'), r = resolve('<h1>Hello</h1><p>Other</p>'), ids = r.elements.map(e => e.id);
  assert.equal(adapter.describe(r).cssAuthoring, true);
  assert.match(adapter.describe(r).cssRendering.selector, /^\[data-rt-svelte-css=/);
  const result = adapter.planOp(r, { type: 'setCSSSelection', ids, fileHash: r.hash, width: 0, changes: { color: '#112233' } });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.selection.map(e => e.id), ids);
  for (const info of result.selection) { assert.equal(info.hash, result.hash); assert.equal(info.cssRules[0].color, '#112233'); }
});

test('Svelte CSS edits independent properties beside reactive style directives', () => {
  const original='<script>let color=$state("red");let size=$state(12);</script><h1 style:color style:font-size|important={size+"px"}>Hello</h1>';
  const after=edit(original,{padding:'12px'},768),r=resolve(after),snapshot=styles.runtimeSnapshot(after,'App.svelte');
  assert.ok(after.includes('style:color style:font-size|important={size+"px"}'));assert.deepEqual(styles.inspect(r).directives,['color','font-size']);assert.equal(styles.describe(r).cssReason,undefined);assert.ok(snapshot.ids[r.element.id]);
  assert.equal(source.textSnapshot(original,'App.svelte').signature,source.textSnapshot(after,'App.svelte').signature);compiler.compile(source.stamp(after,'/tmp/App.svelte','/tmp',{runtime:true}).code,{filename:'App.svelte',generate:'client'});
  const reset=styles.plan(r,{fileHash:r.hash,width:768,resetScope:true});assert.equal(reset.ok,true,reset.reason);assert.equal(reset.edits[0].after,styles.strip(after,'App.svelte'));
});
test('Svelte CSS preserves directive ownership across aliases, shorthands and fallback effects', () => {
  for(const [directive,changes] of [['padding-inline','padding-left'],['inline-size','width'],['background','background-color'],['font','font-size'],['display','line-clamp'],['--tone','--tone'],['all','padding'],['border-inline-color','border-color'],['border-start-start-radius','border-top-left-radius']]){
    const r=resolve('<h1 style:'+directive+'={value}>Hello</h1>'),values={'padding-left':'4px',width:'30px','background-color':'#112233','font-size':'16px','line-clamp':'2','--tone':'#112233',padding:'4px','border-color':'#112233','border-top-left-radius':'4px'};
    const result=styles.plan(r,{fileHash:r.hash,width:768,changes:{[changes]:values[changes]}});assert.equal(result.ok,false,directive+' '+changes);assert.match(result.reason,/authored style directive/);assert.equal(result.edits,undefined);
  }
  const custom=edit('<h1 style:--Tone={value}>Hello</h1>',{'--tone':'#112233'});assert.ok(custom.includes('style:--Tone={value}'));
  const base=edit('<h1>Hello</h1>',{color:'#112233'}),external=base.replace('>Hello',' style:color={color}>Hello'),r=resolve(external);
  const reset=styles.plan(r,{fileHash:r.hash,width:0,changes:{color:null}});assert.equal(reset.ok,true,reset.reason);assert.ok(reset.edits[0].after.includes('style:color={color}'));
});
test('Svelte selection rejects a directive conflict without partially editing other layers', () => {
 const r=resolve('<h1>Hello</h1><p style:padding={padding}>World</p>'),result=styles.planSelection(r,{fileHash:r.hash,width:0,ids:r.elements.map(e=>e.id),changes:{padding:'8px'}});
 assert.equal(result.ok,false);assert.match(result.reason,/authored style directive/);assert.equal(result.edits,undefined);
});
