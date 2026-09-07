'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const liquid = require('../src/adapters/liquid.cjs');
const sources = require('../src/liquid-sources.cjs');
const json = require('../src/json-source.cjs');
const { Index } = require('../src/indexer.cjs');
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-origins-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const index = new Index(root, liquid); index.scanAll();
  return { root, index, resolve(rel, context = {}, nth = 0) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    const id = liquid.collect(source, rel).elements[nth].id;
    return { ...index.resolve(id), context };
  } };
}
function edit(resolved, text) {
  const info = liquid.describe(resolved);
  return liquid.applyOp(resolved, { type: 'setText', text, fileHash: info.hash, sourceHash: info.textSource?.hash, sourceId: info.textSource?.id });
}

test('locale text resolves to the active file and changes only the exact JSON value', t => {
  const en = '/* Shopify generated */\n{ "header": { "account": "Account", "other": "Account" } }\n';
  const app = fixture(t, {
    'sections/header.liquid': '<span>{{- "header.account" | t -}}</span>',
    'locales/en.default.json': en,
    'locales/fr.json': '{"header":{"account":"Compte"}}',
  });
  const r = app.resolve('sections/header.liquid', { locale: 'en' });
  const info = liquid.describe(r);
  assert.equal(info.text, 'Account');
  assert.equal(info.textDynamic, false);
  assert.equal(info.textSource.file, 'locales/en.default.json');
  assert.equal(edit(r, 'My "account"').ok, true);
  assert.equal(fs.readFileSync(path.join(app.root, 'locales/en.default.json'), 'utf8'), en.replace('"account": "Account"', '"account": "My \\"account\\""'));
  assert.equal(liquid.describe(app.resolve('sections/header.liquid', { locale: 'fr' })).text, 'Compte');
  assert.equal(liquid.describe(app.resolve('sections/header.liquid', { locale: 'de' })).text, null);
  assert.equal(fs.readFileSync(path.join(app.root, 'sections/header.liquid'), 'utf8'), r.source);
});

test('assignment chains resolve to their literal definition and reject stale writes', t => {
  const source = `{% assign first = 'Hello' %}{% assign second = first %}<p>{{ second }}</p>`;
  const app = fixture(t, { 'sections/x.liquid': source });
  const p = sources.plan(source, 'sections/x.liquid');
  const origin = p.assignments[0].binding.id;
  const r = app.resolve('sections/x.liquid', { origin });
  assert.equal(liquid.describe(r).text, 'Hello');
  assert.equal(edit(r, 'Goodbye').ok, true);
  assert.equal(fs.readFileSync(r.file, 'utf8'), source.replace("'Hello'", "'Goodbye'"));
  const fresh = app.resolve('sections/x.liquid', { origin });
  const info = liquid.describe(fresh);
  fs.writeFileSync(r.file, fs.readFileSync(r.file, 'utf8').replace('Goodbye', 'External'));
  assert.equal(liquid.applyOp(app.resolve('sections/x.liquid', { origin }), { type: 'setText', text: 'Wrong', fileHash: info.hash, sourceId: info.textSource.id, sourceHash: info.textSource.hash }).refused, true);
});

