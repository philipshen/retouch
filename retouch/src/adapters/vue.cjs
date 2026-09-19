'use strict';
const path = require('node:path');
const MagicString = require('magic-string');
const { NodeTypes } = require('@vue/compiler-dom');
const source = require('../vue-source.cjs');
const tags = new Set(['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li']);
const refuse = reason => ({ ok: false, refused: true, reason });
const escapeText = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
const escapeAttr = value => escapeText(value).replace(/"/g, '&quot;');
const attr = (element, name) => element.attributes.find(attribute => attribute.name.toLowerCase() === name);
const unique = (element, name) => element.attributes.filter(attribute => attribute.name.toLowerCase() === name).length <= 1;
const bound = (element, name) => element.node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' &&
  (!prop.arg || !prop.arg.isStatic || prop.arg.content.toLowerCase() === name));
const directive = (element, name) => element.node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === name);

function textRange(element) {
  if (element.node.ns !== 0 || !tags.has(element.tag) || element.node.isSelfClosing || directive(element, 'html') || directive(element, 'text')) return null;
  if (!element.node.children.every(child => child.type === NodeTypes.TEXT)) return null;
  const end = element.node.loc.source.lastIndexOf('</' + element.tag);
  if (end < 0) return null;
  // With text-only children, the first child's compiler location is exactly
  // after the opening tag, even when an attribute contains a quoted >.
  const start = element.node.children[0]?.loc.start.offset + element.templateOffset;
  return { start: Number.isFinite(start) ? start : element.start + end, end: element.start + end };
}

