# Fill sizing engine compatibility

Verified 2026-09-13 against source `ecd98313cce63696e60d0b2a7cfe1a0a8293ec8b`.
The current Liquid editor still reproduces the older WebKit failure: after shared
Height Fill, the flow child measures 180px instead of 170px with two 5px margins.
The full editor test exits 1; this remains an unresolved product failure.

`retouch/test/e2e/fill-engine.cjs` now isolates the underlying sizing behavior
without a server, source adapter, or Tailwind compiler. It covers 72 combinations:
horizontal and both vertical writing directions, normal flow/flex/grid,
content-box/border-box, both physical axes, and two parent sizes. Parent and child
padding/borders are included. It complements `flow-fill-compat.cjs`, which covers
percentage margins and changing margins in horizontal flow.

| Engine reported by Playwright | Cases passing | Result |
| --- | --- | --- |
| Chromium 145.0.7632.6 | 72/72 | Exit 0 |
| WebKit 26.0 | 60/72 | Exit 1 |
| WebKit 26.6 | 72/72 | Exit 0 |

All twelve older WebKit failures are normal-flow **block-axis** sizing. That is
height in horizontal writing and width in vertical writing. With content-box,
the measured border box is 10px too large; with border-box it is 14px too small
for this fixture. Flex/grid and the normal-flow inline axis pass. Switching box
sizing is therefore not a fix. A correction tied to the current pixel geometry
would also fail to preserve responsive source behavior.

WebKit's [upstream report](https://bugs.webkit.org/show_bug.cgi?id=300661)
describes the legacy height behavior. Its [stretch implementation tracker](https://bugs.webkit.org/show_bug.cgi?id=277117)
tracks standard margin-box sizing. These browser versions are Playwright engine
identifiers, not proof that an installed macOS WKWebView supports the same code.
Native verification remains necessary.

Run the matrix from the repository root:

```sh
RT_INSPECTOR_FIXTURE=/path/to/fixture node retouch/test/e2e/fill-engine.cjs
```

Select engines with `RT_E2E_BROWSER=webkit`; use `RT_E2E_PLAYWRIGHT_ROOT` and
`PLAYWRIGHT_BROWSERS_PATH` to select an isolated Playwright install/cache. A known
failure is deliberately not skipped or converted to a successful result.

Local evidence:

- `/private/tmp/retouch-fill-current-webkit.log`: current Liquid editor failure.
- `/private/tmp/retouch-fill-engine-chromium.log`: Chromium matrix.
- `/private/tmp/retouch-fill-engine-webkit.log`: older WebKit matrix and failures.
- `/private/tmp/retouch-fill-engine-modern.log`: newer WebKit matrix.

No production workaround or desktop rebuild is included in this investigation.
The next implementation must preserve margins, padding, borders, writing mode,
and responsive changes in saved source, including outside the Retouch preview.
