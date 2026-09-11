'use strict';
// The language-adapter seam (RFC-0001 DR-0015). Everything framework-specific
// about "which source made this element" and "rewrite that source" lives
// behind this interface. The core (indexer, server, loader) depends only on
// the interface, never on a parser. Swapping the adapter (React, Vue, Liquid)
// changes nothing else.
//
// An adapter is a plain object with:
//
//   name: string
//   matches(filePath): boolean
//       Which source files this adapter parses and stamps.
//   stamp(source, filePath, appRoot): { code, map } | null
//       Build-time: inject stable element IDs into the COMPILED output. Never
//       modifies source on disk. Returns null when there is nothing to stamp.
//   collect(source, relPath): { elements: [{ id, kind, ... }] }
//       Parse source and return every editable element with its structural ID.
//       The element objects are opaque to the core; the adapter's own
//       describe/applyOp consume them.
//   contentHash(source): string
//       Stable hash of file content (used for the R-11 write precondition).
//   describe(resolved): descriptor
//       Given a resolved element bundle, return what the panel can edit
//       (className, text, src, tag, mixedText, capabilities…).
//   planOp(resolved, op): { ok, edits, ...result } | { refused: true, reason }
//       Resolve a typed op to source edits without writing. Each edit is
//       {file, before, after}; null means creation/deletion. The shared
//       transaction layer validates containment and versions, writes, rolls
//       back failures, and retains these exact snapshots for undo.
//   describeComponent(resolved): component descriptor (optional)
//   hasReference(appRoot, createdFile, excludedFiles): boolean (optional)
//       Language-specific reference detection before undo removes a module.
//   assets: {directory, urlPrefix, uploadDirectory} (optional)
//       Static asset mapping; the server handles listing and uploads.
//   applyOp(resolved, op)
//       Convenience wrapper for direct callers: plan, then shared transaction.
//   capabilities: { ops: string[], classAttr: string, ... }
//
// `resolved` (built by the core Index) is { file, relPath, source, hash,
// element, elements }. Only `element`/`elements` are adapter-specific; the
// rest are generic. `context` is an opaque renderer snapshot. Only adapters
// interpret its metadata. Descriptors may return renderScope attribute/value
// pairs for generic co-highlighting. Rendering integrations separately declare
// whether source writes need page reloads and local stylesheet revalidation.

const registry = new Map();

function register(adapter) {
  registry.set(adapter.name, adapter);
  return adapter;
}

function getAdapter(name) {
  const a = registry.get(name);
  if (!a) throw new Error(`[retouch] unknown adapter: ${name}`);
  return a;
}

// The built-in adapters are registered on require.
register(require('./adapters/react.cjs'));
register(require('./adapters/liquid.cjs'));

module.exports = { register, getAdapter, defaultAdapter: () => getAdapter('react') };
