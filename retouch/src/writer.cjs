'use strict';
// The writer (RFC-0001 R-2, R-9, R-11): applies typed ops to source via
// surgical edits, validates before writing, writes atomically, and
// refuses anything it cannot do deterministically (R-6).

const fs = require('node:fs');
const path = require('node:path');
const MagicString = require('magic-string');
const { twMerge } = require('tailwind-merge');
const { parseSource, contentHash } = require('./id.cjs');

// Class tokens: no whitespace and nothing that can escape a double-quoted
// JSX attribute or open markup (R-9).
const CLASS_TOKEN_RE = /^[^\s"'`\\<>{}]+$/u;

function refuse(reason) {
  return { ok: false, refused: true, reason };
}

function escapeJsxText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function findAttr(node, name) {
  return node.openingElement.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === name
  );
}

// Extract editable info about an element for the shell's panel.
function describeElement(resolved) {
  const { element, source } = resolved;
  const node = element.node;
  const classAttr = findAttr(node, 'className');
  let className = null;
  let classNameDynamic = false;
  if (classAttr) {
    if (classAttr.value && classAttr.value.type === 'StringLiteral') {
      className = classAttr.value.value;
    } else {
      classNameDynamic = true;
    }
  }

  const srcAttr = findAttr(node, 'src');
  let src = null;
  let srcDynamic = false;
  if (srcAttr) {
    if (srcAttr.value && srcAttr.value.type === 'StringLiteral') src = srcAttr.value.value;
    else srcDynamic = true;
  }

  const textInfo = literalTextRange(node, source);
  return {
    id: element.id,
    kind: element.kind,
    tag: tagOf(node),
    file: resolved.relPath,
    hash: resolved.hash,
    className,
    classNameDynamic,
    src,
    srcDynamic,
    text: textInfo ? textInfo.text : null,
    textDynamic: textInfo ? false : hasChildren(node),
  };
}

function tagOf(node) {
  const n = node.openingElement.name;
  return n.type === 'JSXIdentifier' ? n.name : 'element';
}

function hasChildren(node) {
  return (node.children || []).some(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
}

// If the element's significant children are text only, return the source
// range covering all children plus the decoded text. Otherwise null.
function literalTextRange(node, source) {
  if (!node.closingElement) return null;
  const children = node.children || [];
  const significant = children.filter(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
  if (significant.length === 0) return null;
  if (!significant.every((c) => c.type === 'JSXText')) return null;
  const start = node.openingElement.end;
  const end = node.closingElement.start;
  const raw = source.slice(start, end);
  const text = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .trim();
  return { start, end, text };
}

// op: { type, id, fileHash, ... }. `resolved` comes from Index.resolve(id).
function applyOp(resolved, op) {
  if (op.fileHash && op.fileHash !== resolved.hash) {
    return refuse('The file changed since it was last read. Re-select the element and retry.');
  }
  const node = resolved.element.node;
  const ms = new MagicString(resolved.source);

  if (op.type === 'setClasses') {
    if (typeof op.classes !== 'string') return refuse('setClasses needs a string.');
    const tokens = op.classes.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!CLASS_TOKEN_RE.test(t)) return refuse(`Class token not allowed: ${JSON.stringify(t)}`);
    }
    const merged = twMerge(tokens.join(' '));
    const attr = findAttr(node, 'className');
    if (attr) {
      if (!attr.value || attr.value.type !== 'StringLiteral') {
        return refuse(
          `className here is a dynamic expression (${resolved.relPath}); Retouch only edits literal class strings.`
        );
      }
      if (merged === '') {
        ms.remove(attr.start - 1, attr.end); // include the preceding space
      } else {
        ms.overwrite(attr.value.start, attr.value.end, JSON.stringify(merged));
      }
    } else {
      if (merged !== '') {
        ms.appendLeft(node.openingElement.name.end, ` className=${JSON.stringify(merged)}`);
      }
    }
  } else if (op.type === 'setText') {
    if (typeof op.text !== 'string') return refuse('setText needs a string.');
    if (op.text.length > 10000) return refuse('Text too long.');
    const range = literalTextRange(node, resolved.source);
    if (!range) {
      return refuse(
        `The text of this element is dynamic or mixed with other elements (${resolved.relPath}); it cannot be edited deterministically here.`
      );
    }
    ms.overwrite(range.start, range.end, escapeJsxText(op.text));
  } else if (op.type === 'setSrc') {
    // Image swap (R-9 amendment, rev 17): src is settable ONLY as a
    // root-relative project path — no scheme, no host, no traversal — which
    // preserves the injection-safety intent of the src exclusion.
    if (typeof op.src !== 'string') return refuse('setSrc needs a string.');
    if (
      op.src.length > 500 ||
      !/^\/[A-Za-z0-9_\-./]+$/.test(op.src) ||
      op.src.startsWith('//') ||
      op.src.split('/').includes('..')
    ) {
      return refuse('Image paths must be root-relative project paths (e.g. /rt-assets/x.png).');
    }
    const tag = tagOf(node);
    if (!/^(img|source|video|image)$/i.test(tag) && !/Image$/.test(tag)) {
      return refuse('setSrc applies to image elements only.');
    }
    const attr = findAttr(node, 'src');
    if (!attr || !attr.value || attr.value.type !== 'StringLiteral') {
      return refuse(
        `src here is not a literal string (an imported image or an expression); it cannot be swapped deterministically (${resolved.relPath}).`
      );
    }
    ms.overwrite(attr.value.start, attr.value.end, JSON.stringify(op.src));
  } else {
    return refuse(`Unknown op type: ${op.type}`);
  }

  const nextSource = ms.toString();

  // R-11(b): the result must parse before anything is written.
  try {
    parseSource(nextSource);
  } catch (err) {
    return refuse(`The edit produced unparseable code and was not written: ${err.message}`);
  }

  // R-11(c): atomic write in the same directory.
  const dir = path.dirname(resolved.file);
  const tmp = path.join(dir, `.retouch-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, nextSource, 'utf8');
  fs.renameSync(tmp, resolved.file);

  return { ok: true, hash: contentHash(nextSource) };
}

module.exports = { applyOp, describeElement };
