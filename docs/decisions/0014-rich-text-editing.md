# DR-0014: Rich in-place text editing

- Status: Accepted (RFC rev 18)
- Date: 2026-09-02
- RFC: R-5, R-6, OQ-E2, new op `setChildren`

## Context

Plain in-place editing (DR-0005 path) refused any element whose children mixed
text with other elements, because the `setText` op rewrites a literal-text-only
range. The user asked for three Figma-like behaviors on rich text: delete a
section of styled text seamlessly, edit around inline styling, and make a
selection bold or italic within existing text.

## Decision

A new op, `setChildren`, edits an element whose children are text and elements
(no expressions). Its value is a constrained tree, and only that tree:

- `text`: an escaped JSX text run.
- `keep`: a stamped descendant kept by ID. Written as the verbatim source slice
  of that element when its text is unchanged; when its text changed, its opening
  and closing tags are kept verbatim and its own children recurse. This keeps a
  styled child's class and structure exactly while letting its text be edited.
- `wrap`: one of a fixed formatting vocabulary — `strong`, `em`, `u`, `s`. This
  is the only structure the tool may add. No attributes, no other tags.

Anything else refuses (R-6): expressions in the children, a `keep` id that is
not a descendant in source, a formatting tag outside the vocabulary. The result
must parse before it is written (R-11 b).

Determinism holds because every branch is total: text maps to escaped text,
kept elements map to their own source, formatting maps to a fixed tag set, and
every ambiguous case refuses.

### Shell side

- One click on rich text enters editing (matching DR-0005's single-click).
- A selection shows a floating B/I toolbar; `Cmd+B`/`Cmd+I` and the toolbar
  toggle `strong`/`em`. The browser's own rich-edit commands are suppressed.
- On commit, the edited DOM is serialized (`serializeChildren`, extracted to a
  browser+Node module and unit-tested) into the op tree. Unknown wrappers from
  a paste flatten to their text.
- An element whose SOURCE is mixed always commits via `setChildren`, even when
  the edited result is now plain text (e.g. a styled span was deleted), because
  `setText` would refuse the still-mixed source.

## The React reconciliation problem (and fix)

Editing the live React-rendered DOM in place, then letting the write's HMR
reconcile against the hand-mutated DOM, crashes React's committer
(`removeChild` NotFoundError): React tracks child nodes by reference and a
structural mutation invalidates its fiber tree. Restoring the original
`innerHTML` before the write does not help — it swaps node identities too.

Fix: a structural commit (`setChildren`) reloads the iframe after the write, so
React remounts clean from the new source. Text-only and class edits keep the
smooth optimistic + HMR path. The reload preserves scroll position.

## Consequences

- OQ-E2 tier 1 gains: seamless deletion of styled runs, editing around inline
  styling, and bold/italic on a selection.
- Not included (tier 3): adding arbitrary tags, links, or attributes from within
  a text edit; those are markup authoring, not text editing.
- Testing: `serializeChildren` and every `setChildren` branch are covered by the
  fast unit suite; the browser round-trip (including the reconciliation reload)
  is covered by the opt-in e2e suite.
