# Retouch for macOS

## Latest local signed candidate — Svelte creation and embedded previews, 2026-09-20

The universal Developer ID signed app packages clean commit `de10b322`.
All 397 source entries and four native build inputs matched that checkpoint.
It includes Svelte component extraction with managed styles, form bindings,
retained drafts/local stores, imported property contracts and improved comparison
scrolling through SVG, open shadow roots and same-origin embedded pages.

Artifact: `/Users/philipshen/Developer/retouch-worktrees/desktop-creation-de10b322/Retouch-0.1.0-mac.zip`

SHA-256: `89c3b2ee1a10f1cbd46ae56e3c5d243b080d6aa9dcdd938a5dcb9f8a4fe47327`

The extracted runtime passed 2,419 unit tests and Chromium/WebKit component
creation, authoring, recovery and screen-management workflows. All 33 desktop
tests, package tamper checks and bundled PNG/JPEG/ZIP export checks passed.
Final verification confirmed 4,822 packaged files and seven symlinks unchanged.

Homebrew installed the checksum-bound local cask into an isolated app directory.
Installed signatures and manifest passed, with quarantine intact. Cleanup restored
original formula, cask, tap, trust and developer inventories; autoremove was disabled.

Gatekeeper reports **Unnotarized Developer ID**. No native launch was attempted.
Native UI launch, Intel execution, notarization, trusted public distribution and
cask upgrade remain unverified. See the [verification receipt](verification/2026-09-20-svelte-creation-developer-id.json).

## Previous signed candidate — imported contracts and screens, 2026-09-20

The universal Developer ID signed app packages clean commit `cf4ca734`.
All 395 source entries and four native build inputs matched that checkpoint.
It includes imported Svelte property contracts, aliased component editing,
per-screen scroll restoration and the current-screen comparison indicator.

Artifact: `/Users/philipshen/Developer/retouch-worktrees/desktop-types-cf4ca734/Retouch-0.1.0-mac.zip`

SHA-256: `5aa811859ef1442b8ad87fda0009556a709a58ca4fc9708890f9c44261588564`

The extracted runtime passed 2,400 unit tests and Svelte, React component creation,
screen-view memory and project-screen workflows in Chromium and WebKit. React
creation used normal fill/click controls in both engines. All 33 desktop tests,
package tamper checks and bundled PNG/JPEG/ZIP export checks passed. Final
verification confirmed 4,820 packaged files and seven symlinks unchanged.

Homebrew 7.0.1 installed the checksum-bound local cask into an isolated app directory.
Installed signatures and manifest passed, with quarantine intact. Cleanup restored
original formula, cask, tap, trust and developer inventories; autoremove was disabled.

Gatekeeper reports **Unnotarized Developer ID**. No native launch was attempted.
Native UI launch, Intel execution, notarization, trusted public distribution and
cask upgrade remain unverified. See the [verification receipt](verification/2026-09-20-imported-types-screens-developer-id.json).

## Previous signed candidate — component authoring, 2026-09-20

The universal Developer ID signed app packages clean commit `9d15ca05`, including
Svelte component insertion, swapping, ordering, reparenting, independent detachment,
shared-default editing with retained rune state, and structural comparison recovery.
All 394 source entries and four native build inputs match that checkpoint.

Artifact: `/Users/philipshen/Developer/retouch-worktrees/desktop-authoring-9d15ca05/Retouch-0.1.0-mac.zip`

SHA-256: `892c09475a6c809f984b253d70ff0110f6b686b40b27c17e4733ab227649d2ca`

The extracted ZIP runtime passed 2,385 unit tests, combined Svelte authoring
workflows in Chromium and WebKit, and React component creation/recovery workflows
in both browsers. The WebKit React test uses DOM events for offscreen creation
controls; its pointer and keyboard behavior is still unverified. All 33 desktop
tests, package tamper checks and bundled PNG/JPEG/ZIP export checks passed.
Final verification confirmed 4,819 packaged files and seven symlinks unchanged.

Homebrew 7.0.1 installed the checksum-bound local cask into an isolated app
directory. The installed manifest and signatures matched the archive, and
quarantine remained intact. The test app and tap were removed and original
formula, cask, tap, trust and developer-mode inventories were restored.
Uninstall unexpectedly autoremoved pre-existing `git 2.55.0`; that exact version
was restored before the final inventory check. For isolated cask verification,
set `HOMEBREW_NO_AUTOREMOVE=1` as well as `HOMEBREW_NO_AUTO_UPDATE=1` and
`HOMEBREW_NO_INSTALL_CLEANUP=1` on install and uninstall commands.

Gatekeeper reports **Unnotarized Developer ID**. No native launch occurred.
Notarization still needs the existing notarytool Keychain profile name. Native UI
launch, Intel execution, trusted public distribution and cask upgrade remain
unverified. See the [verification receipt](verification/2026-09-20-component-authoring-developer-id.json).

## Previous signed candidate — Svelte components, 2026-09-20

The universal Developer ID signed app packages clean commit `3f362281`, including
Svelte component selection, conditional instance grouping, shared property edits,
selective property paste, inherited defaults and atomic instance property reset.
All 384 packaged source entries and four native build inputs match the checkpoint.

Artifact: `/Users/philipshen/Developer/retouch-worktrees/desktop-components-3f362281/Retouch-0.1.0-mac.zip`

SHA-256: `5b1e8b7866e916d36aa039bd3edf51ff8078b6f920068afb833f4ec652834c81`

The final ZIP was extracted and its test runtime passed all 2,324 unit tests plus
Svelte component workflows in Chromium and WebKit. All 33 desktop tests, package
tamper checks and bundled export checks passed. Final integrity verification
confirmed 4,809 packaged files and seven symlinks remained unchanged.

The local cask passes Ruby syntax validation; installation was not attempted.
Gatekeeper reports **Unnotarized Developer ID**. No native launch occurred.
Notarization awaits an existing notarytool Keychain profile name. Native UI launch,
Intel execution, trusted public distribution and cask install/upgrade remain
unverified. See the [verification receipt](verification/2026-09-20-svelte-components-developer-id.json).

## Previous export candidate — 2026-09-20

The universal app now packages the editor through `f7b44dfa`, including screen,
full-page and selected-layer PNG/JPEG export, transparent/custom-scale output,
separate-layer ZIP export and isolated batch browser reuse. All 340 packaged source
entries and native build inputs match that clean source checkpoint.

