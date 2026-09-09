# Retouch for macOS

A native AppKit window hosts the same Retouch editor used in the browser.
macOS 13 or later; universal Apple Silicon and Intel binary.

Build with Apple's command line developer tools installed:

```sh
node desktop/scripts/build.cjs
open desktop/dist/Retouch.app
```

Start your existing project through `retouch -- <your usual command>`, then enter
its local `/rt` URL in the app. The app checks the sidecar health endpoint before
opening the editor. Cmd+L focuses the address and Cmd+R reloads the editor.
It remembers the last successful URL. No native command bridge is exposed to
web content. This version does not start projects or edit arbitrary remote sites.

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
