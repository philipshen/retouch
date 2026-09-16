'use strict';
const { NodeTypes, ElementTypes } = require('@vue/compiler-dom');

function siblings(resolved, adapter) {
  const parsed = adapter.collect(resolved.source, resolved.relPath);
  const selected = parsed.elements.find(element => element.id === resolved.element.id);
  let parent;
  function find(node) {
    if (node.children?.includes(selected?.node)) parent = node;
    for (const child of node.children || []) find(child);
  }
  find(parsed.ast);
  const owner = parsed.elements.find(element => element.node === parent);
  if (!owner || parent.ns !== 0) throw Error('Choose a layer inside a native Vue parent.');
  const items = [];
  for (const child of parent.children) {
    if (child.type === NodeTypes.TEXT && !child.content.trim()) continue;
    if (child.type !== NodeTypes.ELEMENT || child.tagType !== ElementTypes.ELEMENT || child.ns !== 0 ||
        child.props.some(prop => prop.type === NodeTypes.DIRECTIVE && ['for', 'if', 'else', 'else-if', 'slot'].includes(prop.name)))
      throw Error('Reordering across Vue control flow, component siblings or mixed text is not available yet.');
    const element = parsed.elements.find(element => element.node === child);
    if (!element) throw Error('Every sibling needs an unambiguous source identity.');
    items.push(element);
  }
  const index = items.findIndex(element => element.id === selected.id);
  if (index < 0) throw Error('The selected Vue sibling could not be located.');
  return { parsed, items, index, parentId: owner.id };
}
function describe(resolved, adapter) {
  const base = { canReparent: false, canCopy: false, canPaste: false, canDuplicate: false, canDelete: false,
    canMoveBefore: false, canMoveAfter: false, canMoveFirst: false, canMoveLast: false, parentId: null };
  try {
    const { items, index, parentId } = siblings(resolved, adapter);
    return { ...base, parentId, canMoveBefore: index > 0, canMoveFirst: index > 0,
      canMoveAfter: index < items.length - 1, canMoveLast: index < items.length - 1, reason: null };
  } catch (error) { return { ...base, reason: error.message }; }
}
function plan(resolved, op, adapter) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the layer before moving it.');
    if (op.type !== 'moveElement') throw Error('This Vue structural operation is not implemented yet.');
    const { parsed, items, index, parentId } = siblings(resolved, adapter);
    const to = op.direction === 'before' ? index - 1 : op.direction === 'after' ? index + 1 : op.direction === 'first' ? 0 : op.direction === 'last' ? items.length - 1 : -1;
    if (to < 0 || to >= items.length || to === index) throw Error('There is no sibling in that direction.');
    const order = items.map((_, index) => index);
    order.splice(index, 1); order.splice(to, 0, index);
    const positions = [];
    let after = resolved.source.slice(0, items[0].start);
    items.forEach((slot, index) => {
      const element = items[order[index]];
      positions.push({ element, start: after.length });
      after += resolved.source.slice(element.start, element.end) + resolved.source.slice(slot.end, items[index + 1]?.start ?? resolved.source.length);
    });
    const next = adapter.collect(after, resolved.relPath).elements, mapped = new Set(), sourceIdMap = [];
    let movedId;
    for (const element of parsed.elements) {
      const position = positions.find(({ element: root }) => element.start >= root.start && element.start < root.end);
      const start = position ? position.start + element.start - position.element.start : element.start;
      const target = next.find(candidate => candidate.start === start && candidate.tag === element.tag);
      if (!target || mapped.has(target.id)) throw Error('The reordered Vue layers could not be mapped back to source.');
      mapped.add(target.id);
      if (target.id !== element.id) sourceIdMap.push([element.id, target.id]);
      if (element.id === resolved.element.id) movedId = target.id;
    }
    if (!movedId || mapped.size !== next.length) throw Error('Reordering changed the Vue source layer identities.');
    return { ok: true, structural: true, hash: adapter.contentHash(after), parentId, movedId, sourceIdMap,
      edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
module.exports = { describe, plan };
