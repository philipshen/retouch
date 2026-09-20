'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { runtime } = require('../src/svelte-hmr.cjs');
const hash = number => String(number).repeat(40), signature = hash(9), file = 'App.svelte';
const data = (sequence, text = String(sequence), extra = {}) => ({ file, epoch: 'test-server', sequence, revision: hash(sequence), signature, texts: { heading: text }, attributes: {}, styleIds: { heading: 'aaaaaaaaaa' }, css: { id: 'bbbbbbbbbb', text: 'h1{opacity:' + sequence / 10 + '}' }, ...extra });
function fixture() {
  const listeners = new Map(), dom = new Map(), sent = [], invalidations = [], styles = []; let clock = 0;
  const target = { addEventListener: (type, fn) => dom.set(type, fn), removeEventListener: type => dom.delete(type) };
  const document = { ...target, visibilityState: 'visible', querySelector: () => styles.find(s => !s.removed), createElement: () => ({ setAttribute() {}, textContent: '', remove() { this.removed = true; } }), head: { append: element => styles.push(element) } };
  const hot = { on: (type, fn) => listeners.set(type, fn), send: (type, value) => sent.push({ type, ...value }), invalidate: message => invalidations.push(message), dispose: fn => hot.cleanup = fn };
  const context = vm.createContext({ hot, document, window: target, Date: { now: () => clock }, writable: value => ({ value, sets: 0, set(next) { this.value = next; this.sets++; } }) });
  vm.runInContext(runtime().replace("import {writable} from 'svelte/store';", '').replace('export function sourceState', 'function sourceState').replace('export const componentState', 'const componentState').replaceAll('import.meta.hot', 'hot'), context);
  const store = context.sourceState(file, data(0));
  const emit = (value, snapshot = false) => listeners.get(snapshot ? 'retouch:svelte-snapshot' : 'retouch:svelte-source')(value);
  const reply = value => emit({ ...value, request: sent.at(-1).request }, true);
  return { context, store, sent, styles, invalidations, dom, hot, emit, reply, advance: () => clock += 1100 };
}
test('Svelte source handshake repairs stale initialization and ignores old or duplicate updates', () => {
  const f = fixture(); assert.equal(f.sent.length, 1);
  f.reply(data(2)); assert.equal(f.store.value.texts.heading, '2'); assert.equal(f.styles[0].textContent, data(2).css.text);
  f.emit(data(4)); f.emit(data(3)); f.emit(data(2)); assert.equal(f.store.value.texts.heading, '4');
  const sets = f.store.sets; f.emit(data(4)); assert.equal(f.store.sets, sets);
  assert.equal(f.context.sourceState(file, data(0)), f.store); assert.equal(f.store.value.texts.heading, '4');
  f.reply(data(4)); assert.equal(f.store.value.texts.heading, '4'); assert.equal(f.invalidations.length, 0);
});
test('Svelte runtime queues pre-handshake updates and never rewinds for a delayed snapshot', () => {
  const f = fixture(); f.emit(data(3)); assert.equal(f.store.value.texts.heading, '0');
  f.reply(data(2)); assert.equal(f.store.value.texts.heading, '3');
  f.advance(); f.dom.get('focus')(); const request = f.sent.at(-1).request;
  f.emit(data(5)); f.emit({ ...data(4), request }, true); assert.equal(f.store.value.texts.heading, '5');
  f.emit({ ...data(6), request: request - 1 }, true); assert.equal(f.store.value.texts.heading, '5');
});
test('Svelte runtime handles exact source undo without accepting a replay from the prior history cycle', () => {
  const f = fixture(); f.reply(data(1)); f.emit(data(2)); f.emit(data(3, 'original', { revision: hash(0) }));
  assert.equal(f.store.value.texts.heading, 'original'); f.emit(data(1)); assert.equal(f.store.value.texts.heading, 'original');
  f.emit(data(4, 'new')); assert.equal(f.store.value.texts.heading, 'new');
});
test('Svelte runtime requests recovery after a lost reply, foreground resume and render verification', () => {
  const f = fixture(); f.dom.get('retouch:source-sync')(); assert.equal(f.sent.length, 1);
  f.advance(); f.dom.get('retouch:source-sync')(); assert.equal(f.sent.length, 2);
  f.emit({ ...data(1), request: 1 }, true); assert.equal(f.store.value.texts.heading, '0');
  f.reply(data(2)); assert.equal(f.store.value.texts.heading, '2');
  f.dom.get('visibilitychange')(); assert.equal(f.sent.length, 3); f.reply(data(3));
  f.dom.get('pageshow')(); assert.equal(f.sent.length, 4); f.reply(data(4));
  f.hot.cleanup(); assert.equal(f.dom.size, 0);
});
test('Svelte runtime never applies incompatible component or server snapshots to mounted bindings', () => {
  const f = fixture(); f.reply(data(1));
  f.emit(data(2, 'wrong structure', { signature: hash(8) })); assert.equal(f.store.value.texts.heading, '1'); assert.equal(f.invalidations.length, 1);
  f.emit(data(1, 'replayed old structure', { revision: hash(0) })); assert.equal(f.store.value.texts.heading, '1');
  f.emit(data(3, 'wrong structure', { signature: hash(8) })); assert.equal(f.invalidations.length, 1);
  f.emit(data(4, 'wrong server', { epoch: 'other-server' })); assert.equal(f.store.value.texts.heading, '1'); assert.equal(f.invalidations.length, 2);
});
test('Svelte runtime ignores malformed and conflicting duplicate payloads without changing text or CSS', () => {
  const f = fixture(); f.reply(data(1));
  for (const changes of [{ sequence: -1 }, { sequence: 1.5 }, { revision: 'invalid' }, { texts: null }, { texts: { heading: 42 } }, { styleIds: [] }, { css: { id: 'invalid', text: 'bad' } }]) f.emit(data(2, 'wrong', changes));
  f.emit(data(1, 'conflicting duplicate', { revision: hash(2) }));
  assert.equal(f.store.value.texts.heading, '1'); assert.equal(f.styles[0].textContent, data(1).css.text); assert.equal(f.invalidations.length, 0);
});
