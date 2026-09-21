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

## Existing-stroke inspector controls — 2026-09-21

Canonical retained strokes now have a light-theme Stroke inspector with an
Inside/Center/Outside selector and Restore original shape action. The width is
shown read-only until original paint editing is implemented. The server reports
which positions the geometry supports, so open/unsupported contours cannot offer
an invalid alignment choice. Source operations use the normal structural history
and render synchronization paths.

The layer list shows the original shape's label as one logical vector, omitting
hidden originals and generated paths. Canvas clicks/double-clicks select that
vector, rather than entering generated geometry. Owned geometry, transform,
duplication and movement capabilities no longer advertise unsupported edits.
Locked groups/descendants and repeated rendered source identities disable the
controls; a multiple selection asks for one vector. Restoration is explicit and
undoable, with a tooltip explaining that it restores original stroke settings.

Fresh evidence:
- All 2,461 source tests passed: `/tmp/retouch-stroke-inspector-full.log`.
- Six complete inspector workflows passed: HTML, Next.js React and Liquid in
  Chromium and WebKit. Coverage includes logical layer selection, double-click,
  absent resize handles, locks, repeated-instance refusal, a smaller window,
  all three alignment modes with pixels, exact change/restore undo/redo and
  retained input drafts/preview document identity.
- Logs: `/tmp/retouch-stroke-controls-{html,react,liquid}-{chromium,webkit}-final.log`.
- Light inspector screenshot inspected: `/tmp/retouch-stroke-controls-chromium.png`.

React verification uses `/private/tmp/retouch-react-insertion-typed.kLGibf` for
Next/React and separate existing browser fixtures. The browser-only fixture does
not include Next. A cold page is explicitly rendered before UI checks; successful
final React builds took about 24/29 seconds. Earlier fixture/startup failures did
not establish a UI failure. The final runs exercised actual Next HMR, not just
server-rendered markup. Tests seed a retained group through the internal planner;
they do **not** prove user-facing creation. Creation/style/instance proof,
original paint/geometry editing, responsive semantics, duplication and export
remain open. No desktop package was rebuilt or launched.

## Existing-stroke rendered fidelity — 2026-09-21

Alignment writes now compare the currently rendered retained group with a
canonical reference in a closed shadow root in the editor document. The check
uses the server's canonical model and definition identity. It refuses overridden
paint, clipping, mask geometry, transforms, visible retained originals, active
animations, changed generated geometry, duplicate rendered groups and definition
IDs before submitting a source operation. Restore original shape remains
available as the recovery action. Reference construction does not mutate the
preview document.

The browser checker covers all three positions and three affine transforms,
including harmless clip-path paint CSS, with unchanged screenshot pixels. It
also checks authored-DOM identity/mutation records and cleanup of reference
nodes and temporary Paper scopes. The WebKit element screenshot stability wait
timed out; capturing the same SVG bounding rectangle with page.screenshot avoids
that actionability wait while retaining the pixel comparison.

This verifies the current group, not the prospective layout after switching
modes. CSS that starts matching newly generated nodes, ancestor/sibling :has
rules, responsive contexts, arbitrary-page stroke creation, original paint and
geometry editing, duplication and export still require further work. The
browser check is an editor precondition, not an API authorization boundary.
No desktop bundle was rebuilt or launched.

Validation: 2,461 source tests passed with no skips
(`/tmp/retouch-stroke-fidelity-full.log`); 273 fidelity cases passed in each of
Chromium and WebKit (`/tmp/retouch-stroke-fidelity-{chromium,webkit}.log`).
All six HTML/React/Liquid editor workflows passed, including CSS override
refusal without source writes and subsequent normal alignment/history/state
retention (`/tmp/retouch-stroke-fidelity-controls-{chromium,webkit}.log` and
`/tmp/retouch-stroke-fidelity-controls-{react,liquid}-{chromium,webkit}.log`).

## Editable retained-stroke weight — 2026-09-21

The light Stroke inspector now edits Weight in SVG source units, for Inside,
Center and Outside. The source operation validates a finite width from 0 to
10,000 and regenerates the canonical stroke/mask bounds while retaining the
original shape bytes, geometry, paint, alignment and definition identity.
Zero and fractional widths are supported. Restore original shape intentionally
restores the original authored stroke settings, including its original weight.

Typing commits through the shared field controls. Label/Option dragging and
held Up/Down keys preview the generated stroke without replacing DOM nodes.
A gesture commits once on release; Escape restores the prior attributes without
a source write. Outside-stroke previews update mask bounds as well as the stroke
width. Cancellation only restores attributes still owned by the preview, so it
does not overwrite a concurrent external attribute change. Locked/repeated
instances remain disabled, and writes use the rendered-fidelity precondition.

The shared numeric-handle helper gained opt-in keyboard-only registration and
custom key ordering; existing canvas handles keep their original default keys.
Source and HTTP tests cover valid/invalid/stale edits and exact history across
all three adapters. Browser coverage includes pixels for all alignments, label
and held-key grouping/cancellation, retained input/document state, locks and
CSS-override refusal. Preview tests also cover zero/fractional weights, all
three affine transforms, node identity and external-change cancellation.

This does not enable arbitrary-page creation or establish prospective CSS
fidelity. Original geometry/paint editing, variable-width strokes, multiple
paints, responsive semantics, duplication/export and desktop packaging remain
unfinished.

Validation notes: all 2,464 source tests passed on the final implementation
(`/tmp/retouch-stroke-weight-full-keyboard.log`). An earlier run had one
ECONNRESET in React effect-catalog HTTP tests after a long pause; those three
tests passed in isolation, and both later full runs passed. The final full run
still took about 496 seconds. No production retry logic was added.

Each browser passed 318 rendered-fidelity/preview cases
(`/tmp/retouch-stroke-weight-fidelity-{chromium,webkit}.log`). The inspector
screenshot was inspected at `/tmp/retouch-stroke-weight.png`. The editor test
now waits for the layer list to remove its deliberately duplicated vector before
clicking Lock, rather than relying on the panel's unrelated busy state.

All six complete editor workflows passed: HTML, React/Next and Liquid in
Chromium/WebKit, including weight pixels, held-key and label gestures, exact
undo/redo and retained drafts/document identity. Logs:
`/tmp/retouch-stroke-weight-controls-html-chromium.log` and
`/tmp/retouch-stroke-weight-controls-{html,react,liquid}-{chromium,webkit}-final.log`
(the HTML Chromium result uses the first path).
