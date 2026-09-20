'use strict';
const MagicString = require('magic-string');
const containers = new Set(['div', 'main', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'li', 'td', 'th', 'blockquote']);
const presets = { text: '<p>New text</p>', frame: '<div aria-label="Frame" style="box-sizing:border-box;height:100px;padding:16px;border:1px dashed #999"></div>' };
function describe(resolved) {
  const element = resolved.element;
  if (element.scope.svg || !containers.has(element.tag)) return { canInsert: false, insertReason: 'Select a content container to add a layer.' };
  if (element.node.attributes.some(attr => attr.type === 'SpreadAttribute' || attr.type === 'BindDirective' && ['innerHTML', 'innerText', 'textContent'].includes(attr.name)))
    return { canInsert: false, insertReason: 'This Svelte container replaces its children with generated content.' };
  return { canInsert: true, insertReason: null };
}
function plan(resolved, op, adapter) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the container.');
    const capability = describe(resolved);
    if (!capability.canInsert) throw Error(capability.insertReason);
    if (!Object.hasOwn(presets, op.preset)) throw Error('Choose a text layer or frame.');
    let content = presets[op.preset];
    if (op.position !== undefined) {
      if (op.preset !== 'text') throw Error('Only text supports canvas placement.');
      content = require('./text-placement.cjs').markup(op.position);
    }
    const element = resolved.element, raw = resolved.source.slice(element.start,element.end), out = new MagicString(resolved.source);
    const indent = resolved.source.slice(0, element.start).match(/(?:^|\n)([ \t]*)$/)?.[1] || '';
    const newline = resolved.source.includes('\r\n') ? '\r\n' : '\n', prefix = newline + indent + '  ';
    const insertion = prefix + content + newline + indent;
    let offset;
    if (raw.endsWith('/>')) {
      offset = element.end - 2;
      if (resolved.source.slice(offset, element.end) !== '/>') throw Error('The Svelte container closing token could not be located.');
      out.overwrite(offset, element.end, '>' + insertion + '</' + element.tag + '>');
      offset++;
    } else {
      const close = raw.lastIndexOf('</' + element.tag);
      if (close < 0) throw Error('The Svelte container has no closing tag.');
      offset = element.start + close; out.appendLeft(offset, insertion);
    }
    const after = out.toString(), prior = adapter.collect(resolved.source, resolved.relPath).elements;
    const next = adapter.collect(after, resolved.relPath).elements, parent = next.find(item => item.id === element.id);
    const created = next.find(item => item.start === offset + prefix.length);
    if (next.length !== prior.length + 1 || !created || !parent?.node.fragment.nodes.includes(created.node) ||
        prior.some(item => !next.some(other => other.id === item.id && other.tag === item.tag)))
      throw Error('The inserted layer would change the surrounding Svelte template structure.');
    return { ok: true, structural: true, hash: adapter.contentHash(after), parentId: parent.id, createdId: created.id,
      edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
module.exports = { describe, plan };
