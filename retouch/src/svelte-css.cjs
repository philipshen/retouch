'use strict';
const MagicString = require('magic-string');
const source = require('./svelte-source.cjs');
const css = require('./css-rules.cjs');
const prefix = '\n/* retouch-responsive:';
const suffix = '/* /retouch-responsive */\n';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const empty = () => ({ version: 1, created: false, layers: {} });
const attribute = (node, name) => (node.attributes || []).filter(a => a.name?.toLowerCase() === name);
const value = a => a?.value === true ? '' : a?.value?.map(n => n.data).join('');
function validate(model) {
  if (!object(model) || Object.keys(model).sort().join(',') !== 'created,layers,version' || model.version !== 1 || typeof model.created !== 'boolean' || !object(model.layers) || Object.keys(model.layers).length > 10000) throw Error('Invalid Svelte responsive style metadata.');
  for (const [id, scopes] of Object.entries(model.layers)) {
    if (!/^[a-f0-9]{10}$/.test(id) || !object(scopes) || !Object.keys(scopes).length) throw Error('Invalid Svelte style identity.');
    for (const [width, values] of Object.entries(scopes)) if (!/^(0|[1-9]\d*)$/.test(width) || Number(width) > 7680 || !object(values) || !Object.keys(values).length || Object.entries(values).some(([p, v]) => v === null || !css.valid(p, v))) throw Error('Invalid Svelte responsive style values.');
  }
}
function stylesheet(model, global = false) {
  return Object.entries(model.layers).flatMap(([id, scopes]) => Object.entries(scopes).map(([width, values]) => {
    const rule = css.rule(id, Number(width), values);
    return global ? rule.replaceAll(`[data-rt-style="${id}"]`, `:global([data-rt-style="${id}"])`) : rule;
  })).join('\n');
}
function segment(model) {
  validate(model);
  return prefix + Buffer.from(JSON.stringify(model)).toString('base64') + ' */\n' + stylesheet(model, true) + '\n' + suffix;
}
function documentState(text, relative) {
  const parsed = source.collect(text, relative), style = parsed.ast.css;
  if (style && (attribute(style, 'src').length || attribute(style, 'lang').some(a => !source.literal(a) || value(a) !== 'css'))) throw Error('Responsive editing requires a local CSS style block.');
  const content = style ? text.slice(style.content.start, style.content.end) : '';
  const start = content.indexOf(prefix);
  if (start < 0) {
    if (content.includes('retouch-responsive')) throw Error('The Svelte responsive stylesheet changed outside the editor.');
    return { model: empty(), style, parsed, range: null };
  }
  const metadataEnd = content.indexOf(' */\n', start + prefix.length);
  const end = content.indexOf(suffix, metadataEnd) + suffix.length;
  if (metadataEnd < 0 || end < suffix.length || content.indexOf(prefix, start + prefix.length) !== -1) throw Error('Invalid or duplicated Svelte responsive stylesheet.');
  const encoded = content.slice(start + prefix.length, metadataEnd);
  const model = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  validate(model);
  if (content.slice(start, end) !== segment(model) || content.slice(0, start).includes('retouch-responsive') || content.slice(end).includes('retouch-responsive')) throw Error('The Svelte responsive stylesheet changed outside the editor.');
  if (model.created && text.slice(style.start, style.end) !== '<style>' + segment(model) + '</style>') throw Error('The generated Svelte style block has authored changes.');
  return { model, style, parsed, range: { start: style.content.start + start, end: style.content.start + end } };
}
function replaceModel(text, relative, model) {
  const state = documentState(text, relative), out = new MagicString(text);
  model = { ...model, created: state.range ? state.model.created : !state.style };
  const replacement = Object.keys(model.layers).length ? segment(model) : '';
  if (state.range) {
    if (!replacement && state.model.created) out.remove(state.style.start, state.style.end);
    else out.overwrite(state.range.start, state.range.end, replacement);
  } else if (replacement) {
    if (state.style) out.appendLeft(state.style.content.end, replacement);
    else out.append('<style>' + replacement + '</style>');
  }
  const result = out.toString(); documentState(result, relative); return result;
}
function strip(text, relative) {
  return replaceModel(text, relative, empty());
}
function ownership(state) {
  if (state.owners) return state.owners;
  const owners = new Map();
  // Inventory every template owner, including components and unmapped spread hosts.
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    const markers = attribute(node, 'data-rt-style');
    if (markers.length > 1) throw Error('A Svelte layer has duplicate style identities.');
    if (markers.length) {
      if (!source.literal(markers[0])) throw Error('A Svelte layer computes its style identity.');
      const id = value(markers[0]);
      if (!/^[a-f0-9]{10}$/.test(id)) throw Error('Invalid Svelte style identity.');
      owners.set(id, (owners.get(id) || 0) + 1);
    }
    for (const [key, child] of Object.entries(node)) {
      if (['attributes', 'expression', 'metadata'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
    }
  }
  visit(state.parsed.ast.fragment);
  const mapped = new Set(state.parsed.elements.map(e => value(attribute(e.node, 'data-rt-style')[0])));
  for (const id of Object.keys(state.model.layers)) if (owners.get(id) !== 1 || !mapped.has(id)) throw Error('A Svelte responsive style has an ambiguous or missing source owner.');
  state.owners = owners;
  return owners;
}
function inspect(resolved, state = documentState(resolved.source, resolved.relPath)) {
  const owners = ownership(state);
  const node = resolved.element.node, inline = attribute(node, 'style');
  if (inline.length > 1 || inline.some(a => !source.literal(a)) || node.attributes.some(a => a.type === 'StyleDirective' || a.type === 'SpreadAttribute')) throw Error('This layer computes its inline styles.');
  let id = value(attribute(node, 'data-rt-style')[0]);
  if (id && owners.get(id) !== 1) throw Error('This Svelte layer shares its style identity.');
  if (!id) {
    id = resolved.element.id;
    for (let attempt = 0; owners.has(id) || Object.hasOwn(state.model.layers, id); attempt++) id = source.contentHash(resolved.source + '|svelte-style|' + resolved.element.id + '|' + attempt).slice(0, 10);
  }
  return { ...state, id, inline: value(inline[0]) || '' };
}
function plan(resolved, op) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the layer.');
    const state = inspect(resolved);
    const blocks = Object.entries(state.model.layers[state.id] || {}).map(([width, values]) => ({ width: Number(width), values }));
    const update = css.change({ blocks }, op, state.inline);
    if (!update.ok) return update;
    if (!update.changed) return { ok: true, hash: resolved.hash, edits: [] };
    const layers = { ...state.model.layers };
    if (update.rules.size) layers[state.id] = Object.fromEntries([...update.rules].sort(([a], [b]) => a - b)); else delete layers[state.id];
    const model = { ...state.model, layers: Object.fromEntries(Object.entries(layers).sort(([a], [b]) => a.localeCompare(b))) };
    const out = new MagicString(resolved.source);
    if (update.rules.size && !attribute(resolved.element.node, 'data-rt-style').length) out.appendLeft(resolved.element.start + 1 + resolved.element.tag.length, ` data-rt-style="${state.id}"`);
    const after = replaceModel(out.toString(), resolved.relPath, model);
    const next = source.collect(after, resolved.relPath).elements, prior = state.parsed.elements;
    if (prior.length !== next.length || prior.some((e, i) => e.id !== next[i].id || e.tag !== next[i].tag)) throw Error('This style would change the Svelte template structure.');
    inspect({ ...resolved, source: after, element: next.find(e => e.id === resolved.element.id) });
    return { ok: true, hash: source.contentHash(after), edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return { ok: false, refused: true, reason: error.message }; }
}
function planSelection(resolved, op, adapter) {
  const refuse = reason => ({ ok: false, refused: true, reason });
  if (op.fileHash !== resolved.hash) return refuse('The file changed. Re-select the layers.');
  if (!Number.isInteger(op.width) || op.width < 0 || op.width > 7680) return refuse('Choose a supported screen width.');
  if (!Array.isArray(op.ids) || op.ids.length < 2 || op.ids.length > 100 || new Set(op.ids).size !== op.ids.length || !op.ids.includes(resolved.element.id) || op.ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{10}$/.test(id))) return refuse('Choose 2 to 100 distinct layers from one Svelte component.');
  if (op.resetScope !== undefined && (op.resetScope !== true || ['property', 'value', 'changes', 'changesById'].some(key => Object.hasOwn(op, key)))) return refuse('Reset selected screen scopes without additional property changes.');
  const individual = op.changesById;
  if (individual !== undefined && (!object(individual) || ['property', 'value', 'changes'].some(key => Object.hasOwn(op, key)) || Object.keys(individual).length !== op.ids.length || Object.keys(individual).some(id => !op.ids.includes(id)))) return refuse('Provide one change set for every selected layer.');
  const initial = source.collect(resolved.source, resolved.relPath).elements;
  if (op.ids.some(id => !initial.some(element => element.id === id))) return refuse('Every selected layer must belong to this Svelte component.');
  let text = resolved.source;
  for (const id of op.ids) {
    if (individual !== undefined && object(individual[id]) && !Object.keys(individual[id]).length) continue;
    const elements = source.collect(text, resolved.relPath).elements, hash = source.contentHash(text);
    const result = plan({ ...resolved, source: text, hash, elements, element: elements.find(element => element.id === id) }, { ...op, type: 'setCSS', fileHash: hash, ...(individual === undefined ? {} : { changes: individual[id] }) });
    if (!result.ok) return result;
    if (result.edits.length) text = result.edits[0].after;
  }
  const hash = source.contentHash(text);
  const elements = source.collect(text, resolved.relPath).elements;
  const selection = adapter ? op.ids.map(id => adapter.describe({ ...resolved, source: text, hash, elements, element: elements.find(e => e.id === id) })) : undefined;
  return { ok: true, hash, ...(selection ? { selection } : {}), edits: text === resolved.source ? [] : [{ file: resolved.file, before: resolved.source, after: text }] };
}
const identity = relative => source.contentHash(relative + '|svelte-css').slice(0, 10);
const selector = relative => `[data-rt-svelte-css="${identity(relative)}"]`;
const revision = model => source.contentHash(JSON.stringify(model));
function describe(resolved) {
  try {
    const state = inspect(resolved), rules = state.model.layers[state.id] || {};
    return { cssAuthoring: true, cssRules: rules,
      cssRuleTexts: Object.fromEntries(Object.entries(rules).map(([width, values]) => [width, css.rule(state.id, Number(width), values)])),
      cssRendering: { attribute: 'data-rt-revision', hash: resolved.hash, selector: selector(resolved.relPath), property: '--retouch-css-revision', value: revision(state.model) } };
  } catch (error) { return { cssAuthoring: true, cssReason: error.message, cssRules: {} }; }
}
function runtimeSnapshot(text, relative) {
  const state = documentState(text, relative), ids = {}, attributes = {}, attributeHosts = {};
  const linked = require('./svelte-linked-styles.cjs'), families = linked.families.map(family => linked.create(family));
  for (const element of state.parsed.elements) {
    try { ids[element.id] = inspect({ source: text, relPath: relative, element }, state).id; } catch { /* Leave computed or ambiguous identities untouched. */ }
  }
  for (const element of state.parsed.elements) if (Object.hasOwn(ids, element.id)) {
    attributeHosts[element.id] = [];
    for (const family of families) {
      try {
        family.links({ element }); attributeHosts[element.id].push(family.attribute);
        const marker = element.attributes.find(a => a.name === family.attribute);
        if (marker) attributes[element.id + '|' + family.attribute] = marker.value;
      } catch { /* Computed metadata keeps its original compiler behavior. */ }
    }
  }
  // A managed model must have valid owners before its compiled CSS is replaced.
  const supported = new Set(Object.values(ids));
  if (Object.keys(state.model.layers).some(id => !supported.has(id))) throw Error('A managed Svelte stylesheet has an unsupported source owner.');
  return { state, ids, attributes, attributeHosts, css: { id: identity(relative), text: stylesheet(state.model) + '\n' + selector(relative) + '{--retouch-css-revision:' + revision(state.model) + ';}' } };
}
function removeManaged(out, state) {
  if (state.range) out.remove(state.model.created ? state.style.start : state.range.start, state.model.created ? state.style.end : state.range.end);
}
module.exports = { ownership, documentState, replaceModel, strip, inspect, plan, planSelection, stylesheet, describe, runtimeSnapshot, removeManaged };
