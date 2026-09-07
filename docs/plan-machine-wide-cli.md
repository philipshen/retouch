# Machine-wide Retouch CLI

Original proposed plan, 2026-09-04. Superseded in part by the accepted command-wrapper design in [DR-0016](decisions/0016-command-wrapper.md). See [the implemented CLI](cli.md) for current behavior and verified scope. The launcher-owned startup design below is retained as planning history.

Retouch should be installed once per machine and invoked from a supported project. Homebrew is a suitable distribution channel. The npm package can remain the implementation and an alternative distribution channel; users should not have to add it to their application's dependencies.

The important change is a launcher that owns an editing session. Packaging alone does not remove the current Next.js config requirement. "Any project" means any locally accessible project with a supported language and build integration, with its normal prerequisites already installed. It does not mean arbitrary websites or arbitrary build systems.

## Proposed experience

```sh
# Proposed commands; the tap and general launcher are not published yet.
brew install <owner>/tap/retouch

cd ~/code/my-app
retouch
# Detects the app, starts its instrumented development server,
# and prints the editor URL on the app's usual localhost origin.

retouch ./apps/website           # explicit application in a monorepo
retouch shopify ~/code/my-theme  # retain the existing explicit mode
retouch doctor .                # report toolchain, versions, and blockers
```

Retouch starts the development server for that session. An already-running, uninstrumented React server must be restarted through Retouch. A proxy cannot recover the structural source IDs needed for deterministic writes. If the requested port is occupied, fail with instructions; never kill another server or silently change the origin.

Project dependencies, environment, services, and Shopify authentication remain prerequisites. A generic `retouch -- npm run dev` promise is deferred: arbitrary scripts can start multiple apps, run prerequisites, or hide the bundler in another process.

## Evidence from this repository

| Finding | Evidence | Implication |
|---|---|---|
| The package already exports a command | `retouch/package.json`, `retouch/bin/retouch.cjs` | No language rewrite or standalone executable is necessary. |
| Shopify already launches against an external directory | `retouch/src/shopify.cjs:start` | Machine-wide use fits an existing integration. |
| Next couples config transformation and server startup | `retouch/src/next.cjs:withRetouch` | Separate these responsibilities so the launcher can own lifetime. |
| Loader location is already absolute | `require.resolve('./loader.cjs')` in `next.cjs` | Package-relative resolution is suitable; external-path acceptance by each bundler still needs testing. |
| Indexing and writing accept an explicit project root and adapter | `retouch/src/server.cjs`, `retouch/src/adapter.cjs` | The core does not need to be installed in the target project. |
| Zero-repository-change launch mode was already accepted | DR-0001 and DR-0002; README lists launch mode as unimplemented | This completes an intended adoption path. |

The Next dogfood currently has a `retouch` dependency in `apps/website/package.json`, an import in `next.config.ts`, and a wrapped export. Those are concrete pieces of project state the launcher can eliminate.

### Executed feasibility check

Using the current working tree, I ran `npm pack`, installed the resulting tarball with `npm install --global --prefix <temporary-prefix> --ignore-scripts --no-audit --no-fund`, and invoked the installed executable from a separate empty directory.

- Installation exited successfully.
- The installed CLI executed successfully and printed its current Shopify/config-mode usage.
- The installed React adapter stamped a JSX string with `data-rt` successfully.
- The unrelated directory remained empty; it had no Retouch dependency or config.
- Temporary installation and fixture were removed afterward.

This proves package relocation and dependency resolution for the CLI and stamper. It is not a Homebrew installation test, a Shopify account test, or an end-to-end Next launcher test.

Initial baseline `npm test`: 79/80 passed. The existing Shopify flag test expects `--port` to be accepted, whereas the working-tree implementation refuses it. Reconcile that expectation with the isolation requirement before releasing; do not weaken the guard merely to pass the test. Source and test files changed externally during this investigation. A final rerun also failed a newly present theme-watcher synchronization test. These are observations of an evolving working tree, not a stable release baseline. This task changed only this plan; all implementation edits were left untouched.

## Architecture

Keep one package and the existing language adapters. Add a small session layer and build integrations, without a background daemon or plugin marketplace.

