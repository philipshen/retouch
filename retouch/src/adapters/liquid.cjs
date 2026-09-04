'use strict';
// The Liquid language adapter (RFC-0001 DR-0015). Parses Shopify `.liquid`
// theme files with a tolerant HTML+Liquid tokenizer, stamps HTML elements with
// structural IDs, and rewrites classes / literal text / tags deterministically.
// Dynamic regions ({% %} and {{ }}) are opaque and never edited (R-6).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MagicString = require('magic-string');
const { twMerge } = require('tailwind-merge');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_LIQUID = new Set(['comment', 'raw', 'schema', 'javascript', 'stylesheet']);
const RAW_HTML = new Set(['script', 'style']);
const SKIP_TAGS = new Set(['script', 'style', 'svg', 'path', 'template']);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'blockquote', 'label', 'a', 'li']);
const CLASS_TOKEN_RE = /^[^\s"'`\\<>{}]+$/u;

function contentHash(source) {
  return crypto.createHash('sha1').update(source).digest('hex');
}
function hashId(relPath, pathLoc) {
  return crypto.createHash('sha1').update(relPath + '|' + pathLoc).digest('hex').slice(0, 10);
}
function matches(filePath) {
  return /\.liquid$/.test(filePath);
}

// --- tolerant tokenizer + tree builder -------------------------------------

function parse(source) {
  const roots = [];
  const stack = [];
  const all = [];
  const N = source.length;
  let i = 0;

  const pushChild = (node) => {
    const parent = stack[stack.length - 1];
    node.parent = parent || null;
    const sibs = parent ? parent.children : roots;
    node.childIndex = sibs.length;
    node.pathLoc = (parent ? parent.pathLoc + '/' : '') + node.childIndex;
    sibs.push(node);
    all.push(node);
  };

  while (i < N) {
    if (source.startsWith('{%', i)) {
      const end = source.indexOf('%}', i);
      if (end === -1) break;
      const name = source.slice(i + 2, end).replace(/^-/, '').trim().split(/\s+/)[0];
      if (RAW_LIQUID.has(name)) {
        const re = new RegExp('\\{%-?\\s*end' + name + '\\s*-?%\\}');
        const m = re.exec(source.slice(end + 2));
        i = m ? end + 2 + m.index + m[0].length : N;
      } else {
        i = end + 2;
      }
      continue;
    }
    if (source.startsWith('{{', i)) {
      const end = source.indexOf('}}', i);
      i = end === -1 ? N : end + 2;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i);
      i = end === -1 ? N : end + 3;
      continue;
    }
    const ch = source[i];
    if (ch === '<' && /[a-zA-Z]/.test(source[i + 1] || '')) {
      const tag = readOpenTag(source, i);
      pushChild(tag);
      if (RAW_HTML.has(tag.tag)) {
        const re = new RegExp('</' + tag.tag + '\\s*>', 'i');
        const m = re.exec(source.slice(tag.openEnd));
        tag.childrenEnd = tag.closeStart = tag.openEnd + (m ? m.index : 0);
        tag.closeEnd = m ? tag.openEnd + m.index + m[0].length : N;
        i = tag.closeEnd;
      } else if (tag.selfClosing || VOID.has(tag.tag)) {
        tag.childrenEnd = tag.closeStart = tag.closeEnd = tag.openEnd;
        i = tag.openEnd;
      } else {
        stack.push(tag);
        i = tag.openEnd;
      }
      continue;
    }
    if (ch === '<' && source[i + 1] === '/') {
      const end = source.indexOf('>', i);
      const closeEnd = end === -1 ? N : end + 1;
      const name = source.slice(i + 2, end === -1 ? N : end).trim().toLowerCase();
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tag === name) {
          const node = stack[s];
          node.childrenEnd = node.closeStart = i;
          node.closeStart = i;
          node.closeEnd = closeEnd;
          node.closeNameStart = i + 2;
          node.closeNameEnd = end === -1 ? N : end;
          stack.length = s;
          break;
        }
      }
      i = closeEnd;
      continue;
    }
    i++;
  }
  return { roots, all };
}

function readOpenTag(source, start) {
  const N = source.length;
  let j = start + 1;
  while (j < N && /[a-zA-Z0-9:-]/.test(source[j])) j++;
  const tag = source.slice(start + 1, j).toLowerCase();
  const nameEnd = j;
  let k = j;
  let classAttr = null;
  let selfClosing = false;
  let openEnd = N;
  while (k < N) {
    if (source.startsWith('{%', k)) { const e = source.indexOf('%}', k); k = e === -1 ? N : e + 2; continue; }
    if (source.startsWith('{{', k)) { const e = source.indexOf('}}', k); k = e === -1 ? N : e + 2; continue; }
    const c = source[k];
    if (c === '>') { openEnd = k + 1; break; }
    if (c === '/' && source[k + 1] === '>') { selfClosing = true; openEnd = k + 2; break; }
    if (/\s/.test(c)) { k++; continue; }
    const attrStart = k;
    while (k < N && !/[\s=/>]/.test(source[k])) k++;
    const attrName = source.slice(attrStart, k).toLowerCase();
    while (k < N && /\s/.test(source[k])) k++;
    let value = null, valueStart = -1, valueEnd = -1;
    if (source[k] === '=') {
      k++;
      while (k < N && /\s/.test(source[k])) k++;
      const q = source[k];
      if (q === '"' || q === "'") {
        valueStart = k + 1;
        const e = source.indexOf(q, k + 1);
        valueEnd = e === -1 ? N : e;
        value = source.slice(valueStart, valueEnd);
        k = e === -1 ? N : e + 1;
      } else {
        valueStart = k;
        while (k < N && !/[\s>]/.test(source[k])) k++;
        valueEnd = k;
        value = source.slice(valueStart, valueEnd);
      }
    }
    if (attrName === 'class') {
      classAttr = { valueStart, valueEnd, value, dynamic: /\{[%{]/.test(value || '') };
    }
  }
  return {
    tag, kind: 'host', tagStart: start, nameEnd, openEnd, selfClosing,
    classAttr, childrenStart: openEnd, children: [],
  };
}

// --- adapter interface ------------------------------------------------------

function collect(source, relPath) {
  const { all } = parse(source);
  const elements = [];
  for (const node of all) {
    if (SKIP_TAGS.has(node.tag)) continue;
    node.id = hashId(relPath, node.pathLoc);
    node.node = node; // the "node" the resolved bundle carries is the parse node
    elements.push(node);
  }
  return { elements };
}

function stamp(source, filePath /* , appRoot */) {
  if (!matches(filePath)) return null;
  if (!source.includes('<')) return null;
  const { elements } = collect(source, filePath);
  if (elements.length === 0) return null;
  const ms = new MagicString(source);
  for (const el of elements) ms.appendLeft(el.nameEnd, ` data-rt="${el.id}"`);
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: filePath }) };
}

