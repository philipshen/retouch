# Machine-wide command wrapping

Retouch can live outside the target repository. Run the project's existing
startup command from the root that contains the applications to be edited:

```sh
retouch -- npm run dev
retouch -- make everything
retouch -- ./scripts/start-local.sh
retouch doctor ./apps/website
```

For local Turbo dev tasks with environment filtering, pass the session
variables through the task configuration or use the existing CLI's loose
environment mode for that development invocation:

```sh
retouch -- pnpm turbo dev --env-mode=loose
```

Retouch does not rewrite commands or bypass environment filters. See the
[Turbo environment documentation](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)
for the distinction between passthrough variables and loose mode. Do not use
cached development-server tasks.

## How it works

`session.cjs` owns a loopback registration endpoint and one sidecar per real
application root. The child receives a random registration credential and a
`NODE_OPTIONS --require` preload. `preload.cjs` recognizes the config-loading
module from the project's installed Next.js. It leaves production and raw
config loads untouched and composes the evaluated development config.

The supported automatic release line is Next 16.2.x; browser verification
covers 16.2.5. This is a private API bridge, isolated in one module. Expanding
support requires running the launcher tests on each proposed release line.
No project source, manifest, lockfile, or config is patched during startup.
The framework may create its normal build caches.

Next children and worker restarts register with the same session. The same
root reuses a sidecar; different roots get distinct ports and browser tokens.
Registration refuses canonical paths outside the startup root. Writer ports
are allocated by the OS, not selected by assuming a fixed port is free.
SIGINT/SIGTERM reach the owned process group; remaining descendants are killed
on shutdown. Intentionally detached daemons and abrupt SIGKILL of the wrapper
are outside that graceful cleanup contract.

The browser still visits the app's `/rt` route and its original origin. App
startup, port selection, and any occupied-port behavior remain owned by the
original command. Retouch never kills a pre-existing process to take its port.
The session control endpoint is separate from the browser writer endpoint;
its credential does not appear in the editor shell.

The existing config-mode `withRetouch()` remains available. The new
`withRetouchSession()` and `RETOUCH_AUTO_NEXT=0` support explicit registration;
see the [package README](../retouch/README.md). That import must be resolvable.
Neither mode transports a host installation into Docker or a remote host.
Run Retouch inside that environment, next to its source and dev process.

## Limits

- Automatic instrumentation currently supports Next.js, not arbitrary bundlers.
- Vite React has an explicit `retouch/vite` plugin (Vite 8; see the package README). It is not injected automatically by the wrapper. Additional languages still need their own build integrations.
- Shopify retains `retouch shopify <theme-dir>` and its isolation protections;
  arbitrary `shopify` child processes are not intercepted.
- Windows process-group management is not implemented.
- Nonempty Next `basePath`/`assetPrefix`, unsupported Turbopack rule shapes,
  and explicit `/rt` source-route/rewrite conflicts produce errors.
- Conditional/dynamic routing and custom middleware can still intercept `/rt`;
  projects must reserve that route for the editor.
- `NODE_OPTIONS` or session variables removed by an orchestrator stop automatic
  registration. The CLI warns when no supported app connects.
- No public tap or registry publication was performed by this implementation.

## Installation and release

From the source repository:

```sh
node retouch/scripts/release.cjs /tmp/retouch-release
npm install --global /tmp/retouch-release/retouch-0.1.0.tgz
```

The release script copies distributable files into a temporary directory,
installs the locked dependencies with scripts disabled, generates a published
npm shrinkwrap, and packs the result. The source lockfile remains untouched.

For Homebrew, publish that tarball at an immutable HTTPS URL, compute its
SHA-256, and render the formula into an owned tap:

```sh
node retouch/scripts/homebrew-formula.cjs \
  https://YOUR-RELEASE-HOST/retouch-0.1.0.tgz SHA256 > retouch.rb
```

The formula installs under `libexec`, declares Node, links the command, and
includes stamping, shell-asset, and process-wrapper checks. This follows
[Homebrew's Node application layout](https://docs.brew.sh/Language-Specific-Formulae).
A real tap install/test is still required before publishing support claims.
The generator rejects missing URL/checksum inputs; no placeholder release is
silently published. Updating the formula upgrades the machine installation.
Finish active editing sessions before upgrading or cleaning an old keg.

## Verification

`npm test` in `retouch/` covers config composition, registration authentication,
root containment, app isolation, worker deduplication, argument/environment and
exit-code preservation, failed spawn cleanup, and descendant termination, in
addition to the existing core tests.

The opt-in browser fixture must be disposable and contain installed
Next 16.2.5, React, an npm `dev` script, `app/layout.jsx`, `app/page.jsx` with
`<h1 className="text-lg">Hello Retouch</h1>`, and an async `next.config.mjs`
that sets the response header `x-fixture: preserved`. It must have no Retouch
dependency or hook. Run:

```sh
RT_LAUNCH_FIXTURE=/absolute/path/to/disposable-fixture \
RT_PLAYWRIGHT_PATH=/absolute/path/to/playwright \
node retouch/test/launch/verify.cjs
```

The test runs shell → npm → Next CLI → dev worker for Turbopack and webpack,
drives a browser text edit to disk, observes an external source edit through
HMR, checks unchanged manifests/config, restores fixture source, and verifies
process shutdown. It uses ports 3488 and 3489; they must be free.

`RT_RETOUCH_CLI` can point to an installed CLI to run the same checks against a
packaged release. Separately, a wrapped production build was verified to have
no Retouch stamps in prerendered HTML or `/rt` rewrites in the routes manifest.


### Installed Vite startup verification (2026-09-17)

`retouch/test/launch/vite.cjs` checks the actual installed-package path through
`retouch -- npm run dev`, a TypeScript Vite config importing `retouch/vite`,
and React TSX. It creates its own temporary app and uses installed dependency
fixtures without changing their source. Run it against an installed tarball:

```sh
RT_VITE_FIXTURE=/absolute/path/to/vite-react-dependencies \
RT_INSPECTOR_FIXTURE=/absolute/path/to/playwright-dependencies \
RT_PACKAGE_ROOT=/absolute/path/to/installed/node_modules/retouch \
node retouch/test/launch/vite.cjs
```

Set `RT_E2E_BROWSER=webkit` to use WebKit and configure
`PLAYWRIGHT_BROWSERS_PATH` if its browser installation is outside the default
cache. The Vite dependency fixture needs Vite and `@vitejs/plugin-react`, React,
and React DOM. The Playwright fixture needs its selected browser installed.

Chromium and WebKit passed with Vite 8.3.0, `@vitejs/plugin-react` 6.1.1 and
React 19.2.0. The test verifies announced editor URL and service health, source
stamps, text write-back, hot-update state/document retention, normal process
shutdown, restart and exact persisted source undo, layer-label refresh, and
unchanged application manifest and Vite configuration. It checks the editor
port closes after each shutdown. This does not verify native WKWebView startup,
config-triggered Vite restarts, arbitrary frameworks, or trusted distribution.

The tested npm-packed source was `3c075ef8abb44ddca34289091d56f906d095bfcc`;
tarball SHA-256:
`b9feee599c1a144a4019cd3e388504c3b2118a1fcd2e357ad085175c2360ecc9`.
This is local packaged-install evidence, not a published release.
