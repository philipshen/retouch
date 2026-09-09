# Retouch for macOS

A native AppKit window hosts the same Retouch editor used in the browser.
macOS 13 or later; universal Apple Silicon and Intel binary.

The current local artifact packages editor commit `4c49f9f`, including React
responsive anchors, canvas movement/resizing, alignment snapping and equal-spacing
suggestions. All 82 packaged source files, universal architectures, strict ad hoc
signature, built-bundle launcher tests and an isolated Homebrew install/uninstall
were verified. All 15 HTML workflows passed against bundled code in Chromium and
WebKit; the bundled React positioning workflow passed in Chromium. Native UI
inspection returned `cgWindowNotFound`. The quarantined installed self-test timed
out after 45 seconds without output; its process was stopped and quarantine
preserved. No public, notarized release has been published.

Build with Apple's command line developer tools installed:

```sh
node desktop/scripts/build.cjs
open desktop/dist/Retouch.app
```

Click **Open project…** and choose a folder. Select **Edit HTML files** for a
static web directory, or **Run startup command** for your usual app command.
Folders with `index.html`/`index.htm` and no `package.json` default to HTML mode;
the choice is always available. HTML mode starts the bundled server on an
available port and opens its editor automatically, with no command required.
The canvas comes forward when connected; logs remain available from the toolbar.
The app runs it through its bundled Retouch CLI using a login zsh and the
selected working directory. **Project logs** shows output; **Stop** signals the
owned CLI, which handles its process group. The command is remembered per folder.
Only one app-owned project runs at a time, and quitting signals that project to
stop. Commands execute only from the native startup dialog; page content has no
native command bridge.

The build includes the CLI and its locked production dependencies under
`Contents/Resources/retouch`. Node 22 or later must be available to the login
shell; the generated cask declares the Homebrew `node` formula dependency. A missing executable is reported in the status
and logs. You can also start a project externally through
`retouch -- <your usual command>`. Enter its local `/rt` URL in the app for an externally started project. The app checks the sidecar health endpoint before
opening the editor. Cmd+L focuses the address and Cmd+R reloads the editor.
It remembers the last successful URL. This version does not edit arbitrary remote sites.

## Cask artifact

The build creates `desktop/dist/Retouch-0.1.0-mac.zip` and its SHA-256 file.
Generate a cask for an immutable release URL and its actual archive hash:

```sh
node desktop/scripts/cask.cjs <release-zip-url> <sha256> > retouch-studio.rb
```

