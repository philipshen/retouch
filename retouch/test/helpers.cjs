'use strict';
// Shared helpers for the unit suite. Fixtures are written to a per-test
// temp dir so the writer's real atomic file writes can be exercised without
// touching anything checked in.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const id = require(path.join(SRC, 'id.cjs'));
const stampMod = require(path.join(SRC, 'stamp.cjs'));
const { Index } = require(path.join(SRC, 'indexer.cjs'));
const writer = require(path.join(SRC, 'writer.cjs'));

// Make a temp app root containing the given files ({ 'a/b.tsx': source }).
function makeApp(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-test-'));
  for (const [rel, src] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, src);
  }
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// Resolve one element by tag name in a file, returning what the writer sees.
function pick(index, root, rel, tagName, nth = 0) {
  const abs = path.join(root, rel);
  index.indexFile(abs);
  const src = fs.readFileSync(abs, 'utf8');
  const { elements } = id.collectElements(src, rel);
  const matches = elements.filter((e) => elementTag(e) === tagName);
  const el = matches[nth];
  if (!el) throw new Error(`no <${tagName}>#${nth} in ${rel}`);
  return { el, resolved: index.resolve(el.id), src };
}

function elementTag(e) {
  const n = e.node.openingElement.name;
  return n.type === 'JSXIdentifier' ? n.name : null;
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

module.exports = { id, stampMod, Index, writer, makeApp, cleanup, pick, read, elementTag, SRC };
