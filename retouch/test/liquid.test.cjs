'use strict';
// The Liquid adapter (DR-0015). Unit-tests the tolerant parser, stamping,
// description, and deterministic rewrites, plus a smoke test over a real
// moses theme file when the clone is present.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const liquid = require('../src/adapters/liquid.cjs');

const SRC = `{% comment %} skip me {% endcomment %}
{% if x %}
  <div class="flex px-4 py-2">
    <p class="t-trim">Hello world</p>
    <span>{{ dynamic }}</span>
    <a class="{% if y %}on{% endif %}">Link</a>
  </div>
{% endif %}
{% schema %}{ "class": "not-html" }{% endschema %}
`;

function elByTag(source, tag, nth = 0) {
  const { elements } = liquid.collect(source, 'x.liquid');
  return elements.filter((e) => e.tag === tag)[nth];
}
function resolvedFor(source, el, file = 'x.liquid') {
  return { element: el, elements: liquid.collect(source, 'x.liquid').elements, source, relPath: file, file, hash: liquid.contentHash(source) };
}

test('matches only .liquid', () => {
  assert.ok(liquid.matches('/t/sections/hero.liquid'));
  assert.ok(!liquid.matches('/t/x.tsx'));
});

test('collect finds HTML elements and skips comment/schema blocks', () => {
  const { elements } = liquid.collect(SRC, 'x.liquid');
  const tags = elements.map((e) => e.tag).sort();
  assert.deepStrictEqual(tags, ['a', 'div', 'p', 'span']);
});

test('IDs are stable and pure across an attribute edit', () => {
  const a = liquid.collect(SRC, 'x.liquid').elements.map((e) => e.id);
  const edited = SRC.replace('px-4 py-2', 'px-6');
  const b = liquid.collect(edited, 'x.liquid').elements.map((e) => e.id);
  assert.deepStrictEqual(a, b);
});

test('stamp injects data-rt into HTML tags only', () => {
  const out = liquid.stamp(SRC, '/t/x.liquid');
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 4);
  assert.ok(!/schema[\s\S]*data-rt/.test(out.code)); // schema block untouched
});

test('describe: literal class + literal text are editable', () => {
  const p = elByTag(SRC, 'p');
  const d = liquid.describe(resolvedFor(SRC, p));
  assert.strictEqual(d.className, 't-trim');
  assert.strictEqual(d.text, 'Hello world');
  assert.strictEqual(d.classNameDynamic, false);
});

test('describe: dynamic text and dynamic class are flagged', () => {
  const span = elByTag(SRC, 'span');
  assert.strictEqual(liquid.describe(resolvedFor(SRC, span)).textDynamic, true);
  const a = elByTag(SRC, 'a');
  assert.strictEqual(liquid.describe(resolvedFor(SRC, a)).classNameDynamic, true);
});

test('setClasses rewrites a literal class with tailwind-merge', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-liq-'));
  const file = path.join(root, 'x.liquid');
  fs.writeFileSync(file, SRC);
  const el = elByTag(SRC, 'div');
  const r = liquid.applyOp({ ...resolvedFor(SRC, el), file }, { type: 'setClasses', id: el.id, classes: 'flex px-6 py-2 bg-white', fileHash: liquid.contentHash(SRC) });
  assert.ok(r.ok, JSON.stringify(r));
  assert.match(fs.readFileSync(file, 'utf8'), /class="flex px-6 py-2 bg-white"/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('setClasses refuses a Liquid-dynamic class', () => {
  const a = elByTag(SRC, 'a');
  const r = liquid.applyOp(resolvedFor(SRC, a), { type: 'setClasses', id: a.id, classes: 'x', fileHash: liquid.contentHash(SRC) });
  assert.ok(r.refused);
});

test('setText rewrites literal text and escapes braces (no Liquid injection)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-liq-'));
  const file = path.join(root, 'x.liquid');
  fs.writeFileSync(file, SRC);
  const p = elByTag(SRC, 'p');
  const r = liquid.applyOp({ ...resolvedFor(SRC, p), file }, { type: 'setText', id: p.id, text: 'New {{ evil }} text', fileHash: liquid.contentHash(SRC) });
  assert.ok(r.ok);
  const now = fs.readFileSync(file, 'utf8');
  assert.match(now, /&#123;&#123; evil &#125;&#125;/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('setText refuses dynamic text', () => {
  const span = elByTag(SRC, 'span');
  const r = liquid.applyOp(resolvedFor(SRC, span), { type: 'setText', id: span.id, text: 'x', fileHash: liquid.contentHash(SRC) });
  assert.ok(r.refused);
});

test('setTag rewrites open and close tag names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-liq-'));
  const file = path.join(root, 'x.liquid');
  fs.writeFileSync(file, SRC);
  const p = elByTag(SRC, 'p');
  const r = liquid.applyOp({ ...resolvedFor(SRC, p), file }, { type: 'setTag', id: p.id, tag: 'h2', fileHash: liquid.contentHash(SRC) });
  assert.ok(r.ok, JSON.stringify(r));
  assert.match(fs.readFileSync(file, 'utf8'), /<h2 class="t-trim">Hello world<\/h2>/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('stale fileHash is rejected', () => {
  const p = elByTag(SRC, 'p');
  const r = liquid.applyOp(resolvedFor(SRC, p), { type: 'setClasses', id: p.id, classes: 'x', fileHash: 'stale' });
  assert.ok(r.refused);
});

// Smoke test over a real moses theme file, when the clone is present.
const MOSES = path.join(os.homedir(), 'Developer', 'retouch', 'moses');
test('parses real moses sections without throwing and stamps them', { skip: !fs.existsSync(MOSES) }, () => {
  const dir = path.join(MOSES, 'sections');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.liquid')).slice(0, 20);
  let stamped = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const { elements } = liquid.collect(src, 'sections/' + f);
    for (const el of elements) assert.match(el.id, /^[0-9a-f]{10}$/);
    if (liquid.stamp(src, path.join(dir, f))) stamped++;
  }
  assert.ok(stamped > 0, 'stamped at least one real section');
});
