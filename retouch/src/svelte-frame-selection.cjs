'use strict';
const MagicString = require('magic-string');
const source = require('./svelte-source.cjs');
const structure = require('./svelte-structure.cjs'), insertion = require('./svelte-insert.cjs');
const types = ['frameSelection', 'groupSelection', 'removeFrame'];
const contains = (a, b) => a.start <= b.start && a.end >= b.end;
const isFrame = element => element.tag === 'div' && element.attributes.some(attribute => attribute.name === 'data-rt-frame');
function releaseRange(element, text) {
  const raw = text.slice(element.start, element.end);
  if (!isFrame(element) || raw.endsWith('/>') || element.node.attributes.some(attr => attr.type !== 'Attribute' || !source.literal(attr))) throw Error('Choose a complete Retouch frame without Svelte directives or bindings.');
  if (element.node.fragment.nodes.some(node => ['ConstTag','SnippetBlock','DeclarationTag'].includes(node.type))) throw Error('This frame introduces local Svelte declarations.');
  const opening = raw.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0];
  const close = raw.lastIndexOf('</' + element.tag);
  if (!opening || close < opening.length) throw Error('The frame has no complete closing tag.');
  return { start: element.start + opening.length, end: element.start + close };
}
function describe(resolved, adapter) {
  try {
    const data = structure.siblings(resolved, adapter), parent = data.parsed.elements.find(element => element.id === data.parentId);
    let canRemoveFrame = false; try { releaseRange(resolved.element, resolved.source); canRemoveFrame = true; } catch {}
    return { canFrame: insertion.describe({ ...resolved, element: parent }).canInsert, canRemoveFrame };
  } catch { return { canFrame: false, canRemoveFrame: false }; }
}
function plan(resolved, op, adapter) {
  try {
    if (!types.includes(op.type)) throw Error('Choose group, frame or remove frame.');
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the layers.');
    const parsed = adapter.collect(resolved.source, resolved.relPath), elements = parsed.elements;
    const parents = new Map();
    function visit(node) { if (!node || typeof node !== 'object') return; for (const [key, value] of Object.entries(node)) { if (['attributes','expression','metadata'].includes(key)) continue; for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child === 'object') { parents.set(child,node); visit(child); } } } visit(parsed.ast.fragment);
    let roots, parent, start, end, opening = '', closing = '', removed;
    if (op.type === 'removeFrame') {
      removed = elements.find(element => element.id === resolved.element.id);
      ({ start, end } = releaseRange(removed, resolved.source));
      const data = structure.siblings({ ...resolved, element: removed }, adapter);
      parent = elements.find(element => element.id === data.parentId);
      roots = elements.filter(element => parents.get(parents.get(element.node)) === removed.node);
    } else {
      if (!Array.isArray(op.ids) || !op.ids.length || op.ids.length > 100 || new Set(op.ids).size !== op.ids.length || !op.ids.includes(resolved.element.id)) throw Error('Choose 1 to 100 distinct layers in one Svelte component.');
      const selected = op.ids.map(id => elements.find(element => element.id === id));
      if (selected.some(element => !element)) throw Error('A selected layer no longer resolves.');
      roots = selected.filter(element => !selected.some(other => other !== element && contains(other, element))).sort((a, b) => a.start - b.start);
      const data = structure.siblings({ ...resolved, element: roots[0] }, adapter);
      parent = elements.find(element => element.id === data.parentId);
      if (!insertion.describe({ ...resolved, element: parent }).canInsert) throw Error('Choose siblings in a content container.');
      const indices = roots.map(root => data.items.findIndex(item => item.id === root.id));
      if (indices.some((index, i) => index < 0 || index !== indices[0] + i)) throw Error('Choose consecutive sibling layers without reordering other content.');
      start = roots[0].start; end = roots.at(-1).end;
      opening = op.type === 'groupSelection' ? '<div data-rt-frame="" data-rt-group="" aria-label="Group" style="display: contents">' : '<div data-rt-frame="" aria-label="Frame">'; closing = '</div>';
    }
    const out = new MagicString(resolved.source);
    if (removed) { out.remove(removed.start, start); out.remove(end, removed.end); }
    else { out.appendLeft(start, opening); out.appendLeft(end, closing); }
    let after = out.toString();
    const next = adapter.collect(after, resolved.relPath).elements;
    if (next.length !== elements.length + (removed ? -1 : 1)) throw Error('Framing changed the parsed Svelte structure.');
    const shifted = offset => removed ? offset - (offset >= start ? start - removed.start : 0) - (offset >= removed.end ? removed.end - end : 0) : offset + (offset >= start ? opening.length : 0) + (offset >= end ? closing.length : 0);
    const map = new Map(), used = new Set();
    for (const element of elements) {
      if (element === removed) continue;
      const target = next.find(item => item.start === shifted(element.start) && item.tag === element.tag);
      if (!target || used.has(target.id)) throw Error('An original Svelte layer lost its source identity.');
      map.set(element, target); used.add(target.id);
    }
    const frame = removed ? null : next.find(item => item.start === start && isFrame(item));
    if (!removed && (!frame || !map.get(parent).node.fragment.nodes.includes(frame.node))) throw Error('The frame changed its parsed parent.');
    for (const element of elements) {
      if (element === removed) continue;
      const priorParent = elements.find(item => item.node === parents.get(parents.get(element.node)));
      const expected = roots.includes(element) ? (removed ? map.get(parent) : frame) : map.get(priorParent);
      if (expected && !expected.node.fragment.nodes.includes(map.get(element).node)) throw Error('Framing moved an unrelated layer.');
    }
    if (removed) {
      const styles = require('./svelte-css.cjs');
      const state = structure.structuralStyles(resolved, adapter, { ...removed, end: start, node: { attributes: removed.node.attributes } }, false);
      after = styles.replaceModel(after, resolved.relPath, state.model);
      const final = adapter.collect(after, resolved.relPath).elements;
      if (final.length !== next.length || final.some((element, i) => element.id !== next[i].id || element.tag !== next[i].tag)) throw Error('Style cleanup changed source identity.');
    }
    const selectionIds = removed ? (roots.length ? roots.map(root => map.get(root).id) : [map.get(parent).id]) : [frame.id];
    return { ok: true, structural: true, hash: adapter.contentHash(after), parentId: map.get(parent).id, selectionIds, rootCount: roots.length,
      sourceIdMap: [...map].filter(([before, after]) => before.id !== after.id).map(([before, after]) => [before.id, after.id]), removedSourceIds: removed ? [removed.id] : [],
      edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
module.exports = { types, describe, plan };
