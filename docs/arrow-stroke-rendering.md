# Arrow stroke rendering

The legacy polyline arrow model changes dashed shaft appearance when a start
head is enabled. Existing arrows can now use **Convert to vector path** to
separate the shaft and heads into path sections while retaining the arrow
inspector. Newly drawn arrows still use polylines, so automatic migration remains
an open product defect.

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
or markers that would change appearance. The next step is to migrate creation
and legacy arrow edits automatically, then provide separately styled cap shapes. A preview-only overlay would leave
the exported or served site incorrect. Additional cap shapes should build on
that representation rather than extend the retraced polyline.


## Converted-path gate

Set `RT_E2E_ARROW_PATH=1` with either reproduction command to require the
converted path representation to preserve all shaft pixels. This mode exits
zero in Chromium and WebKit while still reporting the legacy failures. The
default mode retains the failing legacy-polyline assertion.

Logs: `/private/tmp/retouch-arrow-path-pixels-chromium.log` and
`/private/tmp/retouch-arrow-path-pixels-webkit.log`.
