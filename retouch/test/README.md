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

## Browser end-to-end suite — `npm run test:e2e` (opt-in, slow)

Drives the real editor shell in a headless browser (Playwright) against a
running Retouch-instrumented dev server, then asserts the source on disk. It is
NOT part of `npm test` — it needs a browser and a dev server, and it is slow.
Run it deliberately, before a release or when changing shell interaction code.

Prerequisites:

1. A dev server running with Retouch (the dogfood clone: `cd unplastic-backbone/apps/website && PORT=3400 npm run dev`), serving the `/rt-test` rich-text fixture.
2. Playwright resolvable (from this package, the parent repo, or a global install).

Override the server URL with `RT_E2E_URL`.
