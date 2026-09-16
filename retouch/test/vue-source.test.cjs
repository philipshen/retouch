'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vueSource = require('../src/vue-source.cjs');
const compiler = require('@vue/compiler-sfc');
const dom = require('@vue/compiler-dom');
const Vue = require('vue');
const { renderToString } = require('vue/server-renderer');

function stamped(source, options) {
  return vueSource.stamp(source, '/project/src/App.vue', '/project', options);
}
function render(source, data = {}, components = {}) {
  const template = compiler.parse(source).descriptor.template;
  const code = dom.compile(template.content, { mode: 'function', prefixIdentifiers: true }).code;
  const render = new Function('Vue', code)(Vue);
  return renderToString(Vue.createSSRApp({ render, setup: () => data, components }));
}

test('SFC stamping preserves script, style, custom blocks and exact Unicode/CRLF locations', () => {
  const source = '<script setup lang="ts">\r\nconst label = "😀 <div>";\r\n</script>\r\n' +
    '<template>\r\n<section title="a > b"><h1 class="title">Café &amp; tea</h1><img src="/a.png" /></section>\r\n</template>\r\n' +
    '<style scoped>.title::before { content: "<p>" }</style>\r\n<i18n>{"title":"<p>"}</i18n>';
  const before = compiler.parse(source).descriptor;
  const result = stamped(source), after = compiler.parse(result.code).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.equal(after.styles[0].content, before.styles[0].content);
  assert.equal(after.customBlocks[0].content, before.customBlocks[0].content);
  const elements = vueSource.collect(source, 'src/App.vue').elements;
  assert.deepEqual(elements.map(element => element.tag), ['section', 'h1', 'img']);
  for (const element of elements) {
    assert.equal(source.slice(element.start, element.end), element.node.loc.source);
    for (const attribute of element.attributes) assert.match(source.slice(attribute.start, attribute.end), new RegExp('^' + attribute.name + '='));
    assert.ok(result.code.includes(`data-rt="${element.id}"`));
  }
  assert.deepEqual(JSON.parse(result.map.toString()).sourcesContent, [source]);
  const { SourceMapConsumer } = require('source-map-js');
  const map = new SourceMapConsumer(JSON.parse(result.map.toString()));
  for (const text of ['Café', 'const label', '.title::before']) {
    const position = (input, offset) => {
      const lines = input.slice(0, offset).split('\n');
      return { line: lines.length, column: lines.at(-1).length };
    };
    const expected = position(source, source.indexOf(text));
    const actual = map.originalPositionFor(position(result.code, result.code.indexOf(text)));
    assert.equal(actual.line, expected.line);
    assert.equal(actual.column, expected.column);
  }
  assert.equal(compiler.compileTemplate({ source: after.template.content, filename: 'App.vue', id: 'test', scoped: true }).errors.length, 0);
});

test('structural IDs ignore whitespace, comments, text, attribute edits and script length', () => {
  const first = '<template><main><p>A</p><p>B</p></main></template>';
  const second = '<script setup>const longer = true;</script><template>\n<main class="new"><!-- added -->\n<p>Changed</p>\n<p title="x">B</p></main></template>';
  const ids = source => vueSource.collect(source, 'src/App.vue').elements.map(element => element.id);
  assert.deepEqual(ids(first), ids(second));
  assert.notDeepEqual(ids(first), vueSource.collect(first, 'src/Other.vue').elements.map(element => element.id));
  assert.equal(stamped(stamped(first).code).code, stamped(first).code);
});

test('real Vue rendering preserves loops, branches, bindings and event handlers', async () => {
  const source = '<template><section><template v-for="item in items" :key="item.id"><p v-if="item.show" :class="item.kind" @click="select(item)">{{ item.label }}</p><span v-else>Hidden</span></template></section></template>';
  const data = { items: [{ id: 1, show: true, kind: 'hot', label: 'One' }, { id: 2, show: true, kind: 'cold', label: 'Two' }, { id: 3, show: false }], select() {} };
  const result = stamped(source);
  const { elements } = vueSource.collect(source, 'src/App.vue');
  assert.deepEqual(elements.map(element => element.tag), ['section', 'p', 'span']);
  assert.equal(elements[1].scope.repeated, true);
  assert.equal(elements[1].scope.conditional, true);
  const actual = await render(result.code, data), original = await render(source, data);
  assert.equal(actual.replace(/ data-rt="[a-f0-9]+"/g, ''), original);
  assert.equal(actual.split(`data-rt="${elements[1].id}"`).length - 1, 2);
  assert.equal(actual.split(`data-rt="${elements[2].id}"`).length - 1, 1);
});