Artifact: `/Users/philipshen/Developer/retouch-worktrees/desktop-export-f7b44dfa/Retouch-0.1.0-mac.zip`

SHA-256: `5e514e2b7c5979a274ce7d831e54c51d240c5b33fbbc3c305064373308950cf9`

Developer ID and nested signatures passed. The packaged exporter and capture CLI
passed with an absent user browser cache, and an integrity-checked test copy passed
all 2,071 unit tests. A local `retouch-studio.rb` cask beside the archive passed Ruby
syntax validation; it has not been installed. Gatekeeper rejects this artifact as
**Unnotarized Developer ID**. Native UI launch, Intel execution, notarization,
public cask distribution and upgrade remain unverified. No native launch occurred.

See the [verification receipt](verification/2026-09-20-layer-export.json).
The packaged export check can be repeated without launching the native app:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/retouch-empty-browser-cache \
  node desktop/scripts/test-export-runtime.cjs /path/to/Retouch.app \
  /path/to/fixture-with-pngjs /path/to/source-checkout
```


## Latest inspector candidate (2026-09-17, 53438725)

The universal Developer ID signed archive now includes percentage tracking
variables, readable percentage controls, exact picker focus restoration, and
property-compatible variable choices. It was built from clean commit `53438725`.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-inspector-53438725/Retouch-0.1.0-mac.zip`

SHA-256: `3bb9e61f9a7d8570ef4f7fa63a1db98c48deac6206e8dcca03f4dbf54af11e2c`

All 292 source entries and native inputs match the checkout. The exact ZIP was
extracted and passed 1,926 runtime unit tests plus combined Vue workflows in
Chromium and WebKit. All 32 desktop tests and package tamper checks passed.
Final verification confirmed 1,605 packaged files and three symlinks remained
unchanged. The generated local cask passes Ruby syntax validation; installation
and upgrade have not been tested for this artifact.

Gatekeeper reports **Unnotarized Developer ID**. This bundle was not launched.
Notarization, trusted public distribution, and Intel execution remain unverified.
See [the receipt](verification/2026-09-17-inspector-developer-id.json).

## Previous variable-editor candidate (2026-09-17, d70896e1)

The universal Developer ID signed archive includes the latest Vue reusable-style
and collection-variable support, searchable value previews, picker modes and
binding actions, and property entry points across the supported inspectors.
It was built from clean commit `d70896e1`.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-variables-d70896e1/Retouch-0.1.0-mac.zip`

SHA-256: `ac0e69faf05430dbf395c302271b895e6b497772b18adb5dad0e596cdd1c4242`

All 292 packaged source entries and native inputs match the checkout. The exact
ZIP was extracted into a separate test directory: 1,925 runtime unit tests and
the combined Vue workflows passed in Chromium and WebKit. All 32 desktop tests,
tamper checks and strict signatures passed. Final verification confirmed 1,605
packaged files and three symlinks remained unchanged in the tested runtime.

Homebrew 7.0.1 installed this checksum-bound cask into an isolated app directory.
The installed manifest/signature matched, quarantine remained intact, and
uninstall restored the original formula, cask, tap, trust and developer-mode
inventories. Homebrew's uninstall command uses its stored app-directory receipt;
it does not accept `--appdir`. Remove cask trust while a temporary custom tap still
exists so Homebrew can also remove its local-path alias, then verify the trust
inventory after untapping.

Gatekeeper reports **Unnotarized Developer ID**. This candidate was not launched.
The previously requested notarytool Keychain profile name is still pending;
notarization, trusted launch, Intel execution, upgrades and public release remain
unverified. See [the receipt](verification/2026-09-17-variables-developer-id.json).

## Latest Vue rich-text candidate (2026-09-17, 7dbc62a6)

The universal Developer ID signed archive includes Vue rich-text formatting,
responsive paragraph splits, live values, presentation/event bindings, and bound
link text editing, alongside the preceding editor workflows from clean commit
`7dbc62a6`.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-vue-rich-7dbc62a6/Retouch-0.1.0-mac.zip`

SHA-256: `33f6149f668e98e04aa2f69ecd6c99b19440b5ae2ea964b5c2481c03a088eaf3`

All 288 packaged source entries and native inputs match the source revision.
All 32 desktop tests, package tamper checks, and 1,898 extracted-runtime unit
tests passed. The bundled runtime passed the combined Vue workflows in Chromium
and WebKit. Final verification confirmed all 1,601 packaged files and three
symlinks remained unchanged in the tested copy.

Homebrew 7.0.1 installed the checksum-bound local cask into an isolated app
directory. The installed signature and source manifest passed verification;
quarantine remained intact. Uninstall and temporary tap/cask trust cleanup restored
the original package, tap, trust and developer-mode inventories.

Gatekeeper reports **Unnotarized Developer ID**. Native launch was not attempted
for this artifact. The existing notarytool Keychain profile name is still needed
for notarization. Trusted distribution, public release, upgrades and Intel
execution remain unverified. See
[the receipt](verification/2026-09-17-vue-rich-developer-id.json).

## Testing an extracted package without dependency drift

Use a new directory outside the app bundle. This verifies the package signature,
installs lockfile-pinned test dependencies in disposable staging, and copies only
missing dependencies into a separate runtime. Packaged dependencies take precedence,
including scoped packages and executable links. npm never runs inside the app or
its runtime copy. Install scripts are disabled.

```sh
node desktop/scripts/test-runtime.cjs prepare /path/to/Retouch.app /path/to/new-runtime retouch/test
cd /path/to/new-runtime
node --test 'test/**/*.test.cjs'
# Run the relevant browser workflows here as well.
cd /path/to/retouch-checkout
node desktop/scripts/test-runtime.cjs verify /path/to/Retouch.app /path/to/new-runtime
```

Both commands emit JSON evidence. The final verification checks the original app
signature and compares packaged file bytes, permissions, symlink targets, and
inventories against the tested copy. Extra files within a packaged dependency or
source directory fail verification. Test files and additional test dependencies
are permitted; they are not shipped. Use tests from the candidate source revision
and retain the command outputs and test logs together. This verifies runtime
integrity, not native launch, notarization, or complete feature coverage.

## Latest groups/editor candidate (2026-09-15, e0f7560)

