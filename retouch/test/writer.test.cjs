'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Index, writer, makeApp, cleanup, pick, read, id } = require('./helpers.cjs');

const CARD = `import { Button } from './Button';
export function Card({ items }) {
  return (
    <div className="p-4 bg-white rounded-lg">
      <h2 className="text-lg font-bold">Hello world</h2>
      <p>Some literal text</p>
      <span className="text-sm">{items.length}</span>
      <img src="/a.png" className="w-10" />
      <h1 className="t">Plain <span className="text-red-500">styled</span> end.</h1>
      <Button className="mt-4">Save</Button>
    </div>
  );
}
`;

let root, index;
beforeEach(() => {
  root = makeApp({ 'Card.tsx': CARD });
  index = new Index(root);
  index.scanAll();
});
afterEach(() => cleanup(root));

test('setClasses merges via tailwind-merge (last wins per property)', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  const r = writer.applyOp(resolved, {
    type: 'setClasses', id: el.id, classes: 'text-xl font-bold text-red-500', fileHash: resolved.hash,
  });
  assert.ok(r.ok);
  assert.match(read(root, 'Card.tsx'), /className="text-xl font-bold text-red-500"/);
});

test('setClasses refuses a dynamic className', () => {
  const app = makeApp({ 'D.tsx': `export const D = ({c}) => <div className={c}>x</div>;` });
  const idx = new Index(app); idx.scanAll();
  const { el, resolved } = pick(idx, app, 'D.tsx', 'div');
  const r = writer.applyOp(resolved, { type: 'setClasses', id: el.id, classes: 'p-2', fileHash: resolved.hash });
  assert.ok(r.refused);
  cleanup(app);
});

test('setClasses refuses tokens with quotes or spaces-in-token', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  for (const bad of ['a"b', 'a<b', 'a{b']) {
    const r = writer.applyOp(resolved, { type: 'setClasses', id: el.id, classes: bad, fileHash: resolved.hash });
    assert.ok(r.refused, `refuses ${bad}`);
  }
});

test('setClasses adds className when none exists', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'p');
  const r = writer.applyOp(resolved, { type: 'setClasses', id: el.id, classes: 'mt-2', fileHash: resolved.hash });
  assert.ok(r.ok);
  assert.match(read(root, 'Card.tsx'), /<p className="mt-2">/);
});

test('setText escapes JSX-significant characters', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  const r = writer.applyOp(resolved, { type: 'setText', id: el.id, text: 'A & B < C > {x}', fileHash: resolved.hash });
  assert.ok(r.ok);
  assert.match(read(root, 'Card.tsx'), /A &amp; B &lt; C &gt; &#123;x&#125;/);
});

test('setText refuses when children are mixed', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h1');
  const r = writer.applyOp(resolved, { type: 'setText', id: el.id, text: 'x', fileHash: resolved.hash });
  assert.ok(r.refused);
});

test('setText refuses when text is dynamic', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'span'); // {items.length}
  const r = writer.applyOp(resolved, { type: 'setText', id: el.id, text: 'x', fileHash: resolved.hash });
  assert.ok(r.refused);
});

test('stale fileHash is rejected (R-11 e)', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  const r = writer.applyOp(resolved, { type: 'setClasses', id: el.id, classes: 'p-1', fileHash: 'deadbeef' });
  assert.ok(r.refused);
});

test('an edit that would not parse writes nothing (R-11 b)', () => {
  const before = read(root, 'Card.tsx');
  const { el, resolved } = pick(index, root, 'Card.tsx', 'img');
  // A src with an embedded quote cannot pass the grammar, so it refuses
  // rather than corrupting the file.
  const r = writer.applyOp(resolved, { type: 'setSrc', id: el.id, src: '/a"b.png', fileHash: resolved.hash });
  assert.ok(r.refused);
  assert.strictEqual(read(root, 'Card.tsx'), before);
});

test('setSrc rewrites a literal image src to a root-relative path', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'img');
  const r = writer.applyOp(resolved, { type: 'setSrc', id: el.id, src: '/rt-assets/x.png', fileHash: resolved.hash });
  assert.ok(r.ok);
  assert.match(read(root, 'Card.tsx'), /src="\/rt-assets\/x\.png"/);
});

