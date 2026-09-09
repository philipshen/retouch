# Design studio: full parity work ledger

The goal is full Figma Design feature parity on any site, an intuitive responsive
workflow, and a macOS app installable with Homebrew Cask. This ledger records
progress; it does not redefine parity as the implemented subset.

Active worktree: `/private/tmp/retouch-design-studio`
Branch: `feat/figma-design-studio`
Baseline: `cf3b539`, copied from the original checkout's working files without
changing those files. The original checkout may continue to evolve independently.

## Requirement and evidence matrix

| Area | Required outcome | Current evidence and remaining work |
| --- | --- | --- |
| Canvas | Frames, pages, sections, zoom/pan, rulers/guides, grids, multiple selection, alignment/distribution, snapping, grouping, stacking, locking/hiding | Existing single-site zoom/selection/resize plus a linked phone/tablet/desktop comparison rail. Most document and multi-selection operations still absent or unaudited. |
| Layers | Complete searchable tree, nesting/reparenting, reorder, rename, duplicate, delete, copy/paste across contexts | Searchable live layer hierarchy, disclosure, keyboard navigation, canvas-linked selection and literal sibling duplicate/delete/reorder UI now exist. Reparenting, rename, multi-selection, cross-context clipboard and broader source structures remain. |
| Geometry | Shapes, vector/pen editing, vector networks, boolean operations, masks, strokes, corners, transforms | Full vector authoring and geometry model remain. |
| Layout | Auto layout, grid, wrap, hug/fill/fixed, min/max, constraints, absolute children, padding/gaps, responsive behavior | Visual horizontal/vertical/reverse flex and grid controls, wrapping, gaps, alignment/distribution, per-side padding, fixed/hug/fill sizing, minimum/maximum dimensions, grid-child spans and breakpoint-scoped writes now exist. Full constraint, advanced grid, nested auto-layout and cross-framework equivalence work remains. |
| Appearance | Multiple fills/strokes, gradients, images and cropping, blend modes, opacity, shadows, blur/effects | Opacity, CSS border width/style/color, uniform and individual corners, basic color and shadow controls, and image fit/position controls exist. Browser tests cover border independence, corners, scope and exact undo. Multiple fills/strokes, gradient editing, crop handles/zoom/rotation, blending and complete visual/source representations remain. |
| Typography | Font selection, weights/styles, variable axes, text runs, paragraph controls, lists, decoration, sizing and resizing behavior | Inline formatting plus custom font size, line height, tracking, alignment, slant, decoration, case and scoped reset now exist. Browser tests cover named-style preservation, scoped sizes and exact undo. Font browsing, variable axes, full rich-text/paragraph/list controls and complete typography parity remain. |
| Components | Create/reuse, variants, exposed properties, overrides, nested instances, swap/reset/detach, shared libraries | Existing React and Liquid component inspection/detach; full creation/variants/library workflows remain. Live Shopify proof is incomplete. |
| Design systems | Reusable styles, tokens/variables, aliases, collections/modes, import/export and updates | Not implemented or verified. |
| Prototypes | Connections, interactions, states, transitions/animation, overlays, scrolling, variables/conditions, presentation | App interact mode exists; design authoring workflow remains. |
| Assets/export | SVG/raster/PDF export, scales, selections/frames, asset libraries/import | Image upload exists; complete export and import pipeline remains. |
| History/collaboration | Reliable undo/redo across all actions, persistence, version restoration, multiplayer behavior and review | Shared undo/redo controller is now connected to all shell history records, toolbar buttons and keyboard shortcuts. Source and browser tests cover ordered restores, refusal/retry, branch invalidation and structural redo. Persistence across editor restarts, complete gesture grouping, version browsing and collaborative editing remain. |
| Any site | Useful authoring on arbitrary public/local sites and source-connected editing across frameworks; honest source mapping and durable edits | Next/React and Shopify/Liquid are the connected renderers. An HTML source adapter now handles source-preserving edits and history; a local HTML renderer now supports text/tag/image edits; basic responsive CSS editing is connected; generic capture and complete CSS authoring remain. A native WebView alone does not provide this. |
| Screen sizes | Easy size selection, continuous resizing, side-by-side linked views, explicit inheritance and breakpoint overrides, discoverability | New presets/custom dimensions/rotation/persistence resize the actual iframe. Zoom preserves fixed viewport dimensions and vh. Real browser test passes. Breakpoint-scoped class edits, loaded-CSS discovery, inheritance reset and exact undo are browser-verified on React/Tailwind. Linked views, continuous resize handles and the full cross-framework responsive workflow remain. |
| Desktop | Native installable app, project/site onboarding, editor operation, keyboard/file integration, recovery | Universal AppKit/WKWebView app builds and connects to live local editor. Native project startup uses the bundled CLI and an installed Node runtime. Native startup, auto-connect, width editing/undo/redo and Stop passed on one fixture. Full editor behavior, file flows, Intel runtime and broader lifecycle verification remain. |
| Homebrew | Published immutable archive, integrity hash, cask/tap, install/launch/upgrade/uninstall, trusted macOS distribution | Universal ZIP, SHA-256 and cask generator exist. Development build is ad hoc signed. Local cask install/uninstall passed. Developer ID signing/notarization, publishing, upgrades and quarantined launch remain unverified. |
| Ease of use | New user can open a site, select/edit, compare screens, undo and retain work without learning implementation details | Controls have labels and basic defaults. Whole-workflow usability validation remains. |

