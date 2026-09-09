# Tests

Two tiers, by design (see RFC-0001 and the user's testing direction).

## Fast unit + integration suite — `npm test`

Runs on Node's built-in test runner. No browser, no Next build. ~0.4 s for the
whole suite. Run it constantly.

| File | Covers |
|---|---|
| `id.test.cjs` | Structural IDs: host/instance classification, purity, stability across attribute edits, sibling-shift, hashing, parse errors. |
| `stamp.test.cjs` | The compile-time stamper: host/instance/fragment handling, `node_modules` and non-JSX skips, idempotence, source maps. |
| `writer.test.cjs` | Every op and every refusal: `setClasses`, `setText`, `setChildren` (rich text: wrap, keep-verbatim, delete, recurse), `setSrc`, escaping, stale-hash rejection, atomic writes, parse-safety. |
| `serialize.test.cjs` | The DOM→op-tree mapping (`serializeChildren`) against a tiny fake DOM: bold/italic wraps, kept stamped children, deletion, paste-artifact flattening, nesting. |
| `indexer.test.cjs` | The disk index: scan, ignored dirs, resolve, self-heal after external edits, parse-error tolerance, deletion. |
| `server.test.cjs` | The sidecar over real HTTP: token and `Host` checks, resolve, class write-back, upload. |

These are the guardrail. Keep coverage high here; the logic is pure and cheap
to test.

`inspector.test.cjs` checks base-class preservation and anchor geometry.
`components.test.cjs` covers local export resolution, props/defaults, module
detachment, source-hash refusals, rollback, and guarded two-file undo.

The disposable Next/Tailwind fixture in `test/fixtures/inspector` drives
`test/e2e/inspector.cjs` and `test/e2e/components.cjs`. Setup and coverage are in
[the inspector guide](../../docs/inspector.md#verification).

## Browser end-to-end suite — `npm run test:e2e` (opt-in, slow)

Drives the real editor shell in a headless browser (Playwright) against a
running Retouch-instrumented dev server, then asserts the source on disk. It is
NOT part of `npm test` — it needs a browser and a dev server, and it is slow.
Run it deliberately, before a release or when changing shell interaction code.

Prerequisites:

1. A dev server running with Retouch (the dogfood clone: `cd unplastic-backbone/apps/website && PORT=3400 npm run dev`), serving the `/rt-test` rich-text fixture.
2. Playwright resolvable (from this package, the parent repo, or a global install).

Override the server URL with `RT_E2E_URL`.

## Live Shopify / Moses verification

Start the installed CLI with `retouch shopify /path/to/moses --store=STORE`
and run Moses's `pnpm dev:css` in another terminal after `pnpm install --frozen-lockfile`.
For a source checkout, use `node retouch/bin/retouch.cjs` in place of `retouch`.
From `retouch/`, run `node test/e2e/shopify.cjs`.

This opt-in test uses agent-browser to edit the actual Moses development-toolbar
label and classes through the shell, checks the original Liquid on disk and
compiled CSS through the Shopify proxy, then undoes the edits. It restores the
original snippet even on failure. Use a disposable testbed without simultaneous
edits to that snippet. It requires browser/network access; override `RT_E2E_URL`
and `RT_THEME_DIR` for a different local Moses checkout or proxy port.
The same test works with a Homebrew-installed Retouch server.

`node test/e2e/shopify-sources.cjs` checks the Moses heading, locale label, and
richtext paths. It edits and undoes nested template settings and locale strings,
asserts exact source diffs, checks that sibling headings remain unchanged, and
verifies Shopify hot reload. It restores its JSON and snippet fixtures on failure.
`liquid-sources.test.cjs` covers origin validation, instance ambiguity, literal
alias chains, snippet arguments, locale selection, comments/format preservation,
placeholders, and stale-source rejection without a store.

`node test/e2e/spacing.cjs` checks that focusing Moses's heading preserves its
rendered dimensions and whitespace rules, restores inline styles on exit, and
sends no write operation when the text is unchanged.

`node test/e2e/max-width.cjs` drives a real pointer drag on a Moses container,
checks the property popup and snapped preview, verifies CSS refresh and one
class write, then checks exact undo and Escape cancellation. `max-width.test.cjs`
checks nearest-token snapping and preservation of other properties and variants.

`component-usage.test.cjs` checks source call-site counts for Liquid and React,
source-definition writes for single-use components, re-export aliases, and cache
invalidation. `node test/e2e/selection-chrome.cjs` checks the live Moses selection
colors, component badge/detach target, single-use selection, and edge cursors.
Set `RT_AGENT_BROWSER_BIN` to a local agent-browser executable to skip npx.

`node test/e2e/heading-typing.cjs` verifies a real click and native keyboard typing
on the Moses heading, exact backing JSON changes, rendered updates, and undo.
It accepts `RT_AGENT_BROWSER_BIN` and restores the JSON fixture on failure.

`node test/e2e/zoom.cjs` verifies pinch gestures, gray side margins, responsive
viewport preservation, stable viewport-height sections, unchanged CSS units, scaled
selection geometry, text focus, and correct drag snapping/cancellation at 50%. It accepts `RT_AGENT_BROWSER_BIN`.

`npm run test:e2e:zoom-anchor` starts an isolated HTML fixture and verifies
pointer anchoring through canvas/iframe wheel gestures at page top, middle and
bottom, in workspace and fixed-screen modes. It also checks immediate residual
page scrolling when zooming out reaches the canvas limit on a smooth-scrolling
site. Set `RT_INSPECTOR_FIXTURE` to a fixture with Playwright installed and
`RT_E2E_BROWSER=webkit` to use WebKit.
