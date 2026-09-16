'use strict';
// Vue SFC source mapping. Keep this independent of the HTML adapter: Vue's
// template grammar, component boundaries and source locations are different.
const path = require('node:path');
const crypto = require('node:crypto');
const MagicString = require('magic-string');
const sfc = require('@vue/compiler-sfc');
const dom = require('@vue/compiler-dom');
const { NodeTypes, ElementTypes } = dom;
const hash = source => crypto.createHash('sha1').update(source).digest('hex');
const directive = (node, name) => node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === name);

function collect(source, relPath, compilerOptions = {}, { preserveWhitespace = true } = {}) {
  const parsed = sfc.parse(source, { filename: relPath });
  if (parsed.errors.length) throw new Error('Invalid Vue component: ' + parsed.errors.map(error => error.message || error).join('; '));
  const template = parsed.descriptor.template;
  if (!template) return { elements: [], excluded: [] };
  if (template.src) throw new Error('External Vue templates need a separate source mapping.');
  if (template.lang && template.lang !== 'html') throw new Error('Vue template language is not supported: ' + template.lang);
  // Compiler options must match the application's Vue integration (notably
  // custom elements and interpolation delimiters). Callbacks cannot suppress
  // syntax errors. Source editing preserves whitespace; render verification
  // can request the application's compiler whitespace normalization instead.
  const ast = dom.parse(template.content, { ...compilerOptions, comments: true, whitespace: preserveWhitespace ? 'preserve' : compilerOptions.whitespace || 'condense', onError(error) { throw error; } });
  const offset = template.loc.start.offset;
  const elements = [], excluded = [];
  function walk(parent, route, scope) {
    let index = 0;
    for (const node of parent.children || []) {
      if (node.type !== NodeTypes.ELEMENT) continue;
      const here = route + '/' + index++;
      const nextScope = {
        repeated: scope.repeated || directive(node, 'for'),
        conditional: scope.conditional || ['if', 'else', 'else-if'].some(name => directive(node, name)),
        slotted: scope.slotted || node.tagType === ElementTypes.COMPONENT || directive(node, 'slot'),
        picture: scope.picture || node.tag === 'picture',
      };
      // Literal template contents and side-effect tags do not become preview
      // layers. Structural <template v-if/v-for/#slot> nodes are transparent.
      if (['script', 'style'].includes(node.tag) || (node.tag === 'template' && node.tagType === ElementTypes.ELEMENT)) continue;
      if (node.tagType === ElementTypes.ELEMENT) {
        const reserved = ['data-rt', 'data-rt-revision'];
        const collision = reserved.some(name => node.props.filter(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name.toLowerCase() === name).length > 1) || node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' &&
          (!prop.arg || !prop.arg.isStatic || reserved.includes(prop.arg.content.toLowerCase())));
        if (collision) {
          excluded.push({ tag: node.tag, start: offset + node.loc.start.offset, reason: 'Conflicting attributes can replace the source marker.' });
        } else {
          const attributes = node.props.filter(prop => prop.type === NodeTypes.ATTRIBUTE).map(prop => ({
            name: prop.name, value: prop.value?.content ?? '',
            start: offset + prop.loc.start.offset, end: offset + prop.loc.end.offset,
          }));
          elements.push({
            id: hash(relPath + '|vue|' + here).slice(0, 10), kind: 'host', tag: node.tag,
            node, attributes, scope: nextScope,
            start: offset + node.loc.start.offset, end: offset + node.loc.end.offset,
            templateOffset: offset,
          });
        }
      }
      // v-html/v-text replace their contents; do not map unreachable children.
      if (!directive(node, 'html') && !directive(node, 'text')) walk(node, here, nextScope);
    }
  }
  walk(ast, '', { repeated: false, conditional: false, slotted: false });
  return { elements, excluded, template, ast };
}

function stamp(source, file, root, compilerOptions, { revision } = {}) {
  const relPath = root ? path.relative(root, file).split(path.sep).join('/') : file;
  const { elements } = collect(source, relPath, compilerOptions);
  if (!elements.length) return null;
  const out = new MagicString(source);
  for (const element of elements) {
    const old = element.attributes.find(attribute => attribute.name.toLowerCase() === 'data-rt');
    if (old) out.overwrite(old.start, old.end, `data-rt="${element.id}"`);
    else out.appendLeft(element.start + 1 + element.tag.length, ` data-rt="${element.id}"`);
    if (revision) {
      const prior = element.attributes.find(attribute => attribute.name.toLowerCase() === 'data-rt-revision');
      const token = `data-rt-revision="${revision}"`;
      if (prior) out.overwrite(prior.start, prior.end, token);
      else out.appendLeft(element.start + 1 + element.tag.length, ' ' + token);
    }
  }
  return { code: out.toString(), map: out.generateMap({ hires: true, source: file, includeContent: true }) };
}

module.exports = { collect, stamp, contentHash: hash };
