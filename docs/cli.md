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
- Vite React and initial Vue SFC editing have an explicit `retouch/vite` plugin (Vite 8; see the package README for Vue's current limits). It is not injected automatically by the wrapper. Additional languages still need their own build integrations.
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
arbitrary frameworks or trusted distribution. Config-triggered restart recovery is covered by the later check below.

The tested npm-packed source was `3c075ef8abb44ddca34289091d56f906d095bfcc`;
tarball SHA-256:
`b9feee599c1a144a4019cd3e388504c3b2118a1fcd2e357ad085175c2360ecc9`.
This is local packaged-install evidence, not a published release.


### Vite public bases and uploaded images

The Vite plugin supports normalized public base paths, such as `/docs/`.
Opening `/rt` redirects to `/rt/docs/`, preserving query parameters and fragments;
explicit deeper editor paths continue to select the corresponding application
route. API and editor asset paths stay under `/rt`. Vite normalizes full-URL
and relative base configurations before the plugin runs, as described in its
[base documentation](https://vite.dev/config/shared-options.html#base).
Bases that collide with the editor's `/rt/` namespace are refused.

Uploads use the configured public directory and base-prefixed URL. Retouch serves
its generated upload files immediately to avoid an initial HTML fallback while
Vite's public-file inventory updates. Disabled public directories and writes
outside the project are refused. Other Vite files keep their normal serving path.

The browser fixture accepts `RT_VITE_BASE=/docs/` and
`RT_VITE_PUBLIC_DIR=static`. It verifies query/fragment retention, source edits,
exact undo, hot-update state/document retention, production exclusion, and
immediate uploaded SVG decoding in Chromium/WebKit. The installed-package launch
test also accepts `RT_VITE_BASE=/docs/` for startup and persisted undo checks.
These checks do not establish complete React editing or native-app parity.


### Vite setup diagnostics

`retouch doctor <app-directory>` reports the installed Vite version and, for
Vite 8 projects, the React version and default Vite config filenames. It explains
the explicit project-dependency/plugin setup, base-path support and local-host
requirement. Finding a config file is not reported as proof that Retouch is
configured. Unverified versions and unreadable package metadata are distinguished
from missing packages. The diagnostic reads metadata without evaluating Vite
configuration or starting the application; existing Next diagnostics remain.


### Vite configuration restart recovery

Vite replaces its Retouch writer when a configuration edit restarts the dev
server. An already-open editor now detects the changed writer session via its
health endpoint and reloads to obtain the current token and persisted history.
This check is enabled by the Vite plugin. Normal source HMR retains its existing
session and does not trigger this editor reload. The monitor retries through
brief server unavailability and stops its request/timer when the page leaves.

Set `RT_VITE_CONFIG_RESTART=1` on `retouch/test/launch/vite.cjs` to verify recovery
without manually refreshing the editor: edit source, change the Vite config,
wait for a new editor token, undo and redo, then stop/start the process and undo
again. This verifies saved source/history recovery; preserving unsaved drafts
through a configuration restart is not established.

### Vite connections inside the command wrapper

The explicit Vite plugin now notifies the active command session after its
writer starts. The authenticated broker validates the project root and records
the connection without creating another writer. Next's broker-owned writers
continue to use their existing registration path. This prevents the wrapper's
"no supported app connected" notices for a working Vite editor. If registration
fails, the plugin closes its writer before failing startup.

The installed Vite launch test checks that those false notices do not appear
through editing, configuration restart, normal process restart and shutdown.

## Capture a URL into an editable project

```sh
npx playwright@1.59.1 install chromium
retouch capture https://example.com --out ./captured-page --width=1440 --height=900 --responsive --open
# To reopen the saved copy later:
# retouch html ./captured-page
```

Capture uses a fresh browser session and waits for page load, web fonts (up to
three seconds), and an optional `--wait=1000` delay in milliseconds. The output
directory must not exist; its parent must exist. Width and height accept whole
numbers from 240 to 7680. The command saves `index.html` and a `capture.json`
record of the source URL, viewport, timestamp, asset results and known limitations.
Playwright is included in the package. Capture requires its matching Chromium
browser binary (`npx playwright install chromium` from the installed package).
`--open` starts the local editor on an available port after capture; Stop or
Ctrl-C closes it while preserving the saved copy. On first open, the editor
uses the captured viewport. The Screen menu includes **Captured size** to return
to that view; a saved preview choice, including **Fit workspace**, takes
precedence when reopening the project. Cancelling an unfinished
capture closes its browser and removes temporary output.

`--responsive` preserves loaded author stylesheets and inline CSS, including
media queries, fluid dimensions, flex/grid layouts and generated content.
It also keeps `srcset`, `sizes`, native lazy loading and `<picture>` source
conditions. Image candidates are saved locally so width and pixel-density
selection can continue offline; missing candidates are reported in the manifest.
In the HTML editor, select an image and use **Image candidate** to choose its
fallback or a responsive source. Apply a URL, browse project images, or upload
a replacement; each edit preserves the other candidates and sizing conditions.
For an ordinary image, open **Responsive images** to add its first candidate.
The original source stays as the fallback; density starts at 2× when a fallback
exists. Removing the last image candidate restores the plain-image controls.
Open **Candidate options** to add or remove candidates, or change their image
width or pixel density. Each source must use one resolution type with unique
values. An emptied source remains available in the new-candidate source picker.
Open **Artwork by screen** to create a picture source for a different image at
a chosen screen range, move sources earlier/later, or remove them. The first
matching source wins. A plain image is wrapped in a picture with display contents;
an unchanged generated wrapper is removed again with its last source.
Open **Source settings** to change a picture source’s screen range (all, up to,
from, or between widths), a custom media condition, image format, or display
sizes. These settings apply to every candidate in that source. Display sizes
guide width-based image selection; use image framing to resize the layer.
Undo restores the exact source, and comparison previews update in place.
Stylesheet responses are reused for cross-origin CSS and imports. The captured
DOM remains fixed: scripts, client-side route changes and conditional rendering
are not reconstructed. Shadow components and canvases retain captured styling.
The mode refuses an unavailable author stylesheet; omitting `--responsive`
uses the computed-style snapshot mode instead. The desktop source exposes this
choice as **Keep responsive layout** (enabled initially).

This is a rendered page-state import, not recovery of the original application.
JavaScript-rendered text, computed styling, generated before/after content, form
values and readable canvas pixels become literal editable HTML. Retouch's HTML
text/style editing and undo/redo operate on that copy. Original application
scripts, event handlers, embedded documents and form submission are not retained.
Capture does not reuse browser logins or modify the source site.

Referenced images, CSS images and recovered font definitions are saved under
`capture-assets/` and rewritten to local paths. Temporary blob images are read
before the capture browser closes. Repeated URLs download once, and identical
content shares a file. Downloads are limited to 256 assets, 10 MiB per asset,
100 MiB total and one minute. Missing, oversized or unsupported resources remain
remote and are reported in `capture.json` and the command output.

External SVG fragment IDs are preserved while sharing one saved resource.
Nested image, paint and stylesheet dependencies are resolved against the final
URL after redirects and embedded in saved assets, avoiding relative-path
ambiguity when an SVG is reused through `<use>`. Quoted CSS imports are included.
Dependency traversal is bounded to 16 ancestor URLs; cycles and unavailable
resources are listed in `unresolvedReferences` and per-asset dependency reports.
Browser restrictions on nested external `<use>` and SVG image documents still
apply; this does not guarantee arbitrary SVG pixel parity.

Font definitions also come from cross-origin stylesheet responses loaded by the
capture browser. Redirects, nested imports and active media/supports conditions
are preserved without refetching a potentially different stylesheet. Recovery
is limited to 256 stylesheet responses, 2 MiB each and 20 MiB total. Unavailable
responses are reported explicitly.

Web-component capture flattens open and script-created closed shadow roots,
including nested components and assigned/fallback slots, into editable HTML.
Shadow-local IDs and references are remapped to avoid collisions in the copy.
Adopted stylesheets contribute computed appearance and font definitions. The
original component scripts and encapsulation are not retained.

Current limitations: computed-style mode captures layout at one viewport.
Author-stylesheet mode preserves CSS responsiveness, but application logic and
script-driven layout changes are not reconstructed. Unavailable font stylesheet responses,
runtime-created fonts, unsupported SVG dependencies and declarative closed
shadow roots are not fully portable. Browser-owned shadow internals are not
exported. Standard form controls remain editable HTML controls, but native
appearance can differ after computed styles are serialized.
Cross-origin or otherwise unreadable canvases are reported as unavailable.
The desktop source includes **Open website…** with URL, canvas dimensions and
a save location, followed by automatic editor startup. Desktop builds bundle
matching Apple Silicon and Intel capture browsers. Native UI operation and
trusted distribution still require separate verification.