```text
machine-installed retouch
  -> detect explicit application root and local toolchain version
  -> session: root, ports, token, child processes, cleanup
     -> build integration: Next.js / Shopify / later Vite
     -> existing editor + index + language adapter + writer
```

The application owns its framework version. Retouch owns its parser, writer, shell, and integration code. Resolve Next/Vite from the selected application, including workspace resolution, instead of shipping a global framework version. Keep Retouch's modules resolvable from its installation directory; avoid global `NODE_PATH` changes.

Use Homebrew's runtime for the CLI, and preserve the project's supported runtime/environment for framework children where required. Check runtime compatibility and show which executables will run. A Homebrew Node upgrade must not silently force every target onto an incompatible application runtime.

## Implementation sequence

### 1. Prove Next launch injection before promising general support

Start with the installed dogfood Next version and both Turbopack and webpack. Build a disposable fixture with no Retouch dependency or config wrapper.

First investigate the documented programmatic `next({ dir, dev, conf, ... })` entry point, loading the project's own config with its phase semantics and composing Retouch in memory. Verify the config reaches the actual compiler, router, and workers. In the installed Next source, `NextCustomServer.prepare()` calls `getRequestHandlers()` without forwarding `conf`, while another config path consumes `options.conf`. Consequently, simply passing a config object is not yet a proven solution.

If the public API cannot preserve the normal development path, implement a narrowly version-gated child-process bootstrap around the project's native Next CLI/config-loading seam. Keep private API usage in one compatibility module; propagate the injection only to session-owned processes and account for worker restarts. Do not edit the project's config temporarily: crashes, watchers, and concurrent sessions make restoration fragile.

Gate: rendered IDs resolve and write back correctly, Fast Refresh works, existing headers/rewrites survive, and starting/stopping adds no Retouch-specific files to the project. If this requires broad monkey-patching, retain config mode for that version and report it as unsupported for launch mode. The elegance claim depends on this gate passing.

### 2. Separate composition from session lifetime

Extract a pure Next config composer from `withRetouch`; retain `withRetouch` as a compatibility wrapper. Preserve config functions/promises, phase evaluation, TypeScript/ESM/CJS loading, webpack hooks, rewrite forms, and existing loader rules. Current Turbopack composition overwrites matching `*.tsx`/`*.jsx` rules; define and test chaining rather than copying that behavior.

Add a session owner for start, readiness, child failure, signals, and cleanup. Reuse the existing writer and shell. Preserve same-origin `/rt` routing and detect route conflicts. Set roots and session metadata explicitly instead of relying on mutable process-global defaults.

Replace the fixed sidecar-port assumption and the current silent `EADDRINUSE` handling with allocated session ports and verified ownership. Two projects must never accidentally share the first project's writer. Release listeners, index watchers, child processes, and temporary theme copies after success, failure, or interruption.

### 3. Ship the CLI for Next.js and Shopify

Implement root detection, `--help`, `--version`, `doctor`, explicit integration selection, port selection, and actionable unsupported-version errors. At a monorepo root with multiple candidates, require an explicit app path. Report the real source root, toolchain version, and editor URL.

Move Shopify under the session lifecycle while preserving its development-theme restrictions, original-source index, and stamped temporary copy. Missing CLI or upstream startup failure should fail the session clearly. Address websocket forwarding separately from package relocation; the current proxy is HTTP-only.

Keep supported launch contracts narrow. Do not claim that detecting JSX or a `package.json` makes an arbitrary stack supported. Add Vite/React as a subsequent integration, with its own config/HMR verification.

### 4. Package and distribute

Publish one versioned release artifact containing `bin/`, `src/`, `shell/`, license, and user documentation. Declare supported Node versions and an explicit package file allowlist. Make the installed dependency tree reproducible: do not assume a development `package-lock.json` pins transitive dependencies of a global tarball install; choose and verify shrinkwrap or an equivalent locked release assembly.

Create an owned Homebrew tap first, with an immutable release URL, SHA-256, declared Node dependency, private `libexec` install, and linked executable. This is the standard Homebrew pattern for Node CLI applications. Keep the same artifact usable by npm global install or npx. Do not depend on acceptance into `homebrew/core`.

