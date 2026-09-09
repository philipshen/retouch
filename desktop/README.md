# Retouch for macOS

A native AppKit window hosts the same Retouch editor used in the browser.
macOS 13 or later; universal Apple Silicon and Intel binary.

Build with Apple's command line developer tools installed:

```sh
node desktop/scripts/build.cjs
open desktop/dist/Retouch.app
```

Click **Open project…**, choose a folder, and enter your usual startup command.
The app runs it through the installed `retouch` CLI using a login zsh and the
selected working directory. **Project logs** shows output; **Stop** signals the
owned CLI, which handles its process group. The command is remembered per folder.
Only one app-owned project runs at a time, and quitting signals that project to
stop. Commands execute only from the native startup dialog; page content has no
native command bridge.

The CLI and Node must currently be installed and available to the login shell;
they are not bundled in this app. A missing executable is reported in the status
and logs. You can also start a project externally through
`retouch -- <your usual command>`. Enter its local `/rt` URL in the app. The app checks the sidecar health endpoint before
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
release is published yet. A successful build is not evidence that Homebrew
installation, upgrades or Gatekeeper distribution work.

The default signature is ad hoc for local development. Set
`RETOUCH_SIGN_IDENTITY` to a Developer ID Application identity for release
signing, then notarize and staple the app before creating the final published
archive and its hash. The current build script does not automate notarization.
Never reuse the pre-stapling archive hash for a rebuilt archive.

Native UI verification on Apple Silicon confirmed welcome rendering and a
successful connection to a running local editor. Full editor keyboard, file
upload, WebKit rendering parity and Intel runtime tests remain outstanding.

The current universal build passes the URL/quoting self-test. To verify native
launch arguments against a local CLI checkout (working directory and exit code):

```sh
desktop/dist/Retouch.app/Contents/MacOS/Retouch --self-test --launch-cli "$PWD/retouch/bin/retouch.cjs"
```

This launcher test passed on Apple Silicon. The new folder picker, startup dialog,
log window and Stop control still need native UI verification; the computer-use
service returned `cgWindowNotFound` in the latest verification attempt. This does
not prove a complete desktop startup-to-editing flow or a self-contained cask.
