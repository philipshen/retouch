# Stroke inspector reference

Reference reviewed September 13, 2026:
[Figma: Apply and adjust stroke properties](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties),
including its light-theme endpoint and advanced-stroke screenshots.

The SVG Stroke section now keeps Weight next to an advanced-settings icon.
Caps, joins, dashes, offset, miter limit and scaling live in a floating light
panel beside the inspector. Escape and the close button restore focus to the
opener; clicking outside dismisses it. The panel follows inspector scrolling,
stays inside the viewport, and releases its listeners when its selection is
replaced. Its real controls remain inside the inspector DOM so existing source
writes, focused-field restoration and screen scopes continue to work.

Start point and End point appear side by side, with labels above the controls.
Retouch's additional head dimensions are grouped under Arrowhead sizes. Reverse
and swap remain available below them.

This moves the layout toward the reference; it does not establish pixel parity.
Figma's additional cap types, stroke positions, width profiles, brush/dynamic
strokes, multiple stroke fills and per-point settings remain incomplete. Cap/join controls now use icon buttons for the supported standard values.

Validation: 1,151 unit tests; HTML and React Chromium and Liquid WebKit stroke
workflows cover base/scoped values, screen fallback, reset and exact Undo/Redo.
The HTML arrow workflow covers both endpoint controls, dimensions, reverse,
swap and exact history after legacy migration. Screenshots were inspected:
`/private/tmp/retouch-stroke-popover.png` and
`/private/tmp/retouch-arrow-controls.png`.

## Stroke style controls

Solid, Dashed and Custom now appear in Stroke settings. Dashed exposes separate
Dash and Gap fields, preserving numeric, pixel and percentage lengths. A
single-value SVG dash pattern supplies both initial fields. Switching a custom
pattern to Dashed retains its first dash and gap; Solid writes `none`. Opening
Custom only changes the editor view until a pattern is entered. Its editing
preference resets when the selected layer or style screen scope changes.

The controls use the existing SVG paint writer and reset action; they do not
write extra markup or alter cap/join properties. Inline-owned fields retain
the existing disabled state. Negative lengths and malformed multi-value input
in either individual field are rejected before a source write.

Validation: 1,152 unit tests. HTML/React Chromium and Liquid WebKit cover style
changes, a four-value custom pattern, percentage gaps, invalid lengths, scoped
patterns, screen fallback, reset and exact Undo/Redo. The HTML screenshot
`/private/tmp/retouch-dash-controls.png` was inspected. This does not implement
Figma's half-dash endpoint rendering rule or independently styled dash caps.

## Cap and join icon controls

Caps now offers None, Square and Round as illustrated buttons. Join offers
Miter, Bevel and Round. Each group has one tab stop; arrow keys and Home/End
move focus, and Enter/Space apply the focused option. Accessible names and
pressed states identify the options. Focus returns to the same option after
the source refresh. Reset and screen-specific overrides retain their existing
source operations and history.

The underlying selects remain as event targets but are hidden from keyboard
and accessibility navigation when the buttons are available. An unrecognized
current value retains its select. Inline-owned properties disable the buttons.

Verified with 1,152 unit tests and HTML/React Chromium plus Liquid WebKit stroke
workflows. Browser coverage includes keyboard selection, focus after writes,
base/scoped cap and join changes, screen fallback, reset and exact Undo/Redo.
Screenshot inspected: `/private/tmp/retouch-stroke-icons.png`.

The keyboard regression exposed a popup timing bug in React and WebKit: the
focus target could be rebuilt while its settings panel was still invisible.
The panel now uses the `hidden` state until positioned, so the existing focus
observer retries when the controls become available. Final browser logs are
`/private/tmp/retouch-stroke-icons-{html,react,liquid}-final.log`.

## Compact SVG paint rows

SVG Fill and Stroke now combine the swatch, paint-type dropdown, color value
and color opacity on one row. The former Type and Color label rows are removed.
Standard sRGB colors show a short hex label at rest; Display P3 is identified
explicitly. Focusing the value field still exposes its full CSS value. The
swatch opens the existing color picker, and the type dropdown retains gradient
creation and its source-ownership checks.

The percentage field edits the color's alpha through the existing paint writer.
It preserves sRGB/Display P3 channels and does not convert color spaces. Layer
opacity and separate SVG fill-opacity/stroke-opacity still compose with that
alpha; this control does not flatten those independent properties. Contextual
colors that cannot be parsed retain their raw value and disable alpha editing.
Existing inline-source restrictions are reflected by the new field.

