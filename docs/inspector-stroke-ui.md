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
