# DR-0019: Drag an edge to edit max width

- Status: Accepted (rev 23)
- Date: 2026-09-06
- RFC references: OQ-E1, OQ-D3, R-6

## Decision

The user requested max-width dragging, Tailwind snapping, and an explicit
property label. Add a right-edge handle to selections with editable literal
classes. Its popup names Max width and displays the snapped CSS pixel value
and exact utility, including any detected active variant prefix.

Use named Tailwind container sizes, resolved through the preview's compiled
utilities and theme variables, including custom container sizes. The standard
named scale supplies defaults for utilities not yet compiled. Preserve width,
min-width, spacing, and max-width classes in other variant scopes.

Preview max-width locally during the gesture. Release emits one setClasses
operation through the existing validated writer and undo path. Keep the preview
until the utility is compiled, re-anchor after markup replacement, and refresh
same-origin stylesheet links when CSS hot reload lags. Escape and
pointer cancellation restore the prior inline style without a source write.
Dynamic class expressions keep the existing refusal; the inspector explains it.

## Alternatives

1. Change width. Does not match the requested property or preserve flexible sizing.
2. Write arbitrary pixel widths. Does not satisfy the requested Tailwind snapping.
3. Snap max width to named tokens and show the exact mutation. Selected.

## Evidence and limits

The browser regression covers a real Moses container, pointer movement, the
popup, CSS regeneration, one source operation, exact undo, and cancellation.
The scale follows [Tailwind max-width documentation](https://tailwindcss.com/docs/max-width).
Configuration that removes default tokens without exposing replacement CSS
is not discoverable from the preview. Arbitrary values are not generated.
