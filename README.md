# Editable Mirror

Working repository for the design of an open-source library: point it at a running web app, get a Figma-grade editable mirror at `/__mirror`, and have every edit written back to source code deterministically. No model in the write path.

Status: design phase. No code yet. The architecture is specified in RFC-0001.

## Layout

| Path | What it is |
|---|---|
| `docs/rfc-0001-editable-mirror.html` | **Canonical** RFC (carries the SVG figures). Open in a browser. |
| `docs/rfc-0001-editable-mirror.md` | Markdown mirror of the RFC, kept in sync; the HTML wins on conflict. |
| `docs/prior-art-survey.html` | The prior-art survey the RFC cites as "PAS". ~60 projects, 2026-09-01. |
| `docs/decisions/` | Decision records (DR-*n*): one per trade-off discussion, with every alternative considered and why it lost. The RFC's revision history is terse; the reasoning lives here. |
| `scripts/artifact-body.sh` | Emits the RFC body without the HTML wrapper, for publishing as a Claude artifact. |

## How the documents are maintained

- The RFC is normative and follows the editing rules in its own "Note to AI assistants" block: RFC 2119 key words, stable identifiers (R-*n*, OQ-*xn*, Figure *n*), a revision-history row for every substantive change, inline-SVG figures only.
- Every revision that resolves or changes a trade-off gets a decision record in `docs/decisions/`. The revision-history row names it.
- Editing order: change the HTML, mirror the change into the markdown, add or update the decision record, bump the revision.
- Publishing: `sh scripts/artifact-body.sh docs/rfc-0001-editable-mirror.html > <scratch>/editable-mirror-architecture.html`, then republish that file with the Artifact tool (same path keeps the same URL).

## Current state

See the RFC's revision history and `docs/decisions/README.md` for the index of decisions. Open questions are worked one at a time in conversation; the RFC records each resolution.
