# Arrow stroke rendering

The current polyline arrow model changes dashed shaft appearance when a start
head is enabled. This remains an open product defect, despite the passing
solid-stroke arrow editing and history tests.

The regression was run against source `9b8c0d6801f832c0a30285658a36f30936b19e10`.
It renders the actual `svg-parametric.js` point output into an SVG image and
compares the shaft's alpha pixels to an ordinary line with the same endpoints,
stroke width, dash pattern and dash offset. The sampled region excludes both
heads. No inspector, source adapter or editor overlay participates in this test.

| Engine | Current polyline | Independent head reference |
| --- | ---: | ---: |
| Chromium 145.0.7632.6 | 55 / 108 preserve shaft pixels | 108 / 108 |
| WebKit 26.0 | 55 / 108 preserve shaft pixels | 108 / 108 |

The matrix covers three shaft lengths, three dash patterns (including a
four-value pattern and fractional lengths), three dash offsets, and all four
start/end head combinations. All 53 failing cases have a start head; 53 of the
54 start-headed cases fail in each engine, changing as many as 47 sampled
pixels. Both commands exit **1** because the current renderer is incorrect.
The test must remain failing until the product representation is fixed.

```sh
RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture \
  node retouch/test/e2e/arrow-dashes.cjs

RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture \
RT_E2E_BROWSER=webkit \
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/retouch-playwright-browsers \
  node retouch/test/e2e/arrow-dashes.cjs
```

Logs: `/private/tmp/retouch-arrow-dashes-chromium.log` and
`/private/tmp/retouch-arrow-dashes-webkit.log`.

## Cause and implementation direction

The start-head polyline returns from the end of the shaft to its beginning
before drawing the start head. That extra traversal paints a second dash
pattern over the first. Adjusting the inspector controls cannot fix the
underlying topology.

The reference renders one shaft and separate undashed head polylines. It passes
the same pixel comparison in both engines. This proves a viable rendering
approach for the tested cases; it is not yet integrated into Retouch's source
writers or inspector.

The next implementation must separate shaft and head geometry in authored
source, preserve source layer identity and selection, retain independent head
parameters, and support exact undo/redo in HTML, React and Liquid. It must also
handle fill/stroke ownership and transforms. A preview-only overlay would leave
the exported or served site incorrect. Additional cap shapes should build on
that representation rather than extend the retraced polyline.