Validation: 1,152 unit tests; HTML/React Chromium and Liquid WebKit workflows
cover fill/stroke alpha, invalid percentages, base/scoped values, screen fallback,
reset, exact Undo/Redo and Display P3 channel preservation. HTML gradient creation
still covers both paint types, linear/radial gradients and exact history cleanup.
Screenshot inspected: `/private/tmp/retouch-compact-paints-final.png`.
Logs: `/private/tmp/retouch-compact-paints-{html,react,liquid}-final.log` and
`/private/tmp/retouch-compact-paints-gradients.log`.

## Website background and border paint rows

The same compact control now applies to CSS background and border colors on
ordinary HTML, React and Liquid elements. Fill and Stroke expose color-alpha
fields alongside the swatch/value, using the existing CSS and color-override
writers. The full CSS value is available on focus, and picker preview/cancel
continues through the existing handlers.

The `RT_E2E_CSS_PAINT_ROWS=1` page-fonts workflow uses a visibly filled heading
with a three-pixel border. It covers RGB border and Display P3 background alpha,
invalid percentages, tablet-only overrides with phone fallback, scoped resets,
exact source Undo/Redo and picker cancellation. Computed-channel comparisons
allow the observed six-decimal browser serialization; source-history comparisons
remain exact. HTML/React Chromium and Liquid WebKit pass. The existing HTML SVG
stroke workflow also passes after sharing the implementation.

Screenshot inspected: `/private/tmp/retouch-css-paints.png`.
Logs: `/private/tmp/retouch-css-paints-{html,react,liquid}-verified.log`,
`/private/tmp/retouch-css-paints-svg-regression.log`, and
`/private/tmp/retouch-css-paints-units.log` (1,152 passing unit tests).
The latest desktop archive predates this generalization.

## Different colors on each border edge

Border paint now reads the complete CSS shorthand rather than just the top
edge. The field accepts one to four literal colors, including RGB and Display
P3 functions. Its swatch shows the edge colors and its label shows Mixed when
they differ. Different initial alpha values show a Mixed opacity placeholder.
Entering one opacity preserves each edge's color channels and color space and
writes one shorthand in one source transaction.

The shared CSS validator, React/Liquid color-class writer and inspector accept
this shorthand. The HTML writer uses the same validation. Malformed lists,
more than four colors and mixed variable/literal lists are refused. Ordinary
single-color behavior remains supported. This does not add independent
per-edge opacity controls or full Figma individual-stroke authoring.

`RT_E2E_CSS_PAINT_ROWS=1 RT_E2E_CSS_PAINT_SIDES=1` verifies four differently
colored edges with different initial alpha values. HTML/React Chromium and
Liquid WebKit pass channel/space preservation, shared alpha changes, responsive
scope/fallback, reset and exact source Undo/Redo. All 1,154 unit tests pass,
including real React API history and HTML shorthand validation.
Screenshot inspected: `/private/tmp/retouch-border-sides.png`.
Logs: `/private/tmp/retouch-border-sides-{html,react,liquid}.log` and
`/private/tmp/retouch-border-sides-units.log`.

## Direct hex entry

Compact paint fields accept three- or six-digit hex without `#`, preserving
color opacity. Border shorthand edits preserve the independent alpha of each
edge while replacing its color channels. Eight-digit hex explicitly supplies
alpha. Hex denotes sRGB; explicit CSS input (including `#`, RGB and Display P3)
keeps its existing semantics. The full CSS value still appears on focus, so this
is not yet Figma's complete color-format editing UI.

Browser coverage exercises Enter to commit, invalid input refusal, Escape to
cancel, shorthand/explicit-alpha entry, and exact source Undo/Redo. It also
checks that a border edit following invalid input preserves all four edge
opacities. This exposed queued Tab focus being restored during trusted input
that had no preceding keyboard/pointer event. Trusted input now clears that
queued destination; synthetic events used by inspector controls retain it.

HTML/React Chromium and Liquid WebKit pass in
`/private/tmp/retouch-hex-{html,react,liquid}-verified.log`.
The HTML SVG stroke workflow also passes in
`/private/tmp/retouch-hex-svg-verified.log`; the initial invocation omitted the
SVG fixture flag and stopped before selecting a shape. All 1,154 unit tests
pass in `/private/tmp/retouch-hex-units-final.log`. No desktop archive was rebuilt
for this change.

## Individual border widths

CSS Stroke now offers an Individual edges group with Top, Right, Bottom and
Left widths and independent reset buttons. HTML uses the existing longhand
writer and CSS length validation. React/Liquid write physical edge utilities,
retain unrelated edge/color/style classes and screen variants, and preserve
important priority from the current or inherited border declarations. Editing
an edge whose style is `none` in the class adapter adds a solid style on that
edge. The existing all-edge Weight control replaces individual width overrides.
The group remembers its expanded state during source refreshes.

