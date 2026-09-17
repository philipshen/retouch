'use strict';
const types = ['duplicateSelection', 'deleteSelection', 'moveSelection'];
function plan(resolved, op, adapter) {
  try {
    if (!types.includes(op.type)) throw Error('Choose duplicate, delete or ordering for this selection.');
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the layers.');
    if (!Array.isArray(op.ids) || op.ids.length < 2 || op.ids.length > 100 || new Set(op.ids).size !== op.ids.length ||
        !op.ids.includes(resolved.element.id) || op.ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{10}$/.test(id)))
      throw Error('Choose 2 to 100 distinct layers from one Vue component.');
    const original = adapter.collect(resolved.source, resolved.relPath).elements;
    const selected = op.ids.map(id => original.find(element => element.id === id));
    if (selected.some(element => !element)) throw Error('Every selected layer must belong to this Vue component.');
    const contains = (parent, child) => parent.start <= child.start && parent.end >= child.end;
    const roots = selected.filter(element => !selected.some(other => other !== element && contains(other, element))).sort((a, b) => a.start - b.start);
    const common = original.filter(element => roots.every(root => element !== root && contains(element, root))).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    if (!common) throw Error('The selection needs a shared native source parent.');
    const moving = op.type === 'moveSelection', structure = require('./vue-structure.cjs');
    if (moving) {
      if (!['before', 'after', 'first', 'last'].includes(op.direction)) throw Error('Choose a supported ordering direction.');
      const parents = roots.map(element => structure.siblings({ ...resolved, element }, adapter).parentId);
      if (new Set(parents).size !== 1) throw Error('Reorder layers within the same source parent.');
    }
    const ordered = moving && ['after', 'first'].includes(op.direction) ? [...roots].reverse() : roots;
    const subtreeCount = original.filter(element => roots.some(root => contains(root, element))).length;
    const mapping = new Map(original.map(element => [element.id, element.id]));
    let source = resolved.source, created = [];
    for (const root of ordered) {
      const elements = adapter.collect(source, resolved.relPath).elements, id = mapping.get(root.id), element = elements.find(element => element.id === id);
      if (!element) throw Error('A selected Vue layer lost its source identity.');
      const hash = adapter.contentHash(source);
      if (moving) {
        const { items, index } = structure.siblings({ ...resolved, source, hash, elements, element }, adapter);
        const peer = items[index + (op.direction === 'before' ? -1 : 1)];
        if (op.direction === 'first' && index === 0 || op.direction === 'last' && index === items.length - 1) continue;
        if (['before', 'after'].includes(op.direction) && (!peer || roots.some(root => mapping.get(root.id) === peer.id))) continue;
      }
      // Stage each validated operation against a private source snapshot. No
      // file is written unless every selected root and its style copy succeeds.
      const result = structure.plan({ ...resolved, source, hash, elements, element },
        { type: moving ? 'moveElement' : op.type === 'duplicateSelection' ? 'duplicateElement' : 'deleteElement', direction: op.direction, fileHash: hash }, adapter);
      if (!result.ok) throw Error(result.reason);
      if (result.edits.length !== 1) throw Error('The selected Vue operation did not produce one source edit.');
      const remap = new Map(result.sourceIdMap), removed = new Set(result.removedSourceIds || []);
      for (const [originalId, currentId] of mapping) {
        if (removed.has(currentId)) mapping.delete(originalId); else mapping.set(originalId, remap.get(currentId) || currentId);
      }
      created = created.map(id => remap.get(id) || id);
      if (result.createdId) created.push(result.createdId);
      source = result.edits[0].after;
    }
    if (source === resolved.source) throw Error('The selected layers cannot move farther in that direction.');
    const final = adapter.collect(source, resolved.relPath).elements, ids = new Set(final.map(element => element.id));
    const parentId = mapping.get(common.id), selectionIds = moving ? roots.map(root => mapping.get(root.id)) : op.type === 'duplicateSelection' ? created : [parentId];
    if (final.length !== original.length + (moving ? 0 : op.type === 'duplicateSelection' ? subtreeCount : -subtreeCount) ||
        new Set(mapping.values()).size !== mapping.size || [...mapping.values(), ...selectionIds].some(id => !ids.has(id)))
      throw Error('The resulting Vue layers could not be mapped back to source.');
    return { ok: true, structural: true, hash: adapter.contentHash(source), parentId, selectionIds, rootCount: roots.length,
      sourceIdMap: [...mapping].filter(([before, after]) => before !== after), removedSourceIds: original.filter(element => !mapping.has(element.id)).map(element => element.id),
      edits: [{ file: resolved.file, before: resolved.source, after: source }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
module.exports = { plan, types };
