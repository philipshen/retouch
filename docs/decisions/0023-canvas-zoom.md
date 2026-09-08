# DR-0023: Single-site canvas zoom

- Status: Accepted (rev 27)
- Date: 2026-09-07
- RFC reference: OQ-B3

The user requested zooming in and out, with neutral gray surrounding the site.
Use a single scaled site stage on a #808080 canvas. Toolbar controls step from
25% to 200%; clicking the percentage restores 100%. Preserve the iframe's
responsive viewport while zooming. Window resizing still resizes that viewport.
Center the site when it fits, and provide canvas scrolling when enlarged.

Scale the site and overlay coordinate space together. Compensate selection
borders, component badges, and edge hit targets to retain their screen size.
Divide resize pointer deltas by the canvas scale before snapping to Tailwind.
Do not change source files as a consequence of changing zoom.

Browser verification covers zoom in/out/reset, gray margins on all sides,
unchanged viewport dimensions, selection alignment, editing text at 50%, and
scale-correct resize preview/cancellation.