The browser fixture verifies unequal widths, a zero-width edge, invalid negative
input, a tablet-only left edge with phone fallback, independent resets, replacing
individual widths with one weight, and exact source Undo/Redo. React and Liquid
start with an important width shorthand. Computed border colors and styles are
checked after width edits. Source-level coverage also checks default-width edge
utilities, arbitrary longhands, inherited priority and scope preservation.

This provides physical CSS box edges, not Figma inside/outside stroke alignment
or per-segment vector strokes. The desktop archive has not been rebuilt.

Validation: 1,155 unit tests in
`/private/tmp/retouch-border-edges-units-final.log`; HTML/React Chromium and
Liquid WebKit in `/private/tmp/retouch-border-edges-{html,react,liquid}-final.log`.
Screenshot inspected: `/private/tmp/retouch-border-edges.png`.

## Revealing missing border edges

Entering a positive literal width on an edge whose computed style is `none`
now also writes `solid` on that edge. HTML writes width and style in one CSS
change set; React/Liquid use one class update. Undo restores both together.
The all-edge Weight control enables only missing edges and preserves existing
dashed, dotted or double styles. A zero width does not enable an edge.

The HTML validator now accepts individual border styles, and a later
`border-style` shorthand clears older managed style longhands in that scope.
The browser fixture starts with missing top/left edges, a dashed right edge,
and a double bottom edge. It checks zero as a no-op, visible top creation,
tablet-only left creation with phone fallback, all-edge width changes retaining
styles, a later all-edge style change, and exact source Undo/Redo.

This does not infer the resolved width of arbitrary CSS variables before a
write. Width reset continues to reset the width property; use Undo to reverse
the complete creation transaction. Full inside/outside stroke alignment and
native desktop verification remain separate unfinished work.

The installed Tailwind compiler does not generate `border-t-solid` and related
edge-style names. Class adapters now emit explicit property utilities such as
`[border-top-style:solid]`, verified in the rendered React/Liquid fixtures.
The initial class fixtures failed before editing because their edge-style names
were unsupported; they now use the same supported explicit-property syntax.

Validation: 1,156 unit tests in
`/private/tmp/retouch-border-visibility-units-final.log`; HTML Chromium in
`/private/tmp/retouch-border-visibility-html-final.log`; React Chromium and
Liquid WebKit in `/private/tmp/retouch-border-visibility-{react,liquid}-verified.log`.

## Individual border styles and mixed values

Individual edges now pairs each width with a style selector and separate reset
buttons. HTML writes style longhands; React/Liquid use explicit CSS-property
utilities. The all-edge Style selector shows a disabled Mixed placeholder when
the computed edge styles differ, including when an authored all-edge style has
been overridden on one edge. Choosing one style sets all edges; resetting an
individual override reveals the broader style again.

The border-visibility browser workflow now also covers a tablet-only right-edge
style, phone fallback, scoped reset, uniform-to-mixed-to-uniform transitions,
and exact source Undo/Redo across width and style changes. The light-theme
layout was inspected in `/private/tmp/retouch-edge-styles.png`.

Validation: 1,156 unit tests in `/private/tmp/retouch-edge-styles-units-final.log`;
HTML/React Chromium and Liquid WebKit in
`/private/tmp/retouch-edge-styles-{html,react,liquid}-final.log`.
This changes CSS box-edge controls; vector stroke alignment, full Figma UI
parity and a refreshed desktop archive remain unfinished.

## Shared floating stroke layout

Website Stroke now follows the same primary layout as SVG: paint first, followed
by Weight and an advanced-settings icon. Style and Individual edges live in the
floating Stroke settings panel. Existing controls are moved intact, retaining
source writers, responsive scopes, reset actions and focus restoration. CSS
and SVG panels use separate expansion preferences. Escape restores focus to
the settings opener; an outside click dismisses the panel.

Unequal HTML border widths now show Mixed in the primary Weight field, matching
the class adapter instead of displaying a clipped shorthand. Individual widths
remain visible in settings. Entering one primary width still replaces all edges.

HTML/React Chromium and Liquid WebKit edge-style workflows pass, including
paint-first order, panel dismissal/focus, screen fallback, mixed values, resets
and exact source history. The HTML SVG stroke workflow passes after sharing the
popup helper. Screenshot inspected:
`/private/tmp/retouch-css-stroke-popup-final.png`.
The current desktop archive predates this layout change.
Logs: `/private/tmp/retouch-css-stroke-popup-html-final.log`,
`/private/tmp/retouch-css-stroke-popup-{react,liquid}.log`,
`/private/tmp/retouch-css-stroke-popup-svg.log`, and
`/private/tmp/retouch-css-stroke-popup-widths.log`.
All 1,156 unit tests pass in
`/private/tmp/retouch-css-stroke-popup-units-final.log`.

