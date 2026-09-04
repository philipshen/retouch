# DR-0015: The language-adapter abstraction

- Status: Accepted (RFC rev 19). Step 1 (React adapter behind the seam) and step 2 (Liquid adapter) done; the Shopify-CLI proxy integration follows.
- Date: 2026-09-04
- RFC: R-1, R-10, OQ-A1; enables non-React targets (Liquid, Vue, Svelte)

## Context

The user asked for two things: a path to support Liquid (Shopify themes), and a
clean abstraction so that "source-code build-time tooling" is swappable (React,
Vue, Liquid) without affecting anything else. This record establishes that
seam.

## Two axes, not one

Framework support is two swappable layers that cross:

- **Language adapter** — parse, stamp, resolve, and rewrite one source language.
- **Build integration** — inject the stamper and serve the mirror in one
  toolchain (Vite plugin, Next loader, Shopify CLI proxy).

React runs on Vite or Next; Liquid runs on the Shopify CLI. Keeping the two
axes separate is what makes each swappable on its own.

## The adapter interface

An adapter is a plain object (`src/adapter.cjs` documents it):

```
name
matches(filePath) -> boolean
stamp(source, filePath, appRoot) -> { code, map } | null
collect(source, relPath) -> { elements: [{ id, kind, ... }] }
contentHash(source) -> string
describe(resolved) -> descriptor
applyOp(resolved, op) -> { ok, hash } | { refused, reason }
capabilities: { ops, classAttr, ... }
```

The core (`indexer`, `server`, `loader`) depends only on this interface. The
`resolved` bundle it passes is generic (`file, relPath, source, hash, element,
elements`); only `element`/`elements` are adapter-shaped and are produced and
consumed by the same adapter, so the core treats them as opaque.

## What changed (step 1, this record)

- Added `src/adapter.cjs` (registry + interface doc) and `src/adapters/react.cjs`
  (the React adapter, wrapping the existing Babel-based id/stamp/writer modules;
  their bodies can move into the adapter later with no change outside it).
- `Index` takes an adapter and calls only `adapter.matches/collect/contentHash`.
  The hardcoded `.tsx/.jsx` filters are gone; file matching is the adapter's job.
- The sidecar takes an adapter and routes resolve/op through
  `adapter.describe/applyOp`.
- The loader and Next integration select the adapter by name.
- A contract test drives the `Index` with a fake `.lines` adapter, proving the
  core is language-blind.

No behavior changed for React; 62 unit tests pass.

## The Liquid adapter (next steps)

The same interface fits Liquid:

| Concern | Liquid answer |
|---|---|
| matches | `.liquid` files |
| stamp | inject `data-rt` into HTML open tags; skip `{% %}` / `{{ }}` regions |
| structural ID | `hash(path, HTML/Liquid tree path)` |
| classes | `class="…"` string edits; tailwind-merge transfers (moses uses Tailwind) |
| literal text | editable |
| `{{ dynamic }}` | refuse (R-6) |
| `{% for %}` loops | one source, N nodes — the mapped-list case; edit-all + co-highlight |
| `{% render 'snippet' %}` | like a component instance (later) |
| section settings | merchant data, not source; refuse in v1 (later map to settings_data.json) |

Status of the Liquid adapter (`src/adapters/liquid.cjs`): built and unit-tested.
It has its own tolerant HTML+Liquid tokenizer (no external parser). It stamps
HTML tags, resolves by structural ID, and supports `setClasses`, `setText`, and
`setTag`. It refuses dynamic classes (`class` containing `{% %}`/`{{ }}`) and
dynamic or mixed text (R-6). Text writes escape `{`/`}` to entities so an edit
can never inject Liquid. It parses and stamps real moses sections (smoke test).
Not yet: `setChildren` rich text, `setSrc`, and snippet-instance mapping.

The one real difference is the integration: Shopify renders `.liquid` remotely,
so the Liquid build integration is a proxy in front of `shopify theme dev`
(stamp local files → theme dev pushes/renders → proxy injects the shell and
serves `/rt` → writer edits the local `.liquid` file → theme dev hot-reloads),
not a bundler plugin.

## Consequences

- Adding a language is: write one adapter + one integration. Nothing else moves.
- The security and write-integrity rules (R-7, R-9, R-11) stay in the core, so
  every adapter inherits them.
