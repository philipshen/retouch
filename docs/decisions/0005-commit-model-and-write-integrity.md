# DR-0005: Continuous commits; preview without writes; write integrity

- Status: Accepted (RFC rev 8)
- Date: 2026-09-01
- RFC: OQ-F1, OQ-C3, R-11, P1 exit criteria

## Context

Two linked questions. (a) When do edits reach disk? (b) How does the mirror render a change before it is on disk, given that Tailwind generates CSS only for classes it finds in source files? If a drag produces `p-6` and no file uses `p-6` yet, the optimistic class change renders nothing until save + HMR, which breaks the one-frame budget.

The user added a hard requirement during the discussion: there must be no possible way to leave the codebase in a bad state.

## Options considered

**Preview rendering**
1. **Inline-style preview.** During the gesture the agent sets the value as an inline style on the mirror DOM node; after HMR confirms the committed class, it removes the style; on write failure the shell reverts. Cheap; always works; never touches source.
2. **Safelist.** Because gestures produce only scale values (DR-0004), the producible class set is finite; the plugin registers it with Tailwind in development (`@source inline(...)` in v4, `safelist` in v3), so every producible class has CSS before it appears in any file. Deterministic; a few thousand dev-only rules.
3. **Client-side Tailwind compiler** (Lovable's method). Heavy; unnecessary if (2) holds.
4. **Virtual modules** serving unsaved ops through the module graph (an idea from revs 3–6). Withdrawn: it required the writer to feed the bundler and had an unverified interaction with Tailwind's scanner; (1)+(2) cover the need.

**Commit model**
1. **Continuous.** Coalesced ops commit on a debounce (~150 ms after the last gesture); undo is an inverse op; mirror and disk stay convergent. Cost: many small writes; the editor and git see every step.
2. **Session buffer.** Ops accumulate; explicit Save writes once; one clean diff; trivial undo. Cost: mirror diverges from disk; conflict window grows with the session; HMR confirmation is deferred.
3. (2) plus version-control integration (a save is a commit, or the session runs on a branch).

## Decision

- Preview: (1) and (2) together. Inline style covers colors and typography as well, where the set is finite but larger.
- Commit model: continuous, "100%" in the user's words. A session-diff view shows the aggregate change since the session started. Options 2–3 withdrawn: the mirror MUST NOT diverge from disk.
- Reconciliation becomes trivial: after HMR the agent checks that the element's class list contains the written token (or its text equals the written text); if so it removes the inline preview; if not it reports a mapping defect and reverts. No visual comparison.

## Write integrity (R-11), answering "no possible way to leave the codebase in a bad state"

Confirmed first: the inline-style preview never touches source; it exists only in browser memory; the only thing that reaches disk is the typed op applied through the AST. Then the invariants:

1. Preview never writes.
2. Parse and format before write; if either fails, nothing is written.
3. Atomic writes: temp file in the same directory, then rename; a crash leaves the old file or the new file, never a partial one.
4. One op, one file; no multi-file ops in v1, so no partial cross-file states.
5. Every op carries the content hash of the file it was computed against; mismatch rejects the write, so external edits are never clobbered.
6. The library never runs version-control commands; the user's diff is the audit trail.
7. Every op is invertible; undo restores byte-identical content.

Consequence: at every instant a source file is either its previous content or a parsed, formatted, single-op successor.

## Consequences

- P1 exit criteria gained: kill during write leaves the file byte-identical to old or new; an op whose result fails to parse writes nothing; a stale-hash op is rejected; Budget A holds with preview and safelist in place.
- OQ-F2 (remote, non-developer editing) may later need branch isolation; that would be a writer backend, not a change to this decision.