function literalText(node, source) {
  if (node.closeStart == null) return null;
  const inner = source.slice(node.childrenStart, node.childrenEnd);
  if (/[<]|\{[%{]/.test(inner)) return null; // nested tag or liquid → not literal
  const text = inner.trim();
  return text === '' ? null : text;
}

function hasElementChildren(node) {
  return node.children && node.children.length > 0;
}

function describe(resolved) {
  const node = resolved.element;
  const source = resolved.source;
  const text = literalText(node, source);
  const inner = node.closeStart != null ? source.slice(node.childrenStart, node.childrenEnd) : '';
  const hasLiquid = /\{[%{]/.test(inner);
  return {
    id: node.id,
    kind: 'host',
    tag: node.tag,
    file: resolved.relPath,
    hash: resolved.hash,
    className: node.classAttr && !node.classAttr.dynamic ? node.classAttr.value : null,
    classNameDynamic: !!(node.classAttr && node.classAttr.dynamic),
    src: null,
    srcDynamic: false,
    canSetTag: TEXT_TAGS.has(node.tag) && node.closeStart != null,
    text,
    textDynamic: text === null && hasLiquid,
    mixedText: text === null && hasElementChildren(node) && !hasLiquid && /\S/.test(inner.replace(/<[^>]*>/g, '')),
  };
}

function refuse(reason) { return { ok: false, refused: true, reason }; }
function escapeText(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

function applyOp(resolved, op) {
  if (op.fileHash && op.fileHash !== resolved.hash) {
    return refuse('The file changed since it was last read. Re-select the element and retry.');
  }
  const node = resolved.element;
  const ms = new MagicString(resolved.source);

  if (op.type === 'setClasses') {
    if (typeof op.classes !== 'string') return refuse('setClasses needs a string.');
    const tokens = op.classes.split(/\s+/).filter(Boolean);
    for (const t of tokens) if (!CLASS_TOKEN_RE.test(t)) return refuse(`Class token not allowed: ${JSON.stringify(t)}`);
    const merged = twMerge(tokens.join(' '));
    if (node.classAttr) {
      if (node.classAttr.dynamic) return refuse(`class here contains Liquid (${resolved.relPath}); it cannot be edited deterministically.`);
      ms.overwrite(node.classAttr.valueStart, node.classAttr.valueEnd, merged);
    } else if (merged !== '') {
      ms.appendLeft(node.nameEnd, ` class="${merged}"`);
    }
  } else if (op.type === 'setText') {
    if (typeof op.text !== 'string') return refuse('setText needs a string.');
    const text = literalText(node, resolved.source);
    if (text === null) return refuse(`This element's text is dynamic or mixed (${resolved.relPath}); it cannot be edited in place.`);
    ms.overwrite(node.childrenStart, node.childrenEnd, escapeText(op.text));
  } else if (op.type === 'setTag') {
    if (!TEXT_TAGS.has(op.tag)) return refuse('Unsupported target tag.');
    if (node.closeStart == null) return refuse('This element has no closing tag and cannot change tag.');
    ms.overwrite(node.tagStart + 1, node.nameEnd, op.tag);
    if (node.closeNameStart != null) ms.overwrite(node.closeNameStart, node.closeNameEnd, op.tag);
  } else {
    return refuse(`This op is not supported by the Liquid adapter yet: ${op.type}`);
  }

  const next = ms.toString();
  // R-11(b): the result must still parse before anything is written.
  try { collect(next, resolved.relPath); } catch (err) {
    return refuse(`The edit produced malformed markup and was not written: ${err.message}`);
  }
  // R-11(c): atomic write in the same directory.
  const dir = path.dirname(resolved.file);
  const tmp = path.join(dir, `.retouch-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, next, 'utf8');
  fs.renameSync(tmp, resolved.file);
  return { ok: true, hash: contentHash(next) };
}

module.exports = {
  name: 'liquid',
  matches,
  stamp,
  collect,
  contentHash,
  describe,
  applyOp,
  capabilities: { classAttr: 'class', ops: ['setClasses', 'setText', 'setTag'] },
  _parse: parse, // exported for tests
};