The universal Developer ID signed archive now includes native parent moves,
frames, responsive groups, nested group navigation, and comparison group selection.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-groups-e0f7560/Retouch-0.1.0-mac.zip`

SHA-256: `7c0371ef9719a5a6d11b08cdc9983c7b6087947bfa79aa4e71894e84bdb01324`

All 249 packaged source entries and native inputs match clean commit `e0f7560`.
The extracted runtime passed 1,639 unit tests, React/Chromium nested navigation,
and Liquid/WebKit responsive grouping and history. All 1,050 bundled dependency
files were verified unchanged after these tests. All 28 desktop unit tests and
package tamper checks pass. A checksum-bound local cask was syntax-checked.

Gatekeeper still reports **Unnotarized Developer ID**. Native launch and cask
installation were not attempted for this candidate. Notarization, trusted public
distribution, and Intel execution remain unverified. See
[the receipt](verification/2026-09-15-groups-developer-id.json).

## Latest crop/editor candidate (2026-09-14, 6c18995)

The universal Developer ID signed archive includes guide management, transformed
image repositioning, frame-matched crop previews, rotation/flips, keyboard and
local crop history, loading recovery, and first-upload asset-folder creation.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-crop-6c18995/Retouch-0.1.0-mac.zip`

SHA-256: `50ccbae680a4319ee5ea6c57bb3c0b4dab024ffdcb7744348055bac7858ed0b5`

All 232 packaged source entries and native inputs match clean commit `6c18995`.
The extracted runtime passed 1,517 unit tests, React/Chromium crop/history and
WebKit crop/retry workflows. All 25 desktop unit tests and package tamper checks
pass. A local cask was generated and syntax-checked; installation was not rerun.

Gatekeeper reports **Unnotarized Developer ID**. Native launch was not attempted;
notarization, trusted public distribution and Intel execution remain unverified.
See [the receipt](verification/2026-09-14-crop-developer-id.json).

## Latest inspector candidate (2026-09-14, db5b547)

The universal Developer ID signed archive includes the compact boolean paint and
geometry controls, workspace icons, narrow-window tool palette, and persistent
empty-effects section preferences from clean commit `db5b547`.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-inspector-db5b547/Retouch-0.1.0-mac.zip`

SHA-256: `fe416216cd5785cde6fe74f227c1115c7bd14ee477b2896eff4425f4b2786d3b`

All 226 source entries and native build inputs match the checkout. Strict signing,
hardened runtime, secure timestamp, and package tamper checks passed. A separate
copy of the extracted runtime passed all 1,503 unit tests and the Chromium/WebKit
workspace workflows; its source hashes still match the manifest after testing.
All 25 desktop unit tests passed. A local cask was generated; installation was not
repeated for this candidate.

Gatekeeper rejects this candidate as **Unnotarized Developer ID**. No native launch
was attempted. Notarization, public distribution, and Intel execution remain
unverified. See [the receipt](verification/2026-09-14-inspector-developer-id.json).

## Latest responsive-screen candidate (2026-09-14, 39a1635)

The universal Developer ID signed archive now includes the responsive-screen UI,
keyboard navigation, Actions search, Liquid class preview recovery, and opacity
shortcut fixes through clean commit `39a1635`.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-screens-39a1635/Retouch-0.1.0-mac.zip`

SHA-256: `c4276a7910e3b130baa7313187ba4865026522967cfecebea3575b2baef75438`.
All 225 source entries and native build inputs match the checkout. The extracted
runtime passed 1,397 unit tests and six browser workflows: full HTML comparison
editing, Liquid class editing/recovery, and Actions on Chromium and WebKit.
All 25 desktop tests and package-tampering checks passed. An isolated Homebrew
install/uninstall retained quarantine and restored the original inventories.
A syntax-checked local cask is beside the ZIP.

Gatekeeper rejects the archive as **Unnotarized Developer ID**. No native launch
was attempted. Notarization, trusted public distribution, Intel execution and
full Figma/arbitrary-site parity remain incomplete or unverified. See the
[verification receipt](verification/2026-09-14-screens-developer-id.json).

## Previous nested boolean candidate (2026-09-14, a163d5a)

The universal Developer ID signed archive includes nested original canvas
move/resize/rotate previews and direct double-click entry, plus the latest
responsive scope labels and layer-selection menu. Source manifest and native
build inputs match the clean `a163d5a` checkout.

Archive: `/Users/philipshen/Developer/retouch-worktrees/desktop-nested-a163d5a/Retouch-0.1.0-mac.zip`

The exact extracted runtime passed 1,367 unit tests and nested boolean workflows
on HTML/Chromium, Liquid/Chromium, and React/WebKit. All 25 desktop tests and
package-tampering checks passed. The ZIP installed and uninstalled through an
isolated local Homebrew tap, retaining quarantine and restoring inventories.

Gatekeeper rejects this build as **Unnotarized Developer ID**. No native launch
was attempted. Notarization, trusted public cask distribution, and Intel
execution remain unverified. See [the verification receipt](verification/2026-09-14-nested-developer-id.json)
for archive checksum and exact evidence.


## Earlier Developer ID signed candidate — 2026-09-14

Clean commit `1a97caeccf653a081e852782964de5976c5b19d9` is packaged in
`/Users/philipshen/Developer/retouch-worktrees/desktop-boolean-1a97cae/Retouch-0.1.0-mac.zip`.
SHA-256: `758af8bccb7b4d59d09d0137bbda4d257ec53aaf97a5f6f17fec9367352b2d12`.

The universal arm64/x86_64 app has a valid Developer ID Application signature,
hardened runtime and secure timestamp. All 225 packaged source hashes and native
build inputs match the clean checkout. It includes retained boolean groups,
multi-group transforms, original-shape canvas editing and live-first React
preview synchronization. The older signed build job also completed; its signature
was verified before this fresh build was started.

The exact extracted runtime passed 1,347 unit tests and six browser workflows:
HTML/Liquid original/group canvas transforms and multi-selection; React Chromium
and WebKit original editing, stale server HTML, exact history, release and retained
input/document state. All 25 desktop tests and package-tampering checks passed.
The exact ZIP installed and uninstalled through an isolated local Homebrew tap,
with quarantine retained and original cask/formula/tap inventories restored.
The sibling `retouch-studio.rb` is a syntax-checked cask bound to this archive.

**Not yet a trusted public release:** Gatekeeper explicitly reports
`Unnotarized Developer ID`. Apple notarization awaits an existing notarytool
Keychain profile name. No native launch was attempted for this build. Intel
execution, native editing, public distribution and full Figma/arbitrary-site
parity remain unverified or incomplete. Earlier intermittent framework reloads
remain documented; the covered passes do not establish universal retention.
See the [signed candidate receipt](verification/2026-09-14-boolean-developer-id.json).

