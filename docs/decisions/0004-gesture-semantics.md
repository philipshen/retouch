# DR-0004: What a drag means in code; gesture tiers; snapping

- Status: Accepted (RFC rev 7)
- Date: 2026-09-01
- RFC: OQ-E1, OQ-E2, OQ-D3

## Context

A pointer drag is a screen-space delta; source code expresses layout as flow (flex, grid, spacing). Every surveyed competitor delegates this translation to a model. A deterministic system must define a total function from (gesture, target state) to (mutation | refusal). This is the product; everything else is plumbing.

## Options considered

**OQ-E1, drag semantics**
1. **Flow-respecting.** Gestures denote flow mutations only: drag within the same flex/grid parent = reorder; drag on a gap = `gap-*`; drag an edge = `w-*`/`h-*`; drag inside near an edge = `p*-*`; modifier-drag = `m*-*`; drop into another parent = refused.
2. **Freeform.** Any drag becomes absolute positioning or a transform. Feels exactly like Figma; produces the positioning-heavy code the target user is trying to escape; interacts badly with responsive layout; no deterministic system ships it.
3. **Hybrid.** Flow-respecting default plus an explicit per-element "detach" action enabling absolute positioning.

**OQ-E2, gesture set.** Candidate list: select, marquee, reorder, resize, padding/margin/gap, text edit, style panel, delete, duplicate; non-goals: insertion, reparenting, rotation, group ops, image replacement.

**OQ-D3, continuous values.** A resize yields 137 px. (1) Always exact (`w-[137px]`). (2) Snap to the project's Tailwind scale within a tolerance, arbitrary beyond it. (3) Always snap.

## Decision (the user's answers, verbatim in substance)

1. Flow-respecting is correct. No detach in v1; revisit only if usability refusals concentrate on gestures detach would satisfy.
2. Refusing reparenting is acceptable. Priorities: copy, color, and padding/margin adjustments are tier 1 (the MVP); wholesale moving of elements is lower priority. Hence tiers: tier 1 = click select, literal text edit, color/typography panel, padding/margin/gap; tier 2 = edge resize, reorder within parent, marquee, delete, duplicate, radius/shadow; tier 3 (refused in v1 with a reason) = reparenting, insertion, rotation, group ops, image replacement.
3. Snap to the Tailwind scale, always. Gestures never produce arbitrary values; the snap guides show only scale values so what the user sees is what is written. Tailwind v4 derives spacing from one `--spacing` multiplier (any integer step is valid); v3 uses configured steps; the plugin resolves the scale from the project's version and configuration.

## Consequences

- The gesture-to-mutation table in OQ-E1 is the normative seed of a design annex (P2), one row per gesture including every refusal case and its user-facing reason, each row with a test fixture.
- Because gestures produce only scale values, the set of producible classes is finite. This made the preview problem in DR-0005 solvable by a safelist.
- Insertion stays out of plan: it is the boundary between "adjust an existing page" and "page builder" and forces asset and component-catalog questions the rest of v1 does not.
