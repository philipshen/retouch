'use strict';
const MagicString = require('magic-string');
const { NodeTypes, ElementTypes } = require('@vue/compiler-dom');
const insertion = require('./vue-insert.cjs');
function context(resolved, adapter) {
  const data = require('./vue-structure.cjs').siblings(resolved, adapter), parents = new Map();
  function visit(node) { for (const child of node.children || []) { parents.set(child, node); visit(child); } }
  visit(data.parsed.ast);
  // Vue removes v-pre from its AST. Inspect only the opening token, excluding
  // quoted attribute values, to retain this template-interpretation boundary.
  const pre = node => /\sv-pre(?:[\s=/]|$)/.test((node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0] || '').replace(/"[^"]*"|'[^']*'/g, '').split('>')[0]);
  const scope = node => {
    const result = [];
    for (; node; node = parents.get(node)) if (node.type === NodeTypes.ELEMENT && (node.tagType === ElementTypes.COMPONENT || pre(node) ||
      node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && ['for', 'slot'].includes(prop.name)))) result.push(node);
    return result;
  };
  const selected = data.items[data.index], sourceScope = scope(parents.get(selected.node));
  const sameScope = node => { const target = scope(node); return target.length === sourceScope.length && target.every((node, index) => node === sourceScope[index]); };
  const contains = (parent, node) => { for (; node; node = parents.get(node)) if (node === parent) return true; return false; };
  const common = destination => {
    for (let node = parents.get(selected.node); node; node = parents.get(node))
      if (contains(node, destination.node)) return data.parsed.elements.find(element => element.node === node);
  };
  const compatible = destination => destination && !contains(selected.node, destination.node) && sameScope(destination.node) &&
    insertion.describe({ ...resolved, element: destination }).canInsert && common(destination);
  return { ...data, parents, selected, compatible, common };
}
function describe(resolved, adapter) {
  try {
    const data = context(resolved, adapter);
    const containers = data.parsed.elements.filter(element => element.node !== data.parents.get(data.selected.node) && data.compatible(element));
    return { canReparent: containers.length > 0, reparentContainers: containers.map(element => element.id) };
  } catch (error) { return { canReparent: false, reparentContainers: [], reparentReason: error.message }; }
}
function plan(resolved, op, adapter) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the layer.');
    const data = context(resolved, adapter), { selected, parsed, parents } = data;
    const position = op.position ?? 'inside';
    if (!['inside', 'before', 'after'].includes(position)) throw Error('Choose inside, before or after the destination.');
    const target = parsed.elements.find(element => element.id === op.destinationId);
    if (!target || target.id === selected.id) throw Error('Choose another layer in the same Vue component.');
    const destination = position === 'inside' ? target : parsed.elements.find(element => element.node === parents.get(target.node));
    if (!data.compatible(destination)) throw Error('Choose a native container in the same Vue loop, slot and v-pre scope, outside this subtree.');
    if (position === 'inside' && destination.node === parents.get(selected.node)) throw Error('The layer is already in that container.');
    if (position !== 'inside') require('./vue-structure.cjs').siblings({ ...resolved, element: target }, adapter);
    const shared = data.common(destination), chunk = resolved.source.slice(selected.start, selected.end), out = new MagicString(resolved.source);
    const newline = resolved.source.includes('\r\n') ? '\r\n' : '\n', prefix = newline + '  ', suffix = newline;
    let offset, end, inserted;
    if (position === 'inside') {
      if (destination.node.isSelfClosing) { offset = destination.end - 2; end = destination.end; if (resolved.source.slice(offset, end) !== '/>') throw Error('The destination closing token could not be located.'); inserted = '>' + prefix + chunk + suffix + '</' + destination.tag + '>'; }
      else { const close = destination.node.loc.source.lastIndexOf('</' + destination.tag); if (close < 0) throw Error('The destination has no closing tag.'); offset = destination.start + close; end = offset; inserted = prefix + chunk + suffix; }
    } else { offset = position === 'before' ? target.start : target.end; end = offset; inserted = prefix + chunk + suffix; }
    out.remove(selected.start, selected.end);
    if (end > offset) out.overwrite(offset, end, inserted); else out.appendLeft(offset, inserted);
    const after = out.toString(), next = adapter.collect(after, resolved.relPath).elements;
    const movedStart = offset - (selected.start < offset ? chunk.length : 0) + prefix.length + (end > offset ? 1 : 0);
    const shifted = start => start >= selected.start && start < selected.end ? movedStart + start - selected.start :
      start - (start >= selected.end ? chunk.length : 0) + (start >= end ? inserted.length - (end - offset) : 0);
    const map = new Map(), used = new Set(), sourceIdMap = [];
    for (const element of parsed.elements) {
      const target = next.find(candidate => candidate.start === shifted(element.start) && candidate.tag === element.tag);
      if (!target || used.has(target.id)) throw Error('An original Vue layer lost its source identity.');
      map.set(element.id, target); used.add(target.id);
      if (element.id !== target.id) sourceIdMap.push([element.id, target.id]);
    }
    const moved = map.get(selected.id), newParent = map.get(destination.id);
    if (next.length !== parsed.elements.length || !newParent.node.children.includes(moved.node)) throw Error('The move changed the parsed Vue parent.');
    return { ok: true, structural: true, hash: adapter.contentHash(after), sourceIdMap, movedId: moved.id, destinationId: newParent.id,
      parentId: map.get(shared.id).id, edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
module.exports = { describe, plan };