## Previous ad hoc preview-state development archive — 2026-09-14

Clean commit `df69eab7725eda86b90a9b5358bdc0edfa0a85af` is packaged in
`/Users/philipshen/Developer/retouch-worktrees/desktop-preview-df69eab/Retouch-0.1.0-mac.zip`.
SHA-256: `8d56bc1ea2a5fa2f9ffc8f0e798d4e2ffbbb38c53b10ed92560ae63b1e8d7ecd`.

The universal arm64/x86_64 app includes the Next preview fixes: bounded waiting
for delayed hot updates and tracking completed build hashes when comparison
frames connect. All 223 source hashes and native build inputs match the checkout.
The extracted runtime passed 1,320 unit tests and ten browser workflows covering
HTML/Liquid/React masks, comparison screens, canvas gestures, export and screen
controls across Chromium/WebKit. React checks delay hot updates by two seconds
while preserving WebSocket message order and assert retained document/input state.
All 25 desktop tests and package-integrity mutation checks passed.

The exact ZIP installed and uninstalled through an isolated local Homebrew tap,
with quarantine intact and original cask/formula/tap inventories restored. The
sibling `retouch-studio.rb` is a syntax-checked cask bound to this archive.

An earlier Chromium failure is retained in the receipt: the original delay test
could let new messages overtake queued messages. Both engines passed after the
test preserved transport order. These checks establish the covered workflows,
not universal editing or state preservation across arbitrary sites.

This is an ad hoc development archive. Native launch, notarization, public
Homebrew distribution and Intel execution remain unverified.
See the [verification receipt](verification/2026-09-14-preview-state.json).

## Previous mask-canvas candidate — verification incomplete

Clean commit `120ac836ffb3cc2c3fead5b70ae64d45b1a083aa` is packaged in
`/Users/philipshen/Developer/retouch-worktrees/desktop-masks-120ac83/Retouch-0.1.0-mac.zip`.
SHA-256: `af9b86fd6b27dcef44621864da161d2f1f0f6bc79ef1cbb4c1f25f2ded165505`.

The universal arm64/x86_64 app includes React/Liquid/HTML mask editing,
independent mask duplication, canvas transforms, comparison outlines, and
transform-preserving release. All 222 packaged source hashes and the native
build inputs match the checkout. The extracted runtime passed 1,317 unit tests
and eight browser workflows: HTML/Liquid combined masks, mask exports, and screen
controls in Chromium/WebKit. All 25 desktop tests and package-integrity mutation
checks also passed.

The exact ZIP installed and uninstalled through an isolated local Homebrew tap.
Quarantine remained intact, the installed manifest matched the archive, and
original cask/formula/tap inventories were restored. The sibling
`retouch-studio.rb` is a syntax-checked local cask bound to this archive.

**Verification remains incomplete:** the combined React comparison/mask workflow
lost main-preview document state in Chromium and WebKit. An instrumented Chromium
retry passed, which does not resolve the intermittent failure. Investigate preview
synchronization before treating this candidate as fully verified.

This is an ad hoc development archive. Native launch, notarization, public
Homebrew distribution, and Intel execution remain unverified.
See the [candidate receipt](verification/2026-09-14-mask-canvas-candidate.json)
for successful checks and failure logs.

## Previous mask and Liquid development archive — 2026-09-14

Source commit `631b70f054d80f09d10568a878de2013ca445430` is packaged in
`/Users/philipshen/Developer/retouch-worktrees/desktop-masks-631b70f/Retouch-0.1.0-mac.zip`.
SHA-256: `2ebc8b4d97944f605b9367219a98308c6a1bb54ddc2c7c7334e1cfd51fe51286`.

This universal arm64/x86_64 development app includes current boolean operations,
HTML and Liquid masks, editable mask types/shapes/bounds, and screen controls.
All 220 source hashes match the checkout. The extracted runtime passed 1,298
unit tests and six Chromium/WebKit mask and compact-screen workflows. All 25
desktop tests passed, as did package integrity and tampering-rejection checks.
The sibling `retouch-studio.rb` is a syntax-checked local-file cask bound to this
archive's checksum. Homebrew installation was not rerun for this archive.

Receipt: [2026-09-14-masks-liquid.json](verification/2026-09-14-masks-liquid.json).
The runtime test harness references the extracted app's runtime directories;
LiquidJS is supplied only as a test renderer. No native launch was attempted.
This is ad hoc signed and is not a notarized or published trusted release.
The older Developer ID signing process was confirmed live; native launch,
notarization, public Homebrew delivery and Intel execution remain unverified.


A native AppKit window hosts the same Retouch editor used in the browser.
macOS 13 or later; universal Apple Silicon and Intel binary.

Controlled native testing resumed with user authorization on 2026-09-11.
The existing navigation-fixed development bundle opened to its native welcome
window, verified through accessibility and a screenshot without a manual
approval step. Rebuilt bundles and complete native workflows remain unverified.
Avoid repeated blocked launches; see [AGENTS.md](AGENTS.md).

An earlier typography development candidate is
`/private/tmp/retouch-desktop-typography-015bffb/Retouch-0.1.0-mac.zip`
(SHA-256 `5ebe86b9fd3034f01592f7596f6f13e301e00364cb6d7d13b9298c7ac967c5bf`).
It packages clean commit `015bffb`, including selected-text links, source-owned
link destination editing, paragraph indentation, underline details, responsive
text wrapping and fitted typography previews. All 208 runtime source hashes
and native/build/verifier hashes match. The extracted runtime passed 1,212 unit
tests and 18 browser workflows. Universal architecture and strict signatures
verify before and after workflows.

The exact ZIP installed and uninstalled through Homebrew in an isolated app
directory with quarantine retained and the original cask inventory unchanged.
Temporary app, tap, trust configuration and external test harness were removed.
Browser coverage includes HTML/React Chromium and Liquid WebKit link creation,
source-bound URL protection, attributed-anchor URL update/removal/restoration,
paragraph indent, five underline properties and text wrapping. Checks retain
source preservation, preview cancellation, responsive isolation/reset where
applicable, and exact undo/redo assertions. Ten desktop JavaScript/publication
tests, the package-verifier mutation matrix, and extracted Swift sampler policy
checks also pass. The welcome HTML is rendered from the actual Swift template
for initial/stopped states and checked in Chromium/WebKit at two sizes; these
are not native-window tests.
See [the candidate receipt](verification/2026-09-13-typography-links.json).
The [preceding cursor-editing candidate](verification/2026-09-13-cursor-editing.json)
and [combined-text candidate](verification/2026-09-13-combined-text.json) retain
other typography and formatting workflow evidence; those additional workflows
were not repeated for this archive.