test('component roots and slots are transparent without forwarding another layer marker', async () => {
  const source = '<template><Card><template #default><p>Inside</p></template></Card><slot><em>Fallback</em></slot></template>';
  const result = stamped(source), elements = vueSource.collect(source, 'src/App.vue').elements;
  assert.deepEqual(elements.map(element => element.tag), ['p', 'em']);
  assert.equal(elements[0].scope.slotted, true);
  assert.doesNotMatch(result.code, /<(?:Card|slot|template) data-rt=/);
  const Card = { render() { return Vue.h('article', { 'data-rt': 'card-owned-root' }, this.$slots.default()); } };
  const html = await render(result.code, {}, { Card });
  assert.match(html, /<article data-rt="card-owned-root">/);
  assert.ok(html.includes(`data-rt="${elements[0].id}"`));
  assert.ok(html.includes(`data-rt="${elements[1].id}"`));
});

test('marker-overriding bindings are excluded while their independent children remain mapped', () => {
  const source = '<template><div v-bind="attrs"><p>Child</p></div><span :[name]="value"/><p :data-rt="id"/><img :src="url"/></template>';
  const result = vueSource.collect(source, 'src/App.vue');
  assert.deepEqual(result.elements.map(element => element.tag), ['p', 'img']);
  assert.equal(result.excluded.length, 3);
  assert.match(stamped(source).code, /<div v-bind="attrs"><p data-rt=/);
  assert.match(stamped(source).code, /<img data-rt="[a-f0-9]+" :src="url"/);
});

test('v-pre literal bindings and interpolation remain literal under real Vue rendering', async () => {
  const source = '<template><div v-pre :class="literal"><p>{{ untouched }}</p></div></template>';
  const result = stamped(source);
  assert.equal(vueSource.collect(source, 'src/App.vue').elements.length, 2);
  assert.equal((await render(result.code)).replace(/ data-rt="[a-f0-9]+"/g, ''), await render(source));
});

test('case-insensitive existing markers are replaced once and ambiguous markers are excluded', () => {
  const source = '<template><p DATA-RT="old">Text</p><div data-rt="one" DATA-RT="two"/></template>';
  const result = vueSource.collect(source, 'src/App.vue');
  assert.equal(result.elements.length, 1);
  assert.equal(result.excluded.length, 1);
  assert.match(stamped(source).code, /<p data-rt="[a-f0-9]{10}">Text/);
  assert.equal(stamped(stamped(source).code).code, stamped(source).code);
});

test('inert templates and replaced contents never produce unreachable source mappings', () => {
  const source = '<template><main><template><p>Inert</p></template><div v-html="html"><b>Replaced</b></div><p v-text="text"><em>Replaced</em></p><script>ignored()</script><style>p{color:red}</style></main></template>';
  assert.deepEqual(vueSource.collect(source, 'App.vue').elements.map(element => element.tag), ['main', 'div', 'p']);
});

test('compiler options preserve application custom elements and interpolation grammar', () => {
  const source = '<template><x-card><p>[[ label ]]</p></x-card></template>';
  assert.deepEqual(vueSource.collect(source, 'App.vue').elements.map(element => element.tag), ['p']);
  const options = { isCustomElement: tag => tag === 'x-card', delimiters: ['[[', ']]'] };
  const elements = vueSource.collect(source, 'App.vue', options).elements;
  assert.deepEqual(elements.map(element => element.tag), ['x-card', 'p']);
  assert.equal(elements[1].node.children[0].type, dom.NodeTypes.INTERPOLATION);
  assert.match(stamped(source, options).code, /<x-card data-rt=/);
});

test('invalid or externally compiled templates are refused instead of reinterpreted as HTML', () => {
  for (const source of [
    '<template><p></template>', '<template><p a="1" a="2"/></template>',
    '<template><p/></template><template><div/></template>',
    '<template src="./external.html"/>', '<template lang="pug">p Hello</template>',
  ]) assert.throws(() => vueSource.collect(source, 'App.vue'));
  assert.deepEqual(vueSource.collect('<script>export default {}</script>', 'App.vue'), { elements: [], excluded: [] });
  assert.equal(stamped('<script>export default {}</script>'), null);
});
