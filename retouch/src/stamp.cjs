'use strict';
// The stamper: compile-time transform that adds data-rt / data-rt-i
// attributes to JSX elements in the *compiled* output. Source files on
// disk are never modified (RFC-0001, "stamp").

const path = require('node:path');
const MagicString = require('magic-string');
const { collectElements } = require('./id.cjs');

const HOST_ATTR = 'data-rt';
const INSTANCE_ATTR = 'data-rt-i';

function toPosixRel(appRoot, filePath) {
  return path.relative(appRoot, filePath).split(path.sep).join('/');
}

// Returns { code, map } or null when there is nothing to stamp.
// Throws on parse errors; callers treat any throw as "serve unstamped"
// (fault isolation, OQ-B1 residual d).
function stamp(source, filePath, appRoot) {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null;
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return null;
  if (!source.includes('<')) return null;

  const relPath = toPosixRel(appRoot, filePath);
  const { elements } = collectElements(source, relPath);
  if (elements.length === 0) return null;

  const ms = new MagicString(source);
  for (const el of elements) {
    const attr = el.kind === 'host' ? HOST_ATTR : INSTANCE_ATTR;
    const insertAt = el.node.openingElement.name.end;
    ms.appendLeft(insertAt, ` ${attr}="${el.id}"`);
  }
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filePath }),
  };
}

module.exports = { stamp, HOST_ATTR, INSTANCE_ATTR };