This is an ad hoc development build, not a trusted release. Native launch was
not attempted because a fresh CUA connection check failed before app inspection.
Developer ID signing, notarization, public distribution, native editing, Intel
execution and trusted upgrades remain unverified. No signing or launch retry
was attempted.

The [previous inspector candidate](verification/2026-09-13-inspector-paints.json)
records React/Liquid SVG stroke settings, HTML drawing/line-to-arrow workflows,
Liquid legacy-arrow migration and the 108-case dashed-arrow pixel matrix in
both engines. Those additional workflows were not repeated for this archive.

The [previous inline-paints candidate](verification/2026-09-13-inline-paints.json)
records packaged inline-gradient creation, stateful React geometry/paint and full
gradient-canvas workflows, which were not repeated for this archive.

The [previous arrow-controls candidate](verification/2026-09-13-arrow-controls.json)
records packaged React/Liquid drawing and HTML responsive comparison workflows,
which were not repeated for this archive.

The [previous stop-controls candidate](verification/2026-09-13-canvas-stop-controls.json)
records the combined gradient-transform/viewport test, which was not repeated
for this archive. Earlier [canvas](verification/2026-09-13-canvas-gradients.json),
[gradient](verification/2026-09-13-svg-gradients.json),
[alignment](verification/2026-09-13-alignment-scrubbing.json), and
[startup-recovery](verification/2026-09-13-vectors-recovery.json) receipts retain
scope-specific evidence; their other workflows are not implied to have run on
this archive.

The [sizing candidate](verification/2026-09-13-sizing-workflows.json) and
[current engine investigation](../docs/fill-engine-compatibility.md) document
the older WebKit normal-flow block-axis Fill failure. That failure remains
unresolved and was not rerun on this archive.

The previous archive with native workflow evidence is
`/private/tmp/retouch-desktop-shared-e948266/Retouch-0.1.0-mac.zip`.
Its SHA-256 is
`a0d685fad8b5bbe2c629d5938be38ae0fbb7b746ded557dc187f56406e0ce480`.
It contains clean source commit `e948266`, including shared padding/gaps,
separate shared paint sections, inline resets and paired sizing controls.
All 178 packaged source files and native/build/verifier hashes match that checkout.
Universal architecture, archive extraction and strict ad hoc signature checks
passed before and after packaged workflows and the controlled native launch.
All 915 unit tests passed. Packaged React shared-gap editing (Chromium) and
Liquid shared-section persistence (WebKit) passed, including source Undo.
The exact extracted app opened once through CUA and exposed its welcome window
and controls through accessibility without an approval dialog.
See [the package receipt](verification/2026-09-12-shared-inspector.json).

The generated local cask passes Ruby syntax validation; installation was not
repeated for this archive. The previous `671f988` archive installed and uninstalled
through Homebrew in an isolated app directory, retaining quarantine. See
[its installation receipt](verification/2026-09-12-palette-creation.json).
Future isolated cask checks must use `HOMEBREW_NO_AUTOREMOVE=1` and
`HOMEBREW_NO_INSTALL_CLEANUP=1`: the earlier uninstall unexpectedly removed Git,
which was restored and verified.

A native static-HTML flow passed folder selection, automatic project startup,
font-size editing, exact source Undo and Stop. Actual screen sampling and
upgrades remain unverified; other native editing flows are not yet covered. Developer ID signing, notarization and trusted public
distribution remain unfinished; no public release is published.

Build with Apple's command line developer tools installed:

```sh
node desktop/scripts/build.cjs
```

Click **Open project…** and choose a folder. Select **Edit HTML files** for a
static web directory, or **Run startup command** for your usual app command.
For a folder without a saved command, the dialog suggests its `dev` script,
or `start` when no nonempty `dev` script exists. It uses the declared npm,
pnpm, Yarn, or Bun package manager, otherwise the nearest unambiguous lockfile
within the checkout, and defaults to npm when neither is present. Conflicting
lockfiles or unsupported declarations leave the command blank. Suggestions stay
editable, and a previously saved command takes precedence. Selecting the folder
only reads metadata; scripts run after **Start project**.
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
It remembers the last successful URL. **Open website…** now accepts an HTTP(S)
page, canvas dimensions and a new save location. **Keep responsive layout**
preserves loaded author CSS and its breakpoints; turn it off for a computed-style
snapshot. Shadow components retain frozen styles in either mode. It captures an editable HTML
copy and starts its local editor automatically; edits do not update the source
website. Stop cancels capture or stops the editor while retaining a completed
copy. Playwright is included in the locked CLI dependencies. The desktop build
now downloads its matching Chromium headless shell for Apple Silicon and Intel,
signs the native browser files, and includes both alongside the app. Capture
selects the bundled executable for the running Node architecture. The source flow has compiled
and its CLI lifecycle and welcome template have automated coverage; native
interaction with this rebuilt version remains unverified.

## Controlled native workflow verification (2026-09-11)

After testing resumed, the existing navigation-fixed development app completed
Open project → automatic HTML mode → Start project → connected native editor.
An inspector text edit changed exactly the expected source text; Undo and Redo
restored exact original/edited bytes and the visible canvas heading. Stop closed
the owned server. This used the older d9cd994 bundle, not current packaged HEAD.
The stale inspector value observed after Undo was subsequently reproduced against
current source and fixed in the shell's click-completion handling. The running
Mac app connected to current source then verified synchronized inspector/canvas
Apply, Undo and Redo with exact file checks. The earlier click-completion package included the fix and passed the same HTML
workflow, including an additional completed-click fix that does not depend on
another native-window repaint. Other native workflows and trusted distribution
remain unverified.
See the latest native-workflow entry in `docs/design-studio-parity.md`.

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

## Latest local development artifact (d9cd994; verification failed)