test('setSrc refuses external, scheme, traversal, and protocol-relative paths', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'img');
  for (const bad of ['https://evil.com/x.png', 'javascript:alert(1)', '/a/../etc', '//evil.com/x', 'relative.png']) {
    const r = writer.applyOp(resolved, { type: 'setSrc', id: el.id, src: bad, fileHash: resolved.hash });
    assert.ok(r.refused, `refuses ${bad}`);
  }
});

test('setChildren: wrap a run, keep a styled span verbatim, change the tail', () => {
  const src0 = read(root, 'Card.tsx');
  const { elements } = id.collectElements(src0, 'Card.tsx');
  const h1 = elements.find((e) => e.node.openingElement.name.name === 'h1');
  const span = elements.filter((e) => e.node.openingElement.name.name === 'span')
    .find((e) => e.node.start > h1.node.start && e.node.end < h1.node.end);
  const resolved = index.resolve(h1.id);
  const r = writer.applyOp(resolved, {
    type: 'setChildren', id: h1.id, fileHash: resolved.hash,
    children: [
      { t: 'wrap', tag: 'strong', children: [{ t: 'text', value: 'Plain ' }] },
      { t: 'keep', id: span.id },
      { t: 'text', value: ' new end.' },
    ],
  });
  assert.ok(r.ok, JSON.stringify(r));
  const now = read(root, 'Card.tsx');
  assert.match(now, /<strong>Plain <\/strong>/);
  assert.match(now, /<span className="text-red-500">styled<\/span>/);
  assert.match(now, / new end\./);
});

test('setChildren: deleting a styled span merges to plain text', () => {
  const src0 = read(root, 'Card.tsx');
  const { elements } = id.collectElements(src0, 'Card.tsx');
  const h1 = elements.find((e) => e.node.openingElement.name.name === 'h1');
  const resolved = index.resolve(h1.id);
  const r = writer.applyOp(resolved, {
    type: 'setChildren', id: h1.id, fileHash: resolved.hash,
    children: [{ t: 'text', value: 'Plain end.' }],
  });
  assert.ok(r.ok);
  const now = read(root, 'Card.tsx');
  assert.ok(!/<h1 className="t">Plain <span/.test(now));
});

test('setChildren: editing text inside a kept span keeps its class', () => {
  const src0 = read(root, 'Card.tsx');
  const { elements } = id.collectElements(src0, 'Card.tsx');
  const h1 = elements.find((e) => e.node.openingElement.name.name === 'h1');
  const span = elements.filter((e) => e.node.openingElement.name.name === 'span')
    .find((e) => e.node.start > h1.node.start && e.node.end < h1.node.end);
  const resolved = index.resolve(h1.id);
  const r = writer.applyOp(resolved, {
    type: 'setChildren', id: h1.id, fileHash: resolved.hash,
    children: [
      { t: 'text', value: 'Plain ' },
      { t: 'keep', id: span.id, children: [{ t: 'text', value: 'BOLDED' }] },
      { t: 'text', value: ' end.' },
    ],
  });
  assert.ok(r.ok);
  assert.match(read(root, 'Card.tsx'), /<span className="text-red-500">BOLDED<\/span>/);
});

test('setChildren refuses a formatting tag outside the vocabulary', () => {
  const src0 = read(root, 'Card.tsx');
  const h1 = id.collectElements(src0, 'Card.tsx').elements.find((e) => e.node.openingElement.name.name === 'h1');
  const resolved = index.resolve(h1.id);
  const r = writer.applyOp(resolved, {
    type: 'setChildren', id: h1.id, fileHash: resolved.hash,
    children: [{ t: 'wrap', tag: 'script', children: [{ t: 'text', value: 'x' }] }],
  });
  assert.ok(r.refused);
});

test('atomic write leaves no temp files behind', () => {
  const fs = require('node:fs');
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  writer.applyOp(resolved, { type: 'setClasses', id: el.id, classes: 'text-xl', fileHash: resolved.hash });
  const leftovers = fs.readdirSync(root).filter((f) => f.startsWith('.retouch-'));
  assert.deepStrictEqual(leftovers, []);
});

test('every write leaves the file parseable', () => {
  const { el, resolved } = pick(index, root, 'Card.tsx', 'h2');
  writer.applyOp(resolved, { type: 'setText', id: el.id, text: 'New heading', fileHash: resolved.hash });
  assert.doesNotThrow(() => id.collectElements(read(root, 'Card.tsx'), 'Card.tsx'));
});