Figma reference material used to anchor the inventory:
[auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties),
[variables](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma),
[variants](https://www.figma.com/best-practices/creating-and-organizing-variants/).
This inventory still needs a complete audit against Figma's current Design UI and
documentation. Nothing in it proves full parity.

## Verification, 2026-09-08

- `cd retouch && npm test`: 223 passed. Run with local network/watch permissions;
  sandbox-denied socket/watcher failures are not product failures.
- `cd retouch && node test/e2e/screens.cjs`: real browser fixture exercises shipped
  shell, actual media query changes, width/height, rotation, custom sizing, invalid
  values, reload persistence, fit workspace, and zoom-independent viewport units.
- `node desktop/scripts/build.cjs`: arm64 + x86_64 universal app, URL self-test,
  codesign verification, ZIP and SHA-256 produced.
- Native UI: welcome screen rendered; Open editor connected successfully to the
  existing React fixture at `http://localhost:3491/rt`. This checks the native
  connection and editor rendering, not all editing gestures in WKWebView.
- Generated cask: `ruby -c desktop/dist/retouch-studio.rb` passed.

## Next implementation sequence

1. Expand breakpoint scopes to full CSS/style representations, named typography
   styles, important-cascade handling and per-property inheritance controls.
   Current class scopes preserve unrelated variants and use project breakpoint
   units; scoped content edits are not supported (content remains shared).
2. Expand the linked screen comparison rail into customizable canvases with
   direct selection/editing, visible inheritance/overrides and synchronized
   application state. Pinned standard/custom previews now share source
   selection and edits; the main canvas remains the editing surface.
3. Build the layer/document and generic-site authoring model that supports the
   remaining canvas/vector/layout/component operations without requiring JSX.
4. Expand feature families above with browser/source round-trip verification.
5. Integrate desktop project startup, site capture, persistence and file flows;
   publish and verify the cask distribution when a release is ready.

### Responsive editing verification

`RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture node
retouch/test/e2e/responsive.cjs` passed against a disposable Next.js 16.2.5 /
Tailwind 4 fixture on port 3496. It checks md opacity writes in source and rendered
CSS, phone/base independence, reset inheritance, custom rem breakpoint compilation,
exact-byte undo across scope changes, computed inspector refresh and runtime errors.
The full inspector E2E also passed for positioning/anchors, typography, colors,
effects, measurements and images.

A real-browser failure exposed mixed px/rem breakpoint ordering; new size scopes
now reuse a matching named breakpoint and follow loaded breakpoint units. Loaded
CSS discovery does not inventory unused breakpoint names in project config files.
Named custom typography classes do not automatically gain responsive variants;
those presets remain base-only while size/weight controls support scopes.

### Layer workflow

The new left panel follows source-connected elements in the rendered DOM and
keeps the hierarchy updated after navigation and source changes. Search retains
matching ancestors, canvas selection reveals collapsed ancestors, and arrow keys
navigate rows. Enter selects a layer without entering text editing. Cmd/Ctrl+D
and Delete/Backspace act on the focused layer.

Duplicate, delete and sibling move actions use the existing adapter plans and
source transaction history. The UI waits for the rendered child ordering/count
to match a successful structural write. Selection/actions are disabled while a
write or undo is pending to avoid acting on a replaced document. The current
backend still restricts structural changes to literal native siblings and refuses
identity duplication; components, expressions, loops and reparenting require
additional source planning. The layer tree does not yet expose unstamped sites.

`retouch/test/e2e/layers.cjs` verifies hierarchy depth, search, collapse, keyboard
navigation, selection without typing, duplicate/reorder/delete in source and in
the rendered page, exact-byte undo and duplicate refusal for authored IDs.

### Visual layout controls

`retouch/test/e2e/layout.cjs` verifies visual edits against a real Next/Tailwind
fixture: horizontal/vertical/grid layout, wrapping, horizontal gap, side padding,
child alignment, hug/fixed/fill width, three grid tracks, tablet-vs-phone layout
isolation and exact source restoration through the entire undo stack.

The planner changes flex growth/basis/shrink only along the selected dimension's
parent flex axis. Fill follows browser layout semantics; existing min/max
constraints remain intact. Full Figma nested hug/fill behavior, layout suggestions,
advanced grid tracks/line placement and arbitrary CSS authoring remain
unverified or unimplemented. Success notifications replace the previous save
notification so repeated adjustments do not obscure the canvas.

### Editor undo and redo

The shell now uses the existing shared history controller instead of a separate
undo-only array. All successful snapshot-bearing writes record through it.
Toolbar availability tracks history state and pending writes; Cmd/Ctrl+Shift+Z
performs redo, while text inputs retain their native undo shortcuts. Source writes
are blocked during history restoration. A successful source restore moves client
history even if subsequent preview refresh fails.

`retouch/test/e2e/history.cjs` verifies button states, keyboard redo, rendered
style and text restoration, external-change refusal without data loss, retry and invalidation of
redo by a new edit. The layer browser suite now checks duplicate and delete redo
in both source and rendered output. Intermittent initial duplicate-shortcut timeouts exposed a test readiness gap:
the previous selection could still enable Duplicate before the next selection
resolved. The test now waits for the intended row to be selected and enabled.
The focused-layer shortcut also avoids redundant selection requests.

### Typography property controls

The inspector now exposes custom pixel font size and line height, letter spacing,
alignment, italic/normal, decoration and case. Text elements show typography before
container layout controls. Explicit property edits retain named project text styles
and override their unlayered CSS when needed; reset removes the supported property
overrides in the current scope while preserving the named style. Normal line height
is displayed as Normal rather than an estimated number.

`retouch/test/e2e/typography.cjs` checks computed CSS on a named project style,
repeated important overrides, base/tablet isolation, reset and exact-byte undo for
the whole edit sequence. Each step waits for both the rendered result and the
committed source before taking its next history snapshot.

### Borders and corners

Appearance controls now include CSS border width/style/color, uniform radius and
individual corner radii. Color edits preserve border width and style. Increasing
a hidden border's width enables a solid visible border. Mixed corner values are
labelled Mixed; percentage/elliptical radii are not presented as pixel numbers.
The individual-corner disclosure remains open while making successive edits.

`retouch/test/e2e/appearance.cjs` verifies compiled borders, color/width/style
independence, individual-corner preservation, mixed-value refresh, responsive
isolation and exact-byte undo of the full sequence. These are CSS borders;
vector strokes, stroke alignment and multiple strokes remain unimplemented.

### Image framing

Image layers expose five CSS object-fit modes, a nine-point position control and
precise horizontal/vertical percentages. Changes follow breakpoint scope, retain
the image source and frame dimensions, and participate in shared undo/redo.
Numeric controls prefer committed class values while CSS recompiles, preventing
successive axis edits from restoring a stale value on the other axis.

`retouch/test/e2e/image-framing.cjs` verifies computed fit/position, visibly
different left/right crop screenshots, fixed frame dimensions, unchanged source
asset bytes, tablet/base isolation and exact-byte undo. The general inspector
browser regression also passed. These controls apply to editable IMG classes;
interactive crop handles, custom crop zoom/rotation, background-image framing and
multiple image fills remain unimplemented.

### Minimum and maximum sizing

Layout includes a Size limits disclosure with minimum/maximum width and height.
Inputs accept nonnegative lengths, percentages and intrinsic sizing keywords;
unitless numbers mean pixels. Per-property reset removes only the selected
scope's utility override. Authored arbitrary values are shown without converting
percentages into pixels. CSS functions and variables remain visible but are not
accepted as new inputs by these controls.

`retouch/test/e2e/size-limits.cjs` verifies actual geometry with fixed/fill sizing,
percentage constraints, minimum precedence over a smaller maximum, reset,
invalid-input rejection, tablet/base isolation and exact-byte undo. The existing
layout browser regression also verifies the surrounding controls. General nested
auto-layout equivalence and arbitrary-site CSS authoring remain open.

### Linked screen comparisons

Compare screens opens live phone (390×844), tablet (768×1024) and desktop
(1440×900) previews alongside the editing canvas. Each iframe has its own actual
CSS viewport dimensions; the rail scales the rendered page rather than changing
its responsive breakpoints. The selected source layer is outlined in each
preview, including multiple rendered instances. Hidden/absent selections are
identified. Edit activates that screen size on the main canvas while retaining
selection. Wheel scrolling inspects each preview independently. Routes follow the
main canvas; source edits and undo update the previews through the renderer.
Closing the rail unloads its browsing contexts before detaching frames.

`retouch/test/e2e/compare-screens.cjs` verifies exact viewport dimensions, different
responsive CSS, source-linked outlines, size switching, a tablet-scoped write
visible on tablet/desktop but not phone, undo, route changes and repeated preview
close/reopen. One initial run reported an unlocated framework error during frame
teardown; after explicit context unloading, lifecycle and route checks passed
without browser errors. The screenshot was visually inspected.

These are linked source previews, not complete multi-canvas editing: direct edits within comparison frames, synchronized app
state, per-screen override badges and general arbitrary-site support remain open.
Each preview executes its own application instance. Cross-origin pages cannot be
inspected through the current same-origin architecture.

### Custom comparison sets

Pin current size adds the main canvas dimensions as another live comparison.
Duplicate dimensions are disabled; each card can be removed independently.
Up to eight comparisons are retained in local storage for this origin, including
across editor reloads. Stored dimensions are validated before loading frames.
The extended comparison browser test verifies a real 1120×844 custom viewport,
duplicate prevention, removing a default/custom card, persistence, activation and
continued source edit/undo behavior. Comparison-card resizing and naming in place,
shared project-level screen sets and direct editing remain open.

### Native project startup

The desktop app now has Open project, a native folder/command dialog, a project
log window and Stop. Startup delegates to the bundled CLI with the selected
working directory and usual command; the app owns one project process at a time.
Quit signals the owned CLI. No native command bridge is exposed to web content.
The universal arm64/x86_64 build, ad hoc signature verification, URL/quoting test
and real-CLI launcher test passed. The latter checks working-directory and exit
status propagation through the same launch-argument builder.

Earlier computer-use attempts returned `cgWindowNotFound`. A fresh app instance
subsequently passed native dialog/log/Stop and the fixture startup-to-editing
flow, including automatic URL discovery. Signed/notarized distribution remains
unverified.
The current app bundles the CLI; Node must be on the login shell's PATH.

### Packaged CLI and local cask installation

The desktop build stages the CLI from source and installs only production
packages from the lockfile, with lifecycle scripts disabled. It copies that
closure into app resources before signing. The native launcher resolves the CLI
relative to its bundle, including after relocation to a path with spaces. Both
the native bundled-launch self-test and a real Next.js dev-server launch from the
relocated packaged CLI passed. The editor health endpoint and browser shell loaded.

The generated cask declares Node as a formula dependency. Local installation of
the actual archive/hash into an isolated app directory succeeded; signature
verification passed. The quarantined installed binary stalled before main
(`_dyld_start` in a process sample), so its runtime self-test was stopped without
removing quarantine. This does not prove Gatekeeper launch. Uninstall, temporary
tap removal and test trust-entry cleanup were completed. The generator's old
macOS comparison syntax was replaced with `macos: :ventura` after Homebrew's
warning. Public release hosting, signing/notarization and upgrade tests remain.

### Native automatic editor discovery

App-started projects feed complete output lines into loopback URL discovery.
Split chunks and terminal colors are handled before validation. The launcher
probes candidates for a Retouch-specific health marker, then opens the first
ready editor. Address editing, project stop/exit and app quit cancel discovery;
a 90-second timeout leaves a manual-connection message. It does not scan ports
or accept remote/network URLs. Multiple ready apps currently use first-ready
selection; an app picker remains open.

The universal build, URL/chunk/ANSI parser assertions, rejection of generic OK
health JSON, bundled CLI self-test, native health probe against the running
fixture and all 194 unit tests passed. The browser shell also loaded. A subsequent native UI pass also verified the startup-to-editor transition for
this fixture; broader project/framework startup behavior remains unverified.

### Native workflow verification and WebKit resize fix

A fresh rebuilt app instance was tested through native accessibility controls.
The folder picker selected the disposable Next fixture; its command dialog
started `npm run dev -- --port 3496` through the bundled CLI. The log window showed
startup, and the main window automatically connected to `/rt`. Reopening the
project preserved the command. Editing width 180→240px wrote `w-[240px]`; button
undo and Cmd+Z restored exact original source bytes, and Cmd+Shift+Z restored the
edit. Source was restored at the end.

The comparison rail rendered in WKWebView and activated phone/tablet dimensions.
This found a stale-value bug: the parent's viewport notification could precede
WebKit's child media-query recalculation. The shell now listens to the child
window resize and refreshes computed controls after it settles. A fresh rebuilt
native run verified opacity updating 100%→90% on phone→tablet without reselecting.
Stop removed the owned CLI/dev-server processes and port 3496 listener; the
external port 3491 server remained live. Welcome copy now matches native startup.
These checks do not establish file upload, complete native editing parity,
Intel runtime, arbitrary-site authoring or trusted release launch.

### Grid child spans

Layout now exposes column and row spans for in-flow children of CSS grids.
Choose 1–24 tracks, all tracks or automatic placement. Explicit line placement
on the edited axis is replaced; unrelated axis/dimension/project classes and
other breakpoint scopes remain intact. Unrepresented line placements display
Custom placement. Absolute/fixed elements do not show these grid-child controls.

The layout browser regression verifies two-column track-plus-gap geometry,
row/column independence, full/auto modes, tablet-vs-phone isolation and exact
source undo alongside existing flex/grid controls. All 195 unit tests passed;
focused tests also cover important, negative/named line tokens and preservation
of similarly named project classes. Named-line editing, track resizing and a
visual grid-placement canvas remain unfinished.

### HTML document foundation

A registered HTML adapter uses parse5 source locations and structural IDs for
ordinary `.html`/`.htm` documents. It stamps rendered output without changing
source, describes decoded text/classes/images, and plans text/class/tag/image
edits through the shared transactions and exact undo/redo history. Attribute and
text writes escape markup. Scripts, styles, comments and unrelated source bytes
remain intact. Parser-altering tag edits and stale snapshots are refused. Nested
rich text, implicit closing tags, responsive images and foreign SVG editing
still require additional document operations.

Five focused adapter tests cover parser/stamp agreement, real index resolution,
source-preserving edits, history round trips, escaping, stale-file protection and
unsupported constructs. All 200 tests passed. This is a backend foundation;
a subsequent HTML CLI/renderer integration is described below. It does not establish
that existing utility-based visual controls work on arbitrary HTML/CSS. The next
integration needs a renderer, durable CSS authoring, asset/provenance handling and
browser round-trip verification before HTML-site editing is user-facing.

### Local HTML rendering mode

`retouch html <web-directory> --port=9400` now serves local HTML documents and
static assets with the shared editor at `/rt`. Documents receive source IDs in
the response only; CSS and scripts remain authored. Text, supported tag and plain
image-source edits use the HTML adapter and shared undo/redo. Source monitoring
includes HTML files, and rendered pages reload after writes. Static serving
rejects hidden paths, package manifests, unsupported asset types and symlink
escapes, and retains loopback/Host validation from the shared server.

An HTTP integration test verifies stamping, asset preservation, authenticated
edits, class-edit refusal, exact undo and path boundaries. A real browser test
verifies selection, original CSS color, text/image changes and loaded images
after reload, followed by exact undo. All 201 tests passed, and the CLI smoke
check opened the editor through agent-browser.

This initially shipped with content editing; the subsequent CSS authoring path
is described below. Rich markup editing, capture/import, structural actions, image
uploads and full file/navigation/native integration remain open. Existing CSS is
not replaced with a framework or reset stylesheet.


### Persistent HTML CSS editing

The local HTML mode now has a CSS properties panel for dimensions, display,
flex direction/wrapping, gap, padding, typography, colors and borders. It writes
scoped rules into the source document, using a persistent element attribute.
Base and minimum-width rules are sorted so creating a base rule later does not
mask an earlier larger-screen rule. Reset removes a single property in the chosen
scope. Text and image editing continue to use the same source history.

Backend tests cover breakpoint order, isolation, reset, stale writes, malformed
values, externally modified rules and identity collisions. HTTP tests verify
CSS writes and exact undo. Browser tests verify phone/tablet computed widths,
unaffected siblings, standalone HTML rendering, reset inheritance and exact
source restoration. The suite now passes 204 tests.

This is a bounded CSS authoring path. Values are limited to supported simple
forms; shorthand expansion, arbitrary selectors, state/container queries and
existing stylesheet refactoring remain open. Generated declarations use
`!important`; stronger authored important rules may win, and inline important
conflicts are refused. It does not establish arbitrary-site or full Figma parity.


### Native HTML project opening

The native startup dialog offers HTML files and startup-command modes. A static
index folder without a package manifest defaults to HTML mode; app projects keep
their usual startup command. The bundled HTML CLI uses an available port and the
existing health discovery opens the editor. The canvas is brought forward after
connection. A universal build and bundled launch tests verify quoted paths,
mode detection, dynamic port discovery, health and termination. Native UI checks
verify folder selection, the HTML default, a persisted width edit, exact undo,
and Stop releasing the owned port. Release signing/notarization and public cask
distribution remain unverified and unfinished.


### HTML spacing and alignment controls

A shared value schema now drives the HTML inspector and CSS writer. Padding and
margin accept one to four values and expose individual sides; gap accepts two
values. Minimum/maximum height and flex/grid alignment are exposed. Negative
margins and letter spacing are accepted; invalid unitless dimensions and malformed
hex colors are refused before saving. New shorthand edits replace stored edge
overrides in the same scope; edge overrides sort after shorthand declarations.
The reader also recognizes earlier generated declaration ordering.

Inline important shorthand conflicts are checked for overlapping properties.
Reset can remove an editor override even after an important inline rule was added
externally. All 207 tests pass. Browser verification covers shorthand padding,
per-edge editing, shorthand replacement, reset inheritance and exact undo, along
with the existing responsive and standalone-output checks. Complex CSS functions,
selector editing and full visual-design parity remain open.


### HTML image assets

The HTML renderer exposes the web folder as its asset root and stores uploads
under `rt-assets`. The shared image browser now includes lazy thumbnail previews
and filename/path search. URL segments are encoded so spaces, Unicode, percent
signs and fragment characters remain part of filenames. HTML asset listing skips
hidden paths, dependency directories and symlinks. Uploads accept supported image
extensions and retain the existing project-containment checks.

HTTP tests verify root assets, encoded URLs, excluded paths, upload rendering and
refusal of an upload directory symlink outside the project. The full suite passes
208 tests. Browser checks verify case-insensitive Unicode search, previews,
selection, upload, rendered replacement and exact source undo. Uploaded files
remain reusable after undoing their reference; asset deletion and responsive
picture/source-set authoring remain open.


### Local HTML page navigation

The editor toolbar now lists HTML documents from the selected web folder. Nested
index files map to directory URLs, alternate index files remain reachable, and
filenames are URL encoded. Refresh discovers newly added pages. The authenticated
catalog omits hidden/dependency directories, symlinks and the editor's reserved
`rt` tree; it returns at most 1000 entries and identifies truncation. Other
renderers keep direct URL navigation without an unsupported page menu.

Page navigation commits active inline edits and clears the previous selection.
All 209 tests pass. HTTP checks verify encoded routes, directory indexes and
catalog boundaries. Browser checks create and discover a second page, navigate
to it, edit its source without changing the first page, undo exactly and return
home. Page creation/deletion in the UI, remote capture and framework route
catalogs remain open.


### History across page navigation

Source-write requests capture their originating page before awaiting the server.
The shared history controller retains that route with each gesture, so subsequent
navigation cannot change its destination. After a successful source undo/redo,
the shell opens the original page before resolving and refreshing the element.
A refused source operation keeps both the history entry and current page. Preview
load failure does not reverse a successful source-history transition.

All 210 tests pass. A controller test verifies the original route survives grouped
edits and redo. The HTML browser test edits a second page, navigates home, undoes
back on the second page, navigates home again and redoes back on the second page,
then verifies exact source restoration. History remains local to the running
editor session; persistent history and shared multi-user editing remain open.


### HTML image framing

HTML images now use the shared image framing UI, with fit modes, nine position
anchors, percentage coordinates and per-property reset. The HTML writer persists
`object-fit` and bounded percentage `object-position` rules at the selected
minimum-width scope. Utility-based renderers keep their existing class writer.

All 211 tests pass. Browser checks verify tablet fit and position overrides,
phone inheritance, reset and exact undo through the HTML source writer. These
are CSS frame controls; destructive bitmap cropping, masks and image effects
remain open.


### HTML layer opacity and rotation

An Appearance section exposes opacity percentages and rotation degrees for HTML
layers. The writer stores validated opacity and individual rotate declarations
in the selected responsive scope, leaving authored transform declarations intact.
The inspector identifies composition with an existing transform; resets remove
only the selected property override.

All 212 tests pass. Writer checks cover ranges, injection refusal, source
transform preservation and reset. Browser checks verify computed tablet opacity
and rotation, phone inheritance, reset and exact source restoration. This does
not provide full transform matrices, arbitrary transform origins, 3D transforms
or full Figma effects parity.


### HTML typography controls

HTML typography now has a dedicated section with font family stacks, numeric
weights, font style, decoration, text case and the existing text metrics/color.
The writer accepts bounded weights and simple quoted or Unicode font names,
preserves source text, and detects conflicts with important inline font
shorthands. It relies on existing page/system fonts; font upload and font discovery
remain open.

All 213 tests pass. Browser checks verify font family, weight, italic and
underline at the tablet scope, phone inheritance, return to the tablet styling,
and exact source undo. Text shaping controls, variable-font axes and full
Figma typography parity remain open.


### HTML layer organization

The HTML adapter now connects to the shared structural planner and Layers panel.
Complete literal siblings support duplication, movement and deletion with exact
source snapshots. Explicit source ranges exclude mixed text/comments, parser
inserted parents and incomplete markup. Cloning authored identity attributes or
linked editor styles remains refused; copying linked styles is a subsequent
required step. Styled layers can be moved or deleted.

Style identity allocation now avoids identifiers already owned by another layer
or retained style block, so moving a styled element cannot cause the layer at its
old structural position to acquire those rules. The original element retains its
persistent selector. All 217 tests pass, including source range preservation,
identity collision handling and independent post-move styles. Browser checks
verify duplicate, move, delete and exact undo. General reparenting, grouping,
styled cloning and structural editing of dynamic templates remain open.


### Independent styled HTML copies

HTML duplicate and same-parent paste now copy validated managed style rules for
the selected subtree to fresh identities. Base and responsive rules stay with
each copied layer, while later changes target only the chosen copy. The markup
and cloned rules form one transaction, so undo restores exact source bytes.
Malformed or ambiguous managed styles are refused, as are source ranges with
untracked duplicate attributes. Authored identity attributes still block cloning.

All 218 tests pass. Nested-subtree tests verify copied base/tablet rules and
independent edits. Browser checks verify two styled layers, matching tablet
widths, distinct persistent selectors, independent phone widths and exact undo.
This removes the previous linked-style cloning restriction. Authored-ID remapping,
general reparenting, grouping and dynamic-template structure remain open.


### Layer copy/paste controls

The shared Layers panel now exposes Copy and Paste plus Ctrl/Cmd+C and Ctrl/Cmd+V
on focused layer rows. The editor-local clipboard records source identity, hash
and parent; Paste inserts after the selected sibling through the existing source
planner and history. Availability updates with the selection and copied source.
Stale or different-parent targets are disabled and described in the button help.

All 218 tests pass. The HTML browser test verifies both button and keyboard
copy/paste, insertion position and exact undo. Keyboard tests wait for asynchronous
layer selection before issuing shortcuts. This is a local source clipboard;
system-clipboard interchange, cross-parent paste and durable copied fragments
remain open.


### HTML text and frame creation

The Layers panel now offers Add Text and Add Frame for explicit HTML content
containers, including empty containers. Text starts as an editable paragraph;
frames start as visible div containers with a minimum height and dashed border.
The new layer is selected immediately and can be styled or contain more layers.
Insertion validates the resulting parse tree, preserves all existing source
identities and uses the shared source transaction/history path.

All 220 tests pass. Writer tests cover empty/populated containers, stable IDs,
stale hashes and unsupported parent contexts. Browser checks create text, create
a visible frame, insert/edit text inside it and undo to exact original source.
Arbitrary shape insertion, general reparenting and equivalent creation in other
source adapters remain open.


### HTML grid frame controls

Grid/inline-grid containers expose equal-track row/column counts, and children
of those containers expose row/column spans. Controls use bounded counts of 1–24,
persist responsive CSS and reset each property independently. Authored track
syntax is identified as authored/automatic until replaced; choosing a count
explicitly creates equal tracks. Inline grid shorthand conflicts are recognized.

All 221 tests pass. Browser checks verify a two-column layout through actual
child positions, a spanning child, phone inheritance and exact undo. Arbitrary
track sizing, named grid areas, subgrid and draggable grid guides remain open.


### Atomic HTML flex sizing

Flex children expose Fill Available Space and Hug Contents, plus grow, shrink
and basis fields. Presets update flex factors, basis, main-axis size and minimum
size in a single validated CSS change set. Any invalid property or important
inline conflict refuses the whole edit. Each preset is one source transaction
and one undo entry; responsive scope applies to the complete change set.

All 222 tests pass. Browser checks verify the resulting item widths, Hug reducing
the content width, one-step exact undo for each preset, and phone inheritance.
Existing max-size constraints remain effective. Vertical writing-mode sizing,
full constraint combinations and direct on-canvas flex manipulation remain open.


### Flex sizing in vertical writing modes

Fill/Hug now derives the physical main axis from both flex direction and the
parent writing mode. Vertical rows size height, and vertical columns size width;
reversed directions retain that axis. The cross-axis dimension is preserved.

A dedicated browser test (`retouch/test/e2e/html-flex-writing.cjs`) covers six
horizontal, vertical-rl, vertical-lr and reversed-direction cases. It checks actual
filled/hugged dimensions, retained cross sizes and exact one-step undo for both
presets. All six cases passed in Chromium. WebKit runtime validation of these
specific cases remains outstanding; its Playwright runtime is not installed.


### HTML checks across Chromium and WebKit

The HTML editor and flex-writing suites now accept `RT_E2E_BROWSER=chromium` or
`webkit`. `npm run test:e2e:html` runs both suites. The combined command passed in
Chromium and WebKit using the fixture's Playwright 1.58.2. WebKit coverage includes
responsive CSS, typography, assets/uploads, page navigation, structural commands,
independent styled copies, clipboard actions, creation and flex sizing, with
source undo checks. The six writing-mode cases also passed in WebKit.

WebKit reports different intrinsic SVG dimensions under the page's image CSS.
The upload check now requires a decoded image at the uploaded URL and independently
checks exact saved bytes, avoiding an engine-specific natural-width assertion.

The Node-based browser installer stalled during extraction after download. The
archive passed `unzip -tq`; the owned installer was stopped and the archive was
extracted with system unzip into `/private/tmp/retouch-playwright-browsers`.
WebKit verification used that `PLAYWRIGHT_BROWSERS_PATH`; the partial default-cache
file was removed. This verifies the Playwright WebKit engine, not the packaged
AppKit application, Gatekeeper launch or a signed public cask release.


### HTML layer names and immediate page selection

HTML layer names persist in `data-rt-name`, leaving text and accessibility
attributes intact. The inspector exposes naming, layer search uses the name,
and F2 on a focused row opens the field. Clearing restores the original label;
undo restores exact source snapshots. Names are escaped and bounded to one line.

A browser pass also exposed an indexing race for newly created pages. An HTTP
regression test reproduced it: serving a new page could precede the index watcher.
The HTML server now indexes a document before returning its stamped markup, so
its elements resolve immediately.

All 223 tests pass. Chromium and WebKit HTML suites verify rename, search, F2,
clear, preserved page text/accessibility and exact undo. The direct HTTP check
verifies immediate selection of a just-created file. Naming in other source
adapters and bulk layer naming remain open.