Archive: `/private/tmp/retouch-desktop-navigation-fixed-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `2c73481f95da6f4ae24dc1a8b94180e590b4979b18d6e120376a3ff6f3da788f`

The receipt verifies all 88 files against `d9cd994bf7b236a51d1e54a2c05a18b3ffaff7af`,
universal architectures and the strict ad hoc signature after browser checks.
All six Chromium workflows pass. WebKit passes five; React geometry and undo
assertions complete, but Next development-runtime errors fail the final check.
A traced browser-only rerun passes; the original failure remains in the receipt.

Before the launch pause, isolated cask install/uninstall and installed source
verification passed. Installed native launch failed with exit -9. Its process,
app directory, cask, temporary tap and trust entry were removed. The bounded
window diagnostic reported a created window, but an inactive app and no visible
occlusion; this does not establish usable native UI. No native launch was repeated
after the user requested the pause. The temporary browser harness is removed.

## Previous local development artifact (a288bc6; verification failed)

Archive: `/private/tmp/retouch-desktop-navigation-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `2d0aa17904c6e1ca24574eb17d6036294eadec2dc87c54499f335732ea7a972c`

The generated cask, checksum and `verification.json` accompany the archive.
The receipt binds 88 packaged source files to
`a288bc614a89e7924545b365fa507ef7893b3b02`. Bundled browser verification found
Chromium's selected heading partly outside the canvas after Zoom to selection,
and WebKit timed out waiting for a React horizontal-gap control to become stable.
The receipt records per-workflow results; these failures are not waived.

The isolated cask installed and verified all 88 files, both architectures and
the strict signature. Quarantine was preserved. The installed self-test timed
out after 45 seconds; its owned process group was stopped. The cask, app directory,
temporary tap and trust entry were removed, and Homebrew developer mode was
restored. Native inspection of the built app returned `cgWindowNotFound`; its
owned process was sampled and stopped. No trusted launch, notarization, public
release, upgrade or Intel execution is established by this artifact.

## Previous local development artifact (a88e45e)


Archive: `/private/tmp/retouch-desktop-locks-20260909/Retouch-0.1.0-mac.zip`

SHA-256: `24e274a13a940e65b8217792737c90b5cff8b87dd15fbb24c124d1b7a3714bb9`

The generated `retouch-studio.rb`, checksum and `verification.json` accompany the
archive. The receipt binds 87 packaged source hashes to
`a88e45e4f1e508da21298c0b05892a0c3d5975b6`, along with native source hashes,
architectures, browser results, cask installation and cleanup. Browser workflows
used a separate test harness with runtime directories pointing into this bundle.
Both engines passed all 19 HTML workflows plus lock/history/reload/shortcut/recovery,
locked-overlay and layer-interaction checks. The real React lock/marquee/group-edit
workflow passed in WebKit. All 87 source hashes and the strict signature still
verified afterward; the temporary harness was removed. See the receipt for
terminal results and logs.

The local cask installed into an isolated app directory and retained quarantine.
Its self-test timed out after 45 seconds without output; its owned process group
was stopped and verified absent. The installed app, temporary tap, cask trust
entry and app directory were removed, and Homebrew developer mode restored to
disabled. Native inspection of the built app returned `cgWindowNotFound`; its
owned process was sampled and stopped. The native check and sample accompany
the archive. This has not demonstrated usable native editing, trusted Gatekeeper
launch, notarization, public distribution, upgrades or Intel runtime.

The separate Developer ID build still awaits local signing interaction and
packages older source `7708416`. Earlier archive receipts remain in their original
artifact directories, including the initial selection archive's HTML failures.

## Historical native UI evidence (earlier bundles)

Earlier native UI verification on Apple Silicon covered project selection/startup,
logs, automatic connection, a source width edit, button/keyboard undo and redo,
comparison-size switching and Stop. File upload, complete WebKit editor parity,
quit-during-startup and Intel runtime tests remain outstanding.

Earlier universal builds passed the URL/quoting self-test; it was not rerun for the latest archive. To verify native
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

That earlier editor bundle included inline SVG geometry, paint, creation,
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

## Earlier local package (be51333)

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

## Verify a built package

The build embeds `Contents/Resources/build-manifest.json` and runs the verifier
before archiving. The manifest records copied source hashes, the Git base commit
and dirty-state flag, native-source/build/verifier hashes and the Info.plist hash.
File hashes identify the actual snapshot when a build uses uncommitted changes.

```sh
node desktop/scripts/verify-package.cjs /path/to/Retouch.app
node desktop/scripts/test-package-verifier.cjs /path/to/Retouch.app
```

Verification checks the complete packaged source inventory, content hashes,
Info.plist, universal architectures and strict code signature. The test command
uses a disposable copy to exercise altered source, omitted/duplicate/invalid
entries, unlisted source, plist changes and symlinks, then checks the restored
copy and original. Neither command launches the app. These integrity checks do
not establish signing identity, notarization or Gatekeeper trust.

## Rebuilding an existing output directory

Builds take an exclusive `.retouch-build.lock` and prepare the app/archive/hash in
a unique sibling staging directory. Existing outputs remain untouched until
compilation, signing, verification and archiving succeed. Publication retains
backups until all three outputs are installed; ordinary publication errors
restore the previous set. If restoration fails, the error names retained recovery
files. A process crash or power loss is not an atomic multi-file transaction.
A leftover lock is never removed automatically: inspect the recorded process
before removing a stale lock.

Run the filesystem failure and lock checks without launching Retouch:

```sh
node --test desktop/test/publish-package.test.cjs
```

### Screen color sampling (development source)

The color picker falls back to a macOS NSColorSampler bridge when WebKit lacks
the browser eyedropper. The bridge accepts only the connected local editor main
frame in the active app window and returns the user-selected sRGB color. The
existing paint opacity is preserved. Escape dismisses the system sampler; closing
the picker or navigating discards a late result. The API has no programmatic
cancel method. Actual native sampling remains unverified. Adapter tests use
simulated replies; the standalone policy check does not launch the app.

```sh
node --test desktop/test/color-sampler.test.cjs
node desktop/test/color-sampler-policy.cjs
```

### Current text-editing candidate (2026-09-13)

The universal development candidate built from clean source commit `d303a90`
includes the docked typography inspector, cursor formatting, multiline paste,
line breaks, underline/strike, mixed selection states, and multi-run formatting
removal. Its verification receipt is
[`verification/2026-09-13-cursor-editing.json`](verification/2026-09-13-cursor-editing.json).

Local archive:
`/private/tmp/retouch-desktop-editing-d303a90/Retouch-0.1.0-mac.zip`

SHA-256: `dbc7dbdbf763ac965cb8c592d7e62eb18124b47193c557df4714608bdd5bf773`