test('executed branch provenance selects the correct assignment and a forged marker is refused', t => {
  const source = `{% liquid
  case style
    when 'heading'
      assign text = block.settings.title
    when 'body'
      assign text = block.settings.body
  endcase
%}<{{ tag }}>{{ text }}</{{ tag }}>`;
  const template = '/* keep me */\n{"sections":{"hero":{"type":"hero","blocks":{"content":{"type":"group","blocks":{"title":{"type":"text","settings":{"title":"First","body":"<p>Body</p>"}}}}}},"other":{"type":"hero","blocks":{"title":{"type":"text","settings":{"title":"Second"}}}}}}';
  const app = fixture(t, { 'snippets/text.liquid': source, 'templates/index.json': template, 'sections/hero.liquid': '<div></div>' });
  const p = sources.plan(source, 'snippets/text.liquid');
  const context = { template: 'index', section: 'template--123__hero', block: 'opaque__title', blocks: ['opaque__content', 'opaque__title'], origin: p.assignments[0].binding.id, tag: 'h1' };
  const r = app.resolve('snippets/text.liquid', context);
  const info = liquid.describe(r);
  assert.equal(info.tag, 'h1');
  assert.equal(info.text, 'First');
  assert.equal(info.canSetTag, false);
  assert.equal(edit(r, 'Edited').ok, true);
  assert.equal(fs.readFileSync(path.join(app.root, 'templates/index.json'), 'utf8'), template.replace('"First"', '"Edited"'));
  assert.equal(fs.readFileSync(r.file, 'utf8'), source);
  assert.equal(liquid.describe(app.resolve('snippets/text.liquid', { ...context, origin: p.assignments[1].binding.id })).textSource.format, 'html');
  assert.equal(liquid.describe(app.resolve('snippets/text.liquid', { ...context, origin: 'a'.repeat(16) })).text, null);
  const stamp = liquid.stamp(source, r.file, app.root).code;
  assert.match(stamp, /<\{\{ tag \}\} data-rt=/);
  assert.match(stamp, /assign __rt_origin_text = '[a-f0-9]{16}'/);
  assert.match(stamp, /data-rt-origin="\{\{ __rt_origin_text \| escape \}\}"/);
});

test('ambiguous nested block IDs are refused without a distinguishing ancestor', t => {
  const app = fixture(t, {
    'sections/x.liquid': '<p>{{ block.settings.text }}</p>',
    'templates/index.json': JSON.stringify({ sections: { hero: { blocks: {
      left: { blocks: { title: { settings: { text: 'Same' } } } },
      right: { blocks: { title: { settings: { text: 'Same' } } } },
    } } } }),
  });
  const context = { template: 'index', section: 'hero', block: 'title' };
  assert.equal(liquid.describe(app.resolve('sections/x.liquid', context)).text, null);
  const right = app.resolve('sections/x.liquid', { ...context, blocks: ['right', 'title'] });
  assert.equal(edit(right, 'Only right').ok, true);
  const doc = json.parse(fs.readFileSync(path.join(app.root, 'templates/index.json'), 'utf8')).value;
  assert.equal(doc.sections.hero.blocks.left.blocks.title.settings.text, 'Same');
  assert.equal(doc.sections.hero.blocks.right.blocks.title.settings.text, 'Only right');
});

test('literal passed into a snippet traces back through the caller variable', t => {
  const caller = `{% assign label = 'Read more' %}{% render 'label', text: label %}`;
  const app = fixture(t, { 'sections/hero.liquid': caller, 'snippets/label.liquid': '<span>{{ text }}</span>' });
  const origin = sources.plan(caller, 'sections/hero.liquid').assignments[0].binding.id;
  const r = app.resolve('snippets/label.liquid', { origin });
  assert.equal(liquid.describe(r).text, 'Read more');
  assert.equal(edit(r, 'Discover').ok, true);
  assert.match(fs.readFileSync(path.join(app.root, 'sections/hero.liquid'), 'utf8'), /assign label = 'Discover'/);
  assert.match(liquid.stamp(caller + '<div></div>', path.join(app.root, 'sections/hero.liquid'), app.root).code, /__rt_origin_text: __rt_origin_label/);
});

test('JSON dependency staleness and destination changes are rejected', t => {
  const app = fixture(t, { 'sections/x.liquid': '<p>{{ "label" | t }}</p>', 'locales/en.default.json': '{"label":"Old"}' });
  const r = app.resolve('sections/x.liquid', { locale: 'en' });
  const info = liquid.describe(r);
  fs.writeFileSync(path.join(app.root, 'locales/en.default.json'), '{"label":"External"}');
  assert.equal(liquid.applyOp(r, { type: 'setText', text: 'Bad', fileHash: info.hash, sourceId: info.textSource.id, sourceHash: info.textSource.hash }).refused, true);
  assert.equal(liquid.applyOp(r, { type: 'setText', text: 'Bad' }).refused, true);
});

