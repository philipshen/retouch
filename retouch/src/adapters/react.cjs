'use strict';
// The React/JSX language adapter (RFC-0001 DR-0015). For now it wraps the
// existing id/stamp/writer modules, which hold the Babel-based implementation;
// the adapter is the seam the core depends on. A future move relocates those
// bodies into this directory, changing nothing outside it.

const path = require('node:path');
const structure = require('../structure.cjs');
const { collectElements, contentHash } = require('../id.cjs');
const { stamp } = require('../stamp.cjs');
const { applyOp, planOp, describeElement } = require('../writer.cjs');

function matches(filePath) {
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return false;
  return /\.(tsx|jsx)$/.test(filePath);
}

module.exports = {
  name: 'react',
  matches,
  stamp,
  collect: collectElements,
  contentHash,
  describe: resolved => ({...describeElement(resolved),context:resolved.context || null,structure:structure.describe(resolved,'react')}),
  applyOp: (resolved,op) => structure.types.has(op.type) ? require('../transactions.cjs').applyPlan(resolved.appRoot || path.dirname(resolved.file),structure.planOp(resolved,op,'react')) : applyOp(resolved,op),
  planOp: (resolved, op) => structure.types.has(op.type) ? structure.planOp(resolved,op,'react') : op.type === 'detachComponent' ? require('../components.cjs').planDetach(resolved, op) : planOp(resolved, op),
  describeComponent: resolved => require('../components.cjs').describe(resolved),
  hasReference: (root, file, excluded) => require('../components.cjs').hasReference(root, file, excluded),
  assets: { directory: 'public', urlPrefix: '/', uploadDirectory: 'rt-assets' },
  capabilities: {
    classAttr: 'className',
    ops: ['setSVGGeometry', 'setClasses', 'setText', 'setChildren', 'setTag', 'setSrc', ...structure.types],
  },
};
