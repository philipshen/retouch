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
strokes, multiple stroke fills and per-point settings remain incomplete. The
current cap/join controls are still selects rather than Figma's icon buttons.

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