## Small-window popup behavior

Stroke settings observes its own size while open, so expanding edge controls
repositions the panel inside the viewport. The size observer is disconnected
with the existing popup listeners. The header stays visible while the contents
scroll, keeping Close reachable. In the compact workspace, an open stroke
panel is above the bottom tool dock so the dock cannot intercept its inputs.

`RT_E2E_STROKE_POPUP_LAYOUT=1` exercises a 1000 x 280 workspace: open the compact
Inspector, expand edges, verify panel bounds, force actual scrolling, verify
Close remains visible, and hit-test the bottom input above the dock. Collapsing
and closing restores opener focus without changing source. The workflow then
returns to the larger window and runs responsive edge edits and exact history.
Screenshot inspected: `/private/tmp/retouch-stroke-popup-small-final.png`.
The current desktop archive predates these popup changes.
Validation: HTML/React Chromium and Liquid WebKit pass in
`/private/tmp/retouch-stroke-popup-layout-{html,react,liquid}-verified.log`;
the HTML SVG regression passes in
`/private/tmp/retouch-stroke-popup-layout-svg.log`.
All 1,156 unit tests pass in
`/private/tmp/retouch-stroke-popup-layout-units-final.log`.

## Stroke field keyboard drafts

CSS border widths (all-edge and individual), SVG stroke width, dash pattern,
dash/gap lengths, offset, miter limit and compact paint opacity now use the
existing field-draft behavior. Enter commits by blurring the field. Escape
restores its initial display value, clears custom validity and blurs without
writing source. This includes a blank Mixed width or opacity. Existing drag
cancellation and input validation remain in place.

Browser coverage now cancels width and opacity drafts, commits width/opacity
and dash edits with Enter, and verifies exact source Undo/Redo. CSS border
width coverage includes cancelling a mixed all-edge width before replacing it.
SVG coverage includes base/scoped widths and cancelling individual dash drafts.
The desktop archive has not been rebuilt for these keyboard changes.
Validation: 1,156 unit tests in `/private/tmp/retouch-stroke-keyboard-units.log`;
HTML/React border widths in `/private/tmp/retouch-stroke-keyboard-html.log` and
`/private/tmp/retouch-stroke-keyboard-widths-react.log`; HTML and Liquid/WebKit
CSS paints in `/private/tmp/retouch-stroke-keyboard-paints-{html,liquid}.log`;
HTML/React Chromium and Liquid WebKit SVG controls in
`/private/tmp/retouch-stroke-keyboard-svg-{html,react,liquid}.log`.

## Calculations in stroke and opacity fields

Stroke widths, individual dash/gap lengths, dash offset, miter limit and compact
paint opacity accept arithmetic using the same bounded parser as vector geometry.
Examples: `2 * 3`, `(12 + 4) / 2`, and `(2 + 3)px`. A trailing unit applies to
the complete result; omitted units retain the field's current unit, with pixels
as the default for an empty CSS border-width field. Pixel number fields and
opacity percentages reject other units. Existing CSS writers still validate
non-calculation syntax and the final value. Dash-pattern lists remain list fields.

The parser supports numbers, parentheses, arithmetic and powers; it does not
execute JavaScript. Invalid expressions, division by zero and out-of-range
numeric results are refused before writes. Ordinary CSS shorthand/variable
syntax is passed to its existing validator instead of being evaluated.

Former number fields retain Up/Down adjustment (Shift uses ten-unit steps).
Repeated keydown events update the field; key release commits one transaction.
Escape cancels, and blurring finishes a pending adjustment. Browser tests check
that repeated arrow presses make no intermediate source writes and that one
Undo restores the prior opacity. Enter/Escape and responsive history tests now
use arithmetic for widths, SVG values and opacity. The desktop archive predates
this calculation support.
Validation: 1,157 unit tests in `/private/tmp/retouch-stroke-math-units.log`;
HTML/React width calculations in
`/private/tmp/retouch-stroke-math-widths-{html,react}.log`; HTML and Liquid/WebKit
opacity calculations and grouped key changes in
`/private/tmp/retouch-stroke-math-paints-{html,liquid}.log`; HTML/React Chromium
and Liquid WebKit SVG calculations in
`/private/tmp/retouch-stroke-math-svg-{html,react,liquid}.log`.
