'use strict';
// The writer (RFC-0001 R-2, R-9, R-11): applies typed ops to source via
// surgical edits, validates before writing, writes atomically, and
// refuses anything it cannot do deterministically (R-6).

const fs = require('node:fs');
const path = require('node:path');
const MagicString = require('magic-string');
const { twMerge } = require('tailwind-merge');
const { parseSource, contentHash } = require('./id.cjs');
const traverse = require('@babel/traverse').default;

function imageSource(attr, source) {
  if (!attr?.value) return null;
  if (attr.value.type === 'StringLiteral') return { value: attr.value.value };
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'StringLiteral') return { value: attr.value.expression.value };
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'Identifier') {
    const name = attr.value.expression.name;
    let imported;
    traverse(parseSource(source), { JSXAttribute(p) {
      if (p.node.start !== attr.start) return;
      const binding = p.scope.getBinding(name);
      if (binding?.kind === 'module') imported = binding.path.parentPath.node;
      p.stop();
    } });
    if (imported && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(imported.source.value)) return { value: imported.source.value, imported: true };
  }
  return null;
}

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

  const canSetTag =
    node.openingElement.name.type === 'JSXIdentifier' &&
    /^[a-z]/.test(node.openingElement.name.name) &&
    !!node.closingElement;

  const srcAttr = findAttr(node, 'src');
  const image = imageSource(srcAttr, source);
  const authoredSrcSet = findAttr(node, 'srcSet');
  const picture = resolved.elements?.some(e => tagOf(e.node) === 'picture' && e.node.start < node.start && e.node.end > node.end);
  let src = null;
  let srcDynamic = false;
  if (srcAttr) {
    if (image) src = image.value;
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
    srcImported: !!image?.imported,
    canSetSrc: !!image && !authoredSrcSet && !picture && (/^(img|source|video|image)$/i.test(tagOf(node)) || /Image$/.test(tagOf(node))),
    srcReason: authoredSrcSet || picture ? 'This image has authored responsive sources. Editing those choices is deferred.' : null,
    canSetTag,
    text: textInfo ? textInfo.text : null,
    textDynamic: textInfo ? false : hasChildren(node),
    mixedText:
      !textInfo &&
      childrenAreMappable(node) &&
      (node.children || []).some((c) => c.type === 'JSXText' && c.value.trim() !== ''),
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

// Rich in-place editing (DR-0014): the fixed formatting vocabulary.
const WRAP_TAGS = new Set(['strong', 'em', 'u', 's']);

// True when every significant child is JSXText or JSXElement — the shape
// rich editing can map back to source. Expressions refuse (R-6).
function childrenAreMappable(node) {
  if (!node.closingElement) return false;
  const significant = (node.children || []).filter(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
  if (significant.length === 0) return false;
  return significant.every((c) => c.type === 'JSXText' || c.type === 'JSXElement');
}

function validateChildrenTree(children, depth) {
  if (!Array.isArray(children)) return 'setChildren needs a children array.';
  if (depth > 8) return 'Nesting too deep.';
  for (const c of children) {
    if (!c || typeof c !== 'object') return 'Bad node.';
    if (c.t === 'text') {
      if (typeof c.value !== 'string' || c.value.length > 10000) return 'Bad text node.';
    } else if (c.t === 'wrap') {
      if (!WRAP_TAGS.has(c.tag)) return `Formatting tag not allowed: ${String(c.tag)}`;
      const err = validateChildrenTree(c.children, depth + 1);
      if (err) return err;
    } else if (c.t === 'keep') {
      if (!/^[0-9a-f]{10}$/.test(c.id || '')) return 'Bad keep id.';
      if (c.children) {
        const err = validateChildrenTree(c.children, depth + 1);
        if (err) return err;
      }
    } else {
      return 'Unknown node type.';
    }
  }
  return null;
}

function refuseError(msg) {
  const e = new Error(msg);
  e.refusal = msg;
  return e;
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
  } else if (op.type === 'setChildren') {
    // Rich in-place editing (DR-0014). The tree is constrained: escaped
    // text, kept stamped descendants written as verbatim source slices,
    // and the fixed WRAP_TAGS vocabulary. No attributes, no expressions.
    const treeErr = validateChildrenTree(op.children, 0);
    if (treeErr) return refuse(treeErr);
    if (!childrenAreMappable(node)) {
      return refuse(
        `The children of this element include expressions (${resolved.relPath}); they cannot be edited deterministically.`
      );
    }
    const descendants = new Map();
    for (const el of resolved.elements) {
      if (el.node.start > node.openingElement.end && el.node.end < node.closingElement.start) {
        descendants.set(el.id, el.node);
      }
    }
    const source = resolved.source;
    const build = (children) =>
      children
        .map((c) => {
          if (c.t === 'text') return escapeJsxText(c.value);
          if (c.t === 'wrap') return `<${c.tag}>${build(c.children)}</${c.tag}>`;
          const kept = descendants.get(c.id);
          if (!kept) {
            throw refuseError('A kept element is not a descendant of the target in source; the edit cannot be mapped.');
          }
          if (!c.children) return source.slice(kept.start, kept.end);
          if (!childrenAreMappable(kept)) {
            throw refuseError('A styled child whose text was edited contains expressions; it cannot be edited deterministically.');
          }
          return (
            source.slice(kept.start, kept.openingElement.end) +
            build(c.children) +
            source.slice(kept.closingElement.start, kept.end)
          );
        })
        .join('');
    let builtStr;
    try {
      builtStr = build(op.children);
    } catch (e) {
      if (e.refusal) return refuse(e.refusal);
      throw e;
    }
    if (builtStr.trim() === '') return refuse('The edit removed all content; delete the element instead.');
    if (builtStr.length > 50000) return refuse('The edit is too large.');
    ms.overwrite(node.openingElement.end, node.closingElement.start, builtStr);
  } else if (op.type === 'setTag') {
    // Typography: change a text element's tag (h1..h4, p, span). Deterministic
    // tag rewrite of the opening and closing names. Host (lowercase) text tags
    // only — never a component or a self-closing element.
    const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'blockquote', 'label']);
    if (typeof op.tag !== 'string' || !TEXT_TAGS.has(op.tag)) {
      return refuse('Unsupported target tag.');
    }
    const open = node.openingElement.name;
    if (open.type !== 'JSXIdentifier' || !/^[a-z]/.test(open.name)) {
      return refuse('Only plain HTML text elements can change tag; this is a component.');
    }
    if (!node.closingElement) {
      return refuse('This element has no closing tag and cannot change tag.');
    }
    ms.overwrite(open.start, open.end, op.tag);
    const close = node.closingElement.name;
    ms.overwrite(close.start, close.end, op.tag);
  } else if (op.type === 'setSrc') {
    if (findAttr(node, 'srcSet') || resolved.elements?.some(e => tagOf(e.node) === 'picture' && e.node.start < node.start && e.node.end > node.end)) return refuse('This image has authored responsive sources; editing them is deferred.');
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
    const priorImage = imageSource(attr, resolved.source);
    if (!priorImage) {
      return refuse(
        `src here is not a literal or a static image import; it cannot be swapped deterministically (${resolved.relPath}).`
      );
    }
    if (priorImage.imported && /Image$/.test(tag) && !findAttr(node, 'fill')) {
      for (const dimension of ['width', 'height']) if (!findAttr(node, dimension)) {
        const value = op.dimensions?.[dimension];
        if (!Number.isFinite(value) || value <= 0 || value > 100000) return refuse('This imported image needs its rendered width and height to preserve its layout.');
        ms.appendLeft(node.openingElement.name.end, ` ${dimension}={${Math.round(value)}}`);
      }
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