Add a functional formula test that stamps/resolves a fixture and exercises the packaged shell assets, alongside version/help checks. Verify clean installs and upgrades on the advertised macOS architectures and Linux if advertised. Keep active session paths stable across upgrades; do not resolve a new release's loader halfway through a session.

### 5. Migrate and document

After the Next acceptance gate passes, migrate the dogfood by removing the dependency, config import/wrapper, and corresponding lockfile entries through its package manager. Confirm its ordinary dev/build flow still works and that `retouch` supplies editing separately.

Keep config mode for teams that want project-pinned tooling or unsupported launch environments. Publish a tested toolchain/version matrix. Once accepted, update the canonical RFC HTML first, mirror the Markdown, add a decision record, and revise the README according to repository documentation rules.

## What makes it more elegant—and how to prove it

Elegance here means less persistent project state and fewer responsibilities crossing the app/tool boundary, while preserving editing behavior. It does not mean fewer total lines in Retouch.

| Measure | Current Next config mode | Proposed machine-wide launch mode |
|---|---|---|
| Per-project Retouch dependency entry | Required | Zero |
| Per-project Retouch lockfile state | Required when locked | Zero |
| Per-project Retouch config edits | Import + wrapped export | Zero |
| Retouch activation | Every development start with the wrapper | Explicit editing session |
| Upgrade across N projects | Update N project dependency resolutions | Upgrade one machine installation |
| Normal build loads Retouch config module | Yes, even though production wrapping is a no-op | No Retouch import |
| Shared team version | Naturally pinned in the project | Requires release/version discipline; config mode remains useful |
| Framework integration maintenance | Explicit user registration | Retouch maintains launcher compatibility |

The reduction from N integration sites to zero is a direct consequence of keeping all Retouch installation and registration outside those projects. Our relocation experiment establishes that the core can support that boundary. End-to-end launch equivalence remains to be demonstrated.

Release acceptance should compare config mode and launch mode on equivalent disposable fixtures:

1. Launch and stop without an edit: source, manifests, lockfiles, and configs are byte-identical before/after; allow only normal declared framework build caches. No Retouch-specific untracked artifacts remain.
2. Edit text and classes, undo, and inspect the actual source diff. Both modes must produce equivalent edits, preserve structural-ID resolution, and refuse stale/dynamic unsupported writes.
3. Exercise server/client components, navigation, HMR, async config, environment loading, existing rewrites/headers, and custom loaders. Check normal-origin cookies/storage and test `/rt` collisions.
4. Run two projects concurrently with separate roots, tokens, and sidecars. A session must not resolve/write the other project's files. Test occupied ports, failed children, and interruption cleanup.
5. Exercise npm and pnpm workspaces, paths containing spaces, external loader paths, and supported Node versions. Explicitly exclude untested resolution modes such as Yarn PnP until supported.
6. Run an ordinary production build after the launch session. It must contain neither Retouch stamping nor editor routes. Test lifecycle cleanup independently of the normal production no-op guard.
7. Install the release through the actual tap on a clean machine and repeat the supported fixture flow. Record startup overhead relative to config mode, with an agreed regression budget before release.

## Assessment

High confidence: installing Retouch once is feasible, requires no core rewrite, and removes measurable project-level setup. Shopify already has the appropriate launch shape. Homebrew packaging is a small part of the work.

Medium confidence until the spike passes: zero-config Next launching with full config and HMR fidelity. That compatibility work is the dominant engineering risk. Implement the spike first, then lifecycle/CLI work, then packaging and migration. A reasonable planning estimate is 1–2 days for the spike and roughly 1–2 additional engineer-weeks for a bounded release, contingent on the spike; broader framework/version coverage is separate work.

## External references checked

- [Homebrew language-specific formula guidance](https://docs.brew.sh/Language-Specific-Formulae): Node applications under `libexec`, runtime declaration, immutable sources, and functional tests.
- [Next.js custom server API](https://nextjs.org/docs/app/guides/custom-server): documented programmatic entry point and config option; local code inspection above explains why documentation alone does not establish dev-worker injection fidelity.
- [Next.js Turbopack configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack): loader configuration surface whose behavior must be covered by the supported-version tests.
