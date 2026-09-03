'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { id } = require('./helpers.cjs');

const SRC = `export function C({ items }) {
  return (
    <div className="p-4">
      <h2 className="text-lg">Hello</h2>
      <>{items.map((i) => <li key={i}>{i}</li>)}</>
      <Button className="mt">Save</Button>
    </div>
  );
}
`;

test('collectElements finds host and instance elements, skips fragments', () => {
  const { elements } = id.collectElements(SRC, 'C.tsx');
  const tags = elements.map((e) => e.node.openingElement.name.name || e.node.openingElement.name.type);
  assert.deepStrictEqual(tags, ['div', 'h2', 'li', 'Button']);
});

test('host vs instance classification by capitalization', () => {
  const { elements } = id.collectElements(SRC, 'C.tsx');
  const byTag = Object.fromEntries(elements.map((e) => [e.node.openingElement.name.name, e.kind]));
  assert.strictEqual(byTag.div, 'host');
  assert.strictEqual(byTag.h2, 'host');
  assert.strictEqual(byTag.Button, 'instance');
});

test('IDs are a pure function of (path, AST path): same input, same IDs', () => {
  const a = id.collectElements(SRC, 'C.tsx').elements.map((e) => e.id);
  const b = id.collectElements(SRC, 'C.tsx').elements.map((e) => e.id);
  assert.deepStrictEqual(a, b);
});

test('IDs change with the file path', () => {
  const a = id.collectElements(SRC, 'C.tsx').elements.map((e) => e.id);
  const b = id.collectElements(SRC, 'other/C.tsx').elements.map((e) => e.id);
  assert.notDeepStrictEqual(a, b);
});

test('IDs are stable across an attribute edit (R-10)', () => {
  const before = id.collectElements(SRC, 'C.tsx').elements.map((e) => e.id);
  const edited = SRC.replace('text-lg', 'text-xl text-red-500');
  const after = id.collectElements(edited, 'C.tsx').elements.map((e) => e.id);
  assert.deepStrictEqual(before, after);
});

test('IDs of later siblings change when a sibling is inserted', () => {
  const before = id.collectElements(SRC, 'C.tsx');
  const h2Id = before.elements.find((e) => e.node.openingElement.name.name === 'h2').id;
  const btnBefore = before.elements.find((e) => e.node.openingElement.name.name === 'Button').id;
  const inserted = SRC.replace('<h2 className="text-lg">Hello</h2>', '<p>new</p>\n      <h2 className="text-lg">Hello</h2>');
  const after = id.collectElements(inserted, 'C.tsx');
  // h2 now sits at a later child index → its ID (and Button's) changed.
  const h2After = after.elements.find((e) => e.node.openingElement.name.name === 'h2').id;
  const btnAfter = after.elements.find((e) => e.node.openingElement.name.name === 'Button').id;
  assert.notStrictEqual(h2Id, h2After);
  assert.notStrictEqual(btnBefore, btnAfter);
});

test('contentHash changes with content', () => {
  assert.notStrictEqual(id.contentHash('a'), id.contentHash('b'));
  assert.strictEqual(id.contentHash('a'), id.contentHash('a'));
});

test('parse errors throw (caught by callers as skip-unstamped)', () => {
  assert.throws(() => id.collectElements('const x = <div', 'bad.tsx'));
});
