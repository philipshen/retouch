# DR-0003: Structural element IDs; no transported manifest

- Status: Accepted (RFC rev 6)
- Date: 2026-09-01
- RFC: R-10, OQ-C1, OQ-C2, OQ-C3, OQ-D1, §5.3

## Context

Two questions collapsed into one. (a) Where does the element ID live and what invalidates it (OQ-C1)? (b) Who computes the ID-to-source map, and can it be trusted? The plugin runs inside the dev-server process, which executes project code (config, plugins, SSR), so a manifest emitted by the plugin is a forgeable input: a forged entry could point an ID at `.env` or `package.json`.

## Options considered

1. **Persistent IDs written into the user's JSX** (Onlook's `data-oid`). Stable across sessions, edits, and refactors. Costs: pollutes the repository, appears in every diff, and the library modifies files the user did not edit.
2. **Ephemeral IDs in compiled output only, manifest of `id → file:line:col` sent from the build** (Lovable, code-inspector). Clean repo. Costs: every write-back shifts line/column numbers and invalidates every ID in the file; the manifest is transported from an untrusted process.
3. **Ephemeral IDs with a byte-offset manifest** enabling `magic-string` splices at exact ranges. Strictest write path; same invalidation and trust problems as (2); unshipped anywhere.
4. **Structural IDs: `hash(relative file path, AST path)`.** A pure function of source. The stamper computes it at transform time; the writer computes the same value by parsing files from disk and never accepts mapping data from anyone.

## How byte-offset editing works (recorded because it was asked)

The manifest stores the character range of the whole attribute value, e.g. the `className` string occupies `[1256, 1274)`. The writer computes the new string in memory (tailwind-merge semantics), then replaces that one range; `magic-string` splices text, so length changes are fine and several non-overlapping ranges can be applied in one pass. Example: `"mr-4 bg-blue pl-8"` → `"bg-blue pl-4"` is a single `overwrite(1256, 1274, "bg-blue pl-4")`. The catch: every offset after the edit is now wrong, so all other ranges in that file are stale until re-derived; the protocol must fail closed on a content-hash mismatch. The hard case is a non-literal value (`className={cn("mr-4", active && "bg-blue")}`): no single range exists; append into `cn()` or refuse. Under option 4 the writer parses the file at write time and so always has fresh spans; the offset manifest is unnecessary.

## Decision

Option 4 (R-10). The writer builds its index from disk; the plugin only stamps.

## Consequences

- Security: a forged stamp can only name a real JSX element in a real source file; unresolvable IDs are refused. The transported manifest and its IPC path disappear from Figure 1.
- Stability: attribute and text edits do not change the AST path, so the ID survives its own write. Inserting, removing, or reordering JSX nodes changes the IDs of later siblings; the writer returns the old-to-new mapping for its own ops so the shell keeps its selection.
- Mapped lists: one callsite gives one ID carried by every instance, so co-highlighting (OQ-E3) is free.
- Costs accepted: an initial full-project parse (order of one second for hundreds of files; incremental afterwards) and ~10-character hashed attributes in the DOM. Components from `node_modules` have no source in the project, get no stamp, and are not editable (consistent with OQ-D4).
- OQ-C1's former decisive measurement (Budget B) no longer gates identity; it only bounds the commit rate to one file (OQ-C3). OQ-D1: recast and magic-string are both viable with fresh spans; P1 decides.