test('translation placeholders are preserved and outside-theme symlinks cannot be written', t => {
  const app = fixture(t, { 'sections/x.liquid': '<p>{{ "greeting" | t }}</p>', 'locales/en.default.json': '{"greeting":"Hello {{ name }}"}' });
  const r = app.resolve('sections/x.liquid', { locale: 'en' });
  assert.equal(liquid.describe(r).textSource.format, 'template');
  assert.equal(edit(r, 'Hello someone').refused, true);
  assert.equal(edit(r, 'Welcome {{ name }}').ok, true);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'locale.json'), '{"greeting":"External"}');
  fs.unlinkSync(path.join(app.root, 'locales/en.default.json'));
  fs.symlinkSync(path.join(outside, 'locale.json'), path.join(app.root, 'locales/en.default.json'));
  assert.equal(edit(r, 'Bad').refused, true);
});

test('JSON span parser handles comments, escaped quotes and duplicate-key refusal', () => {
  const doc = json.parse('/*x*/ {"a": ["x\\\"y", 2, null], "b": true}');
  assert.equal(json.at(doc, ['a', '0']).value, 'x"y');
  assert.throws(() => json.parse('{"a":"x","a":"y"}'), /Duplicate/);
});

test('render-only files are instrumented and duplicate snippet/argument text has the correct span', t => {
  const caller = `{%- render 'label', text: 'label' -%}`;
  const app = fixture(t, { 'sections/hero.liquid': caller, 'snippets/label.liquid': '<p>{{ text }}</p>' });
  const p = sources.plan(caller, 'sections/hero.liquid');
  const r = app.resolve('snippets/label.liquid', { origin: p.renders[0].binding.id });
  assert.equal(edit(r, 'Caption').ok, true);
  assert.equal(fs.readFileSync(path.join(app.root, 'sections/hero.liquid'), 'utf8'), `{%- render 'label', text: 'Caption' -%}`);
  assert.match(liquid.stamp(caller, path.join(app.root, 'sections/hero.liquid'), app.root).code, /__rt_origin_text:/);
});

test('translation arguments expose the template without replacing its interpolation', t => {
  const app = fixture(t, { 'sections/x.liquid': `<p>{{ 'greeting' | t: name: customer.name }}</p>`, 'locales/en.default.json': '{"greeting":"Hello {{ name }}"}' });
  const r = app.resolve('sections/x.liquid', { locale: 'en' });
  assert.equal(liquid.describe(r).textSource.format, 'template');
  assert.equal(edit(r, 'Welcome {{ name }}').ok, true);
  assert.equal(fs.readFileSync(r.file, 'utf8'), r.source);
});

test('literal captures write to the capture and assignment trimming survives instrumentation', t => {
  const source = `{% capture caption %}Hello{% endcapture %}<p>{{ caption }}</p>`;
  const app = fixture(t, { 'sections/x.liquid': source });
  const p = sources.plan(source, 'sections/x.liquid');
  assert.equal(edit(app.resolve('sections/x.liquid', { origin: p.assignments[0].binding.id }), 'Goodbye').ok, true);
  assert.equal(fs.readFileSync(path.join(app.root, 'sections/x.liquid'), 'utf8'), source.replace('Hello', 'Goodbye'));
  const trim = `{% assign label = 'Hi' -%}  <p>{{ label }}</p>`;
  assert.match(liquid.stamp(trim, path.join(app.root, 'sections/x.liquid'), app.root).code, /assign __rt_origin_label = '[a-f0-9]+' -%\}  <p/);
});

test('a Shopify dynamic-source connection is not mistaken for stored copy', t => {
  const app = fixture(t, {
    'sections/x.liquid': '<p>{{ section.settings.text }}</p>',
    'templates/index.json': '{"sections":{"hero":{"settings":{"text":"{{ product.title }}"}}}}',
  });
  const r = app.resolve('sections/x.liquid', { section: 'hero', template: 'index' });
  assert.equal(liquid.describe(r).textDynamic, true);
  assert.equal(edit(r, 'Wrong').refused, true);
});