function create(options = {}) {
  const compilerOptions = () => typeof options.compilerOptions === 'function' ? options.compilerOptions() : options.compilerOptions || {};
  const collect = (text, relative) => source.collect(text, relative, compilerOptions());
  const literalText = value => {
    const delimiterStart = Array.from(compilerOptions().delimiters?.[0] || '{{')[0];
    return Array.from(value, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ||
      (char === delimiterStart || char === '{' || char === '}' ? '&#' + char.codePointAt(0) + ';' : char)).join('');
  };
  const describe = resolved => {
    const element = resolved.element;
    const range = textRange(element);
    const rendered = source.collect(resolved.source, resolved.relPath, compilerOptions(), { preserveWhitespace: false }).elements.find(item => item.id === element.id);
    const rich = require('../vue-rich-text.cjs').describe(resolved, adapter, rendered);
    const canSetSrc = element.tag === 'img' && unique(element, 'src') && !element.scope.picture && !attr(element, 'srcset') && !bound(element, 'src') && !bound(element, 'srcset');
    return {
      id: element.id, kind: 'host', tag: element.tag, file: resolved.relPath, hash: resolved.hash,
      renderRevisionAttribute: 'data-rt-revision',
      linkedStyleAuthoring: true, textStyleAuthoring: true, selectionStructureOps: [...require('../vue-structure-selection.cjs').types, ...require('../vue-frame-selection.cjs').types],
      structure: { ...require('../vue-structure.cjs').describe(resolved, adapter), ...require('../vue-insert.cjs').describe(resolved), ...require('../vue-reparent.cjs').describe(resolved, adapter), ...require('../vue-frame-selection.cjs').describe(resolved, adapter) },
      className: attr(element, 'class')?.value || '', classNameDynamic: true,
      classNameReason: 'Use the responsive CSS properties for Vue styles.',
      text: range ? element.node.children.map(child => child.content).join('') : null,
      renderedText: rendered?.node.children.every(child => child.type === NodeTypes.TEXT) ? rendered.node.children.map(child => child.content).join('') : null,
      textDynamic: !range && !rich.canSetChildren, textReason: 'This Vue region contains expressions, directives, or nested markup. Its template logic is preserved.',
      mixedText: rich.canSetChildren && !range, ...rich,
      src: attr(element, 'src')?.value ?? null, srcDynamic: bound(element, 'src'), canSetSrc,
      srcReason: canSetSrc ? null : 'Select an image with a literal source and no responsive source bindings.',
      href: element.tag === 'a' ? attr(element, 'href')?.value ?? null : undefined,
      canSetHref: element.tag === 'a' && element.node.ns === 0 && unique(element, 'href') && !bound(element, 'href'),
      hrefReason: 'This link destination is controlled by a Vue binding.',
      canSetTag: !!range, canRename: unique(element, 'data-rt-name') && !bound(element, 'data-rt-name'), layerName: attr(element, 'data-rt-name')?.value || '',
      context: resolved.context || null,
      ...require('../vue-css.cjs').describe(resolved, adapter),
      ...require('../vue-text-styles.cjs').create(adapter).describe(resolved),
      ...require('../vue-linked-styles.cjs').create('color',adapter).describe(resolved),
      ...require('../vue-linked-styles.cjs').create('effect',adapter).describe(resolved),
      ...require('../vue-linked-styles.cjs').create('variable',adapter).describe(resolved),
    };
  };
  function planOp(resolved, op) {
    if (op.fileHash && op.fileHash !== resolved.hash) return refuse('The file changed. Re-select the element.');
    if (require('../vue-frame-selection.cjs').types.includes(op.type)) return require('../vue-frame-selection.cjs').plan(resolved, op, adapter);
    if (op.type === 'setChildren') return require('../vue-rich-text.cjs').plan(resolved, op, adapter, literalText);
    if (op.type === 'setCSS') return require('../vue-css.cjs').plan(resolved, op, adapter);
    if (op.type === 'setCSSSelection') return require('../vue-css.cjs').planSelection(resolved, op, adapter);
    if (op.type === 'insertElement') return require('../vue-insert.cjs').plan(resolved, op, adapter);
    if (op.type === 'reparentElement') return require('../vue-reparent.cjs').plan(resolved, op, adapter);
    if (require('../vue-structure-selection.cjs').types.includes(op.type)) return require('../vue-structure-selection.cjs').plan(resolved, op, adapter);
    if (require('../vue-structure.cjs').types.includes(op.type)) return require('../vue-structure.cjs').plan(resolved, op, adapter);
    const element = resolved.element, info = describe(resolved), out = new MagicString(resolved.source);
    function setAttribute(name, value) {
      const old = attr(element, name), token = `${name}="${escapeAttr(value)}"`;
      if (old) out.overwrite(old.start, old.end, token);
      else out.appendLeft(element.start + 1 + element.tag.length, ' ' + token);
    }
    if (op.type === 'setText') {
      const range = textRange(element);
      if (!range) return refuse(info.textReason);
      if (typeof op.text !== 'string' || op.text.length > 1000000 || op.text.includes('\0')) return refuse('Invalid text.');
      if (op.text === info.text) return { ok: true, hash: resolved.hash, edits: [] };
      // Entity-encode braces so literal text cannot become a Vue interpolation.
      if (range.start === range.end) out.appendLeft(range.start, literalText(op.text));
      else out.overwrite(range.start, range.end, literalText(op.text));
    } else if (op.type === 'setTag') {
      if (!info.canSetTag || !tags.has(op.tag)) return refuse('This Vue layer cannot change its tag yet.');
      const end = element.start + element.node.loc.source.lastIndexOf('</' + element.tag);
      out.overwrite(element.start + 1, element.start + 1 + element.tag.length, op.tag);
      out.overwrite(end + 2, end + 2 + element.tag.length, op.tag);
    } else if (op.type === 'setSrc') {
      if (!info.canSetSrc || typeof op.src !== 'string' || op.src.length > 100000 || /[\0-\x1f]/.test(op.src)) return refuse(info.srcReason || 'Invalid image source.');
      try { if (!['https:', 'http:'].includes(new URL(op.src, 'https://retouch.local/').protocol)) return refuse('Unsupported image URL scheme.'); } catch { return refuse('Invalid image URL.'); }
      setAttribute('src', op.src);
    } else if (op.type === 'setHref') {
      if (!info.canSetHref) return refuse('Choose a native link with a literal destination.');
      if (op.href !== null && !require('../../shell/link-values.js').valid(op.href)) return refuse('Use a web, email, phone or relative link destination.');
      const old = attr(element, 'href');
      if (op.href === null) { if (old) out.remove(old.start, old.end); } else setAttribute('href', op.href);
    } else if (op.type === 'renameElement') {
      if (!info.canRename || typeof op.name !== 'string' || op.name.length > 200 || /[\x00-\x1f\x7f]/.test(op.name)) return refuse('Use a literal, single-line layer name of up to 200 characters.');
      const name = op.name.trim(), old = attr(element, 'data-rt-name');
      if (name) setAttribute('data-rt-name', name); else if (old) out.remove(old.start, old.end);
    } else return refuse('This Vue operation is not implemented yet.');
    const after = out.toString();
    if (after === resolved.source) return { ok: true, hash: resolved.hash, edits: [] };
    try {
      const beforeElements = collect(resolved.source, resolved.relPath).elements, next = collect(after, resolved.relPath).elements;
      if (beforeElements.length !== next.length || beforeElements.some((item, index) => item.id !== next[index].id || next[index].tag !== (op.type === 'setTag' && item.id === element.id ? op.tag : item.tag))) return refuse('This edit would change the surrounding Vue template structure.');
      if (op.type === 'setText' && describe({ ...resolved, source: after, element: next.find(item => item.id === element.id) }).text !== op.text) return refuse('Vue would interpret this text differently. The source was not changed.');
    } catch (error) { return refuse('The edited Vue template is invalid: ' + error.message); }
    return { ok: true, hash: source.contentHash(after), edits: [{ file: resolved.file, before: resolved.source, after }] };
  }
  const adapter = {
    name: 'vue', matches: file => /\.vue$/i.test(file), collect, describe, planOp, compilerOptions,
    stamp: (text, file, root) => {
      const relative = root ? path.relative(root, file).split(path.sep).join('/') : file;
      return source.stamp(text, file, root, compilerOptions(), { revision: source.contentHash(text), transformDocument: out => require('../vue-css.cjs').warmInto(out, text, relative, options.styleModule?.(relative)) });
    }, contentHash: source.contentHash,
    assets: { directory: 'public', urlPrefix: '/', uploadDirectory: 'rt-assets', imageOnly: true },
    capabilities: { classAttr: 'class', ops: ['setPrototypeInteractions','applyVariable', 'applyVariableSelection', 'resetVariable', 'resetVariableSelection', 'detachVariable', 'detachVariableSelection', 'removeVariable', 'removeVariableSelection', 'applyColorStyle', 'applyColorStyleSelection', 'resetColorStyle', 'resetColorStyleSelection', 'detachColorStyle', 'detachColorStyleSelection', 'applyEffectStyle', 'applyEffectStyleSelection', 'resetEffectStyle', 'resetEffectStyleSelection', 'detachEffectStyle', 'detachEffectStyleSelection', 'updateEffectStyle', 'applyTextStyle', 'resetTextStyle', 'detachTextStyle', 'updateTextStyle', 'applyTextStyleSelection', 'resetTextStyleSelection', 'detachTextStyleSelection', 'setText', 'setChildren', 'setTag', 'setSrc', 'setHref', 'renameElement', 'setCSS', 'setCSSSelection', 'insertElement', 'reparentElement', ...require('../vue-structure.cjs').types, ...require('../vue-structure-selection.cjs').types, ...require('../vue-frame-selection.cjs').types] },
    applyOp: (resolved, op) => require('../transactions.cjs').applyPlan(resolved.appRoot || path.dirname(resolved.file), planOp(resolved, op)),
  };
  return adapter;
}
module.exports = { ...create(), create };
