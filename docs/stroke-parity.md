# Stroke parity audit

Audit checkpoint: `c94ea17a`, 2026-09-20. This is one part of the full Figma
Design objective; it neither replaces nor narrows that objective.

The current [Figma stroke reference](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties)
includes multiple stroke fills, inside/center/outside positioning, weight,
variable width profiles, individual sides, endpoint styles, basic/custom dashes,
brush/dynamic strokes and joins. Its custom dash UI uses a text pattern.
SVG export preserves inside/outside appearance through more complex geometry.

| Requirement | Current repository evidence | Remaining work |
| --- | --- | --- |
| Stroke paints | `retouch/shell/svg-paint.js` and the inspector expose single SVG paint and scoped stroke properties. | Multiple independently editable stroke fills and their order/visibility. |
| Alignment | A retained-path rendering foundation now exists in `retouch/shell/svg-stroke-alignment.js`; no source operation or inspector position control is connected yet. | Inside/center/outside rendering while retaining editable originals. |
| Caps, joins, dashes | `svg-paint.js` parses regular/custom patterns; `inspector-ui.js` provides style, dash/gap, custom text, caps and joins. `test/e2e/svg-stroke-settings.cjs` covers source/history and scopes. | Per-point/vector-network equivalence, endpoint placement and full geometry fidelity still need proof. |
| Width profiles | No profile model or authoring control found. | Profiles, direct width handles, serialization and rendering/export fidelity. |
| Brush/dynamic strokes | No corresponding model or control found. | Brush source/assets, dynamic parameters, editable geometry and export. |

The source inventory is evidence of implementation boundaries, not a substitute
for rendered feature tests. Similar-looking CSS borders or shadows do not by
themselves prove vector stroke alignment or multiple stroke-fill parity.

## Next implementation acceptance criteria

The next slice is stroke alignment, with its full remaining scope preserved:

- Keep original paths/primitives and existing paint available for later editing;
  do not replace editable geometry with a screenshot.
- Preserve center behavior; inside/outside must match the selected boundary on
  rectangles, rounded corners, ellipses and curved/compound paths.
- Account for transforms, viewBox scaling, fill rules, joins and caps. Unsupported
  cases must be visible and atomic until their implementation is complete.
- Integrate source revisions, layer selection, exact undo/redo, responsive scopes
  and linked previews through existing adapter protocols.
- Verify pixel boundaries and hit geometry at multiple scales, plus edits after
  conversion and undo. Test HTML/React/Liquid source serialization separately
  from browser rendering; do not generalize one adapter's result to all sites.
- Verify exports and the packaged editor after integration. Public trusted macOS
  delivery remains a separate unfinished requirement.

## Fresh adjacent evidence

