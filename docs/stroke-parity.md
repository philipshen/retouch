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
| Stroke paints | Ordinary and retained SVG shapes expose a single fill/stroke paint; retained paints now support solid colors plus owned linear/radial gradients, stop controls, canvas handles and exact source history. | Multiple independently editable stroke fills and their order/visibility, broader gradient types, shared gradient editing and responsive paint preservation. |
| Alignment | The inspector now creates retained strokes from supported literal SVG shapes and edits Inside/Center/Outside, weight, caps, joins and dashes; see the 2026-09-22 integration checkpoint below. | Broader authored attributes, rendered instances, resource-backed previews, alignment creation from existing referenced paints, multiple paints and current package verification. |
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

## Retained-stroke advanced settings — 2026-09-21

Retained strokes now reuse the existing advanced Stroke settings popover beside
Weight: cap/join icon controls, Solid/Dashed/Custom pattern selection, Dash and
Gap fields, custom literal dash lists, miter limit and dash offset. Source edits
change only the selected model property, preserving geometry, paint, original
bytes and definition identity. They use the same guarded transactions and exact
undo/redo path as weight/alignment. Miter and offset support grouped numeric
previews; outside miter previews also update mask bounds.

The renderer now explicitly rejects unresolved dash variables and inherited
values, which the general CSS validator previously accepted. Retained dash
lengths use literal SVG source units (optional px); percentages are refused.
The general numeric expression handler respects already-handled arrow keys so
it cannot increment a live-preview field a second time.

The existing ordinary-SVG settings test is preserved, with its outside-click
check targeting the Design tab explicitly so it cannot switch to Prototype. The new retained
workflow is `retouch/test/e2e/svg-retained-stroke-settings.cjs`, called by the
retained-stroke editor workflow. A dash pixel comparison explicitly uses butt
caps: square caps can legitimately fill small gaps when stroke weight is larger
than the gap, so that case must not be mistaken for broken dash rendering.

All 2,467 source tests passed (`/tmp/retouch-stroke-settings-full.log`). Each
browser passed 390 rendered-fidelity/preview checks
(`/tmp/retouch-stroke-settings-fidelity-{chromium,webkit}.log`). General arbitrary
page creation, prospective CSS fidelity, variable widths, multiple paints,
responsive semantics and desktop packaging remain open; this is not full stroke
or Figma parity.

All six retained-stroke editor workflows passed, with keyboard undo/redo for
all 13 advanced-setting changes and toolbar history for weight/alignment.
HTML/WebKit passed at the normal action timeout
(`/tmp/retouch-stroke-settings-controls-html-webkit-keyboard.log`); the remaining
five used a temporary runner that only sets Playwright's action timeout to
900,000 ms, with the existing initial React render timeout set to the same
value. No assertions or user interactions were bypassed. These isolated runs
used process-scoped `caffeinate -di`; no global power settings were changed.
Logs: `/tmp/retouch-stroke-settings-controls-{html,react,liquid}-{chromium,webkit}-slow-host.log`
(except HTML/WebKit, whose path is above). Earlier short-timeout runs stopped
at varying click/keypress or cold Next compilation stages.

The ordinary-SVG settings workflow also passed on Chromium, including scoped
values, screen fallback, reset and exact history:
`/tmp/retouch-stroke-settings-existing-chromium-slow-host.log`. Its fixture
requires both `RT_E2E_SVG_COLORS=1` and `RT_E2E_SVG_STROKES=1`. The light settings
popover screenshot was inspected at
`/tmp/retouch-stroke-settings-html-webkit.png`. No desktop build or launch was
performed in this checkpoint.

## Internal creation paint snapshot — 2026-09-21

`svg-stroke-source.creation` now supplies an internal literal-source contract
(tag, exact geometry attributes, canonical path, matrix, parent and source ID).
It rejects retained/boolean-owned children and does not advertise a public
creation capability. The browser `svg-stroke-snapshot.js` captures a normalized
center-stroke model from the connected shape's resolved CSS without adding or
changing preview nodes.

Capture verifies source geometry/transform against the DOM, refuses repeated
IDs in the current DOM root and active shape animations, and resolves inherited
paint/currentColor/CSS variables, opacity, caps, joins, miter, dash values and
stroke weight. Percentage lengths use the normalized diagonal of the nearest
SVG viewport in user units. Open lines/polylines remain open. Unsupported
filters, clipping/masks, markers, non-scaling strokes, stroke-first paint order,
paint references and CSS-altered/unresolved geometry are explicitly refused.
These are remaining implementation gaps, not the intended final parity scope.

Both Chromium and WebKit passed 200 snapshot checks and compared 192,000 pixels
per browser across eight primitive/path shapes with literal and percentage
strokes. Each case compares an original rendered shape with center output made
through the actual internal source planner. The image tolerance permits fewer
than 1% of each image's pixels to differ by more than 16 channel levels; it is
not an exact-byte image equivalence claim. Geometry mutation, CSS geometry,
animations, transforms, paint/effect overrides and repeated identities are
checked. Snapshot capture produces no authored-DOM mutation records and leaks
no Paper scopes. Logs: `/tmp/retouch-stroke-snapshot-{chromium,webkit}.log`.

This module is not yet loaded by the editor or a public creation endpoint.
Prospective generated CSS, wrapping effects on ancestors/siblings, identity
checks across separate DOM roots, and repeated component instances remain
unproved. Full arbitrary-page creation is still unfinished. No desktop build or
launch was performed.

