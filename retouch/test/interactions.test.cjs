const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commandFor, create } = require('../shell/interactions.js');
const state = { mode: 'edit', selected: {}, canUndo: true, canRedo: true };
const key = (key, extra = {}) => ({ key, target: { closest: () => null }, ...extra });

test('canvas shortcuts distinguish undo, redo and source structural actions', () => {
  for (const [event, expected] of [
    [key('z', { metaKey: true }), 'undo'], [key('Z', { ctrlKey: true, shiftKey: true }), 'redo'],
    [key('y', { ctrlKey: true }), 'redo'], [key('d', { metaKey: true }), 'duplicate'],
    [key('Delete'), 'delete'], [key('Backspace'), 'delete'],
    [key('[', { metaKey: true }), 'moveBackward'], [key(']', { ctrlKey: true }), 'moveForward'],
    [key('Enter'), 'selectChild'], [key('Enter', { shiftKey: true }), 'selectParent'],
    [key('Tab'), 'nextSibling'], [key('Tab', { shiftKey: true }), 'previousSibling'],
    [key('F10', { shiftKey: true }), 'contextMenu'], [key('Escape'), 'clearSelection'],
  ]) assert.equal(commandFor(event, state, true), expected);
});

test('typing, IME, interact mode and inspector tab navigation remain native', () => {
  const undo = key('z', { metaKey: true });
  assert.equal(commandFor(undo, { ...state, mode: 'interact' }, true), null);
  assert.equal(commandFor(undo, { ...state, editing: true }, true), null);
  assert.equal(commandFor(undo, { ...state, busy: true }, true), null);
  assert.equal(commandFor({ ...undo, isComposing: true }, state, true), null);
  assert.equal(commandFor({ ...undo, target: { closest: () => ({}) } }, state, true), null);
  assert.equal(commandFor(key('Tab'), state, false), null);
  assert.equal(commandFor(key('Enter', { altKey: true }), state, true), null);
});

function documentStub() {
  const handlers = new Map();
  return {
    handlers, querySelector: () => null,
    addEventListener(type, callback) { handlers.set(type, callback); },
    removeEventListener(type, callback) { if (handlers.get(type) === callback) handlers.delete(type); },
  };
}
function dispatch(doc, event) {
  const result = { prevented: false, stopped: false };
  doc.handlers.get('keydown')({ ...event, preventDefault() { result.prevented = true; }, stopImmediatePropagation() { result.stopped = true; } });
  return result;
}

test('unsupported structural actions are not intercepted and supported undo runs once', async () => {
  const doc = documentStub(); let count = 0;
  const controls = create({ document: doc, getState: () => state, actions: { undo: () => count++ } });
  controls.bindDocument(doc, { canvas: true });
  assert.deepEqual(dispatch(doc, key('d', { metaKey: true })), { prevented: false, stopped: false });
  assert.deepEqual(dispatch(doc, key('z', { metaKey: true })), { prevented: true, stopped: true });
  await Promise.resolve(); assert.equal(count, 1);
  controls.destroy(); assert.equal(doc.handlers.size, 0);
});

test('unavailable history consumes editor shortcut without mutating source', () => {
  const doc = documentStub(); let count = 0;
  const controls = create({ document: doc, getState: () => ({ ...state, canRedo: false }), actions: { redo: () => count++ } });
  controls.bindDocument(doc);
  assert.equal(dispatch(doc, key('Z', { metaKey: true, shiftKey: true })).prevented, true);
  assert.equal(count, 0);
});

test('hierarchy navigation crosses unstamped wrappers without including grandchildren', () => {
  const { parentOf, childOf, siblingOf } = require('../shell/interactions.js');
  const body = {}, ownerDocument = { body };
  const parent = { ownerDocument };
  const wrapper = { closest: () => parent };
  const first = { ownerDocument, parentElement: wrapper };
  const second = { ownerDocument, parentElement: wrapper };
  const grandchild = { ownerDocument, parentElement: { closest: () => first } };
  parent.querySelector = () => first;
  parent.querySelectorAll = () => [first, grandchild, second];
  assert.equal(parentOf(first), parent);
  assert.equal(childOf(parent), first);
  assert.equal(siblingOf(first, false), second);
  assert.equal(siblingOf(first, true), second);
  assert.equal(siblingOf(second, false), first);
});

test('arrow repeats share a gesture, key release starts a new gesture, Shift nudges ten pixels', () => {
  const doc = documentStub(), calls = [], ended = [];
  const controls = create({ document: doc, getState: () => ({ ...state, canNudge: true }), actions: {
    nudge: (...args) => calls.push(args), endNudgeGesture: id => ended.push(id),
  } });
  controls.bindDocument(doc, { canvas: true });
  dispatch(doc, key('ArrowRight'));
  dispatch(doc, key('ArrowRight', { repeat: true }));
  dispatch(doc, key('ArrowRight', { repeat: true, shiftKey: true }));
  assert.deepEqual(calls.map(call => call.slice(0, 2)), [[1, 0], [1, 0], [10, 0]]);
  assert.equal(calls[0][2].gestureKey, calls[2][2].gestureKey);
  doc.handlers.get('keyup')({ key: 'ArrowRight' });
  dispatch(doc, key('ArrowUp'));
  assert.deepEqual(calls[3].slice(0, 2), [0, -1]);
  assert.notEqual(calls[0][2].gestureKey, calls[3][2].gestureKey);
  assert.deepEqual(ended, [calls[0][2].gestureKey]);
  controls.destroy();
});

test('nudge and structural mutation require source capabilities', () => {
  const doc = documentStub(), calls = [];
  let current = state;
  const controls = create({ document: doc, getState: () => current, actions: {
    nudge: () => calls.push('nudge'), duplicate: () => calls.push('duplicate'),
    delete: () => calls.push('delete'), moveForward: () => calls.push('move'), paste: () => calls.push('paste'),
  } });
  controls.bindDocument(doc, { canvas: true });
  const events = [key('ArrowLeft'), key('d', { metaKey: true }), key('Delete'), key(']', { metaKey: true }), key('v', { metaKey: true })];
  for (const event of events) dispatch(doc, event);
  assert.deepEqual(calls, []);
  current = { ...state, canNudge: true, structure: { canDuplicate: true, canDelete: true, canMoveAfter: true, canPaste: true } };
  for (const event of events) dispatch(doc, event);
  assert.deepEqual(calls, ['nudge', 'duplicate', 'delete', 'move', 'paste']);
  current = { ...current, canPaste: false };
  dispatch(doc, key('v', { metaKey: true }));
  assert.equal(calls.length, 5);
});