Forty-six focused SVG paint/crop/mask source tests passed on the checkpoint.
Chromium and WebKit each passed 36 HTML mask pixel checks and the 200% zoom,
90-degree image crop workflow. Exact commands and log paths are recorded in
[the main ledger](design-studio-parity.md#appearance-and-stroke-requirements-audit).
These checks establish that the old blanket mask/crop gaps were stale; they do
not establish the missing stroke features above.


## Alignment rendering foundation

`svg-stroke-alignment.js` renders separate fill/stroke passes from an unchanged
editable path document. Inside clips a doubled stroke to the filled region;
outside uses a luminance mask to remove the interior. Center keeps its original
width. Definitions use caller-provided validated identities, local-space bounds
including curved extrema and miter allowance, and the original affine transform.
The model supports literal colors, caps/joins, dash settings and opacity values.

This is not yet a user-facing alignment feature. Source adapters, canonical
retained-original structure, mutation guards, inspector controls, responsive
scope handling, history, clipboard/duplication and export integration remain.
Unresolved paint references, percentage dashes, non-scaling-stroke semantics and
arbitrary authored CSS need explicit handling. Dashed/cap geometry serialization
is tested; Figma-equivalent dash endpoints are not established. Crossing,
touching, collapsed and redundant nonzero contours refuse rather than claim an
incorrect inside/outside result. General topology remains part of the objective.

Fresh tests: 2,437 unit tests passed; each of Chromium/WebKit passed 684 pixel
assertions for rectangles, circles/arcs, rounded curves, evenodd/nonzero holes,
nonuniform/rotated transforms and two viewBox scales. Pixel checks use literal
opaque colors in a standalone SVG; they do not establish behavior in arbitrary
authored stylesheets. See the main ledger for log paths.

## Retained source transaction foundation — 2026-09-20

`retouch/src/svg-stroke-source.cjs` now plans canonical retained-stroke source
for HTML, JSX and Liquid. The original primitive/path remains verbatim under a
hidden original group; a versioned model and generated fill/stroke follow it.
Creation checks the resolved snapshot against source geometry and transform.
Changing alignment regenerates the visible result atomically. Restore removes
the representation and returns the original authored bytes. This restore
operation deliberately means restore original, not flatten the aligned result.

The planner preserves original and surrounding source identities and ancestry,
refuses stale hashes, dynamic geometry, duplicate/unaccounted attributes,
metadata/animation children and externally altered generated markup. Existing
source transactions provide stale-file protection and exact undo/redo. The
planner was **not registered with adapters or the server at this checkpoint**: browser style proof,
mutation guards (including multi-selection and ancestor operations), inspector
routing, paint/geometry editing, duplication and export integration remain open.
It requires a caller-provided resolved paint snapshot. It does not establish
correctness under arbitrary author styles or dynamic/inherited paint changes.

Validation: 2,449 unit tests passed, including 12 new source/history tests across
all three formats. Chromium and WebKit each passed 684 pixel checks per format
(4,104 total) after creating a retained group and changing its alignment. React
output is compiled with esbuild and rendered through React; Liquid output is
rendered through LiquidJS. React warnings and incorrect mask attribute spelling
fail verification. Each case also checks exact original-source restoration.
Logs: `/tmp/retouch-stroke-source-full-final.log` and
`/tmp/retouch-stroke-source-{html,react,liquid}-{chromium,webkit}-final.log`.
No desktop package was rebuilt for this checkpoint.

## Guarded adapter and API operations — 2026-09-20

HTML, React and Liquid now describe canonical retained groups and their owners,
and route `setSVGStrokeSourcePosition` / `restoreSVGStrokeSource` through the
normal source transaction and persistent history APIs. `createSVGStrokeSource`
remains internal: authored-style fidelity and repeated component-instance
identity still need browser proof before offering creation in the inspector.

Preflight guards cover selected originals, generated children, groups,
ancestors, selection members and source destinations. Whole-group deletion,
independent sibling edits and unchanged retained markup remain possible.
Post-plan checks also cover indirect API planners and additional source files:
modified/generated groups, duplicate groups and new definition-identity
collisions cannot slip through by bypassing an adapter. Dedicated stroke
operations must match the deterministic canonical plan exactly. Existing damaged
groups can remain untouched while unrelated source is edited. React direct
application now uses the same guarded planner as its HTTP operations.

Fresh validation: 2,461 tests passed, none skipped, with four test workers under
process-scoped `caffeinate -i`. Earlier runs encountered an installation-child
exit 143 and idle HTTP connection resets during long delays; the installation
suite passed independently. The new HTTP harness now requests fresh connections,
without retrying mutations or weakening assertions. Final full-suite log:
`/tmp/retouch-stroke-guards-full-awake.log` (41.96 seconds).

Three real sidecar tests exercise authentication, descriptors, preflight and
post-plan refusal, normal alignment/restoration, stale hashes and persisted exact
undo/redo. Direct-application tests cover all three adapters too. Browser output
now changes/restores through adapter operations: each Chromium/WebKit format
passed 684 pixel checks (4,104 total), including compiled React without warnings
and rendered Liquid. Logs: `/tmp/retouch-stroke-guards-{html,react,liquid}-{chromium,webkit}.log`.

Remaining: browser creation/style and repeated-instance proof, inspector controls,
original geometry/paint editing, duplication identity remapping, export and
responsive behavior. This is not full stroke parity or any-site verification.
No desktop bundle was rebuilt or launched.
