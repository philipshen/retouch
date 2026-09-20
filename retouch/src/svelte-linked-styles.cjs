'use strict';
const source = require('./svelte-source.cjs');
const families = ['text', 'color', 'effect'];
const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
const attributeRemovalStart = (text, start) => text[start - 1] === ' ' ? start - 1 : start;
function create(family, adapter = require('./adapters/svelte.cjs')) {
  if (!families.includes(family)) throw Error('Unsupported Svelte style family.');
  const attribute = 'data-rt-' + family + '-styles', title = family[0].toUpperCase() + family.slice(1);
  const refuse = reason => ({ ok: false, refused: true, reason });
  function project(element) {
    return { ...element, node: { ...element.node, attrs: element.attributes.map(a => ({ name: a.name, value: a.value })) }, location: { startTag: { startOffset: element.start }, attrs: Object.fromEntries(element.attributes.map(a => [a.name, { startOffset: a.start, endOffset: a.end }])) } };
  }
  const renderer = { ...adapter, escapeAttribute, attributeRemovalStart, collect: (text, relative) => { const parsed = adapter.collect(text, relative); return { ...parsed, elements: parsed.elements.map(project) }; } };
  const css = { describe: r => require('./svelte-css.cjs').describe(r), plan: (r, op) => require('./svelte-css.cjs').plan(r, { ...op, fileHash: r.hash }) };
  const core = require('./html-' + family + '-styles.cjs').create(renderer, css);
  const resolve = r => ({ ...r, element: project(r.element) });
  function links(r) {
    const markers = r.element.node.attributes.filter(a => a.name?.toLowerCase() === attribute);
    if (markers.length > 1) throw Error('This Svelte layer has duplicate ' + family + ' style links.');
    if (markers.some(a => !source.literal(a)) || r.element.node.attributes.some(a => a.type === 'SpreadAttribute')) throw Error('This Svelte layer computes its ' + family + ' style links.');
    return core.links(resolve(r));
  }
  function describe(r) {
    try { links(r); return core.describe(resolve(r)); }
    catch (error) { return family === 'color' ? { colorStyles: false, colorStyleReason: error.message } : { [family + 'StyleLinkReason']: error.message }; }
  }
  function plan(r, op, style) {
    try {
      links(r);
      const result = core.plan(resolve(r), op, style);
      if (!result.ok || !result.edits.length) return result;
      const after = result.edits[0].after, beforeElements = adapter.collect(r.source, r.relPath).elements, nextElements = adapter.collect(after, r.relPath).elements;
      if (beforeElements.length !== nextElements.length || beforeElements.some((e, i) => e.id !== nextElements[i].id || e.tag !== nextElements[i].tag)) throw Error('This style link would change the Svelte template structure.');
      links({ element: nextElements.find(e => e.id === r.element.id) });
      return result;
    } catch (error) { return refuse(error.message); }
  }
  function planFile(file, relPath, before, style) {
    try {
      require('./' + family + '-styles.cjs').validate({ version: 1, styles: [style] });
      const parsed = adapter.collect(before, relPath), indexed = new Set(parsed.elements.map(e => e.start)), targets = [];
      function check(node) {
        if (!node || typeof node !== 'object') return;
        if (node.attributes?.some(a => a.name?.toLowerCase() === attribute) && !indexed.has(node.start)) throw Error('A ' + family + ' style link belongs to unsupported Svelte markup.');
        for (const [key, child] of Object.entries(node)) {
          if (['attributes', 'expression', 'metadata'].includes(key)) continue;
          if (Array.isArray(child)) child.forEach(check); else if (child && typeof child === 'object') check(child);
        }
      }
      check(parsed.ast.fragment);
      for (const element of parsed.elements) {
        if (!element.node.attributes.some(a => a.name?.toLowerCase() === attribute)) continue;
        for (const [width, value] of Object.entries(links({ element }))) {
          if (family === 'color') { for (const [property, link] of Object.entries(value)) if (link.id === style.id) targets.push({ id: element.id, width: Number(width), property }); }
          else if (value.id === style.id) targets.push({ id: element.id, width: Number(width) });
        }
      }
      let text = before;
      for (const target of targets) {
        const element = adapter.collect(text, relPath).elements.find(e => e.id === target.id);
        if (!element) throw Error('A linked Svelte layer could not be resolved.');
        const result = plan({ source: text, file, relPath, element, hash: adapter.contentHash(text) }, { type: 'refresh' + title + 'Style', width: target.width, property: target.property }, style);
        if (!result.ok) return result;
        text = result.edits[0]?.after || text;
      }
      return { ok: true, updated: targets.length, edits: text === before ? [] : [{ file, before, after: text }] };
    } catch (error) { return refuse(error.message); }
  }
  return { links, describe, plan, planFile, attribute, ...(core.properties ? { properties: core.properties } : {}) };
}
module.exports = { create, families, escapeAttribute, attributeRemovalStart };
