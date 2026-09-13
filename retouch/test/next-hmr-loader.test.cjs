'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const loader = require('../src/next-hmr-loader.cjs');
const source = `const _react = React;
let dispatch = null;
function dispatchAppRouterAction(action) {
  if (dispatch === null) throw Error('Router not initialized');
  dispatch(action);
}
function useActionQueue(nextDispatch) { dispatch = nextDispatch; }
`;
function fixture(input = source) {
  const jobs = [], actions = [], transitions = [];
  const context = vm.createContext({ window: {}, React: { startTransition(fn) { transitions.push(true); fn(); } }, queueMicrotask: fn => jobs.push(fn) });
  const transformed = loader.transform(input, 'use-action-queue.js');
  assert.ok(transformed);
  vm.runInContext(transformed.code, context);
  return { actions, transitions, send: context.dispatchAppRouterAction, mount: () => context.useActionQueue(action => actions.push(action)), flush: () => { while (jobs.length) jobs.shift()(); } };
}

test('cold refreshes coalesce and flush once in a transition after router initialization', () => {
  const f = fixture(), first = { type: 'hmr-refresh', hash: 'one' }, latest = { type: 'hmr-refresh', hash: 'two' };
  f.send(first); f.send(latest); f.flush(); assert.deepEqual(f.actions, []);
  assert.throws(() => f.send({ type: 'navigate' }), /Router not initialized/);
  assert.throws(() => f.send({ type: 'server-action' }), /Router not initialized/);
  f.mount(); f.mount(); assert.deepEqual(f.actions, []); f.flush();
  assert.deepEqual(f.actions, [latest]); assert.equal(f.transitions.length, 1);
  const navigation = { type: 'navigate' }; f.send(navigation); assert.deepEqual(f.actions, [latest, navigation]);
});

test('a newer warm refresh supersedes a queued startup refresh', () => {
  const f = fixture(), latest = { type: 'hmr-refresh', hash: 'new' };
  f.send({ type: 'hmr-refresh', hash: 'old' }); f.mount(); f.send(latest); f.flush();
  assert.deepEqual(f.actions, [latest]); assert.deepEqual(f.transitions, []);
});

test('unknown implementations stay unchanged and repeated transforms are inert', () => {
  for (const changed of [source.replace('dispatch = nextDispatch;', 'dispatch = changed;'), source + '\nlet dispatch = null;', source.replace('function useActionQueue(', 'function other(')]) assert.equal(loader.transform(changed, 'queue.js'), null);
  const result = loader.transform(source, 'queue.js');
  assert.equal(loader.transform(result.code, 'queue.js'), null);
  assert.equal(JSON.parse(result.map.toString()).sourcesContent[0], source);
  const esm = loader.transform(source.replace('const _react = React;', "import React, {use} from 'react';"), 'queue.js');
  assert.ok(esm.code.includes('React.startTransition(() => dispatch(pending))'));
});

test('production loader leaves source and input map untouched', () => {
  const before = process.env.NODE_ENV, map = { original: true };
  try {
    process.env.NODE_ENV = 'production';
    loader.call({ async: () => (error, result, resultMap) => { assert.equal(error, null); assert.equal(result, source); assert.equal(resultMap, map); } }, source, map);
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; }
});

test('server-side initialization errors are unchanged', () => {
  const context = vm.createContext({ React: {}, queueMicrotask() { throw Error('Unexpected queued server refresh'); } });
  vm.runInContext(loader.transform(source, 'queue.js').code, context);
  assert.throws(() => context.dispatchAppRouterAction({ type: 'hmr-refresh' }), /Router not initialized/);
});
