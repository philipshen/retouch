'use strict';
// The writer's index (RFC-0001 R-10): id -> file, built by parsing the
// project's own source from disk. Never accepts mapping data from the
// plugin or the browser. Watches for changes and re-parses per file.

const fs = require('node:fs');
const path = require('node:path');
const { collectElements, contentHash } = require('./id.cjs');

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out', 'public', 'coverage', '.turbo', '.vercel']);

class Index {
  constructor(appRoot) {
    this.appRoot = appRoot;
    this.idToFile = new Map(); // id -> absolute file path
    this.fileIds = new Map(); // absolute file path -> Set(id)
    this.errors = new Map(); // file -> message
  }

  scanAll() {
    const files = [];
    walk(this.appRoot, files);
    for (const f of files) this.indexFile(f);
    return files.length;
  }

  indexFile(absFile) {
    const old = this.fileIds.get(absFile);
    if (old) for (const id of old) this.idToFile.delete(id);
    this.fileIds.delete(absFile);
    this.errors.delete(absFile);

    let source;
    try {
      source = fs.readFileSync(absFile, 'utf8');
    } catch {
      return; // deleted
    }
    const relPath = path.relative(this.appRoot, absFile).split(path.sep).join('/');
    try {
      const { elements } = collectElements(source, relPath);
      const ids = new Set();
      for (const el of elements) {
        this.idToFile.set(el.id, absFile);
        ids.add(el.id);
      }
      this.fileIds.set(absFile, ids);
    } catch (err) {
      this.errors.set(absFile, err.message);
    }
  }

  fileFor(id) {
    return this.idToFile.get(id) || null;
  }

  // Fresh parse of the file that owns `id`; returns { file, relPath, source,
  // hash, element } or null. Self-healing: elements are found by recomputing
  // IDs, so the index only needs id -> file.
  resolve(id) {
    const absFile = this.fileFor(id);
    if (!absFile) return null;
    const source = fs.readFileSync(absFile, 'utf8');
    const relPath = path.relative(this.appRoot, absFile).split(path.sep).join('/');
    const { elements } = collectElements(source, relPath);
    const element = elements.find((e) => e.id === id);
    if (!element) return null;
    return { file: absFile, relPath, source, hash: contentHash(source), element, elements };
  }

  watch() {
    const pending = new Map();
    try {
      this.watcher = fs.watch(this.appRoot, { recursive: true }, (_evt, rel) => {
        if (!rel || !/\.(tsx|jsx)$/.test(rel)) return;
        const parts = rel.split(path.sep);
        if (parts.some((p) => SKIP_DIRS.has(p))) return;
        const abs = path.join(this.appRoot, rel);
        clearTimeout(pending.get(abs));
        pending.set(
          abs,
          setTimeout(() => {
            pending.delete(abs);
            this.indexFile(abs);
          }, 100)
        );
      });
    } catch (err) {
      console.warn(`[retouch] file watching unavailable: ${err.message}`);
    }
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (/\.(tsx|jsx)$/.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
}

module.exports = { Index };
