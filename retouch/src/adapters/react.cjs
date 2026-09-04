'use strict';
// The React/JSX language adapter (RFC-0001 DR-0015). For now it wraps the
// existing id/stamp/writer modules, which hold the Babel-based implementation;
// the adapter is the seam the core depends on. A future move relocates those
// bodies into this directory, changing nothing outside it.

const path = require('node:path');
const { collectElements, contentHash } = require('../id.cjs');
const { stamp } = require('../stamp.cjs');
const { applyOp, describeElement } = require('../writer.cjs');

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
  describe: describeElement,
  applyOp,
  capabilities: {
    classAttr: 'className',
    ops: ['setClasses', 'setText', 'setChildren', 'setTag', 'setSrc'],
  },
};