All 2,470 source tests passed with no skips in 61.38 seconds
(`/tmp/retouch-stroke-snapshot-full.log`), including the internal creation
contract for HTML, React and Liquid. Browser checks used the temporary
slow-host timeout wrapper described above; no checks were bypassed.

## Internal proposed-wrapper probe — 2026-09-21

The internal creator accepts an optional validated, unused definition ID, so a
browser probe and the subsequent deterministic source plan can use the same
identity. Existing internal calls may still generate a fresh random identity.
This does not add creation to public adapter capabilities.

`svg-stroke-probe.js` captures the selected shape, temporarily wraps the actual
node in a proposed retained stroke, verifies generated fidelity, compares the
surrounding DOM root's computed styles, pseudo-element styles, bounds and CSS
selector matches, then restores the original node and order in `finally`.
The probe checks all three alignments and preserves the original element
identity, markup, input draft and preview document on acceptance and refusal.

A WebKit test demonstrated that computed fill alone could remain stale during
the SVG move for `g + circle`. Matching-selector comparison now detects that
structural change independently. Stylesheet media conditions use the preview's
window, not the editor viewport. Unreadable CSSOM and nested style selectors
are refused before any wrapping. The check is conservative: changed matching
rules may cause a refusal even when their current rendered effect is neutral.

Both Chromium and WebKit passed 165 proposed-wrapper checks, including own
paint/original-display overrides, ancestor :has effects, sibling selectors,
pseudo content, active/inactive media rules, unavailable CSSOM, nested rules,
identity collisions and exact restoration. Every accepted probe was converted
into a source plan with the same definition ID. Logs:
`/tmp/retouch-stroke-probe-{chromium,webkit}.log`. All 2,473 source tests passed
(`/tmp/retouch-stroke-probe-full.log`, 109.57 seconds), including deterministic
ID validation and collision refusal in HTML, React and Liquid.

Critical limits: this probe makes observable DOM mutations even when it
restores exact markup; the tests explicitly observe those records. Authored
MutationObservers may react after return. Separate shadow/iframe roots,
stylesheet conditions beyond this proof, layout/style changes during later
async source writes and large-page performance remain unverified. The module
is not loaded by the editor and arbitrary-page creation is still not exposed.
An isolated or committed-preview lifecycle is needed before calling this safe
for general pages. No desktop package was rebuilt or launched.

## Internal isolated wrapper preview — 2026-09-22

`svg-stroke-isolation.js` runs the proposed-wrapper probe in a temporary,
script-disabled iframe in the editor document. A constant CSP blocks resource
loads before importing page markup. It preserves standards/quirks mode, copies
readable stylesheets and form/scroll state, then compares computed styles,
selector matches, pseudo styles, element bounds, rendered text ranges and the
selected stroke snapshot before testing the wrapper. The authored document is
not temporarily wrapped. The iframe is removed on acceptance and refusal.

Before returning, the check verifies the authored markup, element identities,
styles, form state, text layout, stylesheet text, viewport and animation state
again. Authored attribute and CSSOM edits during asynchronous setup are
preserved and cause refusal. Unreadable CSSOM, nested CSS selectors, nested
documents, detected shadow/custom content and unfinished animations are
conservatively refused.

Chromium and WebKit each passed 366 checks across standards/quirks modes,
three transforms and all three alignments. Checks cover generated and
surrounding CSS effects, exact source definition identity, zero authored DOM
mutation records, unchanged focus/drafts, no repeated authored scripts or
event handlers, no extra intercepted resource requests, and iframe/Paper
cleanup. Logs: `/tmp/retouch-stroke-isolation-{chromium,webkit}-final.log`.
The source suite passed all 2,473 tests with no skips in 362.90 seconds
(`/tmp/retouch-stroke-isolation-full.log`). Browser runs used the temporary
slow-host action-timeout wrapper; assertions were not bypassed.

This remains internal and is not loaded by the editor. Resource-backed
layouts, relative CSS URLs, fonts, stylesheet import/layer semantics, closed
shadow roots and large-page performance need further proof. Baseline mismatch
causes refusal; the tested fixtures do not establish arbitrary-page fidelity.
The later check-to-source-commit race and public creation lifecycle remain
unfinished. No desktop package was rebuilt or launched.

The isolated result also exposes `assertCurrent()`, a synchronous recheck of
the captured authored document after the temporary iframe has been removed.
Callers can use it immediately before submitting the source operation. It
checks current state, not uninterrupted history: restoring the same original
nodes, styles and drafts makes the proof current again. It is not a lock or an
atomic browser/server transaction, and cannot protect a later asynchronous
commit by itself. The editor does not yet consume this internal method.

Freshness checks passed in Chromium and WebKit: 384 checks per engine,
including post-return draft changes, CSSOM rule insertion and replacement of
the selected node with identical markup. Each invalidates the proof; exact
restoration passes again without recreating the sandbox. Logs:
`/tmp/retouch-stroke-freshness-chromium-retry.log` and
`/tmp/retouch-stroke-freshness-webkit.log`. The initial Chromium run timed out
waiting for the fixture input before reaching these assertions; the terminal
process was confirmed before retrying. No full source-suite rerun was needed
for this isolated browser-only follow-up.

## Stroke creation in the inspector — 2026-09-22

Supported ordinary SVG shapes now show an Align field in the existing light
Stroke section. Center preserves the ordinary shape; choosing Inside or Outside
captures its rendered paint, tests the proposed wrapper in an inert preview,
rechecks the selection/document and submits one deterministic source operation.
HTML, React and Liquid descriptions advertise literal creation candidates. The
public operation requires a stable unused definition ID and validates geometry,
transform, file revision and the exact source plan independently of the browser.

