'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const parse5 = require('parse5');
const MARKER = '__rt_mirror';
function isMirrorRequest(req) {
  const base = `http://${req.headers.host}`;
  const url = new URL(req.url, base);
  if (url.searchParams.get(MARKER) === '1') return true;
  try {
    const referer = new URL(req.headers.referer);
    return referer.origin === new URL(base).origin && (referer.searchParams.get(MARKER) === '1' || referer.pathname === '/rt' || referer.pathname.startsWith('/rt/'));
  } catch { return false; }
}
function stripReloadClient(html) {
  const tree = parse5.parse(html, { sourceCodeLocationInfo: true }), ranges = [];
  function visit(node) {
    if (node.tagName === 'script' && node.attrs?.some(a => a.name === 'id' && a.value === 'hot-reload-client') && node.sourceCodeLocation) ranges.push(node.sourceCodeLocation);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(tree);
  for (const range of ranges.sort((a,b) => b.startOffset-a.startOffset)) html = html.slice(0,range.startOffset)+html.slice(range.endOffset);
  return html;
}
const SKIP = new Set(['.git', '.shopify', 'node_modules', '.next']);
function relevant(relative) { return !relative.split(path.sep).some(part => SKIP.has(part)) && /\.(liquid|json|css|scss|sass|js|mjs|cjs|ts|tsx|jsx|svg)$/i.test(relative); }
const hash = value => value === null ? null : crypto.createHash('sha256').update(value).digest('hex');
function watchSource(root) {
  root = path.resolve(root);
  const known = new Map(); let revision = 0, watcher = null;
  const read = file => { try { return fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink() ? fs.readFileSync(file) : null; } catch { return null; } };
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (relevant(path.relative(root,file))) known.set(file,hash(read(file)));
    }
  }
  scan(root);
  function check(relative) {
    if (!relative || !relevant(relative)) return;
    const file = path.resolve(root, relative);
    if (!file.startsWith(root+path.sep)) return;
    const value = hash(read(file));
    if ((known.get(file) ?? null) !== value) { known.set(file,value); revision++; }
  }
  try { watcher = fs.watch(root, { recursive: true }, (_event, relative) => check(relative && String(relative))); } catch {}
  return {
    state: () => ({ revision, available: !!watcher }),
    // Transaction writes are synchronous; acknowledgement precedes fs events.
    // A simultaneous different external write still differs from this hash.
    acknowledge(edits) { for (const edit of edits) if (relevant(path.relative(root,edit.file))) known.set(path.resolve(edit.file),hash(edit.after)); },
    check,
    close() { watcher?.close(); },
  };
}
module.exports = { MARKER, isMirrorRequest, stripReloadClient, watchSource };
