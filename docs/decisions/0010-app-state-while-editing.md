# DR-0010: Reaching and holding application state while editing

- Status: **Provisional, to be validated hands-on** (RFC rev 14). Not accepted. Expected to be amended after P1.
- Date: 2026-09-01
- RFC: OQ-E4, OQ-B2 sub-question, P1

## Context

Some elements exist only while the application holds a state: an open dropdown, a modal, a tooltip, a hover style. The user opens the dropdown in interact mode and switches to edit mode; the first pointer movement may close it through a `pointerleave`, a `blur`, or a click-outside handler. Separately, a hot-module update can land during a drag and move or replace the dragged element.

## Why this record is provisional

The user's instruction, verbatim in substance: "I'll have to feel it out. Go with whatever you think is best, but document this decision point as something that needs to be felt out." The behaviors below are therefore defaults chosen for the prototype, not decisions. P1 includes a hands-on pass; its findings amend OQ-E4 and this record. The RFC marks OQ-E4 as non-normative until then.

## Options considered

**Transient state**
1. Pin nothing. Edit mode blocks pointer events into the app, but the app's own focus logic and timers run. States that dismiss on blur are unreachable. Simplest.
2. Suppress dismissal events. The agent stops `pointerleave`, `pointerout`, `blur`, `focusout`, and document-level `click`/`pointerdown` from reaching the app while in edit mode. Most dismiss-on-outside logic uses these, so the state holds. Small, dev-only capture patch. Risk: apps with unusual dismissal logic still close; and a state that cannot be closed until the mode toggles may feel stuck.
3. Full event freeze. Breaks the app's own timers and animations. Rejected.

**Hover styles**
- Hover is not application state; option 2 cannot hold it. Page scripts cannot force `:hover`; only the DevTools protocol can. The Tailwind-specific candidate is to compile `hover:` variants to a class the agent can toggle, for preview only. Deferred from v1.

**HMR during a drag**
1. Abort the gesture.
2. Re-anchor by structural ID and continue; abort only if the ID is gone. Under continuous commits a mid-drag HMR is normally the library's own previous write, and structural IDs survive it (R-10).

## Defaults chosen for P1

Transient state: option 2. Hover: deferred. HMR mid-drag: re-anchor. Plus the settled parts: two modes that never remount the frame, and a route field in the shell for navigating without clicking through the app.

## What to observe in P1

- Does suppressed dismissal make edit mode feel stuck? (A dropdown that will not close until the mode toggles.)
- Do apps with unusual dismissal logic still close their transient UI?
- Does re-anchoring produce visible jumps during a drag?
- How often is hover-only styling the thing the user wanted to edit?

## Amendments

None yet. Record P1 findings here with dates, and update OQ-E4's status when a rule is accepted or replaced.