Creation records one structural history entry, remaps selection/locks to the
logical vector and preserves the original authored shape verbatim. The existing
retained-stroke controls take over after conversion. Undo/redo and Restore
original shape use the normal source-history and preview-refresh paths. The
operation is source-global; the alignment field's tooltip identifies that it
applies to every screen. Multi-selection, repeated rendered IDs and locked
shapes cannot initiate creation through this control.

The isolated preview now copies nested open shadow roots, their inline/adopted
stylesheets, text layout, forms and scroll state. It checks surrounding shadow
content during the wrapper probe and checks shadow source/style changes again
before submission. Custom-element constructors and connection callbacks do
not run in the sandbox. Closed custom content, manual slot assignment and
nested documents remain unsupported. Shadow-root selection itself is not yet
a creation target.

CSSOM nesting is resolved for selector-match comparisons using the complete
parent selector list through `:is()`, following the
[CSS Nesting specification](https://drafts.csswg.org/css-nesting/#nest-selector).
The browser resolver is checked against the repository's PostCSS-based source
resolver for explicit/implicit nesting, lists, repeated ampersands, functional
selectors, quoted values, escapes and size limits.

React/Next testing found a CSSOM serialization loss: a transition shorthand
with a variable, followed by an unresolved variable in a longhand, serialized
to empty longhands in Chromium. Re-parsing that serialization changed a 200 ms
transition to zero. Inline stylesheet text is preserved when a fresh parse
still matches the current CSSOM rule list; CSSOM edits use current serialized
rules. Baseline style/layout comparisons still apply. This does not establish
lossless reconstruction of every external or dynamically modified stylesheet.

After the source refresh, creation checks that exactly one retained group
renders and verifies its generated fidelity. If that check detects a change,
the editor reports it and keeps the normal Undo entry available. This is not
an atomic transaction between browser state and server writes, nor an automatic
rollback of every asynchronous page effect. General resources/fonts, closed
shadow content, dynamic geometry, repeated instances, retained geometry/paint
editing, multiple strokes, profiles and brushes remain part of the full goal.
No desktop package was rebuilt or launched for this checkpoint.

Validation on this implementation: all 2,475 source tests passed with no skips
in 55.82 seconds (`/tmp/retouch-stroke-creation-full-final.log`), including
public HTTP creation/refusal and exact history for all three source adapters.
Six complete editor workflows passed: HTML, React/Next and Liquid in Chromium
and WebKit. Each starts from ordinary source, refuses generated CSS overrides
and repeated instances, creates through the Align field, checks pixels and
exact creation undo/redo, then exercises alignment, weight, advanced settings,
scrub/key gesture grouping/cancellation, locks and exact restoration. Draft
inputs and preview document markers survive the edits.

Editor logs: `/tmp/retouch-stroke-creation-controls-{html,liquid}-{chromium,webkit}-final.log`,
`/tmp/retouch-stroke-creation-react-chromium-preserve.log` and
`/tmp/retouch-stroke-creation-controls-react-webkit-final.log`.
The isolated-preview suite passed 402 checks per engine, including shadow
parts, nested open roots, adopted stylesheet changes, constructor/connection
counters, the pending-transition serialization case and zero additional
resource requests or authored mutation records. The underlying proposed-wrapper
suite passed 165 checks per engine. Logs:
`/tmp/retouch-stroke-creation-{isolation,probe}-none-{chromium,webkit}-final.log`.
Browser runs used the temporary slow-host action/prewarm timeouts without
bypassing assertions. Inspected screenshots include
`/tmp/retouch-stroke-creation-html-webkit-final.png` and
`/tmp/retouch-stroke-creation-chromium.png`.

## Retained fill and stroke paints — 2026-09-22

Retained vectors now keep Fill and Stroke color rows after alignment creation.
The existing compact swatch, color picker and alpha field edit each paint;
`none` removes it. This uses the normal retained source operation and history,
with the same singleton/lock and rendered-fidelity checks as stroke settings.
Literal colors, alpha and Display P3 are supported; unresolved references and
contextual/system colors are refused for these retained paint edits.

The displayed paint combines its literal alpha with its captured fill/stroke
opacity. Saving a paint stores the chosen effective alpha in that color and
sets that paint's separate opacity multiplier to one, avoiding multiplication
of the requested alpha twice. The other paint and group opacity are preserved.
The original source shape remains verbatim and Restore original shape restores
its original paints and opacity. Source tests cover non-unit paint and group
opacity in HTML, React and Liquid.

Picker previews update only generated paint/opacity attributes (and existing
mask bounds), preserve node identities and restore attributes still owned by
the preview on cancellation. Source changes occur on Apply; cancellation leaves
source unchanged. These controls do not add multiple paints, gradients, width
profiles, brushes, responsive variants or retained geometry editing. Desktop
packaging remains unchanged.

Validation: all 2,478 source tests passed with no skips in 40.69 seconds
(`/tmp/retouch-stroke-paints-full.log`). Six HTML/React/Liquid editor workflows
passed in Chromium and WebKit, including color-picker preview/cancellation,
Apply, compact alpha edits, `none`, rendered opaque/translucent pixel samples,
exact source undo/redo and draft/document preservation. The existing alignment,
weight, advanced settings and gesture-history checks still pass in those runs.
Logs: `/tmp/retouch-stroke-paints-controls-{html,react,liquid}-{chromium,webkit}.log`.

Both engines also passed 462 generated-stroke fidelity checks covering all
alignments and three transforms, including the new color/alpha/Display P3
previews and restoration. Logs:
`/tmp/retouch-stroke-paints-fidelity-none-{chromium,webkit}.log`. The standalone
fixture now loads the same palette-values dependency used by the full editor;
its first P3 run exposed the missing fixture dependency. The browser workflows
used the temporary slow-host timeout runner without bypassing assertions.
Inspected UI: `/tmp/retouch-stroke-paints-html-chromium.png`.

## Selected SVG stroke export bounds — 2026-09-22

Selected-layer raster/PDF export now retains the geometric selection frame and
expands it to include supported SVG stroke paint. Center and Outside strokes
are no longer cropped at their path geometry. Inside strokes using the exact
same-path user-space clip remain bounded by their geometry. The calculation
runs in the disposable export document, loading the installed Paper runtime
only for graphical SVG selections. Captured author scripts remain disabled.

The measurement supports paths and SVG primitives, transformed geometry,
rounded rectangles, caps, joins and non-scaling strokes. Sharp miter and square
cap corners are calculated in local stroke coordinates before transformation;
Paper's transformed miter-limit comparison otherwise misses valid corners.
Non-scaling strokes use transformed geometry with an unscaled stroke width.
Text/use and unsupported geometry retain conservative padding. Arbitrary
filters, markers, arbitrary clipping and exact text/use paint bounds are not
proved by this checkpoint. Root SVG canvas export keeps its viewport semantics.

The cross-engine checks also exposed WebKit reporting `transform: none` for
SVG presentation transforms. Frozen captures now recover the effective local
matrix from screen matrices when this happens, preserving CSS overrides and
folding individual transforms into that matrix without applying them twice.
This affects frozen rendered-page captures as well as screen export; responsive
captures continue retaining their authored styling.

Validation: all 2,478 source tests passed, no skips, in 16.87 seconds
(`/tmp/retouch-export-source-v4.log`). Chromium and WebKit each passed 80
painted-bounds cases (eight shapes, five affine transforms, scaling/fixed-width
strokes), 60 retained-stroke export checks and 72 mask export pixel checks.
The bounds cases compare exported frames with actual alpha pixels, retaining
the native geometry frame, and check Paper scope cleanup. Retained cases cover
Inside/Center/Outside, transforms, group/paint opacity, 1x/2x raster dimensions,
sibling isolation, SVG metadata removal and unchanged authored source/DOM.
Screen-export endpoint rendering is Chromium, with captures originating in
each browser; direct bounds tests run independently in each engine.

Both browsers passed existing layer PNG/JPEG/PDF, SVG reference and
`display:contents` exports. Frozen-capture regressions passed CSS transform
replacement/removal, individual transforms and nested SVG viewports, comparing
screen matrices and geometry after Chromium reconstruction. Both also passed
SVG asset capture and complete site capture/edit/exact undo/redo/CLI workflows.
Logs: `/tmp/retouch-export-all-v2.log` and
`/tmp/retouch-export-capture-checks-v4.log`. An earlier full run failed one server
startup timeout and a capture run timed out on page reload; both processes
terminated and unchanged checks passed on rerun. No assertions were relaxed.
The desktop package was not rebuilt or notarized for this checkpoint.

## Retained vector placement — 2026-09-22

Aligned vectors now retain the normal light inspector's position, rotation,
flip and size controls, plus canvas resize/rotation handles and keyboard
movement. The source operation stores an optional placement matrix on the
canonical outer group. Its original archived shape, source geometry transform,
definition identity and paints remain unchanged. Older retained sources retain
their exact serialization until edited. Restore original shape removes the
placement together with the retained wrapper and restores the original bytes.

Placement scales the entire vector, including its stroke, as an SVG group.
The existing stroke width control still edits local source units. This does not
add non-scaling retained strokes or path-node editing. Multi-selection
transforms are covered in the following section. Placement remains source-global across
screen sizes and requires one unlocked rendered instance.

The dedicated source operation validates finite, non-collapsed matrices and
passes the same deterministic plan and exact-history checks as other retained
edits. Browser fidelity compares the outer placement and inner source matrix
separately. Normal vector numeric fields now use grouped held-arrow previews:
release commits once, and Escape restores the previous transform and source.

Retained vectors do not use the ordinary transform probe's cloned subtree.
Duplicating clip/mask IDs, even briefly, caused stale inside-stroke pixels in
WebKit after changing alignment. Inspector mounting now avoids that clone.
A user-requested transform is checked on the existing node with the proposed
placement model, then its owned transform attribute is restored before source
submission. This checks the vector's resulting paint and coordinate space;
it is not a proof that arbitrary author observers or conditional styles on
other elements have no effects. Current singleton, lock and source revision
checks still apply before the source write.

All 2,481 source tests passed with no skips in 17.39 seconds
(`/tmp/retouch-placement-full-verified.log`). Both Chromium and WebKit passed
1,386 fidelity checks each across three alignments, three original matrices
and three outer placements, including reflected placement, paint/width
previews, CSS overrides, identity checks and reference/Paper cleanup.
Logs: `/tmp/retouch-placement-fidelity-{chromium,webkit}.log`.

Six HTML/React/Liquid editor workflows passed across Chromium and WebKit.
They cover creation, X/Y/width/height/rotation fields, flips, keyboard movement,
held-field preview/cancellation, canvas resize/rotation, exact undo/redo,
unchanged archived source shape and definition identity, and retained form
input/document identity. Existing alignment, weight, advanced settings and
paint controls also passed in these runs. The inspector test checks that
mounting controls adds no duplicate definition IDs; a rendered CSS matrix
override refuses the requested transform without a source change. React runtime
revision attributes are excluded from DOM archive comparisons; exact source
bytes remain covered by history/source checks.

Evidence: `/tmp/retouch-stroke-placement-controls-{html,liquid,react}-chromium.log`,
`/tmp/retouch-placement-webkit-css.log`, and
`/tmp/retouch-stroke-placement-controls-{liquid,react}-webkit.log`.
The CSS override fixture uses an explicit identity matrix so both browsers
actually enforce the same rendered constraint. Inspected light UI:
`/tmp/retouch-stroke-placement-html-chromium.png`. Desktop packaging was not
rebuilt or notarized for this checkpoint.

## Mixed and multiple retained vector transforms — 2026-09-22

Aligned vectors now participate in the normal multi-selection transform
controls alongside ordinary SVG vectors. The existing move, size, rotation,
flip, alignment and spacing tools use one `setSVGTransforms` source operation
and one history entry. Retained members update their canonical placement;
ordinary members retain the usual literal transform edit. Parent/child
selections keep covered children's local transforms unchanged, avoiding a
second application of the same movement.

The planner stages all selected members before returning one file edit, checks
retained ownership and canonical source, preserves source IDs, and rejects the
entire selection when a member is invalid. The retained-source plan guard
independently recomputes the complete batch. Archived geometry, paints and
private clip/mask identities remain intact. Existing limits remain: 2–100
vectors in one source file, supported literal transforms, singleton rendering
and unlocked targets. These transforms are shared across screen sizes.

Before submitting a batch, the editor checks all proposed transforms together
on existing nodes and restores only attributes still owned by that preview.
It verifies rendered coordinate spaces and retained paint fidelity without
cloning private definitions. Ordinary ancestors containing retained vectors
also avoid that clone probe. This does not prove the absence of arbitrary
author-script effects or conditional style changes elsewhere in the page.

Testing uncovered an existing multi-selection history refresh issue: undo
could restore every source transform while refreshing only the primary DOM
node. SVG refresh now receives the complete explicit selection from the write
response or history record, independent of temporarily cleared UI selection.
Descendants are reconciled through selected ancestors once.
Validation: all 2,484 source tests passed with no failures or skips. The full
stroke editor workflow passed for HTML, React and Liquid in both Chromium and
WebKit, including mixed and multiple retained selections, parent/child movement,
CSS refusal, canvas and held-key previews, exact undo/redo, and retained document
and input state. Ordinary SVG selection scrub regressions passed in both engines.
The React/WebKit multi-selection screenshot was also inspected.

## Shared aligned-vector stroke settings — 2026-09-22

Selecting multiple aligned vectors exposes shared alignment, weight, caps,
joins, miter limit, dash pattern and dash offset in the Stroke inspector.
Different values display Mixed. Entering a value applies it to every selected
stroke; numeric scrubs and held-arrow previews commit once, with Escape
restoring every preview. Alignment choices are limited to positions supported
by every selected contour.

The `setSVGStrokeSelection` operation stages 2–100 canonical retained strokes
from one source file in memory, composes source identity changes, and returns
one atomic file edit. Each vector preserves its archived shape, definition
identity, placement and unrelated paint settings. A stale file, invalid member
or unsupported property refuses the complete batch. The editor checks rendered
fidelity and locks for every selected stroke before writing, then refreshes the
common source ancestor and retains the selection through exact undo/redo.

Ordinary shapes must first be aligned individually before joining these shared
stroke controls. Mixed ordinary/retained selections still have shared transform
controls. Cross-file edits, path-node editing of retained geometry, gradients
and multiple paints remain open. Shared paint controls are covered below.

Validation: all 2,490 source tests passed without failures or skips in 16.81
seconds (`/tmp/retouch-stroke-shared-full-final.log`). Coverage includes
HTML/React/Liquid, source identity composition across different parents,
unchanged edits, exact transaction history, generated-child/stale-file refusal,
and an unsupported open contour refusing the entire alignment batch.

Six complete editor workflows passed across HTML/React/Liquid in Chromium and
WebKit (`/tmp/retouch-stroke-shared-six.log`). The new checks exercise mixed
weight fields, shared alignment and advanced settings, late CSS refusal,
held-key preview cancellation/one-step undo, controls remaining enabled after
saves, and retained input/document state. Existing transform, paint, lock,
creation, pixel and history checks remain in the same workflows. After
shortening visible labels and putting Weight below Align, HTML and Liquid
Chromium workflows were rerun successfully (`/tmp/retouch-stroke-shared-layout.log`);
React and WebKit runs already used that final layout. The final HTML/Chromium
multi-selection screenshot was inspected. Desktop packaging was not rebuilt
for this checkpoint.

## Shared aligned-vector fill and stroke paint — 2026-09-22

Multiple aligned vectors now retain the normal light Fill and Stroke paint
rows, color picker, and compact opacity fields. Different colors and alpha
values display Mixed. Picker drafts preview every selected vector and Escape
restores them without a source write. Applying a color is one atomic edit and
one history entry, including Display P3 and explicit no-paint values.

Opacity edits preserve each vector's color channels and color space. Bare hex
edits preserve each existing paint's effective alpha; entering hex after None
adds paint at full opacity. Explicit CSS color values retain their own alpha.
No-paint values keep the opacity field disabled until paint is added. These
are shared source edits across every screen size.

The batch operation accepts an exact source-ID-to-paint map for fill or stroke.
It rejects incomplete maps, unknown members, simultaneous scalar/map values,
and invalid paints before returning a file edit. Values follow their original
source identities while the planner composes structural mappings. Paint edits
normalize the chosen paint opacity, preserving the other paint, group opacity,
archived geometry, placement, and private definition identity.

Retained gradients, multiple paints, path-node editing and mixed ordinary/
aligned-vector paint editing remain open.

Verification also exposed a compiled-preview timing edge. The old refresh loop
could skip every live revision check after a scheduling gap and fall back to
reloading an already-current document. A deterministic React browser regression
advanced the monotonic clock between observations and recorded an unnecessary
fetch/reload. Refresh now checks the live revision before expiring its wait and
still requires three stable samples, including stylesheet and client-mount
readiness. Stale or mismatched revisions do not bypass the existing checks.

The final source suite passed all 2,493 tests without failures or skips in
16.21 seconds (`/tmp/retouch-stroke-shared-paint-final-source.log`). New source
coverage exercises distinct per-member sRGB/P3 paint values, effective alpha,
other-paint/group-opacity preservation, incomplete/ambiguous maps, and atomic
refusal of invalid late members.

Ordinary shared paint regressions passed in Chromium and WebKit
(`/tmp/retouch-stroke-shared-paint-ordinary-{chromium,webkit}.log`), including
per-layer alpha, hidden paints, P3 strokes, invalid drafts, and exact history.
The final HTML/Chromium multi-selection screenshot was inspected: mixed paint
labels render once and the existing compact color/opacity rows remain intact.

All six complete HTML/React/Liquid editor workflows passed in Chromium and
WebKit on the final code (`/tmp/retouch-stroke-shared-paint-verified-six.log`).
They exercise picker preview/cancellation, distinct colors and alpha,
opacity-only edits, bare hex, Display P3, None-to-hex creation, atomic CSS
refusal, exact undo/redo, retained selection and document/input state. The
React runs in both engines also pass the deterministic scheduling-gap
regression; its pre-fix run recorded one unnecessary fetch and reload
(`/tmp/retouch-stroke-shared-paint-pause-before.log`). Desktop packaging was
not rebuilt for this checkpoint.

## Relative gestures for mixed stroke numbers — 2026-09-22

Mixed stroke weight, miter limit and dash offset now support label dragging
and held arrow keys. A gesture adjusts every selected value by the same amount,
preserving their differences. For example, weights 8 and 1 become 10 and 3 after
two Up steps. The shared gesture range stops when any member reaches a property
limit, so moving down from 8 and 1 stops at 7 and 0 rather than collapsing their
difference. Shift/Option retain the existing coarse/fine gesture increments.

Gestures track a separate delta, so authored fractional precision is retained.
Escape restores every rendered preview without changing source. Returning to
the starting value creates no edit. A completed gesture uses one source
transaction and one undo entry. Typing a value remains absolute; nudging a typed
draft also edits that absolute draft instead of the previous mixed values.

The batch planner accepts exact per-member finite numeric maps for width,
miter limit and dash offset, with the same member identity and atomic validation
used by shared paint maps. A stale source, incomplete map, out-of-range value,
or invalid late member refuses the whole edit. Numeric previews restore owned
attributes on every selected vector if any preview fails.

Source validation passed all 2,496 tests without failures or skips in 17.19
seconds (`/tmp/retouch-stroke-relative-full-final.log`). New HTML/React/Liquid
coverage includes distinct numeric maps, fractional values, property bounds,
invalid late members, stale hashes, scalar/map ambiguity, source preservation,
and exact transaction undo/redo.

Six full HTML/React/Liquid editor workflows passed in Chromium and WebKit on
the final delta-based implementation (`/tmp/retouch-stroke-relative-precise-six.log`).
The new browser checks use an authored weight of 8.123456789, verify every
member's rendered preview, and cover mixed weight/miter/offset nudges, label
scrubbing, lower limits, Escape, zero-net gestures, absolute typed drafts,
one-step exact undo/redo, and retained form/document state. Existing paint,
transform, alignment, lock, pixel and source-sync regressions pass in the same
workflows. Desktop packaging was not rebuilt for this checkpoint.


## Retained stroke path editing — 2026-09-22

Aligned vectors now expose **Edit vector points** in the SVG geometry section.
The existing point/contour editor edits their current visible path, including
numeric point movement and canvas dragging through retained placement. The
source operation regenerates the fill, stroke and clipping/masking geometry
while retaining alignment, paints, width, original transform and placement.

The original primitive/path remains archived verbatim. An optional canonical
`originalPath` records that archived geometry when the visible path differs;
source validation still checks the archive against it. Returning to the original
path removes that extra metadata. Restore original shape still restores the
archived source, and undo/redo restore exact source bytes.

Inside/outside edits must remain supported closed, noncrossing contours. Open
or crossing edits are refused without writing source; Center supports open
paths. Generated CSS overrides, stale source, locked or repeated instances
retain the existing refusal boundaries. This adds retained path editing to the
existing SVG editor; it does not establish full vector-network parity.

All 2,499 source tests passed with no failures or skips in 17.63 seconds
(`/tmp/retouch-stroke-path-full-final.log`). The new HTML/React/Liquid tests cover
all three alignments, repeated edits, placement/paint preservation, exact restoration and
history, invalid paths, stale hashes and altered archived geometry.

The ordinary vector editor also passed its Chromium and WebKit entry/editing
regressions, including transformed dragging at 50/100/200% zoom, keyboard point
edits, insertion/deletion, exact history and cancellation
(`/tmp/retouch-stroke-path-ordinary-{chromium,webkit}.log`).

An initial Chromium React run lost the unrelated form draft during a later
shared-paint redo (`svg-retained-stroke-shared-paints.cjs:25`), after the retained
path checks passed. The subsequent traced full run passed without a call to
`reloadFrame` (`/tmp/retouch-stroke-path-react-trace.log`). The initial failure
remains recorded in `/tmp/retouch-stroke-path-controls-react-chromium.log`;
its cause is unresolved and is not claimed fixed by this path-editing change.

The full HTML/Liquid/React workflows ultimately passed in Chromium and WebKit.
HTML/Liquid Chromium results are in `/tmp/retouch-stroke-path-six.log`; all three
WebKit results are in `/tmp/retouch-stroke-path-webkit.log`. A final untraced
Chromium React confirmation passed in `/tmp/retouch-stroke-path-react-confirm.log`.
The new browser helper checks numeric point edits, rotated point dragging,
Escape, visible-fill CSS refusal, exact undo/redo, and preserved document/form
state. Existing shared paint/settings, alignment, transform, lock and pixel
checks also passed in those workflows. Successful reruns do not resolve the
intermittent React failure above. Desktop packaging was not rebuilt.


## Delayed hot-update delivery after suspension — 2026-09-22

The compiled preview wait now counts polling opportunities rather than wall-clock
time. It normally allows about eight seconds (160 checks, 50 ms apart), with
three stable readiness samples required before continuing. A tab suspension no
longer exhausts that budget before a queued hot update can run. Permanently
missing updates still reach the existing fallback; the wait is not indefinite.

A deterministic browser reproducer advanced the clock by nine seconds per read
and delayed readiness for two checks. The preceding implementation made two
unnecessary page fetches (`/tmp/retouch-refresh-delivery-before.log`). The
regression helper now covers ready, pending and permanently missing updates;
it intercepts fallback reloads when testing the last case.

Separately, three buffered baseline Chromium React runs completed 960 refreshes
without a reload or form-draft loss (`/tmp/retouch-refresh-buffer-runs.log` and
`/tmp/retouch-refresh-buffer-{0,1,2}.log`). This did not reproduce the earlier
shared-paint draft reset, so that failure remains unresolved. The delivery-wait
change fixes the demonstrated timeout behavior, not a proven root cause of that
intermittent reset.

All 2,499 source tests passed with no failures or skips in 17.14 seconds
(`/tmp/retouch-refresh-delivery-source-final.log`).

Svelte's real Vite workflow passed in Chromium and WebKit, covering source text,
responsive CSS, multi-selection, exact undo/redo, retained component/document
state, conditional identity and exclusion of editor code from production builds
(`/tmp/retouch-refresh-delivery-svelte-{chromium,webkit}.log`).

All six full HTML/Liquid/React stroke editor workflows passed in Chromium and
WebKit (`/tmp/retouch-refresh-delivery-six.log`). Both React runs passed all
three deterministic suspension/delivery scenarios, along with the retained path,
shared paints/settings, transforms, pixels, locks, exact source history and
form/document preservation checks. Desktop packaging was not rebuilt.


## Owned gradients on aligned vectors — 2026-09-22

Aligned vectors can now use independent linear or radial gradients for Fill and
Stroke. The existing light gradient inspector provides stop colors and opacity,
positions, insertion/removal, reversal, coordinate fields, units, spread and
canvas handles. Canvas drags retain the editing session after a source commit;
Escape restores the draft. A gradient-wide opacity field preserves existing
paint opacity and supports grouped numeric previews and exact history.
Converting to Solid uses the first stop with its effective opacity.

Each gradient uses a private definition under the retained owner, separate from
its clip/mask identity. Source edits regenerate the complete canonical group in
one transaction, retaining geometry, alignment, placement, the other paint and
the archived original shape. Original restoration still recovers exact bytes.
The portable gradient model validates coordinates, stop count, literal paints,
opacity, hard stops and tiny offsets. Switching types retains inactive
coordinates. Browser fidelity checks include stop CSS, local references,
definition uniqueness and unexpected gradient geometry/inheritance attributes.

This does not add multiple fills/strokes, angular or diamond gradients,
shared multi-selection stop editing, explicit gradient transforms, or alignment
creation from a shape already using a referenced gradient. Those remain part
of the full parity objective. Shared retained numeric/transform controls remain
available; selections containing a gradient ask for one shape when editing its
stops.

All 2,506 source tests passed without failures or skips in 15.76 seconds
(`/tmp/retouch-stroke-gradient-final-source.log`). New coverage includes
HTML/React/Liquid gradient operations, independent fill/stroke identity,
geometry/placement preservation, solid conversion, original restoration,
stale/malformed edits, canonical tiny offsets, hard stops and paint validation.

Export verification passed 96 checks in each of Chromium and WebKit
(`/tmp/retouch-stroke-gradient-export-{chromium,webkit}.log`), including linear
fill and radial stroke references across inside/center/outside alignment,
transformed artwork, transparent 1x/2x PNGs, SVG metadata removal and unchanged
source/DOM.

The full HTML/Liquid/React editor workflows passed in Chromium
(`/tmp/retouch-stroke-gradient-opacity-three.log`) and WebKit (the WebKit runs
in `/tmp/retouch-stroke-gradient-final-six.log`). Browser coverage includes
rendered gradient pixels, stop edits/insertion, linear/radial conversion,
coordinates, independent stroke gradients, overall opacity and held-key
preview grouping, canvas commits with continued editing, Escape, CSS refusal,
solid conversion, exact undo/redo and preserved document/form state. Existing
alignment, paint, transform, lock and pixel regressions passed in the same runs.

Ordinary SVG gradient editors also remain visible in Fill when CSS image-paint
controls are present. The organizer had moved them into a collapsed “More fill
controls” disclosure after a viewport change. Existing persistent gradient
session tests reproduced the missing canvas button, and now pass in both
browsers (`/tmp/retouch-stroke-gradient-ordinary-fixed-{chromium,webkit}.log`),
including consecutive gestures, restored focus, Done, exact individual history
and Escape during a pending save. Desktop packaging was not rebuilt.

### Authored gradient alignment checkpoint

Stroke alignment can now capture an existing local SVG linear or radial fill
or stroke gradient. It resolves basic local template chains, computed stop
colors and opacity, effective clamped stop offsets, SVG gradient transforms,
and color interpolation into the retained shape's private gradient definition.
The original definition and archived shape stay byte-for-byte intact, and
restoring the original shape restores its original reference. Other shapes
keep using the authored definition. The aligned shape becomes an independent
copy: later edits to the original shared gradient do not propagate to it.

Capture refuses ambiguous/missing/external definitions, cyclic templates,
animated gradient content, differing template-parent styles and CSS gradient
transform overrides. This is bounded SVG support, not arbitrary paint-server
or shared-style parity. Angular/diamond gradients, multiple fills/strokes and
an explicit gradient-transform inspector remain open. CSS rule inspection is
conservative and may refuse an override inside an inactive conditional rule.

Verification: 2,507 source tests passed with no failures/skips
(`/tmp/retouch-gradient-import-source.log`). Chromium and WebKit each passed
217 read-only snapshot checks and compared 312,000 rendered pixels, including
linear/radial fill and stroke, transformed/user-space gradients, linearRGB,
stop opacity, currentColor, single stops, local templates, unchanged shared
definitions and refusal cases (`/tmp/retouch-gradient-import-{chromium,webkit}.log`).
Each browser also passed 402 isolated conversion checks, including authored
gradients, inside/center/outside alignment, CSS collateral checks and preserved
page/form state (`/tmp/retouch-gradient-import-isolation-{chromium,webkit}.log`).
The focused inspector creation workflows passed for HTML, Liquid and React in
both browsers, with CSS/instance refusal, exact undo/redo, original restoration
and preserved document/form state (`/tmp/retouch-gradient-import-six.log`).
These focused workflows do not replace the preceding full editor regressions.
Desktop packaging was not rebuilt.

### Shared gradient paint opacity

Multiple aligned vectors now expose Fill and Stroke opacity when at least one
selected paint is a gradient. Typing a percentage sets every selected paint's
opacity; dragging or holding arrows on Mixed adjusts all values by the same
number of percentage points. The shared bounds stop when any paint reaches
zero or 100%, preserving the differences between selected paints. Escape and
zero-net gestures restore the preview without a source write. A completed
gesture is one atomic source edit and one undo entry.

This opacity multiplies the existing paint: gradient stop colors/alpha, stop
opacity, intrinsic solid-color alpha, gradient geometry and the other paint
stay intact. It works for both gradient-only selections and mixed solid/gradient
selections. Solid-only selections retain their existing effective-color-alpha
controls. Shared gradient stop/type editing remains open; selecting one vector
still exposes those controls. Same-file, single-rendered-instance and lock
requirements still apply to shared source edits.

Source verification passed all 2,510 tests without failures or skips in 16.72
seconds (`/tmp/retouch-shared-gradient-opacity-source.log`). New adapter tests
cover per-member opacity on mixed gradient/solid vectors, unchanged stop and
intrinsic-alpha data, independent fill/stroke opacity, zero/one boundaries,
invalid-member refusal without partial writes, canonical validation and exact
file undo/redo in HTML, React and Liquid.

The focused browser workflow can be run with `RT_STROKE_CREATE=1` and
`RT_STROKE_SHARED_GRADIENT_ONLY=1` on
`retouch/test/e2e/svg-stroke-controls.cjs`; it uses the same renderer/browser
fixture environment as the complete stroke workflow. The shared-gradient helper
also runs inside the complete mixed-vector-selection regression.

The complete HTML/Liquid/React stroke workflows passed in Chromium and WebKit
(`/tmp/retouch-shared-gradient-opacity-six.log`, individual logs
`/tmp/retouch-shared-gradient-opacity-controls-{renderer}-{browser}.log`). New
browser coverage verifies mixed solid/gradient and gradient-only fill/stroke
selections, absolute values, relative drags and held keys, boundary and zero-net
no-ops, Escape restoration, unchanged paint/gradient metadata, atomic CSS
refusal, exact undo/redo and retained document/form state. The same runs passed
existing stroke creation, geometry/path, paint, gradient, lock and transform
regressions. A focused HTML Chromium run passed as well
(`/tmp/retouch-shared-gradient-opacity-focused.log`). The light-theme controls
were visually inspected in `/tmp/retouch-shared-gradient-opacity-html-chromium.png`.
An initial run was intentionally stopped after identifying a test cleanup wait
for a gradient-only field after restoring solid paints; the final runs use the
correct solid-selection wait. Desktop artifacts were not rebuilt or launched.