The extracted package passed 1,195 unit tests and nine HTML/React/Liquid browser
workflows covering the recent text-editing changes. Package tamper/relocation
checks, ten desktop adapter/publication tests, pure Swift helper checks, and
Swift-generated welcome HTML checks also passed. The exact ZIP was installed
and uninstalled through an isolated Homebrew cask with quarantine retained;
the original cask inventory was unchanged and temporary app/tap/trust state
was removed. Test harness files were external to the signed bundle and removed
after all test processes exited.

This candidate is ad hoc signed and has not been notarized or published.
Native UI access failed its preflight, so the app was not launched and native
editing, sampling, shutdown, and Intel execution remain unverified. Browser
checks do not establish WKWebView or native-window behavior. Full Figma parity,
universal site support, and trusted public Homebrew distribution remain open.

## 2026-09-14 text-layer and list-editing development candidate

The current editor at clean source commit `31bdfc176ba0d67de307cae688d01e7f1d6e780e`
was rebuilt as a universal macOS development archive:

- ZIP: `/private/tmp/retouch-desktop-text-layers-31bdfc1/Retouch-0.1.0-mac.zip`
- SHA-256: `45d7ec692490f762a3bf1f8a3ab58be15b0425c518985fea81fc2971a2dcafd8`
- Verification receipt: `desktop/verification/2026-09-14-text-layers-lists.json`

The archive includes atomic text layers, the primary Typography inspector,
paragraph/list splitting and joining, indentation/marker editing and typed list
prefixes. Its 214 source files match the clean source manifest; the universal
arm64/x86_64 executable passes strict ad hoc signature verification.

The extracted packaged runtime passed 1,245 unit tests and 16 browser workflows
covering text history, paragraphs, lists, Layers, locks and inspector docking.
Desktop tests, package-tampering rejection, extracted Swift sampler policy and
welcome-template checks passed. The exact ZIP also passed isolated Homebrew
installation, manifest verification and uninstall with quarantine preserved and
the original cask inventory restored. An initial React workflow hit a Next.js
empty-manifest/HTTP 500 reload failure; the React lane passed on retry against
unchanged packaged bytes. The receipt retains this limitation.

This completed archive is ad hoc signed, not notarized or publicly published.
Native UI verification was unavailable (`Sky Computer Use native pipe startup
failed`), so no native app launch was attempted. A valid Developer ID Application
identity was found and a separate signed build was started, but its codesign
process was awaiting macOS Keychain approval at this checkpoint. No successful
Developer ID archive is claimed. Notarization also needs an identified keychain
profile. Native editing, Intel execution, trusted launch/upgrade and full Figma
parity remain unverified.

### Resumable notarization submission

Once a Developer ID build has finished, submit it using an existing `notarytool`
Keychain profile (only the profile name is passed; never put credentials here):

```sh
node desktop/scripts/notarize.cjs submit /path/to/Retouch.app /path/to/separate-notarization-directory profile-name
node desktop/scripts/notarize.cjs status /path/to/separate-notarization-directory
node desktop/scripts/notarize.cjs finish /path/to/separate-notarization-directory
```

Submission retains a separate app snapshot, the exact submitted ZIP, its SHA256,
and Apple's submission ID. Status checks poll that ID without uploading again.
Commands have bounded subprocess execution and an exclusive output lock. If an
upload is interrupted before its ID is recorded, state becomes
`submission-unknown`: investigate the original submission with Apple before
retrying. Do not delete the retained evidence to blindly resubmit. A failed
preflight retains its app snapshot for inspection; use a new output directory
when the signing problem is resolved.

`finish` checks the same Apple job and its log, then extracts the submitted ZIP
into fresh staging. It staples and validates the ticket, verifies the package
and Gatekeeper assessment, and creates a new ZIP. The final ZIP is extracted
and checked again before publication. Only after all checks pass does it replace
`distribution/` with the app, `Retouch-mac.zip`, its SHA256 file, and a verification
receipt including Apple's log. Prior distribution files survive ordinary failures;
retries use the original submitted bytes. An in-progress job returns without
publishing; rejection retains `apple-log.json`. Review any warnings in that log.

These commands do not launch the app or publish a public Homebrew cask. The
existing development archive remains ad hoc signed. Unit tests simulate Apple
responses; they do not establish notarization. Actual notarization and Gatekeeper
verification remain untested until signing and a Keychain profile are available.

### Latest vector and screen development archive (2026-09-14)

`/private/tmp/retouch-desktop-vectors-b7e12a8/Retouch-0.1.0-mac.zip` contains clean
source commit `b7e12a8a33e19bb5b50f360d65c7356c4d48da86` in a universal arm64/x86_64
app. SHA256: `cdb0731c255f5a142db0d1aae937fd19ef91f5baf5e7e3a1082777a88275a0c9`.

The exact extracted runtime passed 1,252 unit tests, compound-vector workflows
on HTML/React Chromium and HTML WebKit, and compact/project-screen workflows on
Chromium and WebKit. Desktop unit tests, package-tamper checks, Swift sampler
policy and the Swift welcome template in both browsers also passed (13 recorded
jobs). The app passed isolated Homebrew installation/uninstallation with
quarantine retained and the original cask inventory restored. Temporary external
tests were removed after all jobs ended; signatures/manifests were rechecked.
Details and log hashes are in `verification/2026-09-14-vector-joins-screens.json`.

This is an ad hoc development archive. Native launch/editing, Intel execution,
notarization, public hosting/cask distribution and upgrades remain unverified.
The older Developer ID signing attempt remains pending; this build did not start
another signing request or launch a native app.

### Release versions and archive names

`desktop/Info.plist` is the default release-version source. Update its
`CFBundleShortVersionString` and the appropriate `CFBundleVersion` for a release.
The builder reads the copied bundle metadata and names its ZIP
`Retouch-<version>-mac.zip`. The cask generator uses the same default version:

```sh
node desktop/scripts/cask.cjs https://host/releases/0.2.0/Retouch-0.2.0-mac.zip SHA256 0.2.0
```