The generator accepts a `file:///...` URL for local packaging verification.
Follow the [Homebrew Cask Cookbook](https://docs.brew.sh/Cask-Cookbook) to place
the generated cask in the release tap. No public tap or downloadable desktop
release is published yet. Local cask installation and uninstall were verified
using an isolated app directory and temporary local tap. Upgrade and trusted
Gatekeeper launch remain unverified.

The default signature is ad hoc for local development. Set
`RETOUCH_SIGN_IDENTITY` to a Developer ID Application identity for release
signing, then notarize and staple the app before creating the final published
archive and its hash. The current build script does not automate notarization.
Never reuse the pre-stapling archive hash for a rebuilt archive.

## Latest local development artifact (4c49f9f)

Archive: `/private/tmp/retouch-desktop-snapping-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `301b54e288a7f2555333cc8ce4abebd1b53f123203b2481ae105ea0394938a23`

The generated `retouch-studio.rb`, checksum and `verification.json` accompany the
archive. The receipt records per-file source hashes, native source hashes,
architectures, bundled runtime tests, cask installation and cleanup. Source tests
ran from a separate temporary harness whose runtime directories pointed into the
app bundle; the harness was removed afterward. Strict signature verification
still passed after the browser workflows.

The local cask installed into an isolated app directory and retained quarantine.
Its self-test timed out without output. The test app, temporary tap, cask trust
entry and owned app processes were removed; Homebrew developer mode was restored
to disabled. This artifact has not demonstrated usable native editing, trusted
Gatekeeper launch, notarization, public distribution, upgrades or Intel runtime.
The separate Developer ID build remains waiting on its local signing interaction.

## Historical native UI evidence (earlier bundles)

Earlier native UI verification on Apple Silicon covered project selection/startup,
logs, automatic connection, a source width edit, button/keyboard undo and redo,
comparison-size switching and Stop. File upload, complete WebKit editor parity,
quit-during-startup and Intel runtime tests remain outstanding.

The current universal build passes the URL/quoting self-test. To verify native
launch arguments against a local CLI checkout (working directory and exit code):

```sh
desktop/dist/Retouch.app/Contents/MacOS/Retouch --self-test --launch-cli "$PWD/retouch/bin/retouch.cjs"
```

This launcher test passed on Apple Silicon. A subsequent native UI pass verified
the folder picker, remembered command, logs, automatic editor connection and
Stop against the disposable Next.js fixture. Earlier `cgWindowNotFound` errors
were no longer a blocker after opening a fresh app instance. Trusted distribution
remains unverified.

The build now runs `--self-test --launch-bundled` against the packaged CLI. A
relocated bundle with spaces in its path passes that test and signature
verification. Its CLI also started the real Next.js fixture and served `/rt`
successfully. No globally installed Retouch command is required.

A local `brew install --cask --appdir=<isolated-directory>` using the generated
cask and actual ZIP/hash succeeded, and uninstall removed the app. The installed
app retained quarantine and stalled at `_dyld_start` before its self-test; that
process was stopped without removing quarantine. Signed/notarized launch remains
unproven. The generated cask now uses the current `macos: :ventura` syntax.

For app-started projects, the launcher now watches complete stdout/stderr lines
for local editor URLs. It handles split chunks and ANSI colors, probes candidates
for up to 90 seconds, and opens the first healthy Retouch endpoint. Network URLs
and generic `{ "ok": true }` services are not accepted for automatic discovery.
Starting to edit the address, stopping the project or quitting cancels discovery.
Commands that do not print a local URL still use manual URL entry. Multiple apps
currently choose the first ready candidate; a native app picker is not implemented.

URL parsing/validation tests and a native health probe against the live fixture
passed. The startup-log-to-WKWebView transition also passed in the native UI for
the Next.js fixture. The probe can be repeated against a running editor with:

```sh
desktop/dist/Retouch.app/Contents/MacOS/Retouch --self-test --probe-editor http://localhost:3000
```

The native pass exposed stale inspector values after changing preview size in
WebKit. The inspector now refreshes after the embedded window's own resize event.
Phone-to-tablet switching updates computed opacity from 100% to 90% without
reselecting the layer. A 180→240px width edit wrote the expected source class;
undo restored the entire original file byte-for-byte. Cmd+Z and Cmd+Shift+Z also
worked. Stop removed the app-owned port 3496 listener while the externally run
port 3491 server stayed live. The welcome text now describes native project
startup instead of requiring a separate global CLI command.

Native HTML verification covers the folder dialog, automatic mode selection,
command-free startup, automatic connection, persistent CSS editing, exact undo
and Stop releasing the listening port. Bundled launch self-tests also cover a
folder path containing spaces and shell punctuation and dynamic port discovery.

## Earlier local package (1701d24)

The current editor bundle includes inline SVG geometry, paint, creation,
duplication, deletion and stacking; width/height preview handles; and selection
from comparison previews. Its archive is:

`/private/tmp/retouch-desktop-responsive-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `6be76fa775b61902538b016c68085e0de22bd803311a7b9d9cbc073ab1465e07`.
The generated `retouch-studio.rb` and `verification.json` accompany the ZIP.
All 72 packaged source files matched the checkout. The installed app contains
arm64 and x86_64, passed strict signature verification and retained quarantine.
Bundled tests passed CLI exit/working-directory behavior, literal folder paths,
HTML startup, dynamic-port discovery, editor health and shutdown.

The temporary cask installed and uninstalled in an isolated app directory. Its
app, tap and cask trust entry were removed; owned app processes were stopped and
Homebrew developer mode was restored to disabled. The build output is retained.

CUA returned `cgWindowNotFound` for the fresh app. The bounded native diagnostic
reported a created/visible/non-miniaturized 1440×992 window and non-loading
WebView, but applicationActive and windowOcclusionVisible were false. This does
not verify native editing or identify the underlying GUI failure. Developer ID
signing, notarization, public publishing, upgrade and Intel runtime remain open.

## Earlier package verification (4670764)

A fresh universal build from source commit `4670764` includes HTML multi-selection,
marquee selection from the bounded gray canvas, frame selection/removal, gradient
stops, and responsive stack/wrapping/alignment controls. The bundled launcher
self-tests passed: command exit propagation, literal folder paths, dynamic-port
discovery, editor health and shutdown.

Its ZIP was installed and uninstalled through a temporary local cask in an
isolated app directory. The installed app passed strict ad hoc signature
verification, contained both arm64 and x86_64 architectures, and all 66 packaged
source files matched the checkout. Quarantine was preserved. The temporary tap,
installed test app and app process were removed; Homebrew developer mode was
restored to its previous disabled state.

The artifact is `/private/tmp/retouch-desktop-layout-build/Retouch-0.1.0-mac.zip`,
with SHA-256 `582a777892541fa473eccb8f5f8fd9e3d0ea71e4f9d07fc03bfdb99c1f9b80a8`.
A generated local cask and per-file `verification.json` receipt accompany it.
These are local development artifacts, not a published or notarized release.

Native interaction with this build remains unverified: opening the fresh app
through CUA returned `cgWindowNotFound`. Its owned process was stopped. Browser
WebKit results and earlier native UI passes do not establish a usable native
editor for this bundle. Intel runtime and trusted Gatekeeper launch also remain
unverified.


## Bounded window diagnostic

To inspect GUI startup without opening a project, run the app executable with
`--diagnose-window`. It starts the real AppKit/WKWebView window, writes a JSON
report after two seconds and quits. The report includes window creation,
visibility/occlusion, activation, screen/window/WebView geometry and loading state;
it does not print the remembered editor URL or project content.

```sh
/path/to/Retouch.app/Contents/MacOS/Retouch --diagnose-window
```

The universal diagnostic build in
`/private/tmp/retouch-desktop-window-diagnostic/Retouch.app` passed the bundled
launcher checks. Its `window-state.json` reported a created, non-miniaturized,
visible 1440×992 window within the 1728×1117 screen and a non-loading WebView.
However, applicationActive and windowOcclusionVisible were both false. CUA still
could not find the window after a normal macOS launch. This narrows the observed
boundary to window activation/visibility to the desktop tools; it does not prove
the precise cause or a usable native editor. A delayed activation experiment
produced the same state and was not retained. Diagnostic processes exited cleanly.


## Earlier local package (b78aed9)

This bundle adds corner resizing, interrupted-gesture cancellation, visible zoom
and Fit screen controls, low-zoom marquee fixes, and direct SVG shape drawing
with Shift/Option constraints to the earlier package.

Archive: `/private/tmp/retouch-desktop-drawing-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `f5a81edb8535e851545b209bc50cb84112e5dd0853a15b3dac24f78edd36de60`.
The generated local cask and `verification.json` accompany the archive. All 73
packaged source files matched the checkout after actual cask installation.
The installed app contains arm64 and x86_64, passes strict signature verification
and retains quarantine. Bundled self-tests passed launcher argument/working
directory/exit behavior, HTML startup, dynamic port discovery, health and Stop.

Homebrew installed and uninstalled the app in an isolated directory. The
temporary tap, cask trust entry and app directory were removed, the native
process was stopped, and Homebrew developer mode was restored to disabled.
Native UI inspection again returned `cgWindowNotFound`; these checks do not
prove usable native interaction, trusted Gatekeeper launch, Intel execution or
upgrade behavior. The archive is an ad hoc development build, not a published
notarized release.


## Previous local package (7708416)

This bundle includes React SVG geometry, drawing, responsive Tailwind paint,
deletion, stacking and independent duplication, plus compiled source-revision
checks and drawing previews outside the app DOM.

Archive: `/private/tmp/retouch-desktop-react-svg-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `4abf44353957b8132ae932c82279ed2ff2574cf99e523f1e88637f74f820c44f`.
The generated local cask and `verification.json` accompany the archive. All 79
packaged source files matched the checkout after actual cask installation. Both
architectures, strict ad hoc signature and retained quarantine were verified.
The built bundle passed its launcher and HTML startup/health/shutdown tests.

The cask-installed bundle produced no self-test output within a 45-second bound.
Its process was stopped, the app uninstalled, and the temporary tap, cask trust
entry and app directory removed. Homebrew developer mode was restored to
disabled. This is an ad hoc development artifact, not a trusted release.

A valid Developer ID Application identity was discovered, and a separate signed
build was started. Signing is waiting in macOS SecurityAgent for local keychain
authorization; computer-use safety restrictions prevent operating that dialog.
No completed Developer ID archive or notarization is claimed.

## Current local package (be51333)

This bundle adds SVG front/back stacking, responsive HTML position/anchor
controls, and pointer/keyboard canvas movement and resizing, including
proportional/centered handles, cancellation and exact undo/redo.

Archive: `/private/tmp/retouch-desktop-canvas-tools-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `a9e4df7731d288e85b0962dfa2397fcb41f3805a75a84ece634d6a5406d4a993`.

The generated `retouch-studio.rb`, `verification.json` and cask verification log
are alongside the archive. The receipt binds all 82 packaged source-file hashes
to `be5133378c9b6bce6ef0d76a46c57fe4057797b0`. Both architectures and the strict
ad hoc signature were checked before and after isolated cask installation.
Quarantine was retained. The built bundle passed launcher/cwd/exit, HTML
startup/health/stop and URL-discovery tests. Both full 13-workflow HTML suites
passed in Chromium and WebKit against the identical editor source.

Native app processes ran, but computer-use inspection returned
`cgWindowNotFound` twice. A process sample showed the main AppKit event loop;
this does not prove a visible or usable native editor. Both owned test instances
were stopped. Installed quarantined launch was not repeated because the prior
artifact's bounded launch produced no output. The cask, temporary tap and trust
entry, isolated app directory and test processes were removed; Homebrew developer
mode was restored to disabled. The separate Developer ID build still awaits
local keychain authorization and packages older editor source `7708416`.
