'use strict';
const dom = require('@vue/compiler-dom');
const MagicString = require('magic-string');
const source = require('./vue-source.cjs');
const css = require('./css-rules.cjs');
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attribute = (node, name) => node.props?.find(prop => prop.type === dom.NodeTypes.ATTRIBUTE && prop.name.toLowerCase() === name);
const value = (node, name) => attribute(node, name)?.value?.content;
const bound = (node, name) => node.props?.some(prop => prop.type === dom.NodeTypes.DIRECTIVE && prop.name === 'bind' && (!prop.arg || !prop.arg.isStatic || prop.arg.content.toLowerCase() === name));
const empty = () => ({ version: 1, layers: {} });
const identity = relative => source.contentHash(relative + '|vue-css').slice(0, 10);
const selector = relative => `[data-rt-vue-css="${identity(relative)}"]`;
const revision = model => source.contentHash(JSON.stringify(model));
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function body(relative, model) {
  const rules = Object.entries(model.layers).flatMap(([id, scopes]) => Object.entries(scopes).map(([width, values]) => css.rule(id, Number(width), values)));
  return '/* Retouch responsive styles */\n' + rules.concat(`${selector(relative)}{--retouch-css-revision:${revision(model)};}`).join('\n') + '\n';
}
function blockText(relative, model) {
  return `<style data-rt-vue-css="1" data-rt-values="${escape(JSON.stringify(model))}">\n${body(relative, model)}</style>`;
}
function documentState(text, relative) {
  const ast = dom.parse(text, { parseMode: 'sfc' });
  const blocks = ast.children.filter(node => node.type === dom.NodeTypes.ELEMENT && node.tag === 'style' && attribute(node, 'data-rt-vue-css'));
  if (blocks.length > 1) throw Error('The Vue responsive stylesheet is duplicated.');
  const block = blocks[0];
  if (!block) return { model: empty(), block: null };
  const model = JSON.parse(value(block, 'data-rt-values') || 'null');
  if (!object(model) || model.version !== 1 || !object(model.layers) || Object.keys(model).sort().join(',') !== 'layers,version' || Object.keys(model.layers).length > 10000) throw Error('The Vue responsive stylesheet metadata is invalid.');
  for (const [id, scopes] of Object.entries(model.layers)) {
    if (!/^[a-f0-9]{10}$/.test(id) || !object(scopes) || !Object.keys(scopes).length) throw Error('The Vue style identity is invalid.');
    for (const [width, values] of Object.entries(scopes)) {
      if (!/^(0|[1-9]\d*)$/.test(width) || Number(width) > 7680 || !object(values) || !Object.keys(values).length || Object.entries(values).some(([property, value]) => value === null || !css.valid(property, value))) throw Error('The Vue responsive style values are invalid.');
    }
  }
  if (block.loc.source !== blockText(relative, model)) throw Error('The Vue responsive stylesheet changed outside the editor.');
  return { model, block };
}
function inspect(resolved, adapter) {
  const state = documentState(resolved.source, resolved.relPath), parsed = adapter.collect(resolved.source, resolved.relPath), owners = new Map();
  function visit(node) {
    if (node.type === dom.NodeTypes.ELEMENT) {
      const markers = node.props.filter(prop => prop.type === dom.NodeTypes.ATTRIBUTE && prop.name.toLowerCase() === 'data-rt-style');
      if (markers.length > 1) throw Error('A Vue layer has duplicate style identities.');
      const id = markers[0]?.value?.content;
      if (id) owners.set(id, (owners.get(id) || 0) + 1);
    }
    for (const child of node.children || []) visit(child);
  }
  visit(parsed.ast);
  for (const id of Object.keys(state.model.layers)) if (owners.get(id) !== 1) throw Error('A Vue responsive style has an ambiguous or missing source owner.');
  const node = resolved.element.node;
  if (bound(node, 'data-rt-style')) throw Error('This layer computes its style identity.');
  // Important values in a computed inline object cannot be proven from the SFC.
  if (bound(node, 'style')) throw Error('This layer computes its inline styles. Static style editing needs a separate override strategy.');
  let id = value(node, 'data-rt-style');
  if (attribute(node, 'data-rt-style') && !/^[a-f0-9]{10}$/.test(id || '')) throw Error('This Vue layer has an invalid style identity.');
  if (id && (!/^[a-f0-9]{10}$/.test(id) || owners.get(id) !== 1)) throw Error('This Vue layer has an unsupported or shared style identity.');
  if (!id) {
    id = resolved.element.id;
    for (let attempt = 0; owners.has(id) || Object.hasOwn(state.model.layers, id); attempt++) id = source.contentHash(resolved.source + '|vue-style|' + resolved.element.id + '|' + attempt).slice(0, 10);
  }
  return { ...state, id };
}
function describe(resolved, adapter) {
  try {
    const state = inspect(resolved, adapter), rules = state.model.layers[state.id] || {};
    return {
      cssAuthoring: true, cssRules: rules,
      cssRuleTexts: Object.fromEntries(Object.entries(rules).map(([width, values]) => [width, css.rule(state.id, Number(width), values)])),
      cssRendering: { attribute: 'data-rt-revision', hash: resolved.hash, selector: selector(resolved.relPath), property: '--retouch-css-revision', value: revision(state.model) },
    };
  } catch (error) { return { cssAuthoring: true, cssReason: error.message, cssRules: {} }; }
}
function plan(resolved, op, adapter) {
  const refuse = reason => ({ ok: false, refused: true, reason });
  try {
    if (op.fileHash && op.fileHash !== resolved.hash) return refuse('The file changed. Re-select the layer.');
    const state = inspect(resolved, adapter), blocks = Object.entries(state.model.layers[state.id] || {}).map(([width, values]) => ({ width: Number(width), values }));
    const update = css.change({ blocks }, op, value(resolved.element.node, 'style') || '');
    if (!update.ok) return update;
    if (!update.changed) return { ok: true, hash: resolved.hash, edits: [] };
    const layers = { ...state.model.layers };
    if (update.rules.size) layers[state.id] = Object.fromEntries([...update.rules].sort(([a], [b]) => a - b)); else delete layers[state.id];
    const model = { version: 1, layers: Object.fromEntries(Object.entries(layers).sort(([a], [b]) => a.localeCompare(b))) };
    const out = new MagicString(resolved.source), marker = resolved.element.attributes.find(prop => prop.name.toLowerCase() === 'data-rt-style');
    if (update.rules.size && !marker) out.appendLeft(resolved.element.start + 1 + resolved.element.tag.length, ` data-rt-style="${state.id}"`);
    const replacement = Object.keys(model.layers).length ? blockText(resolved.relPath, model) : '';
    if (state.block) out.overwrite(state.block.loc.start.offset, state.block.loc.end.offset, replacement); else if (replacement) out.append(replacement);
    const after = out.toString();
    const next = adapter.collect(after, resolved.relPath).elements;
    const prior = adapter.collect(resolved.source, resolved.relPath).elements;
    if (prior.length !== next.length || prior.some((element, i) => element.id !== next[i].id || element.tag !== next[i].tag)) return refuse('This style would change the Vue template structure.');
    documentState(after, resolved.relPath);
    return { ok: true, hash: source.contentHash(after), edits: [{ file: resolved.file, before: resolved.source, after }] };
  } catch (error) { return refuse(error.message); }
}
function warmInto(out, text, relative, styleModule) {
  const state = documentState(text, relative);
  if (styleModule) {
    const replacement = `<style src="${escape(styleModule)}"></style>`;
    if (state.block) out.overwrite(state.block.loc.start.offset, state.block.loc.end.offset, replacement); else out.append(replacement);
  } else if (!state.block) out.append(blockText(relative, empty()));
}
function warm(text, relative, styleModule) {
  const out = new MagicString(text);
  warmInto(out, text, relative, styleModule);
  return out.toString();
}
function planSelection(resolved, op, adapter) {
  const refuse = reason => ({ ok: false, refused: true, reason });
  if (op.fileHash !== resolved.hash) return refuse('The file changed. Re-select the layers.');
  if (!Number.isInteger(op.width) || op.width < 0 || op.width > 7680) return refuse('Choose a supported screen width.');
  if (!Array.isArray(op.ids) || op.ids.length < 2 || op.ids.length > 100 || new Set(op.ids).size !== op.ids.length || !op.ids.includes(resolved.element.id) || op.ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{10}$/.test(id))) return refuse('Choose 2 to 100 distinct layers from one Vue component.');
  if (op.resetScope !== undefined && (op.resetScope !== true || ['property', 'value', 'changes', 'changesById'].some(key => Object.hasOwn(op, key)))) return refuse('Reset selected screen scopes without additional property changes.');
  const individual = op.changesById;
  if (individual !== undefined && (!object(individual) || ['property', 'value', 'changes'].some(key => Object.hasOwn(op, key)) || Object.keys(individual).length !== op.ids.length || Object.keys(individual).some(id => !op.ids.includes(id)))) return refuse('Provide one change set for every selected layer.');
  const initial = adapter.collect(resolved.source, resolved.relPath).elements;
  if (op.ids.some(id => !initial.some(element => element.id === id))) return refuse('Every selected layer must belong to this Vue component.');
  let text = resolved.source;
  for (const id of op.ids) {
    if (individual !== undefined && object(individual[id]) && !Object.keys(individual[id]).length) continue;
    const elements = adapter.collect(text, resolved.relPath).elements, hash = source.contentHash(text);
    const result = plan({ ...resolved, source: text, hash, elements, element: elements.find(element => element.id === id) }, { ...op, type: 'setCSS', fileHash: hash, ...(individual === undefined ? {} : { changes: individual[id] }) }, adapter);
    if (!result.ok) return result;
    if (result.edits.length) text = result.edits[0].after;
  }
  const elements = adapter.collect(text, resolved.relPath).elements, hash = source.contentHash(text);
  const selection = op.ids.map(id => adapter.describe({ ...resolved, source: text, hash, elements, element: elements.find(element => element.id === id) }));
  return { ok: true, hash, selection, edits: text === resolved.source ? [] : [{ file: resolved.file, before: resolved.source, after: text }] };
}
module.exports = { describe, plan, planSelection, warm, warmInto, documentState, stylesheet: (text, relative) => body(relative, documentState(text, relative).model) };
