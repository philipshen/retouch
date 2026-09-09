# Retouch for macOS

A native AppKit window hosts the same Retouch editor used in the browser.
macOS 13 or later; universal Apple Silicon and Intel binary.

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

Native UI verification on Apple Silicon now covers project selection/startup,
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

## Current editor packaging verification

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