The optional third argument is the version of the actual archive, useful when
preparing a cask for an older release. Always use that archive's checksum and
version; the generator does not download the URL or establish its immutability.
Without the third argument, it reads the current source plist. Release versions
must contain three non-negative integers, consistent with
[Apple's bundle version format](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring).
The generated version is the [Homebrew cask version](https://docs.brew.sh/Cask-Cookbook#stanza-version).

On 2026-09-14, 25 desktop tests passed, including invalid/duplicate metadata and
Ruby cask syntax for three versions. An isolated source fixture with plist
version 0.2.0 built `/private/tmp/retouch-version-check-q1mjqi5p/output/Retouch-0.2.0-mac.zip`
(SHA256 `5dd3b09f61a1b66022347b67bd1699882121e0e43504881d305b3b1fab8510f6`).
The extracted app reports 0.2.0 and passed package integrity, arm64/x86_64 and
strict ad hoc signature checks. This temporary fixture has no Git source receipt
and is not a release. Native launch, Homebrew upgrade, Developer ID signing and
notarization were not tested. The original signing process remained live and was
not restarted; native UI access still failed its preflight.

### Isolated Homebrew upgrade verification (2026-09-14)

Homebrew upgraded the retained 0.1.0 vector development archive to the isolated
0.2.0 version fixture using a temporary local tap and separate app directory.
Both installed versions matched their archive manifests, reported the expected
bundle and cask versions, retained quarantine, and passed strict signatures and
universal architecture checks. Homebrew removed the old version after upgrade.
Uninstall, untap and temporary-config removal restored the original cask,
formula-version and tap inventories. Automatic updates, dependency upgrades,
autoremove and unrelated cleanup were disabled.

See `verification/2026-09-14-homebrew-upgrade.json` for exact archive hashes,
checks and log/script hashes. The first attempt failed in the harness's cask
inventory query and cleaned up successfully; the corrected attempt passed.
No native app was launched. These local ad hoc archives do not prove trusted
public distribution, Intel runtime behavior or interrupted-upgrade recovery.

### Verify the packaged editing runtime

Both npm and desktop releases must include `retouch/runtime/`. The desktop source
manifest covers that directory; `verify-package.cjs` checks it along with the
remaining bundled source. Verify editing against the packaged modules from the
repository root:

```sh
node retouch/test/packaging/verify.cjs /path/to/Retouch.app/Contents/Resources/retouch
RT_PACKAGE_ROOT=/path/to/Retouch.app/Contents/Resources/retouch \
  RT_INSPECTOR_FIXTURE=/path/to/installed-next-fixture \
  node retouch/test/e2e/react-group-runtime.cjs
```

For an npm installation, set the package path to its `node_modules/retouch`.
The first check performs source-edit operations and exact undo in a disposable
project. The browser check generates saved pages with the packaged planners and
runtime, then verifies responsive geometry. It launches Node and a test browser;
it does not launch the native Retouch executable or establish macOS trust.

### Eyedropper on nested editor routes (2026-09-17)

The native color-sampler bridge now supports `/rt/docs/` and other editor page
routes as well as `/rt`. Both the injected script and Swift policy exclude the
editor's API and asset namespaces, including encoded equivalents. The native
checks still require the connected origin and port, the main frame, and an
active app window; the browser adapter still requires user activation.

All 32 desktop tests, the extracted Swift policy checks, and headless native
self-tests pass. The source compiles for arm64 and x86_64. The HTML fixture's
`RT_E2E_NATIVE_DEEP_ROUTE=1 RT_E2E_NATIVE_SAMPLER=1 RT_E2E_EYEDROPPER=1` flow
checks the real `/rt/docs/` route, exact injected bridge, color/alpha handling,
source apply/undo, cancellation, error recovery and ignored late replies in
Chromium and WebKit. Sampling replies are simulated in those browser checks.
The macOS sampler UI and a rebuilt packaged app were not launched for this change.


### Packaged screen and Vite checkpoint (2026-09-17)

A clean `f6d9a341` source tree produced a fresh universal development app at
`/private/tmp/retouch-studio-screen-presets/Retouch.app` and
`Retouch-0.1.0-mac.zip` in the same directory. The
[verification receipt](verification/2026-09-17-screens-vite-package.json) records
its SHA-256, 278 source files, architecture checks and test scope.

Both the original app and a fresh ZIP extraction pass strict signature and
complete source-inventory checks. Tamper rejection and the bundled React runtime
lifecycle pass. The app's bundled CLI passes the Vite `/docs/` startup, editing,
configuration restart recovery and exact undo workflow in WebKit. Its bundled
screen UI passes presets, existing-screen reveal, Actions, persistence and
retained-document checks in Chromium. The add-screen harness now accepts
`RT_PACKAGE_ROOT` to run against that actual packaged source. The generated
local cask passes Ruby syntax checking.

This archive is ad hoc signed. Native launch, Intel execution, notarization,
Homebrew installation/upgrade of this candidate and public release remain
unverified. The checks above do not establish trusted macOS distribution.


The subsequent controlled native attempt started the exact executable in that
package, as verified from its process path. Native automation returned
`cgWindowNotFound` and supplied no app handle, so the window and project dialog
could not be inspected. Bundle-ID selection was also ambiguous among older local
builds. AppKit logs reported old window-state restoration with a null identifier
and class; this has not been established as the cause. The test process was
stopped and its exit verified. Native editing remains unverified; no launch loop,
quarantine removal or security-setting change was performed.


### Bundled capture browser

`desktop/scripts/capture-browser.cjs` installs browser revision 1217 from the
locked Playwright 1.59.1 package into isolated temporary directories. The app
retains the browser resources and license files for both Mac architectures.
Browser binaries and dynamic libraries are signed before the outer app; the
headless executable receives the JIT entitlement used for JavaScript execution.
See [Apple's JIT entitlement documentation](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.cs.allow-jit).

The browser manifest records every file's content hash, mode and native-code
classification. The package verifier checks that complete inventory, executable
architectures, runtime version and individual native signatures. This is
packaging evidence; notarization and native UI launch remain separate gates.
The build does not launch the desktop app by default.

Build-runtime observation (2026-09-19): the locked Playwright downloader stalled
after writing the first extracted file under Node 26.8.2, and the bounded build
exited after five minutes. The same archive extracted under Node 25.2.1. The builder now refuses that specific incompatible version pair before the
download. Use Node 25.2.1 for this package-build verification; this is distinct from the
capture runtime, whose CLI lifecycle tests passed under Node 26.8.2.

The 2026-09-19 Developer ID package passed the complete browser inventory and
signature checks, relocation/tamper checks, and the packaged CLI capture/open/
stop/cancel lifecycle with an absent browser cache. All 301 packaged source
files matched the worktree snapshot. See
[`verification/2026-09-19-bundled-capture-browser.json`](verification/2026-09-19-bundled-capture-browser.json).
Gatekeeper still rejected the app as Unnotarized Developer ID; the native UI
was not launched. Intel execution and a new cask install/upgrade remain unverified.
