'use strict';
// Structural element IDs (RFC-0001 R-10): a pure function of
// (relative file path, AST path). The stamper and the writer both call
// `collectElements` on the same source and therefore agree on every ID
// without any transported mapping.

const crypto = require('node:crypto');
const parser = require('@babel/parser');
const traverseMod = require('@babel/traverse');
const traverse = traverseMod.default || traverseMod;

const PARSER_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  errorRecovery: false,
  plugins: ['typescript', 'jsx', 'decorators-legacy'],
};

function parseSource(source) {
  return parser.parse(source, PARSER_OPTS);
}

function hashId(relPath, astPathLocation) {
  return crypto
    .createHash('sha1')
    .update(relPath + '|' + astPathLocation)
    .digest('hex')
    .slice(0, 10);
}

function jsxElementName(node) {
  const n = node.openingElement.name;
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression') {
    const parts = [];
    let cur = n;
    while (cur.type === 'JSXMemberExpression') {
      parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'JSXIdentifier') parts.unshift(cur.name);
    return parts.join('.');
  }
  return null;
}

// A "host" element (<div>) carries data-rt; a component usage (<Button>)
// carries data-rt-i (the instance ID). Fragments are never stamped.
function classifyElement(node) {
  const name = jsxElementName(node);
  if (!name) return null;
  const first = name[0];
  if (first === first.toLowerCase() && !name.includes('.')) return 'host';
  return 'instance';
}

// Returns [{ id, kind, node, pathLocation }] for every stampable JSX element,
// in source order. `relPath` must be POSIX-style relative to the app root.
function collectElements(source, relPath) {
  const ast = parseSource(source);
  const out = [], fragments = new Set();
  traverse(ast, {
    JSXElement(path) {
      if(require('./react-fragment.cjs')(path)){fragments.add(path.node.start);return;}
      const kind = classifyElement(path.node);
      if (!kind) return;
      const loc = path.getPathLocation();
      out.push({
        id: hashId(relPath, loc),
        kind,
        node: path.node,
        pathLocation: loc,
      });
    },
  });
  return { ast, elements: out, fragments };
}

function contentHash(source) {
  return crypto.createHash('sha1').update(source).digest('hex');
}

module.exports = { parseSource, hashId, collectElements, contentHash, jsxElementName };
