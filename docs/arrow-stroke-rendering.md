# Arrow stroke rendering

The legacy polyline arrow model changes dashed shaft appearance when a start
head is enabled. Existing arrows can now use **Convert to vector path** to
separate the shaft and heads into path sections while retaining the arrow
inspector. Drawing, Add arrow and Convert line to arrow now create paths directly.
Existing legacy polylines still require conversion; editing them does not yet
automatically migrate their representation.

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
pixels. The legacy mode exits **1** because those stored polylines are incorrect.
The current default gate validates the new path representation and exits zero.

```sh
RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture \
RT_E2E_LEGACY_ARROW=1 \
  node retouch/test/e2e/arrow-dashes.cjs

RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture \
RT_E2E_BROWSER=webkit RT_E2E_LEGACY_ARROW=1 \
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/retouch-playwright-browsers \
  node retouch/test/e2e/arrow-dashes.cjs
```

Logs: `/private/tmp/retouch-arrow-dashes-chromium.log` and
`/private/tmp/retouch-arrow-dashes-webkit.log`.

## Cause and implementation

The start-head polyline returns from the end of the shaft to its beginning
before drawing the start head. That extra traversal paints a second dash
pattern over the first. Adjusting the inspector controls cannot fix the
underlying topology.

The reference renders one shaft and separate undashed head polylines. It passes
the same pixel comparison in both engines. This proves a viable rendering
approach for the tested cases. Source-backed arrow paths now also pass all
108 shaft comparisons in both engines. Their head sections still inherit the
stroke dash pattern; independently styled solid or filled caps remain unfinished.

Conversion now preserves source layer identity, metadata children and unrelated
attributes. All three adapters recognize the resulting path and retain endpoint
selectors, dimensions, reversal and swap. The live conversion probe checks CSS
path overrides using browser-normalized coordinates and refuses active fills
or markers that would change appearance. Creation now uses this path representation. Legacy arrow edits still need
automatic migration, and separately styled cap shapes remain unfinished. A preview-only overlay would leave
the exported or served site incorrect. Additional cap shapes should build on
that representation rather than extend the retraced polyline.


## Converted-path gate

Run either command without `RT_E2E_LEGACY_ARROW` to validate current source
creation and require the path representation to preserve all shaft pixels.
The default gate exits zero in Chromium and WebKit while reporting the legacy
failures separately. It also asserts that the source insertion writer actually
creates an editable path.

Current logs: `/private/tmp/retouch-new-arrow-path-pixels-chromium.log` and
`/private/tmp/retouch-new-arrow-path-pixels-webkit.log`.
