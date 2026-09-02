# Retouch

Working repository for the design of an open-source library: point it at a running web app, get a Figma-grade editable mirror at `/rt/`, and have every edit written back to source code deterministically. No model in the write path.

Status: v0.1 built and working against the dogfood target (2026-09-02). The architecture is specified in RFC-0001, "The Editable Mirror". The product name is Retouch (route prefix `/rt/`, configurable).

## Layout

| Path | What it is |
|---|---|
| `docs/rfc-0001-editable-mirror.html` | **Canonical** RFC (carries the SVG figures). Open in a browser. |
| `docs/rfc-0001-editable-mirror.md` | Markdown mirror of the RFC, kept in sync; the HTML wins on conflict. |
| `docs/prior-art-survey.html` | The prior-art survey the RFC cites as "PAS". ~60 projects, 2026-09-01. |
| `docs/decisions/` | Decision records (DR-*n*): one per trade-off discussion, with every alternative considered and why it lost. The RFC's revision history is terse; the reasoning lives here. |
| `scripts/artifact-body.sh` | Emits the RFC body without the HTML wrapper, for publishing as a Claude artifact. |

## How the documents are maintained

- The RFC is normative and follows the editing rules in its own "Note to AI assistants" block: RFC 2119 key words, stable identifiers (R-*n*, OQ-*xn*, Figure *n*), a revision-history row for every substantive change, inline-SVG figures only, and a decision record for every trade-off.
- Editing order: change the HTML, mirror the change into the markdown, add or update the decision record, bump the revision.
- Publishing: `sh scripts/artifact-body.sh docs/rfc-0001-editable-mirror.html > <scratch>/editable-mirror-architecture.html`, then republish that file with the Artifact tool (same path keeps the same URL).

## Source and dogfood layout

| Path | What it is |
|---|---|
| `retouch/` | The library (v0.1, config mode for Next.js). `src/` = stamper, loader, indexer, writer, sidecar, `withRetouch`; `shell/` = the editor UI (vanilla JS, no build step). |
| `unplastic-backbone/` | A local clone of the dogfood target (git-ignored; never committed here). |

### Running the dogfood

```sh
cd unplastic-backbone/apps/website        # retouch is installed and wired in next.config.ts
PORT=3400 npm run dev
open http://localhost:3400/rt             # the editable mirror of http://localhost:3400/
```

The clone's only durable changes are `next.config.ts` (one wrapped export) and the `retouch` dependency (a symlink, so library edits apply on the next dev-server restart). Edits made in the mirror land in the clone's working tree; inspect them with `git -C unplastic-backbone diff`.

## Current state

See the RFC's revision history and `docs/decisions/README.md` for the index of decisions. v0.1 implements: Turbopack/webpack stamping (structural IDs, R-10), the same-origin mirror at `/rt` via a sidecar and one rewrite, select + co-highlight, class chips and spacing steppers, literal text editing, continuous one-line-diff commits with undo, and the R-9 controls (token, custom header, Host check, op grammar). Not yet implemented: the component model's lift/detach/edit-main actions, drag gestures, the Tailwind safelist preview, launch mode (`npx retouch`), and the Vite plugin.
