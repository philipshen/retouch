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
| Canvas | Frames, pages, sections, zoom/pan, rulers/guides, grids, multiple selection, alignment/distribution, snapping, grouping, stacking, locking/hiding | Bounded canvas zoom/scrolling and linked screen comparisons exist. HTML supports multi-selection, range selection, gray/page marquee gestures and framing a consecutive sibling selection. HTML/React canvas locks include batch undo and editor-reload persistence within a live project session. Full document/pages/sections, guides, complete snapping/grouping, durable lock identity and cross-renderer equivalence remain. |
| Layers | Complete searchable tree, nesting/reparenting, reorder, rename, duplicate, delete, copy/paste across contexts | Searchable live layer hierarchy, disclosure, keyboard navigation, canvas-linked selection and literal sibling duplicate/delete/reorder UI exist. HTML also supports rename and reparenting by picker or drag/drop. HTML multi-selection, shared CSS and group duplicate/delete/reparenting exist; cross-context clipboard and broader source structures remain. |
| Geometry | Shapes, vector/pen editing, vector networks, boolean operations, masks, strokes, corners, transforms | HTML frame aspect ratios, content clipping, SVG primitive creation/geometry and responsive solid fill/stroke controls are verified. HTML/React polygons and polylines now support direct vertex dragging and keyboard movement with source undo. Vertex insertion/deletion and Pen creation of straight segments and cubic curves in existing SVG canvases have browser/source verification. Compound SVG paths now support cubic handles, arcs, contour operations, multi-point and marquee selection, and canvas-axis alignment/distribution with source history. Vector networks, boolean operations, arbitrary masks and complete transforms remain. |
| Layout | Auto layout, grid, wrap, hug/fill/fixed, min/max, constraints, absolute children, padding/gaps, responsive behavior | HTML provides direct stack presets, physical nine-position flex alignment (including wrapped/RTL/vertical layouts), adaptive grids, equal tracks/spans, hug/fill, min/max, spacing and breakpoint-scoped writes. HTML absolute placement now supports edge, center, stretch and proportional anchors with screen-scoped writes. Transformed constraints, advanced grids, nested auto-layout equivalence and cross-framework coverage remain. |
| Appearance | Multiple fills/strokes, gradients, images and cropping, blend modes, opacity, shadows, blur/effects | HTML supports linear/radial gradient stacks with draggable stops, shadow stacks, layer/backdrop blur, blend modes, opacity, borders/corners and image fit/position. Browser/source tests cover these scoped edits and undo. Multiple strokes, arbitrary paint/filter representations and full crop handles/zoom/rotation remain. |
| Typography | Font selection, weights/styles, variable axes, text runs, paragraph controls, lists, decoration, sizing and resizing behavior | Inline formatting plus custom font size, line height, tracking, alignment, slant, decoration, case and scoped reset now exist. Browser tests cover named-style preservation, scoped sizes and exact undo. A searchable page-font picker now discovers declared and used families, with React/HTML and local Liquid browser coverage. Explicit variable-axis editing, declared-file range/default inspection and bounded axis sliders have HTML/React/local Liquid browser coverage. Full font browsing, actual glyph-font resolution, live Shopify font verification, full rich-text/paragraph/list controls and complete typography parity remain. |
| Components | Create/reuse, variants, exposed properties, overrides, nested instances, swap/reset/detach, shared libraries | Existing React and Liquid component inspection/detach; full creation/variants/library workflows remain. Live Shopify proof is incomplete. |
| Design systems | Reusable styles, tokens/variables, aliases, collections/modes, import/export and updates | Not implemented or verified. |
| Prototypes | Connections, interactions, states, transitions/animation, overlays, scrolling, variables/conditions, presentation | App interact mode exists; design authoring workflow remains. |
| Assets/export | SVG/raster/PDF export, scales, selections/frames, asset libraries/import | Image upload and SVG-canvas SVG/PNG/JPEG downloads exist, including shared local definitions and bitmap embedding. Arbitrary-layer export, fonts, symbols and the full export/import pipeline remain. |
| History/collaboration | Reliable undo/redo across all actions, persistence, version restoration, multiplayer behavior and review | Shared undo/redo controller is now connected to all shell history records, toolbar buttons and keyboard shortcuts. Source and browser tests cover ordered restores, refusal/retry, branch invalidation and structural redo. Persistence across editor restarts, complete gesture grouping, version browsing and collaborative editing remain. |
| Any site | Useful authoring on arbitrary public/local sites and source-connected editing across frameworks; honest source mapping and durable edits | Next/React, Shopify/Liquid and local static HTML have source adapters with different capabilities. HTML has responsive CSS, structural edits and batch selection operations. Arbitrary remote-site capture/authoring, other frameworks, dynamic structure and equivalent capabilities across adapters remain. A native WebView alone does not provide this. |
| Screen sizes | Easy size selection, continuous resizing, side-by-side linked views, explicit inheritance and breakpoint overrides, discoverability | Presets/custom dimensions/rotation/persistence resize the actual iframe; zoom preserves viewport dimensions. Linked comparison previews exist, with edits on the main canvas. React/Tailwind scopes and HTML responsive layouts/styles have browser/source verification. Direct width and height handles support live resizing, cancel and keyboard steps. Corner resizing also supports Shift-locked proportions. Comparison cards now show current scope coverage and offer an explicit width-and-larger style-scope action. Fully editable comparison canvases and cross-framework parity remain. |
| Desktop | Native installable app, project/site onboarding, editor operation, keyboard/file integration, recovery | Universal AppKit/WKWebView build and bundled CLI launcher tests pass. Earlier native UI fixtures passed startup/edit/undo/Stop; The latest recorded ad hoc bundle packages d9cd994 and retains a failed browser/native-launch receipt; see desktop/README.md. Native launches are paused at the user's request. Current native interaction remains unverified. File flows, Intel runtime and broader lifecycle verification remain. |
| Homebrew | Published immutable archive, integrity hash, cask/tap, install/launch/upgrade/uninstall, trusted macOS distribution | Universal ZIP, SHA-256 and cask generator exist. Development build is ad hoc signed. Local cask install/uninstall passed. Developer ID signing/notarization, publishing, upgrades and quarantined launch remain unverified. |
| Ease of use | New user can open a site, select/edit, compare screens, undo and retain work without learning implementation details | Controls have labels and basic defaults. Whole-workflow usability validation remains. |

Figma reference material used to anchor the inventory:
[auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties),
[variables](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma),
[variants](https://www.figma.com/best-practices/creating-and-organizing-variants/).
This inventory still needs a complete audit against Figma's current Design UI and
documentation. Nothing in it proves full parity.

## Verification baseline and historical checks

- `cd retouch && npm test`: 334 passed. Run with local network/watch permissions;
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


### Moving HTML layers into frames

Move Into exposes a destination picker for HTML content containers. The source
planner moves a complete literal subtree within the same document, retains its
persistent style selectors and records the common ancestor for stable undo/redo.
It rejects descendant/self destinations, stale source, unknown containers and
moves that alter the parsed structure. The moved layer is selected after reload.

All 225 tests pass. Writer checks cover destinations before and after the source,
linked responsive styles, cycles and invalid nested-form moves. Chromium and
WebKit browser checks move a styled heading into a newly created frame, verify
its width and exercise exact undo/redo. Drag/drop reparenting, cross-document
moves and dynamic-template structure remain open.


### Dragging HTML layers into containers

The Layers tree now supports dragging a layer onto a valid content container to
append the source subtree inside it. Eligible targets highlight during the drag;
self, descendant and current-parent targets are excluded. The operation uses the
same validated source planner and exact history as Move Into. Dragging is enabled
only for adapters advertising reparent support. The destination picker remains
available for keyboard use.

All 225 unit tests pass. Chromium and WebKit browser checks perform a real layer
drag into a new frame, undo the move, then undo frame creation and compare the
source with its original bytes. This does not add drag-based sibling placement,
cross-document moves or native package verification.


### Placing HTML layers before or after another layer

Dragging near a row's top or bottom edge now inserts before or after that layer,
with a line indicating the position. The center of a content-container row still
nests the layer. Relative placement works within a parent and between parents,
including literal list siblings. The source planner validates both source and
anchor regions, rejects cycles, and verifies the moved node's actual parent
location after parsing.

All 227 unit tests pass. New writer checks cover before/after moves in both source
directions, moves between parents, list siblings and invalid placements. Chromium
and WebKit browser checks drag a heading after and then before a paragraph, undo
both operations, and verify the original source bytes. Cross-document placement,
multi-layer dragging and dynamic-template structural editing remain open.


### Responsive HTML shadow stacks

The HTML inspector now edits stacked box shadows: drop/inner type, X/Y offset,
blur, spread, color, front-to-back ordering and removal. Add creates a subtle
drop shadow. Clear writes `none` at the current scope, while Reset removes the
local override. Each operation uses the existing CSS source transaction and
undo history. Shared parsing handles computed color-first serialization and
validates up to 16 shadows with pixel lengths. Unsupported authored expressions
are identified instead of silently converted.

All 228 unit tests pass. Writer checks cover stacked serialization, invalid blur,
injection, responsive persistence/reset and inline-important conflicts. Chromium
and WebKit verify adding and editing shadows, a separate tablet stack, inner
shadows, reordering, inherited reset, clearing, and exact undo of all seven
operations. Other effects such as filters, background blur, gradients and blend
modes remain incomplete. This is not a native package verification.


### HTML blur and blending

Appearance now includes supported CSS blend modes and isolation of child blending.
Layer/background blur controls preserve supported existing filter functions in
their original order, including color adjustments and drop shadows. Setting blur
to zero removes that blur function. Clear removes the full stack at the current
scope; Reset removes the local override. Unsupported expressions and repeated
blur functions are identified instead of silently replaced.

All 229 unit tests pass, with a subsequent focused CSS suite also passing after
adding prefixed backdrop-filter conflict detection. Chromium and WebKit verify
computed layer blur, background blur, blend mode and isolation, preservation of
authored contrast, independent tablet blur, inherited reset, clear, and exact
undo of seven edits. These checks establish CSS behavior, not pixel equivalence
with Figma rendering. Gradient fills, arbitrary filter-stack editing and broader
framework parity remain unfinished.


### Current native bundle and cask refresh

Rebuilt the universal Mac app from `54ccdbe` to include the recent HTML editing
features. Bundled launcher/HTML discovery self-tests passed. A local cask install
and uninstall passed for the exact generated archive; the installed app had
both architectures, passed strict ad hoc signature verification, and matched
all 61 packaged source files. The test app and temporary tap were removed.
The archive, cask and hash receipt remain under
`/private/tmp/retouch-desktop-effects-build`.

Current native interaction remains unverified because CUA could not find the
window after a fresh launch and session. A process sample established AppKit
execution, not visual usability. The test process was stopped. Public release,
notarization, trusted Gatekeeper launch and Intel runtime verification remain
outstanding. See `desktop/README.md` for the exact archive hash and evidence.


### HTML gradient fill stacks

The inspector now authors stacked linear/radial background gradients with previews,
angle/center controls, color stops, percentage positions, insertion/removal and
front-to-back ordering. Stops sort by position after edits. Source validation
supports eight fills and sixteen stops per fill, retains responsive scopes, and
refuses conflicting important background shorthand. Existing unsupported image
backgrounds are identified and require explicit clearing before replacement.

All 230 unit tests pass. Chromium and WebKit verify gradient creation, angle,
stop insertion/color, radial type/center, fill stacking/reordering, independent
tablet styling, inherited reset and exact undo of nine edits. Screenshots and
DOM width checks establish that the controls fit the inspector. Chromium exposed
a detached-node timing issue in the earlier shadow layout check; the scroll and
measurement now execute together on one attached DOM node. Canvas handles, conic
and repeating gradients, arbitrary background images, and Figma pixel equivalence
remain unfinished.

Native startup investigation in this turn ruled out early delegate release: the
optimized Swift SIL retains Studio until after NSApplication.run returns. CUA
still reported cgWindowNotFound on a fresh launch, and the owned test process was
stopped. No speculative native source change was made. The last Mac ZIP predates
these gradient changes.


### Direct gradient-stop positioning

Gradient fills now include a stop rail with color handles. Pointer dragging
updates the fill preview and selected canvas element without writing source.
Release restores the transient inline style and saves one source transaction.
Escape, pointer cancellation, focus loss or removal of the inspector cancels
the preview. Existing inline styles are restored on completion. Keyboard arrows
move stops by 1%, Shift by 10%, and Home/End to the bounds; focus returns to the
corresponding stop after the editor reloads. Numeric fields remain available.

All 230 unit tests pass. Chromium and WebKit exercise a real pointer drag,
verify the canvas preview changes before source does, commit, cancel a second
drag, verify transient style removal, move a stop with the keyboard, verify
focus restoration, then undo both committed edits to the exact prior source.
The rendered rail and preview were visually inspected. On-canvas gradient
geometry handles and native interaction with these controls remain unverified
or unfinished.


### HTML multi-selection and atomic shared styling

Shift/Cmd/Ctrl-click toggles layers in the tree or canvas. Every selected layer
has a canvas outline and tree selection state. The inspector shows shared CSS
values and leaves mixed fields empty until edited. Shared opacity, rotation,
blending, dimensions, spacing, typography, colors and borders use the selected
responsive scope. Single-layer structural/resize actions are disabled for groups.

The batch planner validates 2–100 distinct body-layer identities in one document,
checks the file hash, and plans each change against private in-memory snapshots.
Only a fully validated result produces one file edit and one history entry.
A refusal on a later layer cannot leave earlier layers changed. Undo/redo restores
both source and the selected group. API descriptions retain HTML CSS authoring
flags after batch writes.

All 233 tests pass. Planner tests cover atomic edits, isolated identities,
responsive reset/no-op, stale/invalid targets and partial-plan refusal. HTTP
checks cover ancestor/child selection, adapter metadata and exact batch undo.
Chromium and WebKit exercise tree/canvas toggling, mixed font weights, shared
width/tablet opacity, untouched unselected image, restored group selection,
and exact undo/redo. The shared inspector and outlines were visually inspected.
Marquee/range selection, grouping, multi-layer structure, cross-file selection,
and shared complex-effect controls remain unfinished.


### Duplicate and delete HTML selections

Multiple selected HTML layers can now be duplicated or deleted atomically.
Overlapping ancestor/descendant selections reduce to the outermost selected
subtrees, which are handled once. Duplicate creates a copy beside each original
and allocates independent responsive style identities. All roots must pass source
validation before the planner returns one file edit. Temporary copy/parent
markers exist only during planning and are removed before any write. The planner
checks parsed element counts, copied parents and combined style ownership.

The duplicate/delete buttons and keyboard shortcuts now apply to the selection.
Copies become selected; deleting selects their common ancestor. History stores
the before and after selections, so undo/redo restores both exact source and
selection membership. Other single-layer structural actions remain disabled for
a group.

All 236 unit tests pass. Writer tests cover independent styled copies across
parents, nested selection reduction, untouched siblings, unknown/stale targets,
invalid source regions, authored IDs and protected roots. Chromium and WebKit
copy a styled selection, edit only its copies, undo that styling, delete both
copies through a selected row's keyboard shortcut, restore the deletion, and
exercise exact duplication undo/redo. Group reparenting, grouping/ungrouping,
marquee selection and cross-document clipboard remain unfinished.


### Moving HTML selections together

Move Into and Layers drag/drop now move the selected outer subtrees as one set.
Container centers nest the set; row edges place it before/after the target.
All selected rows show drag feedback, and targets within selected subtrees are
excluded. The source planner preserves document order rather than click order,
retains linked styles, checks every source range and destination, and returns
one atomic edit. Temporary markers verify each moved root's parsed parent and
contiguous order, then are removed before persistence.

All 239 unit tests pass. Planner tests cover earlier/later destinations, every
placement, responsive style retention, nested selections, cycles, invalid ranges
and parser-changing nested forms. Chromium and WebKit move a set through the
picker, undo it, drag it into a frame, drag it back before a sibling, and verify
exact source/selection undo and redo. Grouping/ungrouping, marquee selection,
cross-document moves and broader renderer support remain unfinished.


### Layer ranges and scoped select-all

HTML Layers selection now supports anchored Shift-click ranges, Shift plus
Up/Down/Home/End navigation, and Cmd/Ctrl-click toggling. Cmd/Ctrl+Shift extends
a range into the existing selection. The anchor resets when the frame document
changes. Select visible layers and Cmd/Ctrl+A on a row select displayed design
layers; a filter restricts that set to matching labels and excludes context-only
ancestors. Collapsed descendants and HTML/body roots are excluded. The search
input retains normal text-selection behavior.

Batch selection resolves every requested identity against one unchanged HTML
document before replacing the selection. It preserves the existing 100-layer
limit and ignores superseded requests; clearing selection invalidates pending
classification. No selection operation writes source.

All 239 unit tests pass. Chromium and WebKit verify forward and contracting
ranges, keyboard expansion/contraction, individual toggling, select-all, filtered
select-all, excluded context ancestors, search text selection and collapsed-tree
selection, then compare source bytes with the original. Canvas marquee selection
and broader renderer multi-selection remain unfinished.


### HTML canvas marquee selection

Dragging from an empty HTML/body page background now draws a marquee in the
editor overlay. Release selects fully enclosed source-connected layers. If a
parent is fully enclosed, its descendants are represented by that parent rather
than selected again. Shift/Cmd/Ctrl adds the result to the current selection.
Escape, pointer cancellation, lost capture, resize, navigation and focus loss
clean up the gesture. The post-drag click is suppressed so it cannot replace the
new selection. Normal editing and interaction modes retain their existing gates.

All 240 unit tests pass. The geometry test covers reverse drags, containment and
partial/zero-size exclusions. Chromium and WebKit perform real mouse gestures
for a text-layer rectangle, additive image selection, cancellation, and a reverse
drag enclosing the whole main container. They verify rectangle cleanup, preserved
selection on cancellation, outermost-parent selection and unchanged source bytes.
Starting on content or the outer gray canvas, clipped/irregular hit geometry and
marquee support in other renderers remain unfinished.


### Marquee selection from the gray canvas

HTML marquee gestures can now start in the surrounding gray canvas and cross
into the page. A fixed overlay clips the rectangle to the visible canvas; it
cannot expand the canvas scroll extent. Pointer coordinates map through the
current iframe scale, while layer containment is clipped to the page viewport
so offscreen page content is excluded. Pointer capture, additive selection,
Escape cancellation and source preservation apply to gray-start gestures too.

All 241 unit tests pass, including page-viewport clipping. Chromium and WebKit
browser checks cover page-start gestures, gray-start selection and cancellation,
unchanged scroll dimensions/offsets during dragging, zoomed-out coordinate
mapping, and exact source bytes. The gray/page boundary overlay was also inspected in a Chromium screenshot.
Starting on content, irregular/clipped layer geometry and other renderers remain
unfinished; this is not full Figma parity or native release verification.


### Frame a selection and release its children

HTML layers now expose Frame selection for a single layer or consecutive sibling
selection, and Remove frame for containers created by this operation. Framing
keeps the original child markup, attributes, whitespace and linked responsive
styles. Removing an otherwise untouched frame restores the exact original bytes.
The new frame uses the existing responsive inspector. Each operation records one
history entry with the selection before and after it.

The source planner validates source hashes, normalizes selected descendants,
and tracks every existing parsed element across source-offset changes. It refuses
cross-parent/nonconsecutive selections, incompatible parent containers and
incomplete/template markup without returning an edit. Unit coverage includes
responsive styles, authored child IDs, exact removal, nested selections and
atomic refusals. All 244 unit tests pass. Chromium and WebKit verify framing,
independent tablet sizing, removal, exact undo/redo and selection restoration.
The selected frame and layer actions were inspected in a Chromium screenshot.

This creates a real block container. It can change CSS selector matching,
margin collapse and flex/grid layout; pixel-preserving Figma groups, arbitrary
cross-parent grouping and frame operations in other renderers remain unfinished.


### Direct stack and alignment controls

The HTML container inspector now starts with a Layout section. Horizontal stack
and Vertical stack set display, direction and no-wrap in one screen-scoped edit.
A nine-position control aligns children within single-line flex containers by
physical screen position, accounting for writing mode, text direction and reversed
flex direction. Existing gaps, margins and child sizing remain authored; alignment
needs available container space. Wrapped flex and grid keep their existing CSS
controls rather than presenting an inaccurate physical alignment grid.

All 247 unit tests pass, including axis mapping and atomic responsive changes.
Chromium and WebKit cover independent tablet/base layouts and exact stack/alignment
undo. Geometry checks exercise nine horizontal, vertical, reversed and RTL
fixtures, with child bounding boxes checked at opposite corners and along both
stack axes. A Chromium screenshot confirms the visible controls and selected state.
Full auto-layout parity, pixel-preserving groups and other renderer support remain
unfinished.


### Wrapping and physical alignment across lines

The HTML Layout section now exposes Child wrapping for single-line, normal and
reverse wrapping. The alignment grid also works with wrapped flex layouts: one
atomic edit sets justification, item alignment and line alignment at the chosen
screen scope. Reverse wrapping flips the physical cross-axis mapping. Align lines
is additionally available in the CSS fields with its own reset.

All 248 unit tests pass. Chromium and WebKit each verify twelve normal/reverse
wrapping fixtures across horizontal, vertical, reversed and RTL axes. Actual child
bounding boxes must form two rows and two columns at the chosen opposite corners.
Screen-scoped wrapping changes apply at tablet size while the phone retains its
original wrapping, and each edit undoes to exact source. The new fixture is part
of test:e2e:html; its screenshot was inspected. This extends flex auto-layout,
while full Figma parity, other renderers and native release remain incomplete.


### Native bundle refreshed through wrapping controls

Source commit `4670764` was built as a universal Mac app with a staged, locked
production dependency installation. Bundled native launcher tests passed command
exit/working-directory handling, literal HTML folder paths, dynamic-port discovery,
health and shutdown. The exact ZIP installed successfully through a temporary
local Homebrew cask. Strict signature verification passed, both architectures
were present, and all 66 packaged source files matched the checkout. Quarantine
was preserved. The temporary cask/app/tap and owned app process were removed,
and Homebrew developer mode remains disabled.

The archive and per-file receipt are in `/private/tmp/retouch-desktop-layout-build`;
see desktop/README.md for the exact SHA-256. Native CUA opening still returned
cgWindowNotFound, so interactive use of this bundle is unverified. This proves
local build and cask installation, not public distribution, notarization, Intel
runtime or full native UI parity.


### Adaptive grid columns

The HTML Layout section now offers Adaptive grid and Minimum column size (px).
The preset atomically sets grid display, auto-fit columns with a bounded minimum,
and automatic rows. A nested CSS minimum lets a single track shrink below the
chosen size on narrow screens. Managed adaptive rules are recognized across
inherited screen scopes, and the minimum can be overridden per breakpoint.
Child dimensions, spans and authored flow rules remain in effect; this is not a
guarantee that arbitrary fixed-size content cannot overflow.

All 249 unit tests pass. Chromium and WebKit verify the fixture's one/three/five
columns at phone/tablet/desktop sizes, fitting a 240px viewport, a tablet-specific
minimum, inherited control values, unchanged source during resizing and exact
undo/redo. The fixture is included in test:e2e:html, and its inspector screenshot
was inspected. Full grid/Figma parity, other renderers and native release remain
unfinished.


### Frame ratios and content clipping

HTML containers expose Frame aspect ratio and Clip content in Layout. Ratio input
normalizes colon or slash notation and atomically sets the ratio plus automatic
height. Overflow clipping uses CSS clip; resetting removes the scoped shorthand
and axis overrides. Source validation checks positive bounded ratios and overflow
shorthand/axis conflicts. Content and minimum dimensions can override a preferred
aspect ratio; this does not promise fixed geometric frames in every page layout.

All 250 unit tests pass. Chromium and WebKit verify square and widescreen frame
geometry, actual overflow hit-test exclusion, independent phone/tablet ratio and
clipping overrides, clipping reset, and exact atomic source undo/redo. The fixture
is included in test:e2e:html; its screenshot was inspected. Arbitrary masks,
clipped selection outlines, other renderers and full Figma/native parity remain
unfinished.


### Complete HTML integration pass at b94fe53

The entire `npm run test:e2e:html` command completed successfully in both Chromium
and WebKit against source commit `b94fe53`. Each engine ran all five shipped
workflows sequentially: general HTML editing/history/selection/framing, nine
flex-writing geometry cases, twelve wrapped-layout cases, adaptive grids, and
frame aspect-ratio/clipping behavior. This rechecks older editing flows after the
new Layout controls and CSS metadata support were combined. Both processes exited
zero and all their page-error assertions passed.

This is integration evidence for the tested static HTML fixtures. It does not
establish arbitrary-site behavior, complete Figma parity, native WKWebView
interaction or public distribution. The requirement matrix above was refreshed
to distinguish the implemented HTML capabilities from those remaining gaps.


### Screen-scoped visibility without losing layout

HTML Appearance now exposes Visible layer and Reset visibility; multi-selection
adds Shared Visibility with atomic batch writes. These use CSS visibility, keeping
layout space and authored display settings intact. Hidden layers remain in the
layer tree for selection and restoration. Display:none remains a separate CSS
control for removing layout space; this is not full Figma hide/lock behavior.
CSS visibility inheritance also permits descendants to explicitly become visible.

All 251 unit tests pass. Chromium and WebKit verify single hide/show, selecting a
hidden layer through Layers, unchanged sibling geometry, atomic multi-hide,
independent tablet visibility, preserved flex display, reset and exact source
undo. The fixture is part of test:e2e:html and its screenshot was inspected.
Layer-tree eye shortcuts, locking, other renderers and full parity remain open.


### Native window diagnostic

Native startup now has an opt-in `--diagnose-window` command that reports AppKit
window/activation/screen/WebView state after two seconds and quits without opening
a project. The universal build and bundled launcher tests pass. The diagnostic
confirmed window creation and plausible on-screen geometry with WebView loading
finished, but the application remained inactive and the window was reported as
occluded. CUA still returned cgWindowNotFound after a normal macOS launch. A
one-shot deferred activation experiment did not change those results and was
removed. All owned investigation processes stopped.

This is stronger startup evidence, not a native UI pass. The unresolved boundary
is activation/desktop visibility rather than absence of an allocated window;
the precise external or application cause remains unproven.


### Independent HTML corners

The HTML Corners section exposes uniform rounding and four physical corners,
including two-length elliptical values and individual resets. Shared CSS also
includes these fields. Uniform rounding clears per-corner overrides at its scope;
individual corners serialize after the uniform shorthand. The writer retains
historical ordering relative to other shorthand families so older saved rounding
rules remain readable. Important border strokes no longer incorrectly block
rounding, while overlapping important radius declarations are still refused.

All 252 unit tests pass. Chromium and WebKit verify elliptical top-left rounding,
untouched other corners and important border stroke, responsive inheritance,
uniform replacement, individual reset and exact source undo. The new fixture is
included in test:e2e:html; its screenshot was inspected. Figma corner smoothing,
vector geometry, other renderer parity and trusted native release remain open.


### Inspector scroll continuity

Refreshing the same selection now restores the inspector scroll offset after all
sections are rebuilt, including early-return inspector paths. A changed selection
or cleared selection starts at the top. The key includes source file, selection
scope, instance and selected IDs; ordinary style/hash changes keep the same key.
This fixes the observed jump to the top after editing a corner below the fold.

Chromium and WebKit corner tests explicitly scroll before editing and verify the
saved scroll offset remains within one pixel, plus a new selection resets to zero.
The inspected screenshot now retains the Corners section after saving. This
improves editing continuity; focus restoration and full native/all-renderer
interaction coverage remain separate unfinished work.

The full seven-workflow HTML browser command also passed in Chromium and WebKit
after this shared-renderer change, including general editing, flex/wrapping,
adaptive grids, frame bounds, visibility and corners.


### Elliptical shorthand round-trip

The uniform HTML radius field now accepts one to four horizontal radii followed
by a slash and one to four vertical radii, including percentages. This closes the
gap where the browser displayed elliptical shorthand that the editor rejected.
Malformed axes, extra slashes, negative lengths and declaration injection remain
refused. All 253 unit tests pass; Chromium and WebKit verify editing both axes,
computed independent corners and exact undo in the existing corner workflow.


### Inline SVG primitive source editing

The HTML adapter now assigns stable identities to supported inline SVG roots,
groups and shapes while keeping following HTML source IDs stable. Rectangles,
circles, ellipses and lines expose coordinate/size attributes in SVG geometry.
Edits validate the attribute vocabulary, bounded numeric/px/percentage values,
source hash and unchanged parsed identities. Reset removes the attribute; every
write is an ordinary source transaction with exact undo. SVG shapes do not expose
HTML text editing or HTML structural dragging. Definitions, text and foreign
content remain excluded from indexing.

All 256 unit tests pass. Chromium and WebKit verify SVG canvas/tree selection,
rectangle width and viewBox scaling, circle/ellipse/line edits, unchanged adjacent
HTML and exact source undo/redo. The SVG fixture joins test:e2e:html; its screenshot
was inspected. Geometry remains shared across sizes and CSS can override geometry
attributes. Shape creation, vector paint/path/pen tools, SVG structure and full
Figma/native parity remain unfinished.


### Responsive inline SVG paint

SVG paint now exposes fill, stroke, width, line ends, line joins and dash patterns
directly below geometry. These controls use the existing breakpoint CSS writer,
retain original presentation attributes and support reset and exact source undo.
Stroke lengths are bounded, line styles use an explicit vocabulary, and URL paint
references and declaration injection are refused. Important inline conflicts are
refused by the existing writer. Original attributes and inherited CSS return when
the corresponding managed override is removed.

All 258 unit tests pass. Chromium and WebKit verify computed fill/stroke styles,
phone/tablet inheritance, reset and exact undo alongside SVG geometry checks.
The paint screenshot was inspected. This covers solid paint and simple strokes;
gradient/pattern references, vector creation and full parity remain unfinished.


### Create SVG primitives

Add shape now inserts rectangles, circles, ellipses and lines into HTML content
containers or explicitly closed SVG roots/groups. HTML insertion creates a
200 × 200 SVG viewport and selects the shape. Existing SVG insertion uses its
viewBox origin/dimensions or numeric width/height, with a 200-unit fallback.
One transaction creates the viewport and shape together; history restores the
original parent selection on undo and the new shape selection on redo. Existing
HTML insertion now uses this same selection-aware history behavior.

All 261 unit tests pass. Chromium and WebKit verify all four new-viewport
presets, insertion into an existing SVG, visible geometry, exact source undo/redo
and selection restoration. Source tests cover translated icon viewBoxes, groups,
stale hashes, templates and unsupported containers. The creation screenshot was
inspected. The broader HTML workflow also passes in both engines after the
shared insertion-history change. Drawing by drag, vector path authoring, SVG structural actions,
transform-aware placement and full parity remain unfinished.


### Delete SVG layers

Delete layer now supports complete indexed SVG primitives, groups and viewports.
It removes exactly the selected source region, validates all retained indexed
elements and their parsed parents, and leaves surrounding comments/definitions
unchanged. Templates and stale source hashes are refused. Deletion selects the
parent, undo selects the restored layer and redo returns to the parent. Managed
paint rules outside the deleted region remain in source, as with HTML deletion;
exact undo restores the layer with its previous paint.

All 263 unit tests pass. Chromium and WebKit verify deleting a painted primitive,
a group with descendants and a whole viewport, including source/selection undo
and redo and unchanged adjacent HTML. SVG duplication, reordering, reparenting
and broader vector authoring remain unfinished; full parity is not achieved.


### SVG stacking order

Send backward and Bring forward now swap adjacent complete SVG layers inside
a canvas or group. The writer preserves both source chunks and intervening
comments/whitespace, validates all retained indexed elements and parsed parents,
and remaps the selected source identity. Groups move with their descendants;
managed paint identities stay attached. Unsupported SVG siblings and stale
hashes are refused. The layer remains selected through source undo and redo.

All 265 unit tests pass. Chromium and WebKit verify an overlapping rectangle
and circle switching the topmost hit-tested shape, preserved managed fill,
selection restoration and exact source undo/redo. The initial WebKit selection
assertion was changed to wait for the asynchronous Layers highlight. SVG
duplication, reparenting, drawing/path tools and full parity remain unfinished.


### Independent SVG duplication

Duplicate layer now copies complete SVG primitives, groups and viewports next
to the original. Managed CSS identities and all breakpoint rules are cloned
independently. Parsed original/copy nesting and final source identities are
validated; the copy is selected immediately and after redo, while undo selects
the original. Authored IDs/keys/refs, template content and unsupported descendants
remain refused pending reference remapping. SVG copy/paste remains unavailable.

All 268 unit tests pass. Chromium and WebKit verify independent copied fill and
geometry, group/viewport descendants, selection and exact source undo/redo.
Source tests cover cloned base/tablet paint rules and refusals. The screenshot
shows the magenta original and separately positioned green copy. Reference-aware
copying, SVG reparenting, drawing/path tools and full parity remain unfinished.


### Direct responsive width exploration

A right-edge width handle now resizes the actual preview continuously between
240 and 7680 CSS pixels. It accounts for centered/overflowing canvas geometry
and zoom, batches pointer previews per animation frame, persists on release,
and cancels on Escape, lost capture, pointer cancellation or window blur.
Keyboard arrows step 1 px, Shift steps 10 px and Home/End choose the limits.
Cancel restores the prior fixed size or Fit workspace mode. Width changes keep
source and style scope unchanged. The handle is hidden when its edge is outside
the visible canvas; zooming out or the existing width field remain available.

All 269 unit tests pass. Chromium and WebKit verify live breakpoint layout
changes, preview-only persistence during drag, cancellation, keyboard, reload
persistence, zoom and unchanged source/scope. The screenshot was inspected.
Height/corner resizing, editable comparison canvases and full parity remain
unfinished.


### Direct viewport height resizing

The bottom edge now exposes a height slider using the same pointer transaction
as the width handle. Both axes share cancellation, persistence, bounds and
keyboard behavior. Height uses vertical movement adjusted for zoom, preserving
width. Fit workspace starts height dragging from the rendered viewport height
so a zoomed preview keeps its edge position when entering a fixed size.
Pointer release also consumes the final pointer position before saving.

All 270 unit tests pass. Chromium and WebKit verify both axes, live height media
queries and 100vh geometry, independent width, Escape cancellation, keyboard
steps, reload persistence and restoring Fit workspace. Source and style scope
remain unchanged. Corner resizing, editable comparison canvases, cross-framework
coverage and full Figma/native parity remain unfinished.


### Select layers from comparison previews

Clicking a comparison now hit-tests its scaled viewport and opens the same
size on the main canvas, enters Edit mode and selects the matching source layer
(or matching repeated occurrence). Source links are intercepted for selection.
The current style scope stays unchanged and the rail explains this. Keyboard
Enter/Space opens the preview's size while preserving the current selection.
Route checks reject stale previews; a bounded wait handles responsive rendering,
and newer selection activity supersedes a pending comparison selection.

Chromium and WebKit verify a phone-only link selected from a desktop starting
size, prevented navigation, edit-mode entry, a tablet-scoped write reflected in
comparison previews, exact undo, keyboard activation and frame disposal. The
workflow joins test:e2e:html. All 270 unit tests pass; the screenshot was
inspected. This provides direct selection into the editable
main canvas; fully editable comparison canvases, synchronized application state
and full parity remain unfinished.


### Combined HTML verification and comparison visibility

At 450e821, all ten test:e2e:html workflows completed successfully in both
Chromium and WebKit: general HTML editing, flex writing modes, wrapping, adaptive
grids, frame bounds, visibility, corners, SVG authoring, direct viewport resizing
and comparison selection. This expands the combined browser baseline beyond
the earlier seven-workflow run. It does not prove other adapters or native UI.

Inspection also found that comparison outlines counted visibility:hidden layers
as visible whenever their bounding boxes had area. The comparison painter now
skips hidden/collapsed layers and bounds outside the viewport, and distinguishes
hidden, absent and off-screen status. The focused comparison workflow passes
in both engines after this fix, including a hidden phone layer, an off-screen
desktop layer and the outline returning after scrolling into view. This checks
computed visibility and viewport intersection; arbitrary clipping/masks are
not modeled. Full parity and the native release remain unfinished.


### Refreshed native package and cask verification

A universal Mac bundle now packages editor source 1701d24, including the recent
SVG, viewport-resizing and comparison work. Bundled launch tests passed CLI
argument/exit handling, HTML startup, literal paths, dynamic-port discovery,
health and shutdown. The generated local cask installed and uninstalled in an
isolated app directory. All 72 installed source files matched the checkout;
arm64/x86_64 and strict ad hoc signature checks passed. Quarantine was retained.

Artifact: /private/tmp/retouch-desktop-responsive-20260909/Retouch-0.1.0-mac.zip
SHA-256: 6be76fa775b61902538b016c68085e0de22bd803311a7b9d9cbc073ab1465e07
The adjacent verification.json records hashes and cleanup. The temporary cask
trust entry, tap and installed app were removed; owned processes stopped and
Homebrew developer mode returned to disabled.

Fresh CUA access still returned cgWindowNotFound. The bounded diagnostic showed
a created visible window, with applicationActive=false and
windowOcclusionVisible=false. Native interaction, trusted distribution, public
release, upgrades and Intel runtime remain unproven. Documentation now separates
this current package evidence from historical native UI checks. Full parity
is not achieved.


### Corner resizing and temporary aspect lock

The preview now has a bottom-right corner handle for both dimensions. Shift
preserves the starting aspect ratio using the larger proportional change, with
both dimensions bounded together. Pressing or releasing Shift during a drag
updates the preview without requiring another pointer move. Escape restores
the original size; release persists both dimensions. Keyboard arrows act on
one axis, with Shift changing the step to 10 px.

All 271 unit tests pass. Chromium and WebKit verify free corner resizing,
stationary modifier changes, ratio-locked release, zoomed movement, independent
keyboard axes, cancellation, persistence and unchanged source/scope alongside
the existing width/height workflow. The three-handle screenshot was inspected.
The local native artifact still packages 1701d24; this newer editor change has
not been repackaged. Editable comparison canvases, cross-framework coverage
and full Figma/native parity remain unfinished.


### Interrupted screen-resize transactions

A browser regression reproduced an old drag overwriting a newer screen preset
on pointer release. External screen changes now discard pending pointer work
without restoring the obsolete size; resize-owned preview events keep their
transaction. Zoom emits a pre-change event that cancels the drag before anchor
calculations, and window/canvas width changes also cancel stale coordinates.
A second regression reproduced pointer release preceding the resize callback;
pointer processing now checks the actual workspace dimensions as well.

All 271 unit tests pass. Chromium and WebKit verify preset replacement, zoom
interruption and workspace resizing during an active corner drag, alongside
width/height/corner gestures, Shift ratio locking, keyboard steps, persistence,
Escape cancellation and unchanged source/scope. Full parity and native release
verification remain unfinished.


### Visible zoom and fit-screen controls

The screen toolbar now exposes a validated zoom percentage and Fit screen.
Fixed viewports support 1–200% zoom, allowing the maximum 7680 × 7680 screen to
fit a normal workspace. Fluid Fit workspace mode keeps its 25–200% range and
Fit screen returns it to 100%. Fixed-screen fitting uses the available canvas
minus a 24px margin per edge, without changing CSS viewport dimensions, vh
geometry or page scroll. Zoom events also reposition resize handles immediately,
fixing stale handle placement after a gesture.

All 271 unit tests pass. Chromium and WebKit verify fitted bounds, a 50% setting,
maximum viewport fitting below 25%, invalid input/recovery, fixed dimensions,
page scroll, vh geometry, handle placement and Fit workspace reset alongside
the complete resize workflow. Full parity, cross-framework coverage and native
release verification remain unfinished.


### Marquee gestures at low zoom

Marquee activation now measures four screen pixels, including when the pointer
starts inside the preview iframe. Previously, the four-source-pixel threshold
could activate after less than one screen pixel at low zoom. Changing zoom or
screen size cancels an active marquee before its coordinates become stale.

The new html-marquee-zoom workflow passes in Chromium and WebKit: at 10% zoom it
checks one-pixel movement, selection from both page background and gray canvas,
zoom/screen cancellation, and unchanged source bytes. It joins test:e2e:html.
All 272 unit tests pass; the activation check covers 1% through 200% zoom. Starting
a marquee directly on content and cross-renderer parity remain unfinished.


### Direct drawing inside SVG canvases

Selected SVG canvases and groups now offer Draw rectangle, circle, ellipse and
line. A pointer drag previews the shape without a source write; release inserts
it atomically and selects it, with exact undo/redo through the existing history.
Pointer coordinates pass through canvas zoom and the inverse SVG screen matrix,
so viewBox origins/scaling and group transforms affect placement correctly.
Escape, screen/zoom changes, scrolling, navigation and selection changes cancel
the preview. Server validation bounds finite coordinates and rejects empty
geometry or stale source hashes. Existing Add buttons keep their preset behavior.

All 273 unit tests pass. The new html-svg-draw workflow passes in Chromium and
WebKit with all four primitives, a translated/scaled group, a nonzero viewBox
origin, 50% canvas zoom, live source preservation, exact undo/redo and Escape/
zoom/screen cancellation. The existing SVG workflow also passes in both engines.
The drawing screenshot was inspected. The new workflow joins test:e2e:html.
Drawing directly into HTML layout, shape constraint modifiers, vector paths,
pen/freehand tools and cross-renderer support remain unfinished; this does not
establish full drawing parity. The native bundle has not yet been rebuilt with
these changes.


### SVG drawing constraints and center origins

Drawing now accepts Shift for equal width/height or 45-degree line angles, and
Option/Alt for a centered origin. Both modifiers compose. Pressing or releasing
a modifier updates the live preview immediately with a stationary pointer;
release commits the same constrained endpoints. Constraints use the selected
SVG container's coordinate system, so a nonuniform transform can still stretch
a source circle or square visually.

All 275 unit tests pass. Unit checks cover all four drag quadrants, combining
constraints, centered origins and line angle snapping with preserved radial
distance. Chromium and WebKit verify stationary modifier changes, return to free
drawing, exact source preservation during preview/cancel, and committed centered
ellipses and diagonal lines with undo/redo at 50% canvas zoom in a transformed
group. The previous four-shape creation and cancellation checks also pass.
HTML drawing, vector path tools and cross-renderer parity remain unfinished.


### Desktop package refreshed through b78aed9

The universal Mac app now packages the current drawing and responsive-canvas
work. The actual generated cask installed successfully in an isolated app
directory; all 73 packaged source files matched the checkout. Archive SHA-256,
arm64/x86_64 architectures, strict ad hoc signature and retained quarantine were
verified. Bundled launcher and HTML startup/health/shutdown self-tests passed.
The app was uninstalled and temporary tap/trust/developer-mode state cleaned up.
The artifact and receipt are recorded in desktop/README.md.

Native UI inspection still returns cgWindowNotFound, so current native
interaction remains unverified. No public tap, notarized release, trusted
Gatekeeper launch, Intel runtime or upgrade verification is claimed.


### React SVG geometry and renderer readiness

The React adapter now describes and edits rectangle, circle, ellipse and line
coordinates beneath an explicit JSX SVG ancestor. The shared inspector presents
literal string/numeric values, reset controls and disabled dynamic/spread values.
Source writes require the exact file hash, retain surrounding JSX and validate
structural IDs after parsing. Geometry is shared across source instances/sizes.

A real Next.js 16.2.5 browser test exposed an immediate-reload race: the JSX write
succeeded but the preview remained on the previous compiled geometry. Geometry
writes and history restoration now use the existing rendered-element readiness
check before reloading. The test passed in Chromium and WebKit after this fix,
covering four primitives, viewBox scaling, disabled dynamic coordinates and exact
source undo/redo. It launches and cleans up its own Next project and server via
the Retouch command wrapper. All 277 unit tests pass, including JSX refusal and
source-preservation checks. The existing HTML SVG workflow passes in both engines.

This adds geometry parity, not full React SVG parity: drawing, paint controls and
SVG structural operations remain incomplete there. Shape definitions without a
lexically visible SVG ancestor, other frameworks and arbitrary remote sites are
not covered. The current desktop archive predates this change.


### React SVG creation and direct drawing

Explicitly closed JSX SVG canvases/groups now share the four Add and Draw shape
controls with HTML. The insertion planner preserves existing structural IDs,
keeps existing expressions/siblings intact and emits React SVG prop names.
Spread/children/injected-HTML containers, stale hashes and invalid geometry are
refused. Draw coordinates use the live SVG transform and canvas zoom; modifiers
and cancellation use the shared drawing tool. Creation and history wait for
the created layer's presence or absence in the compiled renderer.

Drawing previews now live in a separate SVG in the editor overlay, transformed
into screen coordinates. The app DOM stays unchanged until the source write
renders, avoiding temporary child injection into React-owned nodes. The extended
Next workflow also exposed a detached-document typography-preview callback; it
now checks that its source element and preview remain connected before reading
the source document URL. An initial undo test failure was traced to a selector
counting Next's development-toolbar SVG; it now targets the authored group.

All 279 unit tests pass. Chromium and WebKit pass the real Next/React geometry
workflow extended with all four preset shapes, rectangle/line drawing through a
translated group at 50% zoom, combined Shift/Alt constraints, source and DOM
preservation during preview, Escape cancellation and exact undo/redo. Existing
HTML SVG editing and drawing workflows also pass in both engines. The drawing
workflow compares overlay and rendered geometry bounds through a scaled group;
the overlay screenshot was inspected.

React SVG paint/structural tools, JSX-layout drawing, vector path tools and
cross-framework parity remain incomplete. The native archive predates this work.


### Responsive React SVG paint

React SVG layers now expose fill, stroke, stroke width, line ends, line joins
and dash-pattern controls through the existing scoped Tailwind class writer.
The utility editor distinguishes stroke color from width, preserves unrelated
classes/variants and important flags, and removes only the selected scope's
property on reset. Dynamic class expressions, spread-controlled classes and
inline property overrides are protected in the inspector. Original SVG
presentation attributes remain in source beneath these CSS overrides.

All 281 unit tests pass, including utility classification, screen-scope
preservation, reset, important flags and invalid value rejection. The real Next
fixture now includes Tailwind 4.1.13 and verifies all six computed properties,
base fill versus a 768px override, phone/tablet switching, scoped reset and exact
source restoration in Chromium and WebKit. Its existing geometry, preset/drawing
and history checks also pass. A selection assertion was corrected to wait for
the selected layer and inspector to settle. The paint screenshot was inspected.

These controls require Tailwind. General React CSS authoring, SVG paint servers
and gradients, structural SVG tools and cross-framework parity remain
incomplete. The desktop archive predates these controls.


### React SVG deletion and compiled source revisions

React SVG deletion now operates on complete literal child-node ranges without
requiring all siblings to have literal attributes. Shapes, groups and nested
SVG canvases can be deleted; component roots and selections enclosed by JSX
rendering expressions remain protected. The planner validates retained node
offsets, tags and ancestry after reparsing and returns the mapped parent ID.
Source history retains exact before/after bytes.

React stamping now adds data-rt-revision to compiled host elements only, after
spread props. It records the source hash without changing project source or
passing revision props to custom components. The rendered-element readiness
check uses this marker when the React descriptor advertises it, preventing
old markup with reused structural IDs from satisfying that check. Other
renderers retain their existing readiness behavior and bounded reload fallback.

All 284 unit tests pass, including dynamic sibling deletion, group/canvas
removal, refusal boundaries and source-revision/ID behavior. Chromium and WebKit
pass the real Next/Tailwind workflow with shape/group/canvas deletion, source
revision equality, exact undo/redo and create-delete-undo-delete-undo-creation
transitions. The existing geometry, paint, drawing and cancellation checks also
pass. HTML SVG editing/history passes in both engines after the shared handler
change. React SVG duplication, stacking and broader framework parity remain
incomplete; the desktop bundle predates these changes.


### React SVG stacking order

React SVG canvases/groups now expose Send backward and Bring forward for adjacent
supported SVG child layers. The planner swaps complete JSX subtrees while
retaining the intervening whitespace/comments and dynamic attribute expressions.
It remaps source IDs and verifies all retained node positions/tags/ancestry after
parsing. Expression blocks, component siblings, unsupported SVG nodes, edge
moves and stale source hashes are refused. The existing revision-aware structural
handler keeps the moved layer selected and restores source/selection through
history.

All 286 unit tests pass. Chromium and WebKit pass the full real Next/Tailwind SVG
workflow, including a new overlapping red rectangle/blue circle test. Browser
hit-testing confirms that Bring forward changes the frontmost shape, undo/redo
restores the matching paint order, and Send backward produces the same source
ordering from the opposite selection. The moved rectangle remains selected
after its structural ID changes. Existing geometry, paint, drawing, deletion
and compiled-revision checks also pass. React SVG duplication, non-adjacent
stacking commands and broader framework parity remain incomplete; the desktop
archive predates this change.


### Independent React SVG duplication

The React adapter now duplicates literal SVG shape/group/canvas subtrees through
a planner that copies exact source, maps retained and copied node identities,
and validates ancestry after parsing. The copied layer is selected and can be
edited independently. Literal strings and numeric geometry expressions are
supported; authored IDs/keys/refs, spreads, dynamic expressions and unsupported
subtrees are excluded from this specialized path. Existing generic literal
duplication/clipboard support is preserved where it was already available.

All 289 unit tests pass, including exact subtree copies, identity/ancestry
checks, refusal boundaries and preservation of the generic fallback. Chromium
and WebKit pass the real Next/Tailwind SVG workflow extended with shape/group
duplication, distinct DOM/source IDs, selected-copy verification, independent
copy X/fill edits and exact multi-step undo/redo. Original geometry and computed
fill remain unchanged while the copy moves and changes color. The existing
geometry, drawing, responsive paint, stacking, deletion and revision-readiness
checks also pass. Reference-aware duplication, dynamic subtree cloning, broader
framework parity and a refreshed desktop bundle remain unfinished.


### Integrated HTML suite and refreshed React/SVG Mac package

All twelve HTML browser workflows pass in Chromium and WebKit at the integrated
7708416 editor. The initial Chromium run stopped at the marquee test: after
reselecting the same layer, the test could accept an already-selected row while
the new selection request was still busy. It now also waits for the inspector
to finish that request. The full Chromium suite then passed; the corrected
marquee test also passed separately in WebKit.

The refreshed universal Mac artifact packages all 79 current editor source
files. Its built-bundle launcher tests, source/hash inventory, architectures,
strict ad hoc signature and isolated cask install/uninstall were verified.
The quarantined installed launcher produced no output within 45 seconds and
was stopped; native interaction and trusted distribution remain unverified.
Temporary installation/tap/trust state was removed and Homebrew developer mode
restored. desktop/README.md records the archive and receipt.

A Developer ID Application identity is available locally. A separately signed
build is awaiting local keychain authorization in SecurityAgent; no completed
Developer ID archive or notarization is claimed.

### SVG bring-to-front and send-to-back

HTML and React SVG layers now expose Bring to front and Send to back alongside
adjacent stacking. Each command moves the selected source subtree across all
eligible siblings in one edit and one history entry. Source comments and gaps
retain their positions, descendant identity is remapped, and selection follows
the moved layer. Buttons disable at the corresponding edge or when crossing
unsupported content; React expressions/components are boundaries. React checks
the common parent once rather than parsing the full file for each sibling.

The source tests cover both directions over four unequal sibling subtrees,
comment preservation, ID/ancestry remapping, distant barriers, stale hashes and
every source offset in the shared reorder helper. Browser coverage adds real
paint-order checks across multiple siblings, edge-state controls, selected-layer
retention and exact undo/redo to the existing HTML and Next/Tailwind SVG flows.
This remains SVG stacking inside supported source parents; arbitrary CSS
stacking contexts, cross-parent moves and full vector authoring remain separate
unfinished work. The desktop artifacts described above predate these controls.

Validation: all 292 unit tests pass. Both HTML SVG and real Next/Tailwind React
SVG browser workflows pass in Chromium and WebKit, including the new stacking
cases. Logs: `/private/tmp/retouch-first-last-unit-final.log`,
`/private/tmp/retouch-first-last-html-{chromium,webkit}.log` and
`/private/tmp/retouch-first-last-react-{chromium,webkit}-final.log`.


### HTML responsive positioning and constraints

The Position section now supports HTML flow, relative, absolute, fixed and
sticky modes. Converting to absolute captures the current border-box geometry,
including margins, padding and the actual containing block. Absolute layers
can keep a left/right/top/bottom distance, keep their center offset, stretch
between opposing edges, or scale their position and size proportionally. Each
anchor change is one responsive CSS transaction and one undo entry. Choosing
an anchor normalizes the captured layer to zero margins and border-box sizing;
a previously custom orthogonal axis receives its nearest anchor, while an
existing Retouch anchor mode is retained. Reset positioning and size reveals
the original page rules for those properties in the selected screen scope.

The shared CSS validator accepts constrained center calculations and physical
insets. Important inline inset shorthands and logical insets are protected from
overlapping edits. Refused writes rebuild the panel so its controls continue
to reflect the actual layer. Transforms/zoom and HTML within SVG viewports are
not supported by the placement measurement and are refused without a write.
Fixed/sticky inset fields provide CSS positioning controls; conversion to those
modes does not yet preserve visual bounds.

An integration regression exposed that eagerly measuring a flow element could
interfere with gradient preview cleanup. Flow measurement now occurs only when
converting to absolute; measuring an already-absolute layer does not mutate its
inline style. The existing gradient preview cancellation test now passes again.

Validation includes all 294 unit tests and a new browser workflow exercising
flow-to-absolute bounds, borders/padding/margins, edge/center/stretch/scale
behavior across phone/tablet/desktop dimensions, independent breakpoint
rules/reset, protected inline rules, transformed-layout refusal and exact
source undo/redo. The workflow is part of `test:e2e:html` (13 workflows).
Screenshot: `/private/tmp/retouch-html-position.png`. Unit and browser logs use
`/private/tmp/retouch-html-position-*`. Desktop packages still predate this work.
Both complete 13-workflow HTML suites pass in Chromium and WebKit after the
measurement fix (`retouch-html-position-integrated-{chromium,webkit}-final.log`).
The final focused Chromium run additionally repeats the strongest proportional
pixel assertions and the protected/transform refusal cases.


### Canvas movement for positioned HTML layers

Absolute HTML layers now offer Move on canvas in the Position section. The tool
shows a draggable bounds preview above the page, converts physical pointer
movement through canvas zoom, locks the dominant axis with Shift (including
modifier changes while holding the pointer), and commits one responsive CSS
transaction on release. The selected layer keeps its width/height and existing
anchor modes. Preview movement leaves the page DOM and source unchanged;
Escape, viewport/zoom/selection changes, navigation, blur, scrolling and
observed layout changes cancel the tool. Pointer jitter under four physical
pixels does not create a history entry. Invisible or zero-size layers cannot
start a move.

The existing single-click text editing behavior remains available outside the
move tool. This is a bounds preview for one absolute HTML layer, not yet direct
content dragging, flow reordering, multi-layer movement, snapping or equivalent
movement in every renderer. Desktop archives still predate these changes.

WebKit exposed an existing anchor timing issue after immediate viewport
resizing: the callback could use measurements captured by the old inspector
render. Anchor writes now measure the layer and resolve active responsive rules
at invocation time. The move tool also measures at invocation, and cancels if
the selected bounds or containing-block dimensions change during the gesture.

Validation: 295 unit tests pass. The extended HTML positioning workflow passes
in Chromium and WebKit with 50% zoom, exact 40 CSS-pixel movement from a
20-physical-pixel drag, stationary Shift locking, preserved stretch/center
modes and dimensions, Escape/screen cancellation, click-jitter suppression,
and exact multi-step source undo/redo. Existing constraint, protected inline
rule and transformed-layout refusal cases also pass. Logs:
`/private/tmp/retouch-canvas-move-unit-final.log`,
`/private/tmp/retouch-canvas-move-chromium-latest.log`, and
`/private/tmp/retouch-canvas-move-webkit-verified.log`. The bounds preview was
visually checked in `/private/tmp/retouch-canvas-move.png`.


### Canvas resizing for positioned HTML layers

Resize on canvas now exposes all eight edge/corner handles for an absolute
HTML layer. Resizing keeps the opposite edge in place; Shift preserves the
original aspect ratio, and Option/Alt resizes around the center. Modifiers can
change while the pointer remains held. The bounds preview follows canvas zoom
and commits one scoped CSS transaction with the layer's existing anchor modes.
The tool enforces the border/padding minimum and fixed/percentage CSS size
bounds in the resulting border-box layout. Intrinsic/complex size bounds are
not yet represented by this tool and produce a refusal before drawing.

An unchanged-selection inspector refresh now leaves active canvas tools intact.
Actual selection changes still cancel, and changing the style screen scope
explicitly cancels the tool before changing the target scope. Escape and the
existing viewport, layout, navigation and blur cancellation paths remain.

Validation: 296 unit tests pass. Chromium and WebKit pass the extended HTML
positioning workflow with edge resizing, proportional centered corner resizing
at 50% zoom, live modifier preview bounds, unchanged source/DOM during preview,
retained stretch/center anchors, scope/Escape cancellation and exact undo/redo.
An authored 80–140px width-bound fixture verifies both preview and committed
minimum/maximum clamping while preserving the original min/max rules. Logs:
`/private/tmp/retouch-canvas-resize-unit-final.log` and
`/private/tmp/retouch-canvas-resize-{chromium,webkit}-bounds.log`.
The eight-handle preview was inspected in `/private/tmp/retouch-canvas-resize.png`.

Full content previews, flow resizing/reordering, transformed geometry,
multi-selection resizing, snapping, keyboard handle resizing and other-renderer
parity remain unfinished. Desktop archives still predate the canvas tools.

### Keyboard canvas movement and resizing

The active canvas tools now accept arrow keys. Movement uses one CSS pixel per
press, or ten with Shift, independently of visual zoom. Resize handles receive
keyboard focus and have readable edge/corner labels. Arrows adjust the focused
handle; Shift preserves proportions and Option/Alt centers the resize. Tab can
change handles while retaining the pending bounds, so edits from multiple
handles still form one gesture. Enter writes one scoped edit; Escape cancels.
Returning to the starting bounds does not create a source write/history entry.

Cancel and keyboard commit restore focus to the initiating tool button, even
when inspector rendering replaced that button. WebKit does not consistently
focus a clicked button, so the initiating control is passed explicitly instead
of inferred from document.activeElement. Pointer behavior and source-free
bounds previews remain unchanged. Keyboard operations still cover one absolute
HTML layer; general keyboard transformation parity remains unfinished.

Validation: all 296 unit tests pass. Chromium and WebKit pass the extended HTML
positioning workflow including one-pixel changes at 50% zoom, Shift ten-pixel
movement, Tab between resize handles with retained preview, Enter commit,
Escape cancellation/focus restoration, post-commit focus, no-op suppression,
and exact combined pointer/keyboard undo/redo. Existing geometry, bounds,
responsive scope and pointer modifier/cancellation cases remain covered.
Logs: `/private/tmp/retouch-canvas-keyboard-unit.log` and
`/private/tmp/retouch-canvas-keyboard-{chromium,webkit}-verified.log`.
Desktop archives still predate these canvas tools.

### Refreshed canvas-tools Mac artifact

A new universal development bundle packages editor `be51333`, including the
responsive HTML anchors and pointer/keyboard movement/resizing. All 82 packaged
source files match the worktree. Built-bundle launcher and HTML startup/health/
shutdown tests pass, the strict ad hoc signature and both architectures verify,
and the generated cask passes Ruby syntax checking. Both full 13-workflow HTML
suites pass in Chromium and WebKit for this source revision.

The new archive was installed through an isolated Homebrew cask. Installed
source hashes, architectures, signature and retained quarantine all verified.
The cask/app, temporary tap/trust entry and owned native test processes were
removed, and Homebrew developer mode restored to disabled. Native processes ran
but computer-use inspection returned cgWindowNotFound; the captured main-thread
sample was in AppKit's event loop. Visible native interaction is still unproven.
Quarantined installed launch was not repeated after the previous artifact's
bounded no-output timeout. This remains a development archive, not a trusted
published release. The separately running Developer ID build still awaits
local keychain authorization and contains older source.

Archive and receipt:
`/private/tmp/retouch-desktop-canvas-tools-20260909/Retouch-0.1.0-mac.zip`
and `verification.json` in that directory. SHA-256:
`a9e4df7731d288e85b0962dfa2397fcb41f3805a75a84ece634d6a5406d4a993`.
See desktop/README.md for the package verification scope and limitations.


### Positioning inside zero-size containing blocks

HTML edge, center and stretch anchors no longer reject a zero-width or
zero-height containing block. This supports the common layout where an
absolutely positioned child does not contribute to its parent's height. Scale
remains unavailable on a zero-size axis because a proportional factor cannot
be inferred; the corresponding option is disabled with a visible explanation.

Canvas size limits now use the actual containing block, including zero
dimensions, instead of treating zero as a missing value and substituting the
viewport. Viewport-based absolute positioning uses viewport dimensions. Pointer
gestures that stop at an unchanged size limit no longer write CSS or create an
undo entry, matching keyboard no-op behavior.

Validation: all 297 unit tests pass; zero-width and zero-height edge/center/
stretch calculations and proportional refusal are covered. Chromium and WebKit
pass the extended positioning workflow with a real zero-height parent, retained
bounds under all four non-proportional vertical anchors, bounded resizing and
exact undo. A child with max-height:100% and min-height:20px inside that parent
stays at 20px in both preview and page, without a write when dragged beyond its
limit. Existing responsive, pointer, keyboard, focus and cancellation checks
also pass. Logs: `/private/tmp/retouch-zero-container-unit.log` and
`/private/tmp/retouch-zero-container-{chromium,webkit}-final.log`.
The be51333 desktop package predates this follow-up fix.


### React/Tailwind canvas transforms and proportional anchors

Literal React host layers now expose the shared Move on canvas and Resize on
canvas tools when positioned absolutely. Pointer and keyboard gestures retain
the selected source scope, existing geometry anchor modes, unrelated classes
and history. The React Position section also offers proportional Scale anchors.
An axis without an anchor in the selected scope falls back to the base source
anchor. Important geometry utilities remain important, including inherited
priority when writing a responsive override.

Geometry writes wait for both the matching compiled source revision and the
expected rendered bounds. A real Next run showed that its revision marker could
advance before the new Tailwind styles took effect. If the bounds do not settle
within the bounded wait, the editor reports that condition; the source change
remains undoable. Dynamic classes, spread-controlled props and inline geometry
styles are not rewritten through this class-editing path. Refused anchor writes
restore the inspector's displayed source state.

Validation: all 298 unit tests pass. A new disposable Next.js/Tailwind browser
workflow passes in Chromium and WebKit: pointer move/resize at 50% zoom, keyboard
movement/resizing, important base classes, a tablet override that leaves phone
geometry unchanged, proportional scaling across tablet/desktop dimensions,
class preservation, compiled/CSS readiness, cancellation, dynamic/inline/spread
refusals and exact source undo/redo. The existing extended HTML positioning
workflow also passes in Chromium after the shared-control changes.
`npm run test:e2e:react-position` runs the new workflow with
RT_INSPECTOR_FIXTURE set. Logs: `/private/tmp/retouch-react-position-unit-final.log`,
`/private/tmp/retouch-react-position-{chromium,webkit}-final.log`, and
`/private/tmp/retouch-react-position-html-regression.log`. The rendered React
inspector was visually checked in `/private/tmp/retouch-react-position.png`.

Arbitrary CSS authoring, inline geometry, complex/multiple responsive variant
cascades, transformed bounds, repeated runtime instances and broader renderer
parity remain unfinished. The current Mac archive predates these React tools.


### React anchors inherited through intermediate breakpoints

Creating a desktop geometry override now inherits the tablet anchor through
standard ascending minimum-width Tailwind scopes, instead of falling directly
back to base classes. Anchor inference resolves individual edges, dimensions,
shorthands, auto resets and important priorities. A tablet Scale anchor therefore
stays proportional when first moving the layer at the desktop scope.

Validation: 300 unit tests pass. The real Next.js/Tailwind positioning workflow
passes in Chromium and WebKit, including base-to-tablet-to-desktop edits, desktop
percentage classes, unchanged tablet bounds and exact source undo/redo. Logs:
`/private/tmp/retouch-inherited-unit.log`,
`/private/tmp/retouch-inherited-chromium.log` and
`/private/tmp/retouch-inherited-webkit.log`.

This inheritance model covers distinct ascending minimum-width scopes. Equal-width
aliases, complex or overlapping media conditions, state variants and arbitrary
compiler cascade ordering remain outside this validation. The current Mac package
predates these changes; signing and notarization remain incomplete.


### Canvas movement alignment snapping

The shared HTML and React movement overlay now attracts dragged layer edges and
centers to the containing block and visible direct siblings. Red alignment guides
show the matched line. The threshold is six screen pixels at every canvas zoom;
Option/Alt bypasses snapping immediately, including modifier changes mid-drag.
Shift preserves the dominant axis, a strictly horizontal or vertical drag retains
its other coordinate, and keyboard nudges remain exact. Candidate sibling bounds
are read during the gesture so animation does not leave stale alignment targets.
The preview and guides live outside the site; only a committed drag writes source.

Validation: 301 unit tests pass. The dedicated canvas-snapping browser workflow
passes in Chromium and WebKit at 50%, 100% and 200% zoom, covering sibling and
bordered-container alignment, hidden-sibling exclusion, live guides, modifier
transitions, keyboard precision, cancellation and exact source undo. Existing
HTML and real Next.js/Tailwind positioning workflows also pass in Chromium.
Evidence: `/private/tmp/retouch-snapping-{unit,chromium,webkit,html,react}.log`;
visually inspected screenshot: `/private/tmp/retouch-snapping.png`.

Multi-layer transforms, custom guides,
rulers and vector-edit snapping remain unfinished. This does not establish full
Figma snapping parity or unrestricted renderer support. The Mac package has not
yet been rebuilt with these changes.


### Canvas resize alignment snapping

Resize handles now snap their dragged edges to the container and visible siblings,
using the same six-screen-pixel threshold as movement. Each candidate is solved
through the existing minimum/maximum size and aspect-ratio constraints; a guide
appears only when the constrained edge reaches its line. Corner resizing can align
both edges independently, while proportional resizing chooses the closest reachable
line and preserves the ratio. Option/Alt still resizes from the center. Command/Ctrl
bypasses snapping during either movement or resizing, including modifier transitions
without another pointer move. Keyboard resizing remains exact. Handle centers now
sit on the actual preview edges rather than inside its decorative border.

Validation: all 304 unit tests pass, including every handle direction, fixed opposite
bounds, proportional and centered behavior, size-limit rejection and zoom tolerance.
The expanded browser workflow passes in Chromium and WebKit at 50%, 100% and 200%
zoom, checking committed corner bounds, guides, bypass, Shift/Alt combinations,
maximum-size protection, preview/source separation, cancellation and exact undo.
Existing HTML and real Next.js/Tailwind positioning workflows pass in Chromium.
Logs: `/private/tmp/retouch-resize-snapping-{unit,chromium,webkit,html,react}.log`.
The final screenshot `/private/tmp/retouch-resize-snapping.png` was visually checked.

Multi-layer transforms, custom guides/rulers and vector
snapping still remain. The current Mac artifact predates these changes; the existing
signed build is still waiting on its local signing/keychain interaction.


### Equal-spacing movement suggestions

Dragging a layer now offers equal gaps between adjacent visible siblings, or repeats
an existing neighboring gap before or after the pair. Purple gap markers display
both distances in CSS pixels. The suggestion considers siblings sharing the dragged
layer's row or column, excludes the containing block, and rejects overlapping
placements. Closer edge/center alignments win when they compete with a spacing
suggestion. The same screen-pixel attraction threshold, axis lock, bypass modifiers,
source-free preview, cancellation and single-gesture undo apply.

Validation: all 306 unit tests pass, including insertion, repetition in both
directions, vertical spacing, collision rejection, other-row/container exclusion,
nearest-target priority and zoom tolerance. A dedicated HTML browser workflow
passes in Chromium and WebKit: equal and repeated horizontal gaps at 50%, 100% and
200% zoom; vertical spacing; measured labels; hidden-sibling exclusion; live bypass;
unchanged source during preview; cancellation; and exact source undo. The existing
movement/resize snapping workflow and real Next.js/Tailwind positioning regression
also pass in Chromium. Logs: `/private/tmp/retouch-spacing-{unit,chromium,webkit,snap-regression,react}.log`.
The screenshot `/private/tmp/retouch-spacing.png` was visually inspected.

This is a movement aid for supported positioned layers. It does not yet provide
multi-layer distribution, editable spacing handles, custom rulers/guides, vector
snapping or unrestricted renderer support. Mac signing remains pending, and the
current Mac artifact has not been refreshed with these canvas changes.


### Refreshed Mac package with responsive anchors and snapping

The universal development artifact now packages source commit `4c49f9f`, including
React geometry inheritance through intermediate breakpoints, movement/resize
alignment snapping and equal-spacing suggestions. Archive:
`/private/tmp/retouch-desktop-snapping-20260909/Retouch-0.1.0-mac.zip`.
SHA-256: `301b54e288a7f2555333cc8ce4abebd1b53f123203b2481ae105ea0394938a23`.
The generated cask and `verification.json` receipt accompany the archive.

All 82 packaged source files matched the branch. Native launcher self-tests passed
working-directory/exit behavior, literal paths, HTML startup, dynamic-port discovery,
editor health and shutdown. The universal arm64/x86_64 binary passed strict ad hoc
signature checks. All 15 HTML integration workflows passed in Chromium and WebKit
against the code inside the app bundle, and bundled React positioning passed in
Chromium. The package signature still verified after those tests.

The isolated Homebrew cask install/uninstall passed with installed file hashes and
quarantine intact. Its installed self-test timed out after 45 seconds without
output; the owned process group was stopped. CUA returned `cgWindowNotFound` for
the development app; its process was confirmed running and then stopped. These
checks do not establish a usable native editor or trusted launch. Test app/tap,
cask trust entry and test harness were removed; Homebrew developer mode was restored
to disabled and owned native processes were confirmed absent. The separate Developer
ID build remains waiting on its local signing interaction. Notarization, public
cask distribution, upgrade behavior and Intel runtime remain unfinished.


### Atomic selection alignment and spacing distribution

HTML multi-selection now exposes left/center/right and top/middle/bottom alignment
within the selection bounds, plus horizontal and vertical equal-gap distribution.
Distribution preserves the first and last layers in spatial order. The operation
measures current geometry at click time, retains each layer's dimensions and the
other axis, follows the selected screen scope and uses one undo step. Authored
content-box sizing, padding, borders and size limits are retained. Repeated
alignment ignores subpixel differences below one thirty-second CSS pixel to avoid
adding history solely from browser layout quantization.

The shared CSS writer now accepts individual per-layer change sets and validates
all selected layers before returning one source edit. Missing/extra change sets,
mixed uniform/individual instructions, stale hashes and a protected layer refuse
the complete operation. Existing uniform shared-style editing still passes its
browser regression.

Validation: 309 unit tests pass. The new selection-layout workflow passes in
Chromium and WebKit: all six alignments and both distribution axes; fractional,
padded and maximum-constrained dimensions; no-op repetition; responsive phone
independence; exact atomic undo/redo; disabled two-layer distribution; and
protected, flow, nested-selection and transformed-ancestor refusals. Logs:
`/private/tmp/retouch-selection-layout-{unit,chromium,webkit,html-regression}.log`.
Screenshot `/private/tmp/retouch-selection-layout.png` was visually checked.

These controls currently require separate absolute-positioned HTML layers. Flow
layout rearrangement, React/Liquid multi-selection geometry, vector alignment,
editable spacing handles and group canvas
transforms remain unfinished. The current Mac artifact predates this change.


### Chosen-layer and containing-frame alignment targets

The selection inspector now has an **Align to** control: selection bounds, the
common containing frame, or any named selected layer. A chosen reference layer
stays unchanged in both geometry and source, including when its position is
protected by an inline important rule. Frame alignment uses the inner frame bounds
excluding borders; distribution can spread the selection across those bounds.
Frame targeting is disabled for selections with different containing frames.
Distribution is disabled for a chosen-layer target. Target choice persists through
source edits, screen changes and undo while the same selection remains active.

The atomic CSS writer accepts empty per-layer change sets for untouched references,
while still validating the entire selection and screen width. Unmoved layers no
longer acquire unnecessary style rules. A conflicting layer that must move still
refuses the complete source edit.

Validation: all 311 unit tests pass. Chromium and WebKit exercise all six alignments
against a chosen layer and a bordered frame, both frame distribution axes, unchanged
reference markup, preserved fractional/padded dimensions, target persistence through
undo, different-container refusal and a protected reference. Existing responsive,
atomic undo/redo and unsupported-selection checks still pass, as does the shared
HTML styling regression. Logs:
`/private/tmp/retouch-alignment-target-{unit,chromium,webkit,html-regression}.log`.
Screenshot `/private/tmp/retouch-alignment-target.png` was visually inspected.

Flow layout, React/Liquid multi-selection geometry, vector alignment, editable
spacing handles and group canvas transforms remain unfinished. The current Mac
artifact predates these selection alignment changes; signing remains pending.


### Exact selection spacing controls

The alignment inspector now exposes horizontal and vertical gap fields in CSS
pixels. Unequal gaps show Mixed. Entering a value arranges layers in spatial order,
retains their sizes and the other axis, and keeps the first layer fixed. A chosen
reference stays fixed instead; a containing-frame target starts spacing at the
frame's left or top inner edge. Positive gaps, touching edges and overlapping
negative gaps are supported while each step retains at least one thirty-second
pixel of forward distance to avoid reversing layer order.

Each committed spacing change uses the same atomic per-layer writer and one undo
step. Escape restores an uncommitted value without clearing selection. Invalid
values do not write source. A server refusal now refreshes the shared-style panel,
so a refused spacing value returns to the actual current or Mixed value.

Validation: all 313 unit tests pass. Chromium and WebKit verify positive, negative
and zero gaps, mixed values, no-op repetition, fixed reference markup, containing
frame origins, fractional/padded dimensions, scoped phone independence, Escape
cancellation, order-reversal rejection, protected-layer refusal with field reset,
and exact undo/redo. Existing alignment targets and shared-style regression checks
also pass. Logs: `/private/tmp/retouch-exact-spacing-{unit,chromium,webkit,html-regression}.log`.
Screenshot `/private/tmp/retouch-exact-spacing.png` was visually inspected.

These are numeric spacing controls for supported absolute HTML selections.
On-canvas spacing handles, group transforms, flow-layout rearrangement and
React/Liquid/vector selection geometry remain unfinished. The current Mac package
predates these selection controls; trusted native distribution remains unverified.


### Atomic multi-layer canvas movement

Supported HTML selections now expose **Move selection on canvas**. A shared outer
outline and individual member previews move together; the site DOM and source stay
unchanged during the gesture. Pointer movement, Shift axis lock, snapping/bypass,
keyboard one-pixel/Shift-ten-pixel steps, cancellation and focus restoration use the
same canvas tool as single layers. The union bounds snap to external candidates;
selected members and their containing sibling ancestors are excluded as neighbors.
Candidate elements and containers are deduplicated across the selection.

A commit translates every member by the same CSS-pixel delta and writes one atomic
source edit. Sizes, padding, borders and internal gaps are preserved, including
members in different containing frames. Any member or containing-frame geometry
change cancels an active gesture. A scope/selection change cancels it as well, and
a conflicting protected member refuses the whole source change.

Validation: all 314 unit tests pass. Chromium and WebKit exercise group pointer
movement at 50%, 100% and 200% zoom; member previews; external snapping and selected
member exclusion; Shift lock; precise keyboard movement and no-op handling; focus;
phone/base independence; exact undo/redo with selection restoration; member-layout
and secondary-container cancellation; different-container movement; and atomic
protection. Chromium single-layer snapping/resize and real React positioning
regressions pass; WebKit equal-spacing snapping also passes. Logs:
`/private/tmp/retouch-selection-move-{unit,chromium,webkit,snap-regression,react-regression,spacing-regression}.log`.
Screenshot `/private/tmp/retouch-selection-move.png` was visually inspected.

Group resizing/rotation, flow rearrangement, React/Liquid multi-selection geometry,
vector group transforms and on-canvas spacing handles remain unfinished. The current
Mac artifact predates these selection controls; trusted distribution remains open.


### Atomic multi-layer canvas resizing

Supported absolute HTML selections now expose **Resize selection on canvas** with
an outer eight-handle outline and individual member previews. Resizing scales
member bounds and their positions within the union, including layers in different
containing frames. Shift preserves proportions; Option/Alt resizes from the
center. Snapping, bypass, keyboard steps, cancellation and responsive scope writes
share the single-layer canvas implementation. Each gesture commits one atomic edit
and restores the selection through exact source undo/redo.

The tightest member min/max constraints limit the whole selection. Content-box
members retain their authored box model, padding and borders; aggregate limits
account for those decorations and browser fractional-pixel serialization. Changes
to any member's size constraints cancel a preview even when its current rendered
bounds have not changed. Protected members refuse the entire source write.
Typography, effects, padding and border thickness do not scale with these bounds.

Validation: all 316 unit tests pass. Chromium and WebKit verify member previews,
50/100/200% zoom, edge/corner gestures, proportional and centered resizing,
content-box limits, external snapping, keyboard/focus/no-op behavior, constraint
change cancellation, scope independence, protected-member refusal, different
containing frames, and exact atomic undo/redo. Chromium group movement,
single-layer snapping/resize and real React/Tailwind positioning regressions pass;
WebKit selection alignment and exact-gap regressions pass. The new workflow is
included in the HTML suite, which now contains 18 workflows. Logs:
`/private/tmp/retouch-selection-resize-{unit,chromium,webkit,move-regression,snap-regression,layout-regression,react-regression}.log`.
Screenshot `/private/tmp/retouch-selection-resize.png` was visually inspected.

Group rotation, scaling typography/effects, flow rearrangement, React/Liquid
multi-selection geometry, vector group transforms and on-canvas spacing handles
remain unfinished. The current Mac artifact predates these selection tools;
trusted native distribution and full Figma parity remain open.


### Direct canvas spacing handles

Supported absolute HTML selections now have horizontal and vertical gap tools.
Purple measurement lines and draggable numeric labels show the actual gaps;
moving a label sets equal spacing across the selection with individual layer
previews. Initial mixed gaps stay visible until adjustment. Clicking, moving only
on the other axis, reversing a keyboard step or cancelling leaves mixed spacing
and source unchanged. Arrow keys adjust by one CSS pixel, or ten with Shift.

The first spatial layer stays fixed by default. A chosen reference layer remains
unchanged, while a containing-frame target places the first layer at that frame's
inner origin. Layers can belong to different containing frames. Negative gaps
allow overlap and clamp before reversing spatial order. Layer dimensions and
content-box decorations stay intact. A gesture writes one atomic source edit in
the active responsive scope; undo/redo restores exact source and selection.
Changing the alignment target, selection, scope or observed geometry cancels the
preview. Protected members refuse the whole edit.

Validation: all 316 unit tests pass. Chromium and WebKit exercise horizontal and
vertical dragging, 50/100/200% zoom, mixed gaps, measurement lines/member previews,
either gap as the drag origin, two-layer/different-container spacing, reference
and frame anchors, negative/clamped gaps, keyboard steps and focus, no-op and
cancellation paths, padded content-box sizes, responsive independence, protected
members and atomic undo/redo. Chromium group movement, group resizing and
single-layer snapping and equal-spacing guide regressions pass; WebKit
alignment/numeric spacing passes.
The HTML suite now includes this workflow (19 total). Logs:
`/private/tmp/retouch-selection-spacing-{unit,chromium,webkit,move-regression,resize-regression,snap-regression,equal-regression,layout-regression}.log`.
Screenshot `/private/tmp/retouch-selection-spacing.png` was visually inspected.

These controls currently set a common gap across supported absolute HTML layers.
Independent per-gap edits, flow-layout rearrangement, React/Liquid/vector selection
geometry, and full cross-renderer equivalence remain. The verified Mac package
predates these selection tools; trusted distribution and full Figma parity remain
unfinished.


### Independent canvas gaps

**Canvas gap adjustment** now offers **All gaps equally** and **Only the dragged
gap**. The individual mode changes one horizontal or vertical gap while preserving
the other gaps and every member's size. It keeps the first spatial layer or chosen
reference layer fixed, or uses the containing frame's origin. Gap labels and
member previews retain the actual uneven spacing throughout the gesture.

Keyboard users can Tab between gap labels and accumulate separate adjustments in
one preview, then apply them as one atomic source/history edit. Returning all gaps
to their original values leaves source unchanged, including with a frame target.
Changing the adjustment mode cancels pending work. Negative-gap limits now use the
member preceding each gap; unrelated smaller layers do not restrict that gap.
Existing coincident layer positions can remain unchanged while another gap moves.

Validation: all 318 unit tests pass. Chromium and WebKit pass the extended spacing
workflow, covering independent horizontal/vertical gaps at 50/100/200% zoom,
unchanged neighboring gaps and dimensions, reference-source preservation, frame
origins, cumulative keyboard edits and reversal, negative limits, cancellation,
responsive independence, protected members and atomic undo/redo. Earlier equal-gap
and different-container checks still pass. Chromium numeric spacing/alignment and
WebKit group resizing regressions also pass. Logs:
`/private/tmp/retouch-individual-spacing-{unit,chromium,webkit,layout-regression,resize-regression}.log`.
Screenshot `/private/tmp/retouch-individual-spacing.png` was visually inspected.

The numeric inspector fields still set a common gap; the new mode applies to the
canvas controls. Flow layout, React/Liquid/vector selection geometry and broader
cross-renderer equivalence remain unfinished. The verified Mac package predates
these selection tools; trusted distribution and full Figma parity remain open.


### Atomic React selection class API

The React source adapter now supports `setClassesSelection` for 2–100 distinct
host layers in one source file. Each selected ID receives a class string or `null`
to preserve its source markup verbatim. Every member is validated against private
in-memory snapshots before one final source edit reaches the shared transaction
layer. A stale version, unknown/component member, invalid token/map, dynamic class
expression or spread-prop conflict refuses the whole edit. An unchanged reference
may retain dynamic/spread markup because that member is not rewritten.

The result includes fresh complete descriptors for the selection. Semantically
unchanged class values preserve existing source quoting and produce no history
entry. One batch creates one undo step, with exact source restoration and the
existing external-change protections. The single-layer writer remains in use for
each member's class validation and Tailwind conflict merging.

Validation: all 323 unit and HTTP integration tests pass. Coverage includes exact
reference/no-op preservation, class removal, stable IDs and metadata, complete-map
validation, dynamic/spread/token refusals without partial edits, stale source,
exact batch undo/redo and external-edit refusal. Chromium and WebKit also pass a
new real Next.js/Tailwind workflow: the API changes two layers at the tablet
breakpoint, compiled geometry updates for both, phone positions stay unchanged,
and API undo/redo restores both layers together. The existing Chromium React
positioning workflow still passes. Commands include `test:e2e:react-selection`.
Logs: `/private/tmp/retouch-react-selection-api-{unit,chromium,webkit,position-regression}.log`.

This is the source transaction needed for React multi-layer authoring. The shell
still restricts multi-selection to HTML; React selection controls and shared
canvas geometry must be connected next. Cross-file/instance-specific selection,
Liquid parity, arbitrary-site authoring and full Figma parity remain unfinished.
The verified Mac package predates this source operation.


### React multi-selection and shared style controls

React host layers in one source file can now be selected together with Cmd/Ctrl
click in Layers, Shift-click ranges, or Shift/Cmd/Ctrl click on the canvas. The
Layers tree exposes multi-selection, and shared opacity, visibility, blend mode
and isolation controls use the atomic class-selection operation. Mixed preview
values remain unchanged until edited. Changes and resets preserve other utility
groups, important markers, state variants and unrelated responsive scopes.
New breakpoint edits inherit important priority from lower scopes when needed;
reset buttons stay disabled when that scope has no matching override.

Each shared edit records one history entry and restores the full selection through
undo/redo. Preview refresh checks every selected layer's compiled source revision
and exact class list. Dynamic class expressions and spread props explain why shared
styling is unavailable; an inline property disables its corresponding editor.
Escape discards an uncommitted field value without clearing the selection.

Selection capabilities are now separate from layer reparenting. React structural
multi-layer actions remain disabled while shared styling is available. Source
class edits affect every rendered occurrence of the selected source layer; these
controls do not create per-instance overrides.

Validation: 325 unit/HTTP tests pass, including shared-style scope preservation,
important/state classes, resets and invalid-value refusal. Chromium and WebKit
pass the real Next.js selection workflow, which exercises mixed values,
opacity/visibility/blend changes, tablet-only edits with phone independence,
resets, range and canvas selection, exact undo/redo with selection restoration,
and dynamic/inline/spread guards. The Chromium HTML spacing regression passes.
Evidence logs are `/private/tmp/retouch-react-selection-ui-{unit,chromium,webkit,html-regression}.log`.
Screenshot `/private/tmp/retouch-react-selection-ui.png` was visually inspected.

React multi-layer alignment, movement, resizing and spacing remain to be connected;
React multi-layer structure, cross-file/instance overrides, Liquid equivalence and
arbitrary-site authoring remain incomplete. The verified Mac package predates these
controls. Full Figma parity and trusted Mac distribution remain open.


### React selection geometry on the shared canvas

Unique absolute React host layers now use the shared selection layout and canvas
tools: alignment to selection/layer/frame bounds, distribution, numeric gaps,
equal/individual canvas gaps, movement and eight-handle resizing. A geometry
strategy translates the common measured result to each member's Tailwind classes
and submits one atomic selection edit. Unchanged reference layers use `null` and
retain their markup exactly. All changed members are checked for rendered geometry
after the compiled revision/class refresh.

Content-box layers retain their padding, borders and size bounds. Percentage,
stretch and end anchors use each member's containing frame, including selections
across different frames. Important priority is preserved by geometry group: an
important right anchor does not turn an unchanged width into important and suppress
its larger-breakpoint override. Geometry requires an active style scope and refuses
inline positioning, dynamic/spread classes, repeated source instances and the
shared unsupported transformed/nested/SVG cases. Commit revalidates the selection
so a new inline geometry override cannot slip through a preview.

Viewport and stylesheet refresh now distinguish a focused form field from a
focused action button. An action button no longer keeps obsolete geometry controls
visible after changing screen size; in-progress form inputs remain protected.

Validation: all 327 unit/HTTP tests pass. Chromium and WebKit pass the new real
Next.js/Tailwind selection-geometry workflow: alignment/reference markup,
50/100/200% pointer movement, keyboard movement, content-box resizing and maximum
size clamping, numeric and independent gaps, exact undo/redo with selection,
important responsive anchors, larger-breakpoint width preservation, phone/base
independence, inactive-scope refusal, inline changes during a preview, repeated
instances and different containing frames. Existing Chromium React shared-style
and HTML spacing workflows pass. The package exposes
`test:e2e:react-selection-geometry`. Logs:
`/private/tmp/retouch-react-selection-geometry-{unit,chromium,webkit,styles-regression,html-regression}.log`.
Screenshot `/private/tmp/retouch-react-selection-geometry.png` was visually inspected.

Flow and transformed geometry, vector group transforms, cross-file selection,
per-instance overrides, React group structure, Liquid equivalence and arbitrary
site authoring remain unfinished. Full Figma parity and trusted Mac distribution
remain open; the verified Mac artifact predates these tools.


### React marquee and empty-frame selection

React now supports marquee selection from gray canvas, page background and empty
source-container backgrounds. This uses the same selection capability as the
layer tree, instead of requiring HTML reparenting. Dragging within an empty frame
can enclose its children; direct text, editable content, interactive elements and
containers without source children do not start a marquee. Shift/Cmd/Ctrl adds to
the existing selection. A short click still selects or toggles the frame.

Pointer capture remains on the original inner element. An explicit short-click
callback handles WebKit's suppressed compatibility click, with duplicate-click
suppression for engines that also deliver it. The existing four-screen-pixel
threshold, clipping and Escape/zoom/screen cancellation remain shared.

Regression checking found missing static-HTML capability metadata: the site adapter
implemented CSS selection operations without advertising them. Its operation list
now reflects the CSS and selection planners, restoring the capability-based Select
visible layers/range/marquee controls. The class-only operation refused by this
site adapter is no longer advertised.

Validation: all 328 unit/HTTP tests pass. Chromium and WebKit pass a real Next.js
marquee workflow at 50/100/200% zoom, with inner-frame and gray starts, ordinary and
modifier frame clicks, screen-pixel threshold, additive selection, Escape/zoom/
screen cancellation, group movement and exact source/selection undo. Both engines
also pass the static-HTML low-zoom marquee regression and its explicit selection
capability/control checks. The package exposes `test:e2e:react-marquee`. Logs:
`/private/tmp/retouch-react-marquee-{unit,chromium,webkit,html-regression,html-webkit}.log`.
Screenshot `/private/tmp/retouch-react-marquee.png` was visually inspected.

Marquee still selects source layers within the supported single-file selection
model. Cross-file/instance selection, arbitrary site authoring, full Figma parity
and trusted Mac distribution remain unfinished. The verified Mac artifact predates
these selection tools.

## Inspector focus preservation during stylesheet refresh

Packaged HTML verification exposed a regression from the React geometry viewport
refresh: replacing the inspector after CSS changes could dismiss the project image
browser or remove a gradient stop's keyboard focus. Stylesheet refreshes now preserve
any focused inspector interaction. Viewport refreshes may replace only the canvas
tool button that initiated a viewport change; other controls retain focus.

The full 19-workflow HTML suites pass in Chromium and WebKit after the stylesheet
refresh fix. The superseding packaged build will also verify the final viewport
focus guard and React geometry controls against bundled code. The earlier selection
archive's verification receipt records its HTML failures and superseded status.

## Refreshed Mac selection package (3b3d8a1)

The universal ad hoc development archive is
`/private/tmp/retouch-desktop-selection-fixed-20260909/Retouch-0.1.0-mac.zip`,
SHA-256 `012656964aeb9142812079d29fbe2a7e95739b4ac2ee32a13b45e5ba8d519887`.
Its generated cask and verification receipt are alongside it. All 86 packaged
source files matched source commit `3b3d8a194966072a722b018e2873ae19a84e691c`
and the isolated cask-installed copy. Both architectures, strict signature,
bundled launcher/cwd/exit, HTML startup/health/stop and URL self-tests passed.

Both engines passed all 19 HTML workflows against bundled code. Bundled React
geometry passed in Chromium; marquee and shared styles passed in WebKit. The first
shared-style run timed out during selection without page errors. Diagnostic and
unmodified reruns passed, but the initial timeout remains unexplained. The receipt
retains each result. All 328 source unit/HTTP tests passed. Bundle hashes and strict
signature still verified after testing; both temporary bundle harnesses were removed.

Cask install/uninstall, quarantine preservation and cleanup passed. The installed
quarantined self-test timed out after 45 seconds without output; its own process
group was stopped and verified absent. The app directory, temporary tap, cask
registration and temporary trust entry were removed, with Homebrew developer mode
restored to disabled. Native interaction, trusted launch, notarization, public
release, upgrades and Intel runtime remain unverified. The separate older-source
Developer ID build still waits for local keychain authorization. Full Figma parity
and arbitrary-site authoring remain active unfinished requirements.

## Preserve layer interactions across live source updates

A deterministic browser regression reproduced a missed layer click: a source
mutation between mouse press and release triggered the layer observer, whose full
tree replacement detached the pressed button. The tree now reuses rows keyed by
their source DOM element, removes obsolete rows and moves only rows whose order
changed. Handlers and accessibility metadata refresh against the new hierarchy;
existing buttons remain attached during unrelated updates. Rename retains focus,
and keyboard parent navigation follows reparenting.

The new `test:e2e:layer-interactions` fails on the prior implementation and passes
in Chromium and WebKit. It covers held-click source refresh, modifier selection,
button identity, rename focus, reparented keyboard navigation, search and disclosure.
The real React selection/style workflow passes in both engines; the HTML selection
layout workflow passes in Chromium. All 328 unit/HTTP tests pass. Logs are
`/private/tmp/retouch-layer-refresh-{before,chromium,webkit,react-chromium,react-webkit,html,unit}.log`.

This proves and fixes a real source-refresh click loss. It does not establish the
cause of the earlier packaged WebKit timeout, whose evidence remains intact.
The latest Mac archive still packages `3b3d8a1` and predates this source fix.

## Canvas layer locks

The Layers tree now exposes lock/unlock controls with labels and inherited lock
state. Locked layers and their descendants are excluded from canvas click/text
editing, modifier picking, hover outlines and marquee selection. Select-visible
and range candidates omit locked layers. Explicit tree selection remains available
for deliberate inspector edits. Locking clears the current selection and cancels
active canvas tools. Source files and runtime DOM attributes/styles are unchanged.

Locks belong to the current editor session and page route, keyed by source host
or instance IDs. They survive iframe reloads and route round trips; a child's
independent lock survives unlocking its parent. They are not persisted across an
editor reload and are not a source-write permission boundary. Lock undo/redo
was added in the following increment. Source structural changes may shift IDs; durable document
identity and lock persistence remain unfinished.

The real React marquee workflow passes in Chromium and WebKit with locked-layer
filtering, modifier picking, group movement and exact source undo. The HTML lock
workflow passes in
Chromium and WebKit, including plain/modifier/double-click, marquee filtering,
inherited states, iframe reload, SPA route changes, deliberate tree selection and
unchanged source. The focused state test covers route and instance separation.
All 329 unit/HTTP tests pass; existing layer-interaction regression passes.
Logs: `/private/tmp/retouch-layer-locks-{chromium,webkit,react-chromium,react-webkit,unit,interactions}.log`.
Screenshot `/private/tmp/retouch-layer-locks.png` was inspected. The latest Mac
archive predates this feature.

## Ordered lock and source history

Lock/unlock changes now record entries in the existing shared history controller.
Undo and Redo restore the entry's route and editor lock state without invoking the
source operation API. Source edits and lock changes therefore reverse in one
chronological order. No-op locks add no entry; conflicting lock state refuses a
restore and retains the entry for retry. New lock changes invalidate redo through
the same controller used by source edits. Restoring locks clears selection and
refreshes inherited lock indicators.

The extended HTML lock workflow passes in Chromium and WebKit. It interleaves a
real source width edit with locks, checks exact source bytes and source API request
counts, follows a lock undo across routes, and verifies toolbar/keyboard undo,
redo and branch invalidation. All 330 unit/HTTP tests pass, including route-isolated
lock restoration and conflicting-state refusal. Logs:
`/private/tmp/retouch-lock-history-{chromium,webkit,unit}.log`.
The real React lock/marquee/group-edit workflow also passes in WebKit; log
`/private/tmp/retouch-lock-history-react-webkit.log`.

Session persistence, durable source identity, full Figma parity and trusted Mac
distribution remain unfinished. The packaged Mac app predates lock support.

## Selection through locked overlays

Canvas picking now searches the rendered hit stack beneath a locked source layer.
It skips locked descendants and the covered layer's own ancestors, so a locked
object cannot intercept access to an unrelated editable layer beneath it. This
applies to normal/modifier picking, double-click text access and hover outlines.
A drag starting over a locked object can start a marquee; short clicks preserve
normal picking through the overlay, with the existing duplicate-click suppression.
No pointer-events styles or source attributes are changed.

The new `test:e2e:locked-overlay` passes in Chromium and WebKit at 50/100/200%
zoom. It covers underlying selection, modifier selection, empty clicks, text
editing entry/exit, marquee starts over a locked overlay, Escape, unlock behavior,
unchanged source and suppression of the overlay's application click handler.
The HTML lock/history workflow passes in Chromium, and the real React lock/marquee/
group-edit workflow passes in WebKit. All 330 unit/HTTP tests pass. Logs:
`/private/tmp/retouch-locked-overlay-{chromium,webkit,lock-regression,react-regression,unit}.log`.

This uses the browser's same-document hit stack; it does not add source mapping
inside cross-origin frames or closed shadow roots. Full arbitrary-site authoring,
lock persistence, remaining Figma features and trusted desktop distribution remain
unfinished. The latest packaged app predates the lock work.

## Selection-wide lock and unlock

The Layers action area now offers Lock selection and Unlock selection. Each action
records only changed source identities in one history entry, deduplicating repeated
rendered instances. Mixed selections preserve pre-existing locks when undone;
unlocking only removes direct locks, with inherited locks still controlled by the
parent. Empty/no-op changes add no history entry. Batch history validates all
members before restoring any member, so a conflicting lock cannot cause a partial
undo. Single-row lock controls use the same batch path.

The HTML workflow passes in Chromium and WebKit for two-layer lock/unlock, one-step
undo/redo, and mixed-state restoration, alongside the existing route/source-history
checks. All 331 unit/HTTP tests pass, including all-or-nothing conflicting restores
and invalid-member handling. Logs:
`/private/tmp/retouch-batch-locks-{chromium,webkit,unit}.log`.
The real React workflow also passes batch lock/undo and subsequent marquee/group
editing in WebKit: `/private/tmp/retouch-batch-locks-react-webkit.log`.

Lock persistence and durable source identity remain unfinished; the latest Mac
archive still predates the lock features. Full parity remains the active goal.

## Locks survive editor reloads within the live project session

The shell now receives opaque project and sidecar-session identifiers. Project
identity hashes the canonical project path; session identity hashes the fresh
sidecar token. Neither stored identifier contains the raw path or token. Locks
are saved in tab session storage under the project identity, and loaded only when
the stored sidecar session also matches. Lock/unlock and undo/redo all update the
stored state. Corrupt, oversized or incompatible lock data is discarded; unavailable
storage leaves live editing usable.

Both Chromium and WebKit pass full editor reload with restored lock behavior,
unlock/undo followed by another reload, and an independent editor tab starting
without those locks. History itself remains session-memory-only and starts empty
on editor reload; restored locks do not create fictitious history entries. The
HTTP test verifies stable project identity, route-independent scope, different
projects and fresh sidecar session identities. All 334 unit/HTTP tests pass.
Logs: `/private/tmp/retouch-lock-reload-{chromium,webkit,unit}.log`.

Locks still intentionally reset for a new sidecar session. Persistence across
server restarts or tab closure requires durable source identity beyond the current
structural IDs. Source edits during the live session can still shift those IDs;
this existing limitation is not solved here. Full parity, arbitrary-site authoring
and trusted Mac distribution remain unfinished; the local archive predates locks.

React editor-reload verification also exposed a canceled-marquee pointer-capture
bug. A WebKit trace showed press and release targeting a lock button, followed by
the click being delivered to the old canvas capture surface, with no busy operation.
Cancellation now retains capture until the canceled pointer's actual release;
cleanup still releases it, and a fresh pointerdown clears stale click suppression.
The real React workflow, including clicking Lock immediately after screen/zoom
cancellation and then reloading the editor, passes in Chromium and WebKit.
Locked-overlay and low-zoom marquee/cancellation workflows also pass in both engines.
Logs: `/private/tmp/retouch-lock-reload-react-{chromium,webkit}-fixed.log` and
`/private/tmp/retouch-lock-reload-cancel-{chromium,webkit}.log`. The failing initial
React run and pointer diagnostic remain in `/private/tmp/retouch-lock-reload-react-webkit.log`
and `/private/tmp/retouch-lock-reload-react-pointer-diagnostic.log`.
The final server-scope regression passed all 11 server tests in
`/private/tmp/retouch-lock-reload-server-final.log`.

## Keyboard selection locking

Command/Control+Shift+L toggles locks for the current selection. An entirely
directly locked selection unlocks; an unlocked or mixed selection locks together.
The shortcut uses the same batch state/history path as row and selection buttons,
works from both the editor chrome and the app iframe, and is exposed in button
tooltips and accessibility shortcut metadata. Text inputs, editable content,
Interact mode and open dialogs keep their native handling; busy state and repeat
keydown events do not create extra lock actions.

The HTML lock workflow passes in Chromium and WebKit with parent Meta and iframe
Control shortcuts, batch undo, unlock toggling, editor-search/native-iframe input
exclusion and Interact-mode exclusion, alongside the existing history and reload
checks. Logs: `/private/tmp/retouch-lock-shortcut-{chromium,webkit,unit}.log`.
The work remains on the isolated design-studio branch. Full parity and trusted Mac
distribution remain unfinished; the packaged app still predates lock support.

## Find and recover locked layers

The Layers tree now offers Locked layers only and Unlock shown locks. The lock
filter composes with text search, retains ancestor context and temporarily opens
collapsed branches without discarding their stored collapse state. Empty results
explain whether no locks exist or no locked layers match. Unlock shown locks
removes direct locks represented in the filtered tree as one undoable action;
locks outside those results remain unchanged. Recovery controls stay available
without a current canvas selection.

Chromium and WebKit pass filtering, ancestor context, temporary branch expansion,
collapse-state restoration, empty results, filtered unlock/undo and preservation
of locks hidden by search, within the complete lock/history/reload workflow.
The existing layer-interaction regression and all 334 unit/HTTP tests pass.
Logs: `/private/tmp/retouch-lock-recovery-{chromium-final,webkit-final,interactions,unit}.log`.
Visual inspection found and corrected the checkbox's inherited full-width styling
and matched the recovery button to the tree controls. The final Chromium workflow
passed in `/private/tmp/retouch-lock-recovery-visual-final.log`; screenshot
`/private/tmp/retouch-lock-recovery-final.png` was inspected.

Full feature parity, arbitrary-site source authoring, durable lock identity and
trusted Mac distribution remain unfinished. The existing Mac archive predates
these lock controls.

## Refreshed Mac lock package (a88e45e)

The universal ad hoc archive packages source
`a88e45e4f1e508da21298c0b05892a0c3d5975b6` and is available at
`/private/tmp/retouch-desktop-locks-20260909/Retouch-0.1.0-mac.zip`.
SHA-256: `24e274a13a940e65b8217792737c90b5cff8b87dd15fbb24c124d1b7a3714bb9`.
Its generated cask, verification receipt, native UI check and process sample are
alongside the archive. All 87 packaged source files matched the source commit and
the cask-installed copy. Both architectures, strict ad hoc signature and bundled
launcher/cwd/exit, HTML startup/health/stop and URL self-tests passed.

Both Chromium and WebKit passed all 19 HTML workflows against bundled code, plus
the lock/history/reload/shortcut/recovery, locked-overlay and layer-interaction
workflows. The real React lock/marquee/group-edit workflow passed in WebKit.
The source hashes and strict signature verified again after browser testing;
the temporary harness was removed. Logs are `/private/tmp/retouch-locks-package-*.log`,
with individual paths and counts recorded in `verification.json`.

The isolated cask install/uninstall and cleanup passed. The installed quarantined
self-test timed out after 45 seconds without output; its owned process group was
stopped and verified absent. Quarantine was retained. The test app, temporary tap,
cask trust and registration, and app directory were removed; Homebrew developer
mode was restored to disabled. Native inspection of the built app returned
`cgWindowNotFound`. Its owned PID 3105 was sampled and stopped. This does not prove
usable native editing, trusted launch, notarization, public distribution, upgrades
or Intel runtime. The older-source Developer ID build was polled and remained live
waiting for local signing interaction. Full Figma parity and arbitrary-site
source authoring remain unfinished.

## Zoom to selection

The screen toolbar now offers Zoom to selection for single or multiple selected
source layers. It reveals the selection, fits its bounds within the existing
1–200% zoom limits and pans the bounded canvas. Responsive viewport dimensions
stay fixed. In Fit workspace mode, the current actual viewport dimensions become
a fixed screen before zooming, preserving the site's current media-query layout.
The action cancels canvas tools and reports busy state while revealing the layers.
It does not write source or add a source history entry.

Chromium and WebKit pass offscreen single/group selection, preserved workspace and
fixed responsive dimensions, pan recovery from 50/100/200%, and unchanged source.
The test waits for the completed reveal and verifies actual visible bounds; the
zoom number alone can already equal the desired value before panning finishes.
Screenshot `/private/tmp/retouch-zoom-selection.png` was inspected. Logs:
`/private/tmp/retouch-zoom-selection-{chromium-final,webkit-final,unit}.log`.
All 334 unit/HTTP tests pass. The existing HTML screen-resize workflow passes in
Chromium and React lock/marquee/group editing passes in WebKit; logs
`/private/tmp/retouch-zoom-selection-{screen-regression,react-regression}.log`.

Selections spanning more than the current screen viewport are reported as partially
outside it. Complete reveal through arbitrary nested clipping/scroll containers,
zoom beyond 200%, full Figma parity and trusted Mac distribution remain unfinished.
The latest Mac archive predates this control.

## Canvas zoom shortcuts

Shift+1 fits the current screen and Shift+2 reveals/zooms the selection. Both use
the existing toolbar actions and work from editor chrome or the app iframe.
Button tooltips and accessibility metadata advertise the shortcuts. Typing,
editable content, Interact mode and open editor dialogs retain their own handling;
modified/repeated keys and busy actions do not trigger extra zoom operations.
The shortcuts use physical Digit1/Digit2 codes so shifted punctuation does not
prevent recognition.

The zoom-selection workflow passes in Chromium and WebKit for both focus contexts,
fit/reveal transitions, unchanged responsive dimensions, native editor-search and
iframe-input typing, Interact-mode exclusion and unchanged source. All 334 unit/
HTTP tests pass. Logs: `/private/tmp/retouch-zoom-shortcuts-{chromium-final,webkit-final,unit}.log`.
The first runs had an incorrect native-character assertion: Playwright's Shift+2
synthesis inserts `2` in these inputs. The final check uses the observed native
character and still verifies that zoom remains unchanged while typing.

Full parity, arbitrary-site authoring and trusted desktop distribution remain
unfinished; the latest Mac archive predates Zoom to selection and these shortcuts.

## Precision zoom through 6400%

The zoom input, wheel/gesture clamp and Zoom to selection now support up to 6400%.
High zoom from Fit workspace fixes the current actual viewport dimensions before
magnifying and preserves horizontal pan through that transition. Fixed screens
retain their 1% minimum. Input validation rejects values above 6400% without
changing the canvas. Zoom-to-selection waits for the final pan frames before
re-enabling tools that cancel on viewport movement.

Chromium and WebKit pass direct workspace-to-high-zoom conversion, fixed viewport
preservation, unchanged CSS bounds, scaled rendered bounds at 400/1600/6400%,
bounded 96px canvas end padding, invalid-limit refusal, and selection fitting.
A 10px layer fits at 6400%; a 64-screen-pixel Control-drag moves it exactly one CSS
pixel, followed by exact source undo in both engines. WebKit's native context menu
initially intercepted Control-drag; the active canvas tool surface now suppresses
that menu. The trace in `/private/tmp/retouch-high-zoom-pointer-webkit-events.log`
records the interruption. A separate test setup issue retained text in the layer
search; that field is now explicitly reset before choosing the tiny layer.

Final browser logs: `/private/tmp/retouch-high-zoom-pointer-{chromium,webkit}-fixed.log`.
All 334 unit/HTTP tests pass in `/private/tmp/retouch-high-zoom-unit-final.log`.
The HTML screen-resize regression passes in Chromium in
`/private/tmp/retouch-high-zoom-screen-regression.log`.

This does not establish every editing gesture at every high zoom, complete legacy
Fit-workspace viewport-unit equivalence through the fixed-screen transition, or
full Figma parity. Arbitrary-site authoring and trusted Mac distribution remain
unfinished; the latest archive predates these zoom changes.

### 2026-09-09 — Preserve responsive viewport during workspace zoom

Workspace zoom now scales a stable iframe viewport, just as fixed screens do.
Removed preview-only vh rewriting, its style mutation observer, and the automatic
switch to a fixed screen above 200%. Previously workspace 200% halved innerHeight
while pinned 100vh retained the original height; switching to 400% restored vh
against the smaller frozen viewport. Height media queries also saw different
geometry from pinned viewport units. Workspace dimensions now follow workspace
resizing at every zoom, and magnification leaves CSS and responsive layout intact.
Zooming out displays a smaller viewport instead of additional vertical page area.
A viewport smaller than the workspace leaves unused canvas space; additional
endpoint panning remains bounded by 96 screen pixels. Zoom to selection still
chooses a fixed screen before fitting the selected bounds.

Chromium and WebKit pass viewport-unit, height-media-query, untouched CSS,
workspace-resize, stable screen-choice, and repeated top/bottom pan limit checks
at 25/50/100/200/400%, together with the existing selection, high zoom through
6400%, one-CSS-pixel Control-drag and exact source undo flow:
`/private/tmp/retouch-viewport-zoom-chromium-final.log` and
`/private/tmp/retouch-viewport-zoom-webkit-bounds.log`.
The initial WebKit run encountered an execution-context destruction during the
expected source-edit reload; polling now retries that specific transient error.
Chromium screen-resize regression passes in `/private/tmp/retouch-viewport-resize.log`.
All 334 unit tests pass in `/private/tmp/retouch-viewport-unit.log`.
The legacy external Moses zoom script expectations were updated but that script
was not run in this checkpoint. The latest Mac archive still predates zoom work;
full Figma parity, arbitrary-site authoring and trusted distribution remain open.

### 2026-09-09 — Keep zoom anchored under the pointer

Zoom now pans the canvas before changing page scroll, preserving the pointer's
page coordinate and the iframe's scroll position when canvas bounds allow it.
If the canvas reaches its limit, residual page scrolling is immediate, including
sites that author `scroll-behavior:smooth`. Finite canvas/page bounds can still
prevent exact anchoring when zooming out; this does not introduce infinite space.

A new isolated HTML browser test reproduced the previous failure before the fix:
at 100% to 200%, the point at document y=200 moved to y=103 under the pointer and
page scroll began animating (`/private/tmp/retouch-zoom-anchor-before.log`).
The test now passes in Chromium and WebKit for both canvas and iframe gestures,
workspace and fixed screens, page top/middle/bottom, 100→200→400→200%, and a
100→50% residual-scroll case that checks immediate and settled coordinates.
Logs: `/private/tmp/retouch-zoom-anchor-{chromium,webkit}-final.log`.
Existing viewport/selection/high-zoom/source-undo browser flows pass in both
engines: `/private/tmp/retouch-anchor-selection-{chromium,webkit}.log`.
This checkpoint does not validate every sticky/nested-scroll layout or refresh
the Mac archive. Full feature parity and trusted distribution remain unfinished.

### 2026-09-09 — Hand tool and temporary Space-drag

Added a visible Hand toggle and temporary Space-drag for canvas navigation.
The hand surface uses pointer capture in the parent editor, so dragging across
iframe/canvas boundaries moves the finite canvas by physical screen pixels
without changing page scroll, layer selection or source. Space works with a
layer row or iframe focused; normal buttons and editable fields retain native
keyboard behavior. Escape cancels an in-flight gesture without allowing its
remaining pointer movement to pan, and capture survives until the real release
so WebKit does not swallow the next selection click. Screen/zoom changes,
Interact mode, busy source/history work and parent-window blur exit the hand.
Horizontal wheel input pans the canvas; vertical/pinch input uses existing zoom
and page-scroll handling. This is viewport panning, not whole-document capture.

Both engines pass the isolated HTML flow at 50/200/400%, with editor and iframe
focus, selection/page-scroll preservation, horizontal wheel input, Escape during
a drag, the next layer click, parent-field typing, Interact mode, screen-change
cleanup and unchanged source. Logs:
`/private/tmp/retouch-canvas-pan-chromium-complete.log` and
`/private/tmp/retouch-canvas-pan-webkit-complete.log`.
An initial Space check exposed that layer rows use buttons; the shortcut now
exempts treeitems from the ordinary-button guard. Chromium's existing selection,
responsive zoom and precise 6400% source-edit/undo flow also passes:
`/private/tmp/retouch-pan-zoom-regression.log`.
The latest Mac archive does not include this tool. Full Figma parity, arbitrary
remote-site authoring and trusted distribution remain unfinished.
All 334 unit tests pass in `/private/tmp/retouch-canvas-pan-unit-final.log`.

### 2026-09-09 — Exclusive Hand and editing tools

Starting single-layer movement/resizing (HTML or React), group transformation or
gap adjustment, or SVG drawing now dismisses Hand before mounting the editing
tool. Switching to Hand already cancels an uncommitted editing preview. This
prevents two tools from remaining logically active and competing for Escape.

The expanded HTML browser regression includes Hand→Move, Move keyboard preview→
Hand with unchanged source, and Hand→SVG rectangle drawing. Testing the corrected
fixture against the previous implementation reproduces Hand remaining pressed
while Move is mounted: `/private/tmp/retouch-tool-switch-baseline.log`.
The initial fixture attempted to move an offscreen layer; it now explicitly uses
Zoom to selection before testing tool transitions.
Chromium passes in `/private/tmp/retouch-tool-switch-chromium-final.log`.
WebKit passes in `/private/tmp/retouch-tool-switch-webkit-probe.log` and, after
removing temporary diagnostic calls, `/private/tmp/retouch-tool-switch-webkit-confirmed.log`.
An earlier WebKit run lost the move surface after the zoom/Hand transition
(`/private/tmp/retouch-tool-switch-webkit-final.log`); its timing-related cause is
not established, so those successful reruns do not prove it fully resolved.
The real React selection-geometry suite additionally activates Hand before group
movement at 50/100/200% and verifies dismissal before pointer edits and exact
undo: `/private/tmp/retouch-hand-react-geometry.log` (Chromium PASS).
No Mac archive refresh or full Figma parity is claimed by this checkpoint.

### 2026-09-09 — Immediate editor reveal on smooth-scrolling sites

Layer-tree selection and comparison selection now reveal their target with
explicit instant scrolling. Fit screen and source reload restoration also use
instant scrolling. Normal site interaction retains authored smooth scrolling.
Previously those editor paths inherited `scroll-behavior:smooth`, enabling canvas
tools while the target was still moving or entirely outside the visible canvas.
The new isolated regression fails before the fix: the selected heading's top
was y=1578 while the canvas ended at y=1100, even after the Move control appeared
(`/private/tmp/retouch-layer-reveal-before.log`).

The regression now passes in Chromium and WebKit, including immediate visibility,
a Move surface that remains active after reveal, Fit preserving page scroll,
a one-pixel source movement, reload scroll restoration and exact source undo.
Logs: `/private/tmp/retouch-layer-reveal-{chromium,webkit}-final.log`.
Hand/Move/Draw transitions also pass in both engines in
`/private/tmp/retouch-reveal-tool-switch-{chromium,webkit}.log`.

The preceding intermittent WebKit dismissal was not captured in six bounded
traced attempts: `/private/tmp/retouch-move-cancel-trace.log` and
`/private/tmp/retouch-move-cancel-repeat-{1,2,3,4,5}.log`. Those traces only showed
expected Escape/Hand cancellation. This deterministic smooth-scroll defect is
fixed, but its identity with that earlier intermittent failure remains unproven.
Temporary cancellation tracing was removed. The Hand regression additionally
checks that the revealed heading lies inside the canvas before starting Move.
No Mac archive refresh or full Figma parity is claimed.
All 334 unit tests pass in `/private/tmp/retouch-layer-reveal-unit.log`.

### 2026-09-09 — Fresh navigation Mac archive; verification failed

Built `/private/tmp/retouch-desktop-navigation-20260909/Retouch-0.1.0-mac.zip`
from `a288bc614a89e7924545b365fa507ef7893b3b02`, SHA-256
`2d0aa17904c6e1ca24574eb17d6036294eadec2dc87c54499f335732ea7a972c`.
All 88 packaged source files match the commit, before and after bundled browser
runs. Universal arm64/x86_64, strict ad hoc signature, native bundled launcher,
HTML startup/health/stop and URL-boundary self-tests pass. The generated cask
installed in an isolated directory and verified the same 88 files and signature.
Quarantine remained intact; installed native self-test timed out after 45 seconds.
Its owned process group, installed cask, app directory, temporary tap and cask
trust entry were removed; Homebrew developer mode was restored to disabled.

Both bundled engines pass zoom anchoring, high-zoom selection/source undo,
immediate layer reveal/Fit/source-reload restoration and screen resizing.
Chromium additionally passes real React group geometry but fails the Hand flow's
post-zoom heading visibility assertion (part of the heading lies above canvas).
WebKit passes Hand/tool switching but times out waiting for the real React
horizontal-gap button to stabilize. Ten of twelve workflows passed; the archive
is explicitly not a release candidate. `verification.json` contains all results
and logs, including the initial failures rather than replacing them with retries.
The temporary browser harness was removed after terminal tests/hash verification.

Native CUA inspection returned `cgWindowNotFound`. The owned built-app process
was sampled and stopped, with `native-ui-check.json` and the process sample beside
the archive. No current usable native UI, trusted launch, notarization, public
release, upgrades or Intel execution is established. Desktop README now names
this newest artifact and its failures; the earlier lock package evidence remains
in its historical section. Full Figma parity remains unfinished.

### 2026-09-09 — Settle native momentum before finishing selection fit

The packaged zoom-visibility failure is now reproduced with a scroll-call trace:
`/private/tmp/retouch-reveal-position-trace.log`. Native Space scrolling started
in Interact mode keeps advancing after explicit instant scroll requests. During
selection fitting, the page reached scrollY=0 as requested, then advanced to 54
and 94 while the fitting operation was still busy. The old two-frame wait ended
there, leaving the heading above the canvas (y=26.64 versus canvas top=89).
This is distinct from inherited CSS smooth scrolling fixed in a288bc6.

Selection fitting now recenters on each animation frame until the page bounds,
scroll and canvas geometry remain stable for three frames. A one-second bound
returns an actionable message for a continuously moving page. New zoom, screen
or frame-load events supersede the pending operation, so it cannot override a
newer view command. Temporary investigation tracing was removed.

Both browser engines pass the native Space→edit→selection fit→Hand/Move/Draw
flow, including the full heading visibility assertion:
`/private/tmp/retouch-reveal-stability-pan-{chromium,webkit}.log`.
Both also pass high zoom/precise source movement/exact undo, continuous-motion
failure, recovery after motion stops and cancellation by a new Fit command:
`/private/tmp/retouch-reveal-stability-{chromium,webkit}-final.log`.
All 334 unit tests pass in `/private/tmp/retouch-reveal-stability-unit.log`.

The React gap-control instability was investigated first. The real WebKit
selection-geometry workflow passed with bounds/DOM-identity tracing enabled
(`/private/tmp/retouch-gap-stability-trace.log`), so its earlier packaged failure
is not established as resolved. The existing Mac navigation archive still
contains the pre-fix code and retains its failing receipt. Full Figma parity and
trusted Mac distribution remain incomplete.

### 2026-09-09 — Preserve inspector controls during pointer activation

A same-selection inspector rebuild now waits until an active panel pointer
finishes. Pointer release/cancel in either the editor or iframe schedules the
pending rebuild after the compatibility click; a new selection can still render
immediately. This preserves the control and its click handler across viewport
refreshes instead of replacing the pressed DOM element before mouse-up.

A real browser-window resize while Move is pressed fails against the previous
inspector in an isolated runtime copy:
`/private/tmp/retouch-inspector-real-resize-before.log` (pressed node detached).
The copy was removed after the terminal result. The initial regression used a
synthetic viewport event without required detail, which produced an HTML
exception. That test version also encountered Next development-overlay errors;
their precise cause was not established. The synthetic event was replaced with
a real window resize, without suppressing page errors. Optional React error-stack
logging remains available through `RT_TRACE_PAGE_ERRORS=1`.

The HTML regression verifies the held control remains attached, release starts
Move, the deferred rebuild subsequently runs, and source editing/scroll restore/
exact undo still work. React verifies the ordinary gap-button click as well as
holding it during resize, followed by keyboard gap edits and exact source undo.
The fresh archive still predates this fix and retains its failing receipt; the
new source checks do not retroactively validate that artifact or establish every
cause of the prior intermittent WebKit instability. Full Figma parity and
trusted Mac distribution remain unfinished.

Final HTML browser logs (both PASS):
`/private/tmp/retouch-panel-press-html-{chromium,webkit}-complete.log`.
Final real React browser logs (both PASS):
`/private/tmp/retouch-gap-press-{chromium,webkit}-real.log`.
WebKit screen-resize regression passes in `/private/tmp/retouch-panel-press-screen.log`;
all 334 unit tests pass in `/private/tmp/retouch-panel-press-unit.log`.

### 2026-09-09 — Preserve confirmed live previews and selection on undo

React source writes now retain the iframe session when the live DOM confirms the
compiler revision and expected edit, with linked stylesheets loaded across three
observations. The existing reload path remains for renderers without revision
stamps or live updates that do not settle within the bounded check. This avoids
forcing a navigation after an already-applied HMR update; it does not guarantee
preservation of every application's component state.

The first WebKit run exposed Layers showing one selected item after a three-layer
undo. Selection was restored in editor state but the tree depended on the next
animation frame. Inspector updates now synchronize layer selection immediately,
including before deferred panel-content rendering. The existing exact-selection
assertions remain unchanged.

Both full React selection-geometry workflows pass, including source movement at
50/100/200 percent zoom, responsive geometry, gaps, undo/redo and a new assertion
that the iframe window survives a compiler-confirmed edit:
`/private/tmp/retouch-live-refresh-{chromium,webkit}-sync.log`.
The initial failed WebKit log remains at
`/private/tmp/retouch-live-refresh-webkit.log`.
All 334 unit tests pass in `/private/tmp/retouch-live-refresh-unit.log`.
Chromium's HTML layer-reveal workflow passes with source-reload scroll preservation
and exact movement undo in `/private/tmp/retouch-live-refresh-html-reveal.log`.

WebKit SVG geometry, creation/drawing, duplication, stacking/deletion, responsive
paint and exact undo/redo also pass in
`/private/tmp/retouch-live-refresh-webkit-svg.log`.

Native launch testing remains paused at the user's request. No native app was
launched for this work. The d9cd994 archive retains its original failed receipt;
these source changes do not validate that archive. Full Figma Design parity,
arbitrary-site support and trusted Mac distribution remain incomplete.

### 2026-09-09 — Direct polygon and polyline vertex editing

The SVG geometry inspector now offers Edit vector points for literal polygon and
polyline point lists in HTML and React. Handles map pointer movement through the
SVG screen transform and editor zoom; nested translation, rotation and nonuniform
scaling are covered. Clicking a handle selects it for arrow-key movement (one
SVG unit, or ten with Shift). Drag release or Enter commits through the existing
source transaction/history path. Shift-drag constrains an SVG-coordinate axis.
The outline preview stays outside the site's DOM; untouched point values retain
JavaScript numeric precision. Canvas padding exposes edge handles without changing
the site viewport or zoom. Repeated tool activation supersedes a pending launch.

Escape, screen/viewport changes, scrolling and source/rendered geometry changes
cancel the preview. File hashes protect source commits; dynamic JSX values remain
uneditable and a source vector rendered multiple times is refused by the canvas
entry point. Point lists validate numeric syntax, complete coordinate pairs,
finite values, coordinate bounds and a 512-point editing limit.

All four HTML/React × Chromium/WebKit browser cases pass source movement at
50/100/200 percent zoom, click-to-select keyboard edits, exact undo/redo, and
Escape/screen/stale-preview cancellation, plus repeated activation. Logs are
`/private/tmp/retouch-svg-vertices-{html,react}-{chromium,webkit}-complete.log`.
The inspected screenshot `/private/tmp/retouch-svg-vertices-final.png` shows the
transformed triangle, isolated moving outline and visible handles. All 337 unit
tests pass in `/private/tmp/retouch-svg-vertices-unit-final.log`, including source
identity preservation and malformed/dynamic/stale point-list refusal.

This edits existing straight-segment vectors. Creation, adding/removing vertices,
Bézier paths and handles, vector networks, boolean operations and masks remain.
No native app was launched; this work does not establish full Figma parity or
trusted Mac distribution.

### 2026-09-09 — Add and remove SVG vertices

Edge midpoint controls now insert a vertex into the pending vector preview. The
new point takes keyboard focus and can immediately move. Polygon closing edges
receive insertion controls; open polylines do not gain an unintended closing
edge. Delete/Backspace and a Delete point button remove the focused vertex, with
minimums of three polygon points and two polyline endpoints. Done and Cancel are
visible in a wrapping action bar above the transient help message. Enter on an
insertion button activates that button; Enter on a point applies the edit.
Uncommitted changes remain outside the site DOM and source.

WebKit/React initially failed to reopen the editor after redo. The trace
`/private/tmp/retouch-svg-topology-react-webkit-trace.log` shows matching source
and attribute values, an unchanged transform, and four base points, while
animatedPoints retained three points. The editor now checks actual SMIL animation
targets rather than relying on that stale list. Actual points animations still
refuse editing with a specific message; attribute/matrix changes still cancel.
The original failure and diagnostic logs are retained.

Final HTML/React × Chromium/WebKit workflows all pass in
`/private/tmp/retouch-svg-topology-{html,react}-{chromium,webkit}-final.log`.
They cover transformed dragging at 50/100/200 percent zoom, keyboard insertion on
a polygon's closing edge, removal/minimum counts, no closing-edge insertion for
open lines, Done/Cancel, exact source undo/redo and reopening, unchanged source
during previews, and actual-animation refusal. Visual inspection of
`/private/tmp/retouch-svg-topology-html-webkit-final.png` confirms the insertion
control, point handles and accessible action buttons are visible.

This extends existing straight-segment vectors; freeform creation, Bézier path
authoring, vector networks, booleans and masks remain unfinished. Native app
launches remain paused. Full Figma Design parity, arbitrary-site editing and
trusted Mac distribution are not established by these checks.

### 2026-09-09 — Draw new vectors with Pen

Existing HTML and JSX SVG canvases/groups now offer Pen. Clicks place straight
segments in local SVG coordinates; Shift constrains direction to 45-degree
increments. Enter, Finish line or a double-click finishes an open polyline.
Clicking the first point or Close shape creates a polygon. Backspace/Remove last
point edits the pending path; Escape, Cancel and viewport changes discard it.
The preview stays outside the site's DOM. Source insertion preserves surrounding
identities, selects the new vector and participates in exact source undo/redo.
Newly drawn vectors can immediately use the vertex editor.

Both adapters reject missing, incomplete, nonnumeric, nonfinite, oversized and
insufficiently distinct point lists. Pen accepts at most 512 points and uses the
existing file-hash and structural checks. JSX output uses strokeWidth. Drawing
into a repeatedly rendered source container is refused.

A cancellation trace (`/private/tmp/retouch-svg-pen-cancel-trace.log`) exposed a
shared toolbar issue: long help text changed canvas height and dispatched a
viewport event that cancelled drawing. Status text now has a stable flex basis
and ellipsis; its full text is available in the tooltip and transient message.
The pen browser test asserts that help does not change toolbar height. Pen also
shares the point editor's canvas-margin preparation so points on a clipped group
edge remain accessible. Its actions occupy the larger frame overlay while point
placement remains inside the SVG canvas.

All four HTML/React × Chromium/WebKit workflows pass:
`/private/tmp/retouch-svg-pen-{html,react}-{chromium,webkit}-complete.log`.
These verify open vectors at 50/100/200 percent zoom through nested transforms,
closed creation, Backspace, Shift, double-click, cancellation, subsequent point
editing, source/DOM isolation during previews and exact undo/redo. Expected
coordinates use actual delivered mouse events because WebKit rounds synthetic
click positions. Initial failures and diagnostic logs remain in /private/tmp.
The inspected `/private/tmp/retouch-svg-pen-html-chromium-complete.png` shows
visible points, unobstructed actions and stable header layout.

All 339 unit tests pass in `/private/tmp/retouch-svg-pen-unit-final.log`. Existing
Chromium layer reveal/pressed Move/source undo passes in
`/private/tmp/retouch-pen-toolbar-layer-reveal.log`; WebKit Hand/Space pan, tool
exclusivity and source preservation pass in
`/private/tmp/retouch-pen-toolbar-canvas-pan.log`.

Pen currently creates straight segments inside existing SVG containers. Curves,
Bézier handles, vector networks, booleans, masks and unrestricted canvas/document
authoring remain. Native launches stayed paused; no desktop build or launch was
performed. Full Figma parity and trusted Mac distribution remain incomplete.

### 2026-09-09 — Bézier curve creation with Pen

Pen now places an anchor on pointer-down. Clicking leaves a corner; dragging
creates paired incoming/outgoing handles, with a live cubic path and visible
control lines. Backspace removes the last anchor and its handles. Open paths
finish with Enter or Finish path. Curved shapes can close with two distinct
anchors; the closing segment uses the final outgoing and first incoming handles.
Straight drawings retain polygon/polyline output. Curved drawings become SVG
paths through the same HTML/JSX insertion and history path.

A shared serializer validates anchors/handles and emits only numeric M/L/C/Z
commands. It covers mixed straight/curved segments and independent handle values;
the current pen gesture creates mirrored handles. Source tests cover bounds,
malformed or injected values, missing/sparse nodes, stale hashes, surrounding
identity preservation and JSX strokeWidth output. All 342 unit tests pass in
`/private/tmp/retouch-svg-curves-unit.log`.

Four browser/renderer combinations pass visible curvature and path-length
checks at 50/100/200 percent zoom, two-anchor curved closure, preview-to-source
identity, Backspace/Escape and exact undo/redo:
`/private/tmp/retouch-svg-curves-html-chromium.log`,
`/private/tmp/retouch-svg-curves-react-webkit.log`,
`/private/tmp/retouch-curves-html-webkit-svg-curves.log`,
`/private/tmp/retouch-curves-react-chromium-svg-curves.log`.
The inspected `/private/tmp/retouch-svg-curves.png` shows the curved preview,
control lines and both handles on the active anchor.

The straight-line regression initially compared against click-event coordinates;
anchors now originate from pointer-down, whose coordinates can differ from the
subsequent compatibility click. The test now captures the delivered pointer-down
position without loosening its geometric tolerance. Straight creation, point
editing, cancellation and undo/redo pass in
`/private/tmp/retouch-curves-html-chromium-svg-pen.log` and
`/private/tmp/retouch-curves-react-webkit-svg-pen.log`.

This establishes curve creation, not complete vector authoring. Editing saved
path anchors/handles, independent handle controls, path conversion/import, vector
networks, booleans and masks remain. Native launches stayed paused. Full Figma
Design parity, arbitrary-site support and trusted Mac distribution remain open.


### 2026-09-09 — Saved path anchors and independent Bézier handles

The vector point editor now opens supported SVG paths in HTML and JSX. Moving an
anchor translates its attached handles; incoming and outgoing handles can also
move independently with pointer dragging or arrow keys. Shift-arrow moves ten
SVG units. Adding a point splits the cubic at its midpoint without changing its
geometry. Anchor deletion, Done/Enter, Escape and source undo/redo use the existing
geometry history flow. Pending geometry remains outside the site DOM.

The shared parser accepts one subpath using M/L/H/V/C/S/Q/T/Z, including relative,
implicit and smooth commands. Quadratics normalize to cubic handles. It rejects
arcs, compound paths, malformed data and unsupported coordinate/node bounds.
These remain explicit vector-authoring gaps. The command semantics follow
https://www.w3.org/TR/SVG2/paths.html.

All four saved-curve browser workflows pass:
`/private/tmp/retouch-saved-curves-{html,react}-{chromium,webkit}-complete.log`.
They cover anchor/independent-handle changes at 50/100/200 percent zoom through
nested transforms, geometry-preserving insertion, deletion, preview isolation,
cancellation, actual CSS geometry override refusal and exact source undo/redo.
The inspected `/private/tmp/retouch-saved-curves-react-chromium.png` shows anchor
squares, round handles, tangent lines and the editing action bar.

The original Chromium failure is retained in
`/private/tmp/retouch-saved-curves-html-diagnostic.log`: computed CSS rounded the
attribute's coordinates, causing a false override refusal. The check now compares
browser-normalized CSS values. Source/transform/animation changes still cancel
pending edits. All 344 unit tests pass in
`/private/tmp/retouch-saved-curves-unit.log`, including exact cubic subdivision
checks and parser normalization/rejection cases. Existing polygon/polyline
regressions pass in `/private/tmp/retouch-saved-curves-vertices-html-regression.log`
and `/private/tmp/retouch-saved-curves-vertices-react-regression.log`.

This adds saved curve editing. Vector networks, arcs/compound paths, handle modes,
booleans, masks and the other full-parity requirements remain open. Native app
launches remain paused; no desktop build or launch occurred for this change.


### 2026-09-09 — Corner/smooth conversion and linked handle movement

Saved path editing now includes Make corner and Make smooth actions. Corner
removes the selected anchor's control handles. Smooth creates opposing tangents
along adjacent anchors, retaining usable handle lengths and deriving missing
lengths from the neighboring edges. Open endpoints get only their used handle;
two-anchor loops retain an existing tangent or use a perpendicular fallback.
Invalid or out-of-bounds conversions leave the pending geometry unchanged.

The Move handles selector offers Independent, Aligned and Mirrored movement.
Aligned rotates the opposite handle while preserving its length. Mirrored also
matches lengths. Pointer movement uses the drag-start geometry to avoid drift;
keyboard movement uses the same helper. This is a tool-wide session setting,
retained across reopening the editor until shell reload. Geometry is written to
SVG source; persistent per-anchor constraint metadata remains unimplemented.

Zero-length controls from serialized cubics are hidden so they do not obscure
corner anchors after reopening. Make smooth restores usable handles. Both
conversions stay in the isolated preview until commit and participate in exact
source undo. Native launches remain paused.

All 346 unit tests pass in `/private/tmp/retouch-handle-modes-unit.log`. All four
HTML/React and Chromium/WebKit workflows pass in
`/private/tmp/retouch-handle-modes-{html,react}-{chromium,webkit}-complete.log`.
The new assertions check independent/aligned/mirrored keyboard geometry, mirrored
pointer dragging, corner conversion and reopening, smooth conversion, cancellation
and exact undo. They also run the saved-curve creation/editing regression at
50/100/200 percent zoom through nested transforms. The inspected
`/private/tmp/retouch-handle-modes-html-chromium.png` shows the visible conversion
buttons, movement selector and curve controls without clipped toolbar actions.

Full vector networks, compound paths/arcs, booleans/masks, the wider Figma Design
scope, arbitrary-site authoring and trusted Mac distribution remain incomplete.


### 2026-09-09 — Compound SVG contour editing

The path model now accepts multiple supported subpaths in one SVG d attribute.
It preserves contour order, winding, closure and relative moveto origins after
open or closed contours. The editor uses the complete document for source and CSS
geometry checks. HTML and JSX writes retain surrounding source identities, paint
and fill-rule attributes. The single-contour API remains available for Pen and
geometry helpers.

A Contour picker and clickable secondary contour outlines choose which anchors
to edit. Pending changes survive switches, all contours receive preview outlines,
and Done commits the complete path in one source operation. Escape discards the
whole pending edit. The shared 512-anchor limit applies across all contours, with
at most 128 contours. Deletion refuses a degenerate remaining contour before
mutating the preview.

All 349 unit tests pass in `/private/tmp/retouch-compound-unit.log`. Compound
browser workflows pass in `/private/tmp/retouch-compound-html-chromium.log`,
`/private/tmp/retouch-compound-react-webkit.log`,
`/private/tmp/retouch-compound-html-webkit-svg-compound.log`, and
`/private/tmp/retouch-compound-react-chromium-svg-compound.log`.
These verify even-odd holes, untouched outer/neighboring contours, open curve
handles, picker and outline selection, isolated pending edits across contours,
50/100/200 percent zoom through nested transforms, cancellation and exact source
undo/redo. The inspected `/private/tmp/retouch-compound-html-chromium.png` shows
the selected hole, secondary outlines and wrapped but fully visible toolbar.
Single-contour creation/handle-mode regressions pass in
`/private/tmp/retouch-compound-html-chromium-svg-handle-modes.log` and
`/private/tmp/retouch-compound-react-webkit-svg-handle-modes.log`.

Supported contours still use M/L/H/V/C/S/Q/T/Z. Arcs, move-only/degenerate contours,
drawing commands immediately after Z without a new moveto, creating/removing whole
contours, vector networks, booleans and masks remain open. Native launches remain
paused; no desktop build or launch occurred. Full Figma Design parity, unrestricted
site authoring and trusted Mac distribution remain incomplete.


### 2026-09-09 — Whole-contour restructuring

Path editing now offers Duplicate contour, Delete contour, Reverse contour and
Open/Close contour. Duplication copies anchors and handles with a 10-unit SVG
offset and selects the copy. Deletion keeps at least one contour; the existing
layer deletion action handles removing the final path. Reversal swaps incoming
and outgoing handles and preserves cubic geometry. Closed contours retain their
starting anchor, while open contours exchange endpoints. Reversal can change
holes under the nonzero fill rule.

Opening removes the closing edge and its endpoint handles. Closing joins the
endpoints with a straight edge. The buttons describe these effects and report
pending changes. All actions update the preview and contour picker, preserve
unselected contours, enforce document limits and commit through one source undo
operation. Escape discards pending restructuring.

All 352 unit tests pass in `/private/tmp/retouch-contour-actions-unit-final.log`.
The initial reversal test used incorrect reverse-edge indices; its failure is
retained in `/private/tmp/retouch-contour-actions-unit.log`. Corrected geometric
sampling and reverse-twice assertions pass without changing the implementation.
All four browser workflows pass in
`/private/tmp/retouch-contour-actions-html-chromium.log`,
`/private/tmp/retouch-contour-actions-react-webkit.log`,
`/private/tmp/retouch-contour-actions-html-webkit-svg-contour-actions.log`, and
`/private/tmp/retouch-contour-actions-react-chromium-svg-contour-actions.log`.
They verify nonzero cutout reversal, reversed cubic samples, copied handle
coordinates, whole-contour deletion, closing-edge length changes, final-contour
protection, isolated previews and exact undo/redo. They also run compound editing
at 50/100/200 percent zoom through nested transforms. Existing curve/handle-mode
regressions pass in
`/private/tmp/retouch-contour-actions-html-chromium-svg-handle-modes.log` and
`/private/tmp/retouch-contour-actions-react-webkit-svg-handle-modes.log`.
The inspected `/private/tmp/retouch-contour-actions-html-chromium.png` shows the
copied contour selected and all contour actions visible in the wrapped toolbar.

Drawing new contours into an existing path, arcs, vector networks, boolean/mask
operations and the remaining Figma Design requirements are still open. The
preview uses outlines; fill-rule changes are rendered by the site after commit.
Native launches remain paused. This source change does not establish trusted Mac
distribution or arbitrary-site authoring.


### 2026-09-09 — Pen drawing into existing compound paths

Draw contour opens Pen from the path editor. It draws in the selected path's own
coordinate system, including path-level and ancestor transforms. Finishing an
open or closed drawing appends a contour to the pending document and selects it;
Done writes the entire edit as one source/history operation. The path remains a
single SVG element and retains existing paint, contours and source identity.
Unused endpoint handles are removed from open appended contours.

Pen cancellation returns to earlier pending point edits. Cancelling the parent
editor discards all pending changes; source, screen or transform changes tear down
both tools. Pen shares the parent's stale-geometry guard and remaining anchor
budget. Its background outlines show the pending document while drawing, so prior
point edits remain visible. Source and rendered site DOM are untouched until the
parent edit commits.

All 353 unit tests pass in `/private/tmp/retouch-draw-contour-unit.log`. The first
React/WebKit test counted SVG paths in Next.js development chrome; that failure is
retained in `/private/tmp/retouch-draw-contour-react-webkit.log`. The assertion now
counts only the edited site's SVG content. Coordinate checks use actual delivered
pointer events and inverse SVG matrices with a 0.01-unit tolerance.

All four final browser workflows pass in
`/private/tmp/retouch-draw-contour-{html,react}-{chromium,webkit}-context.log`.
They cover curved append at 50/100/200 percent zoom through nested nonuniform
transforms, closed straight contours, preserved pending edits and contextual
outlines, child/parent Escape, source-change/screen-change teardown, unchanged site
path count, source isolation and exact undo/redo. The inspected
`/private/tmp/retouch-draw-contour-react-webkit-context.png` shows the pending
outlines, new curve, tangent handles and Pen actions. Standalone curve creation
and contour-action regressions passed in
`/private/tmp/retouch-draw-contour-html-chromium-svg-curves.log` and
`/private/tmp/retouch-draw-contour-react-webkit-svg-contour-actions.log` before the
optional background-outline rendering was added.

Arcs, vector networks, booleans/masks, persistent per-anchor constraints and the
remaining full-parity requirements remain open. Native launches remain paused;
no desktop build or launch occurred. Full Figma Design parity, unrestricted site
authoring and trusted Mac distribution remain incomplete.


### 2026-09-09 — Whole-contour movement

Move contour switches the vector editor to translating every anchor and handle
in the selected contour together. Users drag its highlighted outline or use
arrow keys; Shift-arrow moves ten SVG units. Pointer movement shares the existing
axis constraint and inverse transform handling. A drag commits on release, while
keyboard changes commit with Done/Enter. Escape cancels pending movement. Other
contours retain their geometry and paint.

Point controls are hidden/disabled during this mode, and Delete addresses the
whole contour while preserving the existing final-contour guard. Returning from
a cancelled nested Pen step restores keyboard focus to contour movement. Source
bounds are checked before each translation. The active contour gets a blue
highlight instead of the browser's oversized transformed SVG focus outline;
tangent guides are hidden while moving.

All 354 unit tests pass in `/private/tmp/retouch-move-contour-unit.log`. The initial
browser tests matched both the visible preview and the new transparent hit path;
those failures are retained in `/private/tmp/retouch-move-contour-html-chromium.log`
and `/private/tmp/retouch-move-contour-react-webkit.log`. The visible preview now
has an explicit data-vector-preview marker used by geometry assertions.

All four browser workflows pass in
`/private/tmp/retouch-move-contour-{html,react}-{chromium,webkit}-complete.log`.
They check every translated anchor/handle against actual pointer events through
nested transforms at 50/100/200 percent zoom, untouched neighboring contours,
keyboard movement, preview isolation, mode switching, Escape, nested Pen focus
restoration and exact undo/redo. The final highlight styling was verified in
`/private/tmp/retouch-move-contour-html-chromium-focus.log` and
`/private/tmp/retouch-move-contour-react-webkit-focus.log`; the inspected
`/private/tmp/retouch-move-contour-html-chromium-focus.png` shows the contour itself
highlighted without the oversized focus box or tangent lines.

Before the final styling adjustment, curve-mode and Pen-append regressions passed
in `/private/tmp/retouch-move-contour-html-chromium-svg-handle-modes.log` and
`/private/tmp/retouch-move-contour-react-webkit-svg-draw-contour.log`.
Arcs, vector networks, boolean/mask authoring, persistent per-anchor constraints
and the broader Figma Design requirements remain open. Native launches remain
paused; this work does not establish unrestricted site authoring or trusted Mac
distribution.


### 2026-09-09 — Preserve and edit SVG elliptical arcs

The path model now retains A/a segments as arc descriptors on their endpoint
anchors. Parsing supports relative endpoints, packed single-character flags,
negative-radius normalization and curved closing edges. Serialization preserves
SVG A commands instead of approximating ellipses with cubics. Arc descriptors are
validated and deep-copied during translation/duplication. Opening clears the
closing arc; reversal transfers descriptors to reversed endpoints and flips the
sweep flag. Conflicting incoming Bézier/arc representations are refused.

Subdivision uses endpoint-to-center conversion and radius correction from the
SVG implementation notes:
https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes.
It divides the sweep angle and emits two arcs using corrected radii, preserving
the ellipse. Zero-radius arcs follow the browser's straight-line behavior.
Unrepresentable subdivision results remain unchanged. Existing path controls
move arc endpoints and complete contours, split open and closing arcs, reverse,
duplicate and delete them through source history. Corner/smooth conversion is
disabled at adjacent arc segments to preserve their geometry; tooltips explain
that arc parameters can currently be edited through path data.

All 357 unit tests pass in `/private/tmp/retouch-arcs-unit-final.log`. They cover
flag grammar, closure, malformed parameters, both sweep/large-arc choices,
rotated ellipses and corrected radii, subdivision/reversal samples, translation
and zero-radius geometry. The model checks use a 1e-5-unit tolerance.

All four arc browser workflows pass in
`/private/tmp/retouch-arcs-html-chromium.log`,
`/private/tmp/retouch-arcs-react-webkit.log`,
`/private/tmp/retouch-arcs-html-webkit-svg-arcs.log`, and
`/private/tmp/retouch-arcs-react-chromium-svg-arcs.log`.
They verify rendered arc subdivision within 0.12 SVG units, preserved A commands,
endpoint/whole-contour edits, open reversal, nested transforms at 50/100/200 percent
zoom, isolated previews and exact undo/redo. The latter two also verify closed
arc reversal. The inspected `/private/tmp/retouch-arcs-html-chromium.png` shows
elliptical compound contours with a subdivided arc and accessible anchor controls.
Bézier handle-mode and Pen-append regressions pass in
`/private/tmp/retouch-arcs-html-chromium-svg-handle-modes.log` and
`/private/tmp/retouch-arcs-react-webkit-svg-draw-contour.log`.

Dedicated radius/rotation/arc-flag controls and arc-to-cubic conversion remain.
Move-only/degenerate contours, drawing commands after Z without a new moveto,
vector networks, booleans/masks, persistent per-anchor constraints and the broader
Figma Design requirements remain open. Native launches remained paused; no desktop
build or launch occurred. Unrestricted site authoring and trusted Mac distribution
are not established by this change.


### 2026-09-09 — Arc property controls in the inspector

Arc editing now exposes Radius X, Radius Y, rotation, Long arc and Reverse arc
controls. A segment picker distinguishes incoming and outgoing arcs at shared
anchors. Controls change the pending preview without moving endpoints or altering
neighboring contours. Done/Enter commits through source history; Escape discards
pending edits. Invalid numeric values are marked and keep the editor open until
corrected. Number-field navigation no longer reaches canvas point shortcuts.

The controls live in the inspector sidebar and are removed when editing ends.
They hide while a nested Pen step is active and return afterward. A contextual
hint explains zero-radius straight segments and reports SVG's effective radii
when the authored radii must expand to connect the endpoints. Switching arcs
refreshes both values and the hint.

All 358 unit tests pass in `/private/tmp/retouch-arc-controls-unit.log`. Initial
browser failures are retained in `/private/tmp/retouch-arc-controls-html-chromium.log`
and `/private/tmp/retouch-arc-controls-react-webkit.log`: the floating toolbar grew
over subdivision controls at 50 percent zoom. Moving properties to the sidebar
resolved that layout failure.

All four browser workflows pass in
`/private/tmp/retouch-arc-controls-html-chromium-sidebar.log`,
`/private/tmp/retouch-arc-controls-react-webkit-sidebar.log`,
`/private/tmp/retouch-arc-controls-html-webkit-svg-arc-controls.log`, and
`/private/tmp/retouch-arc-controls-react-chromium-svg-arc-controls.log`.
They verify all arc parameters, incoming/outgoing selection, rendered geometry
changes, unchanged endpoints/neighboring contours, invalid-value recovery,
keyboard handling, preview isolation and exact undo/redo, alongside the arc
50/100/200 percent zoom regression. The latter two also verify radius-correction
and zero-radius hints. A final Chromium pass in
`/private/tmp/retouch-arc-controls-hint-final.log` verifies hint refresh on segment
switching. The inspected `/private/tmp/retouch-arc-controls-final.png` shows the
properties in the sidebar and unobstructed canvas actions.

Bézier handle and Pen-append regressions pass in
`/private/tmp/retouch-arc-controls-html-chromium-svg-handle-modes.log` and
`/private/tmp/retouch-arc-controls-react-webkit-svg-draw-contour.log` before the final
hint-refresh adjustment. Direct arc-radius handles, arc-to-cubic conversion,
vector networks, booleans/masks, persistent per-anchor constraints and the broader
Figma Design requirements remain open. Native launches stayed paused; no desktop
build or launch occurred. Unrestricted site authoring and trusted Mac distribution
remain unverified.


### 2026-09-09 — Convert SVG arcs into editable Bézier curves

The arc inspector now offers Convert arc to Bézier. It creates cubic handles
while preserving the original segment endpoints and neighboring contours. The
conversion is pending until Done, can be cancelled with Escape, and participates
in exact source undo/redo. Saved handles can be reopened and edited normally.
The cubic Hermite subdivision uses a conservative interpolation bound of 0.01
SVG coordinate units; unsupported numeric or document point limits refuse the
conversion without changing the pending arc. This is an SVG-local bound, not a
screen-pixel guarantee under arbitrary transforms.

All 359 unit tests pass in `/private/tmp/retouch-arc-convert-unit-escape.log`.
Numerical tests sample rotated, eccentric, radii-corrected, long and short arcs
in both directions against the parametric ellipse, and cover closing segments,
endpoint preservation and atomic refusal at point limits. The original unit
failure in `/private/tmp/retouch-arc-convert-unit.log` was an incorrect assertion
that the shared start anchor would gain no outgoing handle; that assertion was
corrected to preserve the neighboring arc while allowing its new cubic handle.

All four browser workflows pass in
`/private/tmp/retouch-arc-convert-html-chromium-fixed.log`,
`/private/tmp/retouch-arc-convert-html-webkit.log`,
`/private/tmp/retouch-arc-convert-react-chromium.log`, and
`/private/tmp/retouch-arc-convert-react-webkit-fixed.log`.
They verify open and closing arc conversion, unchanged neighboring contours,
rendered shape samples, editable saved handles, source isolation, exact undo/redo,
invalid-property refusal and cancellation, alongside the existing transformed
arc operations at 50/100/200 percent zoom. The inspected Chromium and WebKit
screenshots show the converted handles and accessible Done/Cancel controls:
`/private/tmp/retouch-arc-convert-html-chromium.png` and
`/private/tmp/retouch-arc-convert-react-webkit-fixed.png`.

The original React/WebKit failure is retained in
`/private/tmp/retouch-arc-convert-react-webkit.log`. Escape could reach the shell
when focus fell outside the editor and clear the selected layer. The shell now
cancels an active drawing before clearing selection. The browser regression
explicitly removes focus before Escape and verifies the editor closes while the
selected vector remains available to edit.
The React/WebKit nested Pen regression also passes in
`/private/tmp/retouch-arc-convert-nested-pen.log`, including child cancellation,
retained parent edits and exact source history.

Direct arc-radius handles, vector networks, booleans/masks and persistent
per-anchor constraints remain open. Dense converted curves also warrant clearer
handle visibility at small sizes. This does not establish full Figma parity or
unrestricted site authoring. Native launches stayed paused; no desktop build or
launch occurred, and trusted Mac distribution remains unverified.


### 2026-09-09 — Selected-point controls for dense curves

Curve handles and tangent lines now follow the selected anchor by default.
All anchors remain available, the selected anchor is filled and exposed with
aria-pressed, and Show all handles restores the contour-wide overview without
changing source geometry. Path subdivision buttons appear on the selected
anchor's adjacent edges. Polygon and polyline subdivision remains unchanged.
Focus and pointer selection refresh the controls, including after arc conversion,
contour changes, corner/smooth conversion and whole-contour mode transitions.

Browser checks pass in `/private/tmp/retouch-handle-visibility-chromium-final.log`
(HTML/Chromium) and `/private/tmp/retouch-handle-visibility-webkit-final.log`
(React/WebKit). These check selected-handle visibility, overview toggling,
adjacent subdivision controls, open/closing arcs, unchanged source on visibility
changes, saved handle edits and exact undo/redo. The inspected
`/private/tmp/retouch-handle-visibility-webkit-final.png` shows eight anchors with
only the selected endpoint's handle, instead of the previous dense collection
of every handle and insertion button.

React/WebKit handle-mode regression passes in
`/private/tmp/retouch-handle-visibility-modes-final.log`, covering independent,
aligned and mirrored editing, pointer dragging, corner/smooth conversion and
50/100/200 percent transforms. HTML/Chromium contour movement also passes in
`/private/tmp/retouch-handle-visibility-contour.log`. Initial failures are retained
in the corresponding logs without the final suffix: conversion tests incorrectly
expected an outgoing handle at the closing arc endpoint, and the handle-mode
test attempted to drag a handle before selecting its anchor. The corrected tests
exercise the new point-selection interaction explicitly.

This is a visibility improvement, not full vector-editing parity. Multi-point
selection, persistent anchor constraints, vector networks, booleans/masks and
arbitrary-site authoring remain open. Native launches remained paused; no Mac
app build or launch was performed.


### 2026-09-09 — Multi-point vector selection and editing

Shift-click now adds or removes anchors from the current contour selection.
Dragging a selected anchor moves the selected group with every attached handle;
arrows move by one SVG unit, Shift-arrows by ten. A stationary plain click
collapses the group to that anchor. Select all points and Cmd/Ctrl+A provide
whole-contour point selection. Selected anchors and their handles remain visible,
with a selected-count status. Batch Delete, Make corner and Make smooth operate
on the group and retain the contour's validity/minimum point requirements.
Arc-adjacent selections retain their arc descriptors and disable incompatible
corner/smooth conversion. Arc properties remain a single-anchor interaction.

Movement validates the full candidate before applying any point, so coordinate
or handle bounds refuse the whole move. Source remains unchanged during keyboard
or pointer preview; Done/Enter and drag release use existing source history.
Escape discards pending edits. Structural contour changes reset point selection,
and whole-contour movement remains a separate mode.

All 360 unit tests pass in `/private/tmp/retouch-multi-points-unit.log`, including
atomic refusal, duplicate/invalid indices, attached handles, arc descriptors and
unchanged input models. The new browser workflow passes in all four combinations:
`/private/tmp/retouch-multi-points-chromium.log` (HTML/Chromium),
`/private/tmp/retouch-multi-points-webkit.log` (React/WebKit),
`/private/tmp/retouch-multi-points-react-chromium.log`, and
`/private/tmp/retouch-multi-points-html-webkit.log`.
They verify group movement at 50/100/200 percent zoom under nested transforms,
untouched points/contours, handles, select-all, toggle/collapse, batch deletion,
corner conversion, minimum counts, cancellation and exact undo/redo. The latter
two also verify batch smoothing after corner conversion. The inspected
`/private/tmp/retouch-multi-points-webkit.png` shows two selected anchors, their
handles, the pending outline and the selected-count toolbar.

Regressions pass in `/private/tmp/retouch-multi-points-vertices.log`,
`/private/tmp/retouch-multi-points-handles.log`,
`/private/tmp/retouch-multi-points-arcs.log`, and
`/private/tmp/retouch-multi-points-contour.log`: existing polygon/polyline editing,
independent/aligned/mirrored handles, arc controls and whole-contour movement.

Selection is currently scoped to one contour. Cross-contour selection, marquee
selection, vector networks, booleans/masks, persistent point constraints and
arbitrary-site authoring remain open. Full Figma Design parity and trusted Mac
distribution remain unproven. Native app launches stayed paused; no desktop build
or launch occurred.


### 2026-09-09 — Drag-box selection for vector points

Dragging empty space in the vector editor now draws a selection box and selects
anchor centers inside it. Shift-drag adds those anchors to the starting selection;
ordinary drag replaces it. Reverse-direction boxes behave the same way. The hit
test uses displayed anchor centers, so it follows rotation, nonuniform transforms
and canvas zoom. Releasing the box changes selection without writing source.
The focused editor accepts arrows and Enter afterward for group editing.

Empty boxes clear the point selection and disable point deletion and shape
conversion. Escape during a box drag removes the editor and leaves source
unchanged. Pointer capture keeps a box drag distinct from point/handle movement;
whole-contour and nested Pen modes keep their existing controls. Inspector help
and the startup status explain box selection, Shift-add and group movement.

All four browser workflows pass:
`/private/tmp/retouch-marquee-chromium.log` (HTML/Chromium),
`/private/tmp/retouch-marquee-webkit.log` (React/WebKit),
`/private/tmp/retouch-marquee-react-chromium.log`, and
`/private/tmp/retouch-marquee-html-webkit.log`.
They exercise 50/100/200 percent zoom, forward/reverse boxes, Shift-add, empty
selection, Escape mid-drag, keyboard movement after selection, attached handles,
unchanged neighboring contours, source isolation and exact undo/redo. They also
run the full multi-point workflow, including batch corner/smooth/delete and
selection toggling. The latter two runs include the final help text. The inspected
`/private/tmp/retouch-marquee-final.png` shows the box and selected anchors with
readable updated help. React/WebKit nested Pen regression passes in
`/private/tmp/retouch-marquee-nested-pen.log`.

Box selection is currently confined to the active contour. Cross-contour point
selection, vector networks, booleans/masks, persistent point constraints,
arbitrary-site authoring and full Figma parity remain open. Native launches
stayed paused; trusted Mac distribution remains unverified.


### 2026-09-09 — Align and distribute selected vector points

Selecting at least two anchors reveals Arrange points in the inspector. Left,
Center, Right, Top, Middle and Bottom align point centers on the visible canvas
axes, including rotated and nonuniformly scaled SVGs. Space horizontally and
Space vertically require three points and distribute their centers between the
selected extremes. Each point's handles move with it; unselected points and
other contours remain unchanged. Actions update the pending preview, preserve
selection, and use Done/Escape and existing source undo/redo.

The geometry helper projects anchors through the SVG screen matrix, computes
alignment/spacing in those axes and maps displacement back into local coordinates.
It rejects invalid/singular transforms, insufficient selections, unsupported
indices, degenerate results and coordinate overflow before changing the model.
The inspector group hides for a single/empty selection, whole-contour movement
and nested Pen drawing. Cancelling nested Pen now restores the original point
selection and the arrangement controls.

All 361 unit tests pass in `/private/tmp/retouch-arrange-points-unit-final.log`.
Tests cover both axes and every operation under a nonuniform rotated matrix,
unchanged orthogonal coordinates, attached handles/arc descriptors, unselected
anchors, input immutability and invalid/overflow/degenerate refusals.
All four browser workflows pass in
`/private/tmp/retouch-arrange-points-chromium.log` (HTML/Chromium),
`/private/tmp/retouch-arrange-points-webkit.log` (React/WebKit),
`/private/tmp/retouch-arrange-points-react-chromium.log`, and
`/private/tmp/retouch-arrange-points-html-webkit.log`.
They verify all eight controls, projected positions and preserved orthogonal
coordinates, attached handles, selection counts, unchanged neighboring contours,
source isolation, cancellation and exact undo/redo. All actions run at 100 percent
zoom; left alignment and horizontal distribution also run at 50 and 200 percent.
The latter two workflows additionally verify nested Pen selection restoration.
The inspected `/private/tmp/retouch-arrange-points-chromium.png` shows the controls
in the inspector and aligned anchor centers. The full marquee/multi-point
regression passes in `/private/tmp/retouch-arrange-points-marquee.log`.

Arrangement remains scoped to selected anchors in one contour. Cross-contour
selection, vector networks, booleans/masks, persistent point constraints and
arbitrary-site authoring remain open; full Figma parity is not established.
Native launches remained paused, with no desktop build or launch in this step.
Trusted Mac distribution remains unverified.


### 2026-09-09 — Responsive scope coverage in comparison previews

The comparison rail now displays the current style scope and reports whether its
breakpoint applies in each preview. Base scope is identified separately; wording
keeps breakpoint coverage distinct from the final CSS cascade, where other
overrides may take precedence. Unavailable/loading coverage is marked unknown.
An explicit Edit styles: [width] px and larger action switches the main viewport
and selects that minimum-width style scope. Ordinary layer picking and the
existing Edit size action continue to preserve the user's chosen style scope.
No scope action writes source until a subsequent style edit.

The action requires a selected layer. Static HTML uses its pixel media scopes;
React reuses a matching loaded Tailwind breakpoint and preserves the project's
breakpoint units for custom widths. Scope choices and coverage update when the
inspector scope changes. These are breakpoint-coverage indicators, not a
per-property provenance inspector or direct authoring inside comparison frames.

HTML/Chromium and HTML/WebKit pass in
`/private/tmp/retouch-compare-scope-chromium.log` and
`/private/tmp/retouch-compare-scope-webkit.log`; final labels/loading-state handling
also pass in `/private/tmp/retouch-compare-scope-html-final.log`.
These check unchanged source on scope selection, tablet/desktop versus phone
coverage, base scope, live scoped color writes, exact undo, layer picking and
hidden/offscreen states. The inspected
`/private/tmp/retouch-compare-scope-chromium.png` shows coverage beneath the
comparison viewports; the final action label explicitly says Edit styles.

An isolated copy of the Next/Tailwind fixture passes Chromium in
`/private/tmp/retouch-compare-scope-react-chromium-final.log` and WebKit in
`/private/tmp/retouch-compare-scope-react-webkit-final.log`. These verify md reuse,
1120px mapped to a 70rem custom scope, coverage at standard/custom sizes,
source isolation, live width updates, exact undo, navigation, repeated preview
open/close, pin/remove and persisted custom sizes. The fixture source was verified
restored before removal, and its CLI/server exited with no listener on port63241.

Initial failures remain recorded: the first server launch used the parent temp
directory instead of the fixture (`/private/tmp/retouch-compare-scope-react-server.log`);
the first Chromium test tried the custom-scope action after navigation cleared
selection (`/private/tmp/retouch-compare-scope-react-chromium.log`); and WebKit's
navigation poll encountered a replaced execution context
(`/private/tmp/retouch-compare-scope-react-webkit.log`). The corrected test verifies
the disabled state, selects a layer, and tolerates only that specific transient
navigation error while polling.

The broader requirement inventory remains open: arbitrary-site authoring,
editable comparison canvases, complete per-property inheritance/provenance,
Figma Design feature parity and trusted Mac distribution are not established.
Native app launches stayed paused; this step used browser fixtures only.


### 2026-09-09 — Preserve compound media conditions in responsive scopes

Breakpoint discovery now retains enclosing media conditions together and merges
repeated occurrences as alternatives. Nested conditions are evaluated with AND;
alternative rule groups use OR; comma-separated queries stay intact for the
browser's matchMedia evaluation. Empty outer style rules no longer advertise a
broader breakpoint before their nested declarations are reached. Stylesheet
media restrictions are retained, and disabled sheets are skipped.

This follows the nested-rule behavior described in
[CSS Conditional Rules](https://www.w3.org/TR/css-conditional-3/#processing).
Inspector mismatch notes and comparison coverage use the same structured
conditions. The readable condition summary is never parsed as an executable
media query. Choosing a width reuses only a plain, single minimum-width scope;
range, height-conditioned and alternative scopes cannot silently become a
width-and-larger edit scope. Custom scopes still preserve discovered unit
conventions. Anchor inheritance also excludes these compound scopes.

All 362 unit tests pass in `/private/tmp/retouch-media-scope-unit-final.log`.
The initial `/private/tmp/retouch-media-scope-unit.log` records a syntax error in
the newly added nested fixture, corrected before the final run. Browser CSS
agreement passes in `/private/tmp/retouch-media-scope-chromium.log` and
`/private/tmp/retouch-media-scope-webkit.log`. The new
`test:e2e:responsive-media` workflow checks nested width/height conditions,
repeated alternatives, comma query lists, CSS nesting, five viewport shapes,
initial rem metrics and refusal to reuse conditional breakpoint names.

HTML comparison regression passes in
`/private/tmp/retouch-media-scope-compare-chromium.log`. The actual React inspector
and comparison workflow passes in
`/private/tmp/retouch-media-scope-react-chromium.log` and
`/private/tmp/retouch-media-scope-react-webkit.log`, with
`RT_E2E_COMPLEX_SCOPES=1` and temporary CSS defining bounded/either scopes.
It verifies nested tablet-only coverage, the separate desktop alternative,
ordinary md reuse, custom rem scopes, source-isolated scope changes, live edits,
undo, preview navigation/disposal and pin persistence. The temporary source was
verified restored, the server exited and port64631 had no remaining listener
before the fixture was removed.

This covers discovered media conditions, not exhaustive CSS provenance.
Unreadable/imported/adopted stylesheets, container/supports/state conditions,
per-property cascade provenance and equivalent authoring across arbitrary sites
still require broader work. Full Figma Design parity and trusted Mac distribution
remain unproven. Native app launches stayed paused.


### 2026-09-09 — Imported and document-adopted responsive stylesheets

Breakpoint discovery now traverses readable CSS imports and document-level
adoptedStyleSheets in addition to ordinary document stylesheets. Import and
stylesheet media restrictions are carried through nested imports without
repeating an identical restriction. Repeated imports under different conditions
retain their separate alternatives. Branch-local cycle detection prevents
recursive import graphs from looping, and an inaccessible import does not stop
other sheets from being inspected. Disabled sheets are skipped.

All 363 unit tests pass in `/private/tmp/retouch-stylesheet-discovery-unit.log`,
including imported/adopted sheets, media propagation, cyclic graphs, disabled
sheets and a CSSOM-access exception. Real browser checks pass in
`/private/tmp/retouch-stylesheet-discovery-chromium.log` and
`/private/tmp/retouch-stylesheet-discovery-webkit.log`. The new
`test:e2e:responsive-stylesheets` workflow uses intercepted local test origins
for actual browser stylesheet loading, nested and repeated imports, adopted
sheets and a cross-origin stylesheet without CSSOM access. It compares discovery
with rendered opacity at four viewport shapes, then verifies disable/removal
updates. The opaque stylesheet renders but stays undiscovered, rather than being
reported as an inactive breakpoint. No external site was contacted.

The preceding compound-media regression also passes in
`/private/tmp/retouch-stylesheet-discovery-media-regression.log`.
This extends discovery, not authoring support for arbitrary stylesheet sources.
Shadow-root styles, unreadable CSS, supports/container/state conditions and
complete per-property provenance remain open, along with the broader Figma,
arbitrary-site and trusted Mac distribution requirements. Browser contexts were
closed after the checks; native app launches remained paused.


### 2026-09-09 — Page font selection and JSX class serialization

Typography now offers a Page font selector for generic families, the selected
layer's supported current family, declared document fonts and families used in
the page. React family overrides preserve named typography classes and weight,
use the selected responsive scope, and have a dedicated reset. Static HTML uses
the existing responsive CSS writer. The picker scans up to 200 declared font
faces and 300 document elements, with at most 100 choices; it does not enumerate
installed fonts or prove that every declared face has loaded or supplied glyphs.

The JSX writer now narrowly admits quoted font-family tokens and the escaped
underscores Tailwind needs for literal underscores. JSX attribute serialization
keeps those backslashes literal and chooses a delimiter that leaves generated
double-quoted font names visible to Tailwind's source scanner. Ordinary selector
ampersands stay raw; entity-like sequences are escaped for JSX round-trip safety.
Injection-like family tokens remain refused.

All 366 unit tests pass in
`/private/tmp/retouch-page-fonts-unit-verified.log`. The new
`test:e2e:page-fonts` harness passes React on Chromium and WebKit in
`/private/tmp/retouch-page-fonts-react-chromium-regression.log` and
`/private/tmp/retouch-page-fonts-react-webkit-regression.log`. It verifies declared
and used family choices, quoted stacks, literal underscores, weight and named
style retention, responsive isolation, preview, reset, exact source undo, and
continued hover-selector compilation after font writes. Static HTML passes in
`/private/tmp/retouch-page-fonts-html-chromium-verified.log` and
`/private/tmp/retouch-page-fonts-html-webkit-verified.log` (before the later
React-only hover assertion was added). Screenshot
`/private/tmp/retouch-page-fonts-react-final.png` was inspected: the active scope,
font value, sample, reset and typography controls are visible in the inspector.
All browser runs exited successfully and cleaned their temporary fixtures.

Earlier failing logs are retained: the first React check observed CSS before HMR
settled, later checks exposed writer rejection of escaped underscores, and the
writer-era check observed the reset before computed styles settled. The final
harness waits for both source and rendered family and verifies exact undo.

The shared Liquid inspector can expose these choices, but its separate writer
still refuses quoted or escaped family tokens. That requires equivalent Liquid
serialization and rendering verification; this entry does not claim Shopify
font parity. Font search/previews across a full catalog, font loading states,
variable axes, richer text editing and other Figma Design requirements remain.
The broader goal is incomplete. Native app launches remain paused; no macOS
app, native diagnostics or installed-cask launch checks were run.


### 2026-09-09 — Liquid font serialization and conditional branches

The Liquid writer now accepts the same bounded quoted-family and literal
underscore grammar as the JSX writer through a shared class-token validator.
Literal class attributes encode HTML-sensitive characters and retain raw
Tailwind candidates in an owned Liquid comment. The adapter skips that comment
when parsing the attribute and strips it when describing literal classes.
Quoted, unquoted, boolean and absent class attributes are covered; neighboring
attributes are retained. These comments disappear during Liquid rendering.

Dynamic class patches preserve the original template expression, escape host
HTML output, and retain raw candidates for CSS compilation. Conflicting font
families in inactive branches and quoted Liquid assignments are removed at the
same responsive scope without removing weight or other breakpoint families.
Removal comparisons use captured values so quotes and backslashes do not depend
on Liquid string-literal escape behavior. Generated image_tag class arguments
use captures where a literal argument would consume a backslash or collide with
a quote; image_tag still performs its own HTML escaping.

All 370 unit tests pass in
`/private/tmp/retouch-liquid-font-unit-release.log`. Added tests render literal
and conditional templates through LiquidJS, parse actual HTML attributes with
parse5, exercise repeated quoted-family replacements and reset, retain IDs and
neighboring attributes, preserve alternate branches, and cover generated image
classes. The existing source-history, other Liquid functionality and JSX writer
suites also pass.

The new `test:e2e:liquid-fonts` variant runs the actual Retouch inspector against
a disposable Liquid renderer and the installed Tailwind scanner/compiler.
Both browser engines pass:
`/private/tmp/retouch-liquid-font-release-chromium.log` and
`/private/tmp/retouch-liquid-font-release-webkit.log`.
It verifies quoted and declared names, underscores, hover-selector compilation,
weight and named-style retention, responsive family isolation, typography
preview, reset and byte-exact source undo. After each font selection it renders
an alternate template branch in a separate browser page and checks its computed
family and weight. React regression passes in
`/private/tmp/retouch-liquid-font-react-regression.log` after extracting the
shared validator. All final runs exited successfully and cleaned their fixtures.
The earlier dynamic Liquid screenshot
`/private/tmp/retouch-liquid-page-fonts-dynamic.png` was visually inspected.

Earlier failures remain in their logs: the initial generated-image test exposed
underscore loss in a Liquid string argument; an inactive branch retained its
old font utility; the first browser attempt used an unsupported absolute package
entrypoint; one later assertion expected a different ordering of equivalent
class tokens. These were resolved before the final checks. Tailwind emits a
Node deprecation warning in the local test harness; there were no browser page
errors. The agent-browser CLI was absent, so verification used the repository's
Playwright harness instead.

This supersedes the preceding entry's Liquid serializer gap for the tested
font vocabulary. It is local LiquidJS/Tailwind evidence, not live Shopify theme
or full arbitrary-site evidence. Other Liquid runtime/build configurations,
complex font names outside the bounded grammar, font loading status, variable
axes, full Figma Design parity and trusted Mac distribution remain unverified
or incomplete. No native Retouch launch was attempted; the launch pause remains.


### 2026-09-09 — Searchable page fonts

The shared font control retains its quick selector and adds an expandable
Browse page fonts section. Search matches words across family names and fallback
stacks, ignoring case, accents and CSS quote characters. Results are ordinary
keyboard-accessible buttons, with the current choice indicated and a bounded
scrolling results area. The search status reports match counts or a no-match
message. Searching makes no source change. Escape closes the browser, returns
focus to its summary and preserves the selected layer. A current family outside
the supported writer grammar remains visible in the quick selector as a disabled
current-value option instead of making the selector appear blank.

All 371 unit tests pass in `/private/tmp/retouch-font-search-unit.log`.
The page-font browser workflow now checks no-match behavior, preservation of the
selected family and source, Escape without layer deselection, case-insensitive
search, Tab/Enter application, and the existing responsive/reset/preview/undo
flow. Passing browser evidence:
- `/private/tmp/retouch-font-search-html-chromium.log`
- `/private/tmp/retouch-font-search-html-webkit.log`
- `/private/tmp/retouch-font-search-react-webkit-verified.log`
- `/private/tmp/retouch-font-search-liquid-chromium.log`

The Liquid variant also checks alternate template branches after each choice.
All runs exited and cleaned their temporary fixtures. Screenshot
`/private/tmp/retouch-font-search-html.png` was inspected: the expanded search,
match count and result button fit in the inspector and leave the canvas visible.
The initial React/WebKit log is retained at
`/private/tmp/retouch-font-search-react-webkit.log`; it exposed a detached
preview iframe during screen-size rerender. The preview-specific assertion now
retries that transient detachment and still requires the replacement frame's
computed font to match. Other errors continue to fail the check.

Search currently covers the existing bounded discovered catalog (up to 200 font
faces, 300 document elements and 100 choices), not all installed fonts or every
font on arbitrarily large pages. It does not provide font-face load status,
per-result glyph previews, variable axes or a full font management workflow.
Those and broader Figma/any-site parity remain open. Live Shopify and trusted
Mac distribution are still unverified; no native app launch was attempted.


### 2026-09-09 — Progressive page-wide font discovery

Opening Browse page fonts now starts a fresh asynchronous scan of the document's
FontFaceSet and text/control elements throughout its body. The scan yields after
100 entries or an eight-millisecond between-entry budget, reports Scanning page,
and stops when the browser closes or its inspector is removed. Reopening
rebuilds the catalog, discovering new declarations and dropping removed ones.
Search covers the full discovered catalog, while Previous/Next fonts controls
render at most 50 matching buttons per page. Focus on an existing result is
preserved during catalog updates. Searching and paging never apply a font.

The quick dropdown remains a bounded initial sample for immediate interaction.
Its initial body scan now uses a tree walker instead of allocating and copying
a querySelectorAll result for the entire page or reading ancestor textContent.
The expanded browser no longer stops at 200 faces, 300 body entries or 100
choices. The elapsed-time budget is checked between entries; an individual
browser style computation can still take longer than the budget.

All 371 unit tests pass in
`/private/tmp/retouch-font-discovery-unit-release.log`. The new
`test:e2e:font-discovery` workflow uses a real iframe document with 260 declared
faces and 1,500 text elements, including a late-used family. Chromium and WebKit
pass in `/private/tmp/retouch-font-discovery-release-chromium.log` and
`/private/tmp/retouch-font-discovery-release-webkit.log`. Checks cover discovery
past every former limit, late-family selection, 50-result paging, cancellation
before and after the first batch, rescanning newly declared and removed faces,
and no implicit application during search or paging. The isolated picker
screenshot `/private/tmp/retouch-font-discovery-release.png` was inspected.

Full inspector/source-write regressions pass for HTML in
`/private/tmp/retouch-font-scan-html-regression.log`, React/WebKit in
`/private/tmp/retouch-font-scan-react-regression.log`, and conditional local Liquid
in `/private/tmp/retouch-font-discovery-liquid-regression.log`. The first two
precede the final fresh-catalog-on-reopen adjustment; final discovery tests and
the Liquid workflow include it. All browser processes exited and closed their
contexts. An initial Chromium discovery assertion read the previous completed
status before the reopen toggle began its new scan; its failing log remains
`/private/tmp/retouch-font-discovery-chromium.log`. The corrected test waits for
the newly declared result itself before asserting completion.

This supersedes the preceding search-catalog cutoff limitation for normal body
content and document font declarations. Shadow roots, generated pseudo-element
text, cross-origin iframe documents, installed-font enumeration, font loading
status and variable axes still require work. The scan is a fresh traversal, not
a subscription to every subsequent DOM change. The full Figma/any-site/native
distribution goal remains incomplete, and native app launches remain paused.


### 2026-09-09 — Declared font-face loading feedback

The font selector and browser results now report the first family's declared
font-face states: loaded, loading, failed and not loaded. Mixed states remain
visible rather than collapsing an entire family into a success flag. Unquoted
generic families are identified as system/fallback families, even when a quoted
custom family with the same spelling exists. Families without page declarations
are identified as such; unsupported family syntax reports status unavailable.
The UI explains that some characters or weights may still use fallback fonts.
These counts are not proof of which face rendered a glyph or of installed-font
availability.

Feedback reads FontFaceSet metadata and listens for loading/loadingdone/
loadingerror. It does not call load() or check(), request font URLs, write source
or apply a choice. An inspector lifecycle observer removes those listeners and
cancels its scan when the containing inspector is removed.

All 372 unit tests pass in `/private/tmp/retouch-font-state-unit-final.log`,
including mixed state aggregation, quoted generic names and unsupported syntax.
The new `test:e2e:font-state` workflow passes Chromium and WebKit in
`/private/tmp/retouch-font-state-chromium.log` and
`/private/tmp/retouch-font-state-webkit.log`. It intercepts test font requests,
explicitly initiates them from the fixture, holds the loading state, returns a
404 for one face and a valid fixture WOFF2 for another, and verifies live mixed
failed/loaded feedback. There are no font requests before fixture initiation,
no implicit font application, no page errors, and all three listeners are
removed after inspector disposal. No external font server was contacted.
The isolated screenshot `/private/tmp/retouch-font-state.png` was inspected.

Discovery/paging/cancellation regression passes in
`/private/tmp/retouch-font-state-discovery-regression.log`. Actual source-edit
flows, responsive isolation and exact undo pass for React/WebKit in
`/private/tmp/retouch-font-state-react-regression.log` and HTML/Chromium in
`/private/tmp/retouch-font-state-html-regression.log`. Every run exited
successfully and closed its browser contexts.

This adds declared-face feedback, not full font management or shaping parity.
Exact active-face/glyph coverage, variable axes, font previews before applying,
shadow-root discovery and live Shopify coverage remain incomplete. The complete
Figma/any-site/trusted Mac distribution goal remains active. Native launches
were not attempted and remain paused.


### 2026-09-09 — Font discovery inside open web components

The existing batched font traversal now queues open shadow roots, including
nested roots, without recursive JavaScript calls. Text directly assigned to a
slot uses the slot's computed font rather than the light-DOM host's font.
Repeated families remain deduplicated by the catalog. The same entry and time
budgets, cancellation and result paging remain in force. Closed shadow roots
are not inspected.

All 372 unit tests pass in `/private/tmp/retouch-shadow-font-unit.log`.
The expanded real-browser discovery workflow passes in
`/private/tmp/retouch-shadow-font-chromium.log` and
`/private/tmp/retouch-shadow-font-webkit.log`. The fixture includes a font used
only in an open root, a nested root styled by an adopted CSSStyleSheet, directly
slotted text with a different font, duplicate uses and a closed root. It verifies
all three accessible families appear, duplicates do not create extra choices,
and the closed-root-only family is absent. Existing large-catalog, paging,
rescan and cancellation checks also pass.

The conditional local Liquid source-write regression passes in
`/private/tmp/retouch-shadow-font-liquid-regression.log`, including keyboard
selection, responsive changes, alternate-branch rendering and exact source undo.
All browser runs exited and closed their contexts. No native app was launched.

This extends font discovery only. It does not establish source mapping or
editable internals for arbitrary web components, nor does it establish that a
discovered family supplies the rendered glyphs. Closed roots, pseudo-element
text, other iframe documents, complete variable-font/text controls and broader
Figma Design/any-site/trusted native distribution requirements remain open.
The active goal is incomplete and native launches remain paused.


### 2026-09-09 — Fractional font weights and reliable scope changes

React/Liquid typography now has a numeric weight field covering 1–1000,
including fractional values, and a weight-only reset. The writer classes replace
weight tokens at the selected scope while retaining the font family, named
styles and other scopes. Custom weight and size classes display Inherited /
custom in their preset selectors instead of leaving those selectors blank.
Static HTML already supports fractional weight through its CSS field.

Verification exposed two shared editor issues. Unchanged class strings now
return without a write or history entry. Compiler-stamped class writes use the
existing rendered-revision readiness path before rebuilding the inspector,
which prevents the inspector from retaining pre-compilation computed values.
The style-scope selector also blurs a different focused panel field before
changing scope, so delayed input change events are handled in the field's
original scope. This matters for programmatic/accessibility selection and was
reproduced by Chromium during the weight workflow.

All 373 unit tests pass in
`/private/tmp/retouch-custom-weight-unit-release.log`, including fractional
weight token replacement and range validation. The new `test:e2e:custom-weight`
variant passes final browser runs in:
- `/private/tmp/retouch-custom-weight-release-react.log` (Chromium)
- `/private/tmp/retouch-custom-weight-release-liquid.log` (WebKit, local Liquid)
- `/private/tmp/retouch-custom-weight-release-html.log` (Chromium)

All variants verify 537.5 base weight, 725.5 tablet weight, phone isolation,
family retention, reset and exact source undo. React/Liquid additionally check
numeric range rejection, custom preset display, replacement by the Medium
preset, and inspector value agreement with the rendered revision. Switching
scope after restoring an unchanged field is asserted not to write. The HTML
variant exercises its existing CSS field and does not run the React/Liquid
preset or numeric-input rejection assertions (the initial success-log wording
was generalized afterward to reflect that distinction).

React/WebKit also passed in
`/private/tmp/retouch-custom-weight-react-webkit.log` before the final focused-field
scope fix. A separate geometry/class-write regression passed in
`/private/tmp/retouch-custom-weight-position-regression.log`, covering movement,
resizing, scoped constraints, compiler revisions and undo/redo. Screenshot
`/private/tmp/retouch-custom-weight-final.png` was inspected: both the rendered
canvas and inspector reflect the 725.5 tablet weight. All runs exited and cleaned
their disposable fixtures.

Earlier failed logs are retained at
`/private/tmp/retouch-custom-weight-react-chromium.log`,
`/private/tmp/retouch-custom-weight-react-chromium-fixed.log`, and
`/private/tmp/retouch-custom-weight-react-diagnostic.log`. The diagnostic showed
an unintended md:type-editorial and md weight write after scope switching;
`/private/tmp/retouch-custom-weight-react-scope-fixed.log` confirms that source
corruption and extra undo step are removed by finishing the focused field first.

Numeric CSS weight does not prove a selected font contains every requested
weight or supports continuous variation. Actual glyph interpolation, variable
axis discovery/editing, other typography controls and full Figma/any-site/native
distribution parity remain incomplete. Native app launches remain paused.


### 2026-09-09 — Rendered variable-weight verification

The new `test:e2e:variable-weight` variant uses the installed fixture's Geist
Latin WOFF2 as an embedded test font, with a declared weight range of 100–900.
Its OpenType fvar metadata was inspected with fontTools and confirms a wght
axis with minimum 100, default 400 and maximum 900. The exact fixture binary is
`/private/tmp/retouch-responsive-fixture/node_modules/next/dist/next-devtools/server/font/geist-latin.woff2`,
SHA-256 `1b5ebfb3a01a97343ac96873e6d59a8cb285c66012b6a1ac509cb2765e995ba8`.
The binary remains in the external fixture; no font binary was added to the repo.

The actual editor/source workflow sets base weight 537.5 and tablet weight
725.5. After confirming the face loaded, the test rasterizes the selected text
in a temporary page canvas using that element's computed weight and family,
then compares summed glyph alpha coverage at a fixed size. Chromium's coverage
increases from 336292 to 421076; WebKit's increases from 340152 to 424558.
This supplies evidence of a changed glyph rendering, beyond merely reading a
changed CSS property. Both values are inside the inspected variable axis range.

Passing evidence is in `/private/tmp/retouch-variable-weight-react.log`
(React/Chromium) and `/private/tmp/retouch-variable-weight-html-webkit.log`
(HTML/WebKit). The full font/weight workflow also verifies family retention,
responsive isolation, reset and exact source undo; React additionally checks
preset replacement, range rejection and inspector agreement with the renderer.
Both runs exited successfully and removed their temporary fixtures. This turn
changes only the browser harness, package test entry and this evidence ledger;
it does not change editor implementation or claim a new unit-suite run.

The default Python fontTools environment lacked WOFF2's Brotli dependency;
metadata inspection succeeded in an isolated uv environment with Brotli and
fontTools, without changing the workspace's linked node_modules.

This establishes variable weight behavior for one known font and tested values,
not every font, every axis or every glyph. Axis discovery, axis-specific UI and
broader typography/Figma/any-site/native distribution requirements remain open.
No native app launch was attempted; the launch pause remains in force.


### 2026-09-09 — Automatic line height and scoped spacing reset

Typography now offers Automatic line height, writing CSS normal at the selected
scope rather than a fixed line-height multiplier. React/Liquid also have a
dedicated line-height reset; HTML uses its existing property reset. The pixel
field remains available, shows Automatic when the computed value is normal,
and replaces either automatic or explicit line-height classes. Reset text
overrides now recognizes the arbitrary normal property as well as leading
utilities. Family and weight overrides are retained by spacing-only changes.

All 374 unit tests pass in `/private/tmp/retouch-line-height-unit.log`, including
normal/explicit token replacement and preservation of fonts and other scopes.
The new `test:e2e:line-height` workflow passes in:
- `/private/tmp/retouch-line-height-react.log` (React/Chromium)
- `/private/tmp/retouch-line-height-liquid.log` (local Liquid/WebKit)
- `/private/tmp/retouch-line-height-html.log` (HTML/Chromium)

The browser checks write 80px at base, normal at tablet, verify the phone remains
80px, switch tablet to 45px, reset to inherited base spacing, and undo to the
exact original source and initial computed spacing. They verify font family and
weight remain unchanged. React/Liquid additionally verify the Automatic field
placeholder and bulk text reset followed by undo of the automatic override.
All runs exited successfully and cleaned their disposable fixtures.

This improves line-height authoring, not complete text layout parity. Rich-text
runs, paragraph spacing, lists, variable axes and broader Figma/any-site/native
distribution requirements still need work. Native launches remain paused and
none were attempted during this work.


### 2026-09-09 — Text-first HTML inspector and canvas-tool focus

HTML text layers now place typography before positioning, layout and appearance
controls. Other layer types retain position first. React and HTML share the
existing text-layer classification, avoiding different ordering rules for the
same tag. The HTML positioning section is passed into the CSS inspector's
ordered container so it can follow typography without losing its controls.
Screenshot `/private/tmp/retouch-text-inspector-priority.png` was inspected:
the font controls appear near the top below layer naming and screen scope,
instead of below the long appearance/effects sections.

The positioning regression exposed an existing WebKit focus loss after a
keyboard canvas move. It also failed on an archived, unchanged 3e2a0bb baseline
at the same focus-restoration assertion. Inspector rebuilds now preserve focus
on an existing canvas-tool button when the selected layer key is unchanged.
The replacement button receives focus without scrolling; selection changes do
not inherit that focus.

All 374 existing unit tests pass in
`/private/tmp/retouch-text-inspector-unit-final.log`. Existing browser workflows
pass for typography/line-height/source undo in
`/private/tmp/retouch-text-inspector-fonts.log`, HTML positioning in Chromium at
`/private/tmp/retouch-text-inspector-position-chromium.log`, HTML positioning and
focus in WebKit at `/private/tmp/retouch-text-inspector-focus-fixed.log`, and
React positioning/focus at `/private/tmp/retouch-text-inspector-react-focus.log`.
The positioning checks cover pointer and keyboard moves/resizes, scopes,
constraints, cancellation/refusal and exact undo/redo. Every run exited and
cleaned its fixture; the temporary baseline checkout was also removed.

Failed diagnostic logs remain at
`/private/tmp/retouch-text-inspector-position.log` and
`/private/tmp/retouch-text-inspector-position-baseline-fixed.log`. The first
baseline attempt lacked parse5 because it linked the fixture dependencies;
`/private/tmp/retouch-text-inspector-position-baseline.log` retains that setup
failure. The valid baseline run used the same Retouch dependencies as the worktree.

This improves inspector discoverability and keyboard continuity, not the full
usability or parity requirement. Many design features, arbitrary-site source
coverage and trusted Mac distribution remain unfinished. No native app launch
was attempted; the launch pause remains active.


### 2026-09-09 — Font-relative letter spacing

Typography now has a Letter spacing (%) field, described as relative to the
selected layer's font size. It stores an em value: 10% becomes 0.1em. React and
Liquid replace tracking classes within the chosen scope; HTML writes the
existing responsive letter-spacing property. The original pixel/CSS controls
remain available. The percentage input currently accepts -100 to 1000, with
six-decimal percentage precision when serializing.

All 374 existing unit tests pass in
`/private/tmp/retouch-relative-spacing-unit.log`. The new
`test:e2e:relative-spacing` workflow passes in:
- `/private/tmp/retouch-relative-spacing-react.log` (React/Chromium)
- `/private/tmp/retouch-relative-spacing-html.log` (HTML/WebKit)
- `/private/tmp/retouch-relative-spacing-liquid.log` (local Liquid/Chromium)

The real inspector writes 10% spacing at 32px font size and verifies 3.2px
computed spacing, increases the font to 40px and verifies spacing scales to 4px,
then writes a -5% tablet override and verifies -2px spacing while the phone stays
at 4px. Each run restores the exact original source and spacing through undo.
Existing font-search/family/reset checks also pass. Runs exited successfully and
cleaned their temporary fixtures. A descriptive tooltip was added after these
runs; no behavior changed after verification.

This covers the selected element's CSS-relative spacing. It does not establish
mixed-run spacing parity, paragraph/list controls or the broader Figma/any-site/
trusted native distribution objective. Native launches remain paused and none
were attempted.


### 2026-09-09 — Font-relative line height

Typography now offers Line height (%) alongside automatic and pixel/CSS
controls. It writes a unitless multiplier (175% becomes 1.75), allowing spacing
to scale when the selected element's font size changes. The field derives its
current display from computed line height and font size, shows Automatic when
normal has no numeric computed height, and supports 0–1000% with six-decimal
percentage precision when serialized. React/Liquid use the existing scoped
line-height token replacement and reset; HTML uses the responsive CSS writer.

All 374 existing unit tests pass in
`/private/tmp/retouch-relative-line-unit.log`. The new
`test:e2e:relative-line-height` workflow passes in:
- `/private/tmp/retouch-relative-line-react-fixed.log` (React/Chromium)
- `/private/tmp/retouch-relative-line-html-fixed.log` (HTML/WebKit)
- `/private/tmp/retouch-relative-line-liquid-fixed.log` (local Liquid/Chromium)

Each browser run writes 175% at 32px and verifies 56px line height, increases the
font size to 40px and verifies 70px while the percentage display stays 175,
sets tablet spacing to 200%/80px, checks phone spacing remains 70px, resets tablet
to the base multiplier, and restores the exact original source and spacing with
undo. All runs exited successfully and cleaned their temporary fixtures.

The initial React/Liquid tests tried to enter their already displayed 150%
value, which correctly produced no change event; the tests timed out waiting
for a write. Their logs remain at `/private/tmp/retouch-relative-line-react.log`
and `/private/tmp/retouch-relative-line-liquid.log`. The corrected test begins
with a different value. The earlier HTML 150% check passed at
`/private/tmp/retouch-relative-line-html.log` because its initial value was normal.

This verifies selected-element CSS multiplier behavior, not complete mixed-run
or paragraph layout parity. More advanced typography, arbitrary-site source
coverage and trusted native distribution remain incomplete. Native launches
remain paused and none were attempted.

### Explicit spacing conversion (2026-09-09)

Added compact Use % actions for line height and letter spacing in React, Liquid,
and HTML typography. An unchanged computed percentage now explicitly converts
fixed spacing into unitless line height / em tracking. Conversion uses the
unrounded computed ratio; edited values retain input validation. Separate labels
and buttons preserve accessible input association. Blur followed by activation
deduplicates the same pending value.

Verified 374 unit tests (`/private/tmp/retouch-convert-unit.log`) and real browser
flows: Chromium HTML (`retouch-convert-html.log`), Chromium React
(`retouch-convert-react-fixed.log`), WebKit local Liquid
(`retouch-convert-liquid-fixed.log`), all under `/private/tmp`. Checks establish
fixed 48px line height and 3.2px tracking, convert without changing the displayed
150% / 10%, preserve appearance, resize the font 32px to 40px, verify 60px / 4px,
and undo to exact original source. Initial React/Liquid test setup entered the
already displayed 48px and generated no change; failed logs are retained. Corrected
setup first establishes a different explicit value. Screenshot
`/private/tmp/retouch-convert.png` inspected; conversion buttons subsequently use
the existing control-button styling for consistency.

Full Figma parity and arbitrary-site authoring remain incomplete. Native app
launches remain paused at the user's request; no native tests executed.

### Inspector Tab continuity (2026-09-09)

Text/number field Tab now records the adjacent visible, enabled inspector control
before blur commits a save. Once the busy fieldset is enabled again, focus resolves
the replacement control by semantic identity and occurrence within the same layer
selection. Normal focus scrolling brings that control into view. Unchanged fields
move immediately, Shift+Tab reverses direction, and a deliberate click or later
keyboard action cancels queued focus. Controls with their own prevented Tab event
retain that behavior. This covers input/textarea navigation within the inspector;
it does not claim complete focus retention for all selection or route transitions.

374 unit tests passed (`/private/tmp/retouch-panel-tab-unit.log`). Chromium HTML
and React plus WebKit local Liquid passed actual edit/rebuild, next-button focus,
Shift+Tab, unchanged Tab and exact source undo (`retouch-panel-tab-{html,react,liquid}.log`
under `/private/tmp`). Added a held network write and explicit click into layer
search to verify pending focus is cancelled; HTML and WebKit Liquid passed in
`retouch-panel-tab-{html,liquid}-cancel.log`. React final validation is recorded in
`/private/tmp/retouch-panel-tab-react-final.log`. Native launches remain paused.

### Numeric font features (2026-09-09)

Added shared Number formatting controls for number width (tabular/proportional),
figure style (lining/old style), diagonal/stacked fractions, ordinals, and slashed
zero across HTML, React and local Liquid. Changing one group preserves the others.
The disclosure stays open through saves. Reset removes the active screen scope's
numeric override; React/Liquid text reset also includes these properties. Named
numeric Tailwind utilities are replaced together to avoid conflicting declarations,
and typography previews copy numeric features. HTML validation rejects duplicate
or conflicting groups and detects font/font-variant shorthand overlap.

Property semantics follow [CSS Fonts 4 numerical formatting](https://drafts.csswg.org/css-fonts-4/#font-variant-numeric-prop).
Fonts may not provide every requested glyph feature; the UI states this limitation.
Feature availability discovery, arbitrary OpenType tags and complete typography
parity remain unfinished.

375 unit tests passed in `/private/tmp/retouch-numeric-unit-final.log`; focused
inspector tests passed again after adding the value-length bound in
`/private/tmp/retouch-numeric-inspector-final.log`. Chromium HTML/React and WebKit
local Liquid passed composition, responsive isolation, reset, disclosure retention
and exact undo (`retouch-numeric-{html,react,liquid}.log` under `/private/tmp`).
Chromium React and WebKit HTML also verified actual digit layout using bundled
Geist at weight 400: tabular six-one/six-eight widths 115.203125/115.203125px,
proportional widths 67.328125/115.96875px, with only number width changing between
measurements. Logs: `/private/tmp/retouch-numeric-glyph-react-final.log` and
`/private/tmp/retouch-numeric-glyph-html-final.log`.

Initial glyph checks at weight 700 failed strict equality. FontTools inspection
confirmed the font's tabular one/eight advances are 636/638 units there and 600/600
at weight 400; failed logs remain. The corrected proof explicitly selects 400
and undoes that source edit too. Inspected `/private/tmp/retouch-numeric.png`.
Native launches remain paused; no desktop verification attempted.

### Editable comparison dimensions (2026-09-09)

Each pinned comparison now has width, height and Rotate controls. Changes resize
the actual iframe while preserving main-canvas dimensions, selected style scope,
and source. Labels, hit-test scale, active-size indicators and width-based scope
actions use the updated dimensions. Custom-card titles and accessible labels
follow their new size. The existing pinned-size persistence stores revisions.
Only integer dimensions 240–7680 are accepted; Escape restores the current value,
and duplicate pinned dimensions are refused with a visible status message.

375 unit tests passed (`/private/tmp/retouch-compare-dimensions-unit.log`). Real
Chromium and WebKit HTML flows passed media-query visibility changes, independent
width/height, rotation, scope actions using the revised width, invalid values,
duplicate refusal, custom-card renaming, reload persistence and unchanged source,
alongside the previous selection/scoped-edit/undo checks. Logs:
`/private/tmp/retouch-compare-dimensions-chromium-fixed.log`,
`/private/tmp/retouch-compare-dimensions-webkit-fixed.log`, and final screenshot
run `/private/tmp/retouch-compare-dimensions-final.log`. Inspected
`/private/tmp/retouch-compare-dimensions-final.png`. Initial logs without the
`-fixed` suffix retain the test's ambiguous p.hint locator failure; dimension
errors now have a dedicated class separate from selection-status hints.

This makes comparison viewport setup editable; property editing still occurs on
the main canvas. Full simultaneous canvas authoring, synchronized application
state and cross-renderer comparison verification remain. Native launches paused.

### Nested scrolling in comparison previews (2026-09-09)

Comparison wheel input now targets the scrollable element under the pointer,
consumes movement there, and passes residual movement through ancestors to the
page. Both pixel axes account for preview scale, including edited comparison
widths. Line and page delta modes are handled, overscroll containment stops
ancestor handoff, and subpixel rounding residuals do not nudge ancestor scrollers.
The overlay explicitly receives pointer input: real WebKit wheel events previously
reached the iframe and scrolled natively despite iframe pointer-events:none.

Added `npm run test:e2e:compare-scroll`, a disposable HTML fixture with nested
horizontal and vertical scrollers. Chromium and WebKit real mouse wheel checks
plus dispatched line/page events passed: scaled axes before/after card resizing,
inner-to-outer-to-page handoff, containment, unchanged main scroll and unchanged
source. Logs `/private/tmp/retouch-compare-scroll-{chromium,webkit}-release.log`.
Both engines also passed existing comparison selection/scoped-edit/resize/undo
checks (`retouch-compare-scroll-edit.log` and `retouch-compare-scroll-edit-webkit.log`
under `/private/tmp`). All 375 unit tests passed in
`/private/tmp/retouch-compare-scroll-unit.log`. The failed real WebKit input log
`/private/tmp/retouch-compare-scroll-webkit-final.log` is retained as evidence for
the overlay fix; initial synthetic-only passing tests did not expose that bug.

This does not verify scrolling inside nested iframe documents or closed shadow
roots, complete scroll-snap/RTL behavior, or synchronized application state across
previews. Full simultaneous comparison authoring remains unfinished. Native app
launches remain paused.

### Reveal selected layers in comparisons (2026-09-09)

Comparison cards now provide Show selection, or Show next instance when the
selected source layer has multiple rendered instances. Activation scrolls the
chosen instance into view through nested scroll containers without changing the
main canvas, source or style scope. Hidden/absent layers disable the action;
custom-card accessible labels follow dimension edits. The instance cursor resets
when the selected source layer changes.

375 unit tests passed in `/private/tmp/retouch-compare-reveal-unit.log`. Chromium
and WebKit comparison browser flows passed offscreen reveal, hidden-layer refusal,
cycling a runtime clone inside a nested scroller, unchanged main scroll/source,
and existing selection/scoped-style/dimension/undo flows. Logs:
`/private/tmp/retouch-compare-reveal-chromium-final.log` and
`/private/tmp/retouch-compare-reveal-webkit-final.log`. WebKit additionally passed
keyboard activation and retained focus across the comparison repaint interval in
`/private/tmp/retouch-compare-reveal-keyboard.log`. The fixture's clone is a
runtime-only repeated source identity; no source mutation is used to simulate it.

Full simultaneous comparison editing, complete clipped-outline geometry and
application-state synchronization remain unfinished. Native launches remain paused.

### Overflow-clipped comparison outlines (2026-09-09)

Comparison selection bounds now intersect the viewport and ancestor overflow
scroll/auto/hidden/clip boxes on each axis. Fully clipped instances no longer
produce visible outlines but remain revealable. Partial outlines use the visible
rectangle. Intermediate overflow containers are skipped when an absolute
descendant's containing block lies outside them; viewport-fixed descendants also
escape those clips. This avoids incorrectly hiding floating layers.

375 unit tests passed (`/private/tmp/retouch-compare-clip-unit.log`). Chromium and
WebKit comparison flows passed full clipping, reveal through nested scrolling,
partial clipping to a 200px by 30px visible area at comparison scale, fixed-layer
escape, and existing scoped editing/dimensions/undo checks. Logs:
`/private/tmp/retouch-compare-clip-chromium-final.log`,
`/private/tmp/retouch-compare-clip-webkit.log`. The extended WebKit run additionally
verified absolute positioning escaping an intermediate overflow ancestor:
`/private/tmp/retouch-compare-clip-webkit-final.log`.

Bounds remain rectangular. Rotated/nonrectangular clipping, masks, rounded clip
edges, transformed containing blocks for fixed positioning and full shadow-tree
clipping are not verified or complete. Native launches remain paused.

### Fixed descendants of transformed containers (2026-09-09)

Comparison clipping now uses the browser-reported offset parent for both absolute
and fixed descendants. A viewport-fixed element has no such parent and escapes
intermediate clips; a fixed element inside a transformed containing block is
clipped by that block. This replaces the previous blanket exemption for all
fixed positioning. [CSS Transforms rendering model](https://www.w3.org/TR/css-transforms-1/#transform-rendering)
provides the relevant containing-block behavior. Direct Chromium and WebKit probes
confirmed that these engines expose the transformed ancestor as offsetParent.

Chromium and WebKit full comparison flows passed fixed-layer full clipping and
partial clipping under scale(2): a 200px by 20px container-visible region produces
a 400px by 40px rectangle before comparison scaling. Earlier viewport-fixed and
absolute escape checks still pass, as do selection/reveal/scoped edits/undo. Logs:
`/private/tmp/retouch-compare-fixed-chromium.log` and
`/private/tmp/retouch-compare-fixed-webkit.log`. All 375 unit tests passed in
`/private/tmp/retouch-compare-fixed-unit.log`.

This verifies translation/positive axis scaling, not arbitrary rotations,
nonrectangular clips or every browser's containing-block representation. Full
Figma parity remains unfinished. Native launches remain paused.

### SVG canvas export (2026-09-09)

Added Export SVG canvas when selecting SVG layers. The browser downloads a
standalone SVG document with the containing canvas's viewBox and dimensions,
definitions, and computed geometry/paint/typography styles at the current preview
size. Local paint-server URLs are normalized to fragment references; linked asset
URLs are made absolute. Editor stamps, executable handlers, scripts and source
style elements are removed after styling is captured. Source files are unchanged.

The initial export path explicitly refuses linked symbol instances (`use`) and
SMIL animations rather than silently exporting incorrect inherited paint or base
geometry. Linked images are not embedded and fonts must be available to the
consumer. External definitions, font outlines/embedding, arbitrary animation
snapshots, raster/PDF export, selected-shape cropping and complete SVG fidelity
remain unfinished; this is the first canvas export path, not full asset parity.

375 unit tests passed in `/private/tmp/retouch-svg-export-unit.log`. Chromium and
WebKit downloaded real files, decoded each as an SVG image independently of the
editor document and checked dimensions and raster pixels: CSS-defined width/color,
gradient paint, clipPath and phone/tablet styling all passed. The source remained
byte-identical and the export contained no editor/script markup. Logs:
`/private/tmp/retouch-svg-export-chromium.log`,
`/private/tmp/retouch-svg-export-webkit.log`, and WebKit's symbol-refusal check
`/private/tmp/retouch-svg-export-webkit-final.log`. Reusable command:
`RT_INSPECTOR_FIXTURE=/private/tmp/retouch-responsive-fixture npm run test:e2e:svg-export`
from retouch/. Sample downloaded artifact: `/private/tmp/retouch-export-example.svg`.
Native app launches remain paused.

### Shared SVG definitions in export (2026-09-09)

Export now collects same-document paint/filter/clip/mask/marker/pattern references
that live outside the selected SVG canvas. It follows local gradient/pattern href
dependencies transitively, captures each definition's computed styling, and adds
only the referenced definition roots to exported defs. Collection is separate from
cloning so shared/nested definition roots are deduplicated. Missing local
definitions and unsupported reference targets produce errors instead of silently
writing broken fragment references. Symbol-instance and SMIL-animation restrictions
also apply to imported definitions.

Chromium and WebKit both downloaded and rasterized a canvas whose gradient and
clipPath live in a separate zero-sized SVG. The gradient inherits stops through a
second local gradient, proving transitive collection. Existing pixel checks for
CSS geometry/colors, gradient blending, clipping and responsive output passed,
as did missing-definition refusal and unchanged-source checks. Logs:
`/private/tmp/retouch-svg-shared-chromium.log`,
`/private/tmp/retouch-svg-shared-webkit.log`. Local-definition regression passed
in `/private/tmp/retouch-svg-shared-local-regression.log`. All 375 unit tests
passed in `/private/tmp/retouch-svg-shared-unit.log`. Run with
`RT_E2E_SHARED_DEFS=1` to include this fixture in the SVG export browser harness.

Definitions in other documents are still external links. Symbol expansion, embedded
fonts/images, full animation snapshots and complete export parity remain unfinished.
Native app launches remain paused.

### PNG export of SVG canvases (2026-09-09)

Added Export PNG and a 1×–4× scale picker beside SVG export. PNG rasterizes the
computed-style SVG snapshot, including collected local definitions, at the chosen
output dimensions and downloads a scale-suffixed filename. Alpha is preserved.
Output is bounded to 32 million pixels and 16,384px per side. The scale choice
survives inspector rebuilds within the current editor session. Source is unchanged.

Chromium and WebKit downloaded PNG files at 1×, 2× and 4× and independently
decoded them to verify dimensions, exact colored pixels on both sides of a scaled
edge, filename suffixes and transparency. SVG export checks still pass. Logs:
`/private/tmp/retouch-png-chromium.log`, `/private/tmp/retouch-png-webkit.log`.
The extended Chromium check verifies refusal of external image dependencies and
oversized output before allocation (`/private/tmp/retouch-png-bounds.log`). Invalid
scales and SVG text also fail explicitly. All 375 unit tests passed in
`/private/tmp/retouch-png-unit.log`. Reusable script: `npm run test:e2e:png-export`
with RT_INSPECTOR_FIXTURE set.

PNG currently refuses SVG text/foreignObject and nonembedded external resources;
font/image embedding, symbol expansion and full asset fidelity remain unfinished.
This exports SVG canvases, not arbitrary HTML layers. Native launches remain paused.

### Bitmap embedding for SVG/PNG export (2026-09-09)

Exports can now fetch linked SVG image elements and embed their bitmap bytes as
data URLs. PNG always embeds; SVG defaults to embedding and exposes Embed images
in SVG when images are present, preserving linked-only export as an option. Reused
URLs fetch once per operation. Browser fetch/CORS rules and same-origin credential
handling apply. Downloads wait for embedding and report failures rather than
announcing success early. Fetched bitmaps are decoded before inclusion; missing or
corrupt assets fail explicitly. href takes precedence over legacy xlink:href.

The reader accepts PNG/JPEG/WebP/GIF/AVIF MIME types with a 15-second network bound,
16 MB per image and 64 MB per export byte limits. PNG output dimensions are checked
before image fetching. These resource bounds are configured; the browser fixture
verifies PNG data, not every accepted decoder or timeout/byte-limit boundary.

Chromium and WebKit downloaded SVG and 1×/2×/4× PNG containing two uses of the same
linked bitmap. Independent raster samples matched the source image; exported SVG
contained data URLs, and request counts proved one fetch per embedding operation.
Shared gradients/clipping and previous export checks passed. Final logs:
`/private/tmp/retouch-export-image-final.log` and
`/private/tmp/retouch-export-image-webkit-final.log`. Chromium also verified the
unchecked option retains links and performs no image fetch:
`/private/tmp/retouch-export-image-option.log`. Missing and corrupt-image refusals
passed. All 375 unit tests passed in `/private/tmp/retouch-export-image-unit.log`.
Use RT_E2E_IMAGE=1 with the SVG export harness to enable bitmap coverage.

Linked SVG-as-image recursion, font embedding/outlines, symbol expansion, animated
frame fidelity and arbitrary HTML-layer export remain unfinished. Native app
launches remain paused.

### Export format picker and JPEG (2026-09-09)

Consolidated SVG/PNG/JPEG into one format picker and download action. SVG shows its
image-embedding option; raster formats show a shared 1×–4× scale picker. Format,
scale and embedding choices survive inspector rebuilds in the current session.
JPEG uses the same captured styles, shared definitions and embedded bitmap assets
as PNG, composites transparency onto white, and encodes at quality 0.92. UI text
explains the opaque background. Format switching is disabled during a download.

Chromium and WebKit downloaded actual JPEG files, checked JPEG signatures and
400×200 dimensions for 2× export, decoded white transparent-region pixels and
artwork color within JPEG tolerance. Switching formats preserves scale; previous
SVG embedding and PNG scale/alpha/edge tests also passed. Logs:
`/private/tmp/retouch-export-jpeg-chromium.log` and
`/private/tmp/retouch-export-jpeg-webkit.log`. All 375 unit tests passed in
`/private/tmp/retouch-export-jpeg-unit.log`. Inspected the compact export panel in
`/private/tmp/retouch-export-picker.png`; shortened the JPEG option label afterward
to avoid truncation while retaining the white-background explanation below.

Configurable JPEG quality/background, text/font export, symbols, arbitrary HTML
layer export and full asset parity remain unfinished. Native launches remain paused.

### JPEG quality and background (2026-09-09)

JPEG export now offers integer quality 1–100% and a background color picker.
Settings persist across format changes and inspector rebuilds within the editor
session. JPEG encoding uses the requested quality, and the chosen background
fills transparent pixels before compositing the SVG snapshot. Export validates
both the UI fields and raster API options. Defaults remain quality 92%, white.

Chromium and WebKit downloaded JPEGs at quality 35% and 95% with background
#123456. Independent decode confirmed the background within JPEG tolerance, and
file sizes changed from 2057 to 3921 bytes (Chromium) and 3154 to 5821 bytes
(WebKit). This demonstrates the quality tradeoff for the fixture, not a universal
file-size guarantee. Format switches retained 95% / #123456. Invalid 0%, 101% and
fractional quality inputs failed validity checks. Existing SVG/PNG/JPEG download,
asset embedding, alpha, dimensions and source-preservation checks still passed.
Logs: `/private/tmp/retouch-jpeg-options-chromium.log` and
`/private/tmp/retouch-jpeg-options-webkit.log`. All 375 unit tests passed in
`/private/tmp/retouch-jpeg-options-unit.log`.

Text/font rasterization, symbols, arbitrary HTML-layer exports and full asset
parity remain unfinished. Native launches remain paused.

### Local-font SVG text in raster export (2026-09-09)

PNG/JPEG export now permits SVG text using locally available fonts. Snapshots
include kerning, variation/optical settings, direction and writing-mode properties
alongside existing typography styles. Text referencing a family registered in
the page's FontFaceSet is refused until font embedding is implemented, including
text inside imported definitions. Family parsing preserves quoted commas.
foreignObject and textPath raster export remain explicitly unsupported.

Chromium and WebKit compared the exported PNG's isolated TEST glyph region against
a screenshot of the actual source SVG using Arial bold 20px. Thresholded ink
counts and bounds matched within each engine: Chromium 357 pixels, bounds
[10,60,10,24]; WebKit 367 pixels, bounds [10,59,10,24]. The crop excludes nearby
gradients/images. Raster scale, JPEG/background/quality, asset embedding and
source-preservation flows also passed. Logs:
`/private/tmp/retouch-raster-text-chromium-final.log` and
`/private/tmp/retouch-raster-text-webkit-final.log`. Quoted-comma page-font refusal
passed both engines in `retouch-raster-text-family-fixed.log` and
`retouch-raster-text-family-webkit.log` under `/private/tmp`. The initial comma
fixture accidentally included literal quotes in the FontFace family; its failed
log is retained as `retouch-raster-text-family.log`. All 375 unit tests passed
in `/private/tmp/retouch-raster-text-unit.log`. RT_E2E_TEXT=1 enables the glyph fixture.

This proves the tested local font, not every system font, script or text layout.
Web-font embedding, text outlines/paths, symbols and arbitrary-layer export remain
unfinished. Native launches remain paused.

### Curved SVG text export (2026-09-09)

SVG snapshots now collect same-document paths referenced by textPath, including
paths defined in a separate SVG. PNG/JPEG export permits these text layouts with
local fonts; page-font refusal also checks textPath and linked text descendants.
This supersedes the textPath refusal described in the preceding entry.

Chromium and WebKit exported the shared quadratic-path TEST fixture successfully.
The source screenshot and downloaded 1x PNG had identical thresholded black glyph
masks within each engine (intersection-over-union 1.0; 317 and 322 ink pixels,
respectively). The 90x50 crop contains the complete glyph region and excludes
colored artwork through per-channel thresholds. The test requires >95% overlap,
plus count and bounding-box checks. Both browser processes exited 0; logs:
`/private/tmp/retouch-text-path-chromium-mask.log` and
`/private/tmp/retouch-text-path-webkit-mask.log`. The same flows also passed SVG
standalone decoding, raster scales, JPEG options, refusal cases and unchanged
source checks. All 375 unit tests passed in
`/private/tmp/retouch-text-path-unit.log`; git diff --check passed.

This verifies the tested local-font curved layout, not every font, script or SVG
text feature. Web-font embedding, text-to-outline conversion, symbols and arbitrary
HTML-layer export remain incomplete. Native app launches remain paused at the
user's request; full Figma parity and trusted cask distribution remain unproven.

### Shared-symbol export reference groundwork (2026-09-09)

Added a read-only SVG use-reference graph collector as preparation for symbol
export. It resolves same-document href and legacy xlink:href, deduplicates shared
definitions, follows nested instances, and reports missing, external, non-SVG or
cyclic targets. Traversal uses an explicit stack and a 10,000-node bound. Snapshot
now runs this validation before the existing symbol-export refusal, giving a
specific error for broken references. No symbol rendering support is claimed:
baking computed styles from definition nodes would incorrectly freeze inherited
instance colors, so that rendering work remains pending.

Real Chromium and WebKit fixtures passed nested symbols, two instances sharing
one definition, href/xlink resolution, cyclic/missing/external diagnostics and
unchanged DOM. Final iterative traversal evidence:
`/private/tmp/retouch-symbol-refs-iterative-chromium.log` and
`/private/tmp/retouch-symbol-refs-iterative-webkit.log`, both exit 0. The prior
recursive implementation additionally passed the full curved-text PNG/JPEG flow
in `retouch-symbol-refs-chromium.log` and `retouch-symbol-refs-webkit.log` under
`/private/tmp`. Unit suite passed in `/private/tmp/retouch-symbol-refs-unit.log`;
git diff --check passed. The node bound and every invalid URL form have not been
exhaustively exercised. Native launches remain paused; full parity is incomplete.

### Shared SVG symbol export with instance inheritance (2026-09-09)

Export now permits same-document symbols and artwork defined inside defs. It
collects nested use references, retains authored declarations in reused subtrees,
and copies matching stylesheet rules with a zero-specificity export scope.
Current media/supports conditions are evaluated at the source viewport; layer
structure is retained. Computed custom properties are carried on outer instances.
Imported definitions retain cloned ancestor context so browser-native symbol
selector behavior survives standalone export. No live page nodes are modified.
This implements the inheritance direction described in the SVG specification:
https://www.w3.org/TR/SVG2/struct.html#UseStyleInheritance

Chromium and WebKit both matched source screenshot colors for two differently
colored instances of a nested shared symbol, including currentColor and a CSS
variable override. Downloaded PNGs retained those colors at 1x, 2x and 4x; SVG
standalone decoding, JPEG options, reference diagnostics and unchanged source also
passed. Final browser logs (both exit 0):
`/private/tmp/retouch-symbol-export-guarded-chromium.log` and
`/private/tmp/retouch-symbol-export-guarded-webkit.log`.

The ancestor-selector fixture exposed an actual engine difference: Chromium's
source icons are black while WebKit applies the outer ancestor rule and renders
the instance colors. Export matches the source within each engine. Evidence:
`retouch-symbol-export-ancestry-chromium.log` and
`retouch-symbol-export-ancestry-webkit.log` under `/private/tmp`. The earlier
selector-rewriting attempt changed Chromium's colors; its failed logs are retained
as `retouch-symbol-export-*-fixed.log`. The first fixture run also hit an obsolete
white-pixel assertion where an icon had been added; original logs are retained.

Still unsupported: references to visible artwork, external symbol documents,
unreadable stylesheets, CSS nesting/container/scope rules, and inline symbol rules
that require ancestors outside the exported canvas. These return errors. Symbols
with text and page fonts require font embedding. CSS animation/state fidelity,
all imported/layered CSS combinations, exact geometry across arbitrary symbols,
and cross-engine export equivalence are not proven. This is useful shared-icon
coverage, not complete asset or Figma parity. Native app launches remain paused.

Final unit validation: all 375 tests passed (exit 0) in
`/private/tmp/retouch-symbol-export-final-unit.log`; git diff --check passed.

### Effective SVG reference precedence (2026-09-09)

Snapshot collection now uses the effective modern href when both href and
xlink:href exist, removes the unused legacy attribute from the export, and treats
an explicitly empty href as suppressing the legacy fallback. Source attributes
remain unchanged. This prevents valid icons from failing export merely because
an obsolete legacy fallback names a missing definition.

A direct browser comparison against parent commit 670085b reproduced the failure:
parent snapshot reported `Missing SVG definition: obsolete-missing-icon`; the
working implementation exported the valid effective reference. Chromium and
WebKit end-to-end tests passed mixed references, empty modern href, unchanged
source attributes, nested-symbol colors/CSS variables, standalone SVG decoding,
PNG colors at 1x/2x/4x and JPEG export. Both processes exited 0; logs:
`/private/tmp/retouch-symbol-href-chromium.log` and
`/private/tmp/retouch-symbol-href-webkit.log`. git diff --check passed. These are
focused browser checks; the unit suite was not rerun for this change.

The previously documented symbol/CSS/font limitations remain. Full Figma parity
is incomplete, and native launches remain paused.

### Editable export filenames (2026-09-09)

The Export inspector now has an Export file name field and an exact filename
preview. Custom names persist per SVG canvas in a WeakMap during the page session;
clearing the field restores the canvas-derived default. SVG/PNG/JPEG download
helpers share filename normalization, remove a supplied image extension, replace
path punctuation with hyphens, retain Unicode letters/numbers, and apply raster
scale suffixes. These preferences do not edit the site's source or history.

WebKit passed the combined existing raster flow and naming checks in
`/private/tmp/retouch-export-names-webkit.log`. Focused Chromium naming checks
passed in `/private/tmp/retouch-export-names-chromium-focused.log`. Actual downloads
were Banner-中文.svg, Banner-中文@2x.png and Banner-中文@2x.jpg. Both verified preview,
screen-size persistence, clearing to default and unchanged source. git diff --check
passed. The unit suite was not rerun for this UI/download-name change.

Unresolved verification issue: Chromium's larger combined raster-plus-naming run
completed the custom SVG and PNG downloads, then timed out waiting for the custom
JPEG (the eleventh download in that page run). It reproduced in
`retouch-export-names-chromium.log` and `retouch-export-names-chromium-debug.log`
under `/private/tmp`; both processes exited 1. The focused run succeeds, but the
cause of this accumulated-download behavior has not been proven. Do not report
that combined Chromium run as passing. Names do not persist across page reloads.
Full parity remains incomplete; native launches remain paused.

### Repeated-download stall resolved in tested browsers (2026-09-09)

A minimal Chromium page with no Retouch code reproduced the rate-sensitive loss:
12 button clicks delivered 10 blob downloads in 473 ms; a fresh page with 150 ms
between clicks delivered all 12 in 2343 ms. This isolates the observed problem
from filename normalization and Retouch's raster encoder. Historical Chromium
reports discuss the same burst symptom, but the local reproduction is the
current evidence; no exact universal browser threshold is claimed.

Retouch now serializes download dispatch and spaces requests by at least 150 ms.
SVG, PNG and JPEG helpers await dispatch, keeping the inspector busy until its
request is sent. The first download is immediate; a failed queued task does not
poison later tasks, and object URLs/anchors are cleaned up. Browser security and
download permission settings are unchanged. Dispatch completion is not an OS
file-save acknowledgement.

The previously failing combined raster/name flow passed in Chromium and WebKit,
followed by 12 additional consecutive successful downloads in each engine. Both
processes exited 0. Logs: `/private/tmp/retouch-export-paced-chromium.log` and
`/private/tmp/retouch-export-paced-webkit.log`. Existing pixel, filename, format,
scale and unchanged-source checks also passed; git diff --check passed. This
supersedes the unresolved eleventh-download issue in the preceding entry. The
unit suite was not rerun for this browser download-dispatch change. Permission
rejections and concurrent public-API callers were not separately exercised.

Full design parity remains incomplete. Native app launches remain paused.

### One-click raster scale batches (2026-09-09)

PNG and JPEG export now offer Export 1×–4× alongside the single-scale action.
The batch takes one SVG snapshot, validates/renders the largest scale first,
embeds linked bitmaps once, then renders the remaining scales from that prepared
snapshot. All four files encode before any download dispatch. Filenames are
ordered base, @2x, @3x, @4x; JPEG quality/background and custom names apply to the
whole batch. Export controls are disabled until dispatch completes.

Chromium and WebKit each downloaded all four PNGs and all four JPEGs, validating
names, 200x100/400x200/600x300/800x400 dimensions and artwork colors. The fixture
changed live artwork after the first download; subsequent files retained the
captured color. Reused bitmap fetch count was exactly one per batch. Source files
were unchanged and existing single-export flows passed. Both processes exited 0:
`/private/tmp/retouch-export-batch-fixed-chromium.log` and
`/private/tmp/retouch-export-batch-fixed-webkit.log`. All 375 unit tests passed in
`/private/tmp/retouch-export-batch-unit.log`; git diff --check passed.

The initial refactor accidentally referenced the internal captured argument in
prepared(), causing the initial browser runs to time out. That error was fixed;
failed logs remain in `retouch-export-batch-chromium.log` and
`retouch-export-batch-webkit.log` under `/private/tmp`.

Batch downloads still depend on browser download permission, and holding four
encoded outputs increases memory use; large-batch memory pressure and interrupted
download recovery were not measured. This does not add arbitrary HTML-layer
export or complete Figma parity. Native app launches remain paused.

### Named comparison views (2026-09-09)

Comparison titles are now buttons that open an inline name field. Enter/blur
saves, Escape cancels, and whitespace is normalized. Empty and duplicate names
are rejected with a status message. Names update the preview title and all card
control labels, persist with pinned dimensions, and survive resizing. Only an
exact generated Custom WIDTH × HEIGHT name automatically tracks changed sizes;
other custom names retain their wording. Renaming does not reload the iframe or
change the main canvas, source styles or history.

Chromium and WebKit passed rename, resize retention, blank/duplicate rejection,
Escape cancellation, reload persistence, unchanged source/main size, plus the
existing comparison edit/selection/clip/scope/undo flow. Logs (exit 0):
`/private/tmp/retouch-compare-rename-chromium.log` and
`/private/tmp/retouch-compare-rename-webkit.log`. A further Chromium run passed in
`/private/tmp/retouch-compare-rename-visual.log`; its screenshot
`/private/tmp/retouch-compare-name.png` was inspected and showed readable title
buttons beside Edit/remove controls within the narrow comparison rail.
git diff --check passed. No unit suite rerun for this browser-only control change.

Names remain local browser preferences; cross-device/team sharing is unfinished.
Full Figma parity remains incomplete, and native launches remain paused.

### Undo removal of comparison views (2026-09-09)

Compare screens now offers Undo remove: NAME after a view is removed. Up to eight
removals are retained in the current page session. Restore recreates the last
removed view at its saved position with its original name and dimensions, and
persists the resulting pinned list. The new iframe is inserted directly in place;
surviving preview frames are not moved or reloaded. Restore waits for outstanding
frame removal and is disabled when the eight-view limit or an existing name/size
conflicts with the saved view. This preference undo is separate from source edit
history and does not change the main canvas.

Chromium and WebKit passed removing Tablet and Checkout narrow, restoring them in
reverse removal order, checking the complete original card order and the custom
820px width. A live state marker on the untouched Desktop iframe survived. Source
files remained unchanged, and the full existing comparison flow passed. Logs
(both exit 0): `/private/tmp/retouch-compare-restore-chromium.log` and
`/private/tmp/retouch-compare-restore-webkit.log`. git diff --check passed. Unit
tests were not rerun for this browser control change.

Conflict/capacity disabling and more than eight removal cycles were not separately
exercised. Undo history does not survive a page reload and restored previews load
afresh; their prior application/scroll state is not restored. Full parity remains
incomplete, and native app launches remain paused.

### Portable named screen sets (2026-09-09)

Compare screens now provides Save screen set and Load screen set. The downloaded
retouch-screens.json contains version 1 and ordered name/width/height records,
without page content, URLs or source styles. Loading validates the complete file
before replacing any view: up to eight screens, unique names and dimension pairs,
nonempty names up to 80 characters, whole-number dimensions 240–7680, and a 64 KB
file limit. Undo load screen set restores the previous pinned list and removal
history. Loaded preferences persist locally; the main canvas and source remain
unchanged. Closing comparisons invalidates an outstanding file read.

Chromium and WebKit passed actual JSON download/reload, named dimensions and order,
loading a different two-view set, undoing it, and rejecting duplicate dimensions,
unsupported versions, invalid sizes, blank names, malformed JSON and oversized
files. A marker confirmed invalid files did not reload existing previews. A gated
File.text test confirmed that closing/reopening comparisons prevents an old read
from applying afterward. Full existing comparison flows also passed. Final logs
(both exit 0): `/private/tmp/retouch-screen-sets-cancel-chromium.log` and
`/private/tmp/retouch-screen-sets-cancel-webkit.log`. The prior full validation runs
are `retouch-screen-sets-final-chromium.log` and
`retouch-screen-sets-final-webkit.log` under `/private/tmp`.

`/private/tmp/retouch-screen-sets.png` was inspected: save/load controls fit on one
row and Undo load wraps beneath them in the narrow comparison rail. git diff
--check passed. Unit tests were not rerun for this browser file/control flow.

File portability is verified through the browser round trip; a separate real
project/browser-profile transfer was not exercised. This is file-based sharing,
not a synchronized/team library. Undo load retains one previous set only in the
current session. Full parity remains incomplete; native launches remain paused.

### Explicit variable-font axes (2026-09-09)

A shared Variable font axes disclosure now edits font-variation-settings across
HTML, React and Liquid. Standard Weight, Width, Optical size, Slant and Italic
axes can be added, edited independently and removed. Existing four-character
alphanumeric custom tags are displayed/editable. Reset respects the current
breakpoint, and class-based Reset text overrides includes axis overrides. The
class writer now validates quoted axis declarations explicitly instead of
rejecting every quoted property except font-family. Typography previews include
variation and optical-sizing properties.

All three adapters passed Chromium and WebKit browser flows: add/change axes,
remove Width while preserving Weight, base/mobile versus tablet scope isolation,
reset and exact source undo. A loaded variable font rendered Headline at about
125.25px for wght=200 and 142.80px for wght=850, proving a glyph-layout change rather
than only a computed CSS value. WebKit React/Liquid additionally checked the live
typography preview's axis settings after edits. Evidence under /private/tmp:
`retouch-font-axes-html-chromium.log`, `retouch-font-axes-html-webkit.log`,
`retouch-font-axes-react-fixed.log`, `retouch-font-axes-liquid-fixed.log`,
`retouch-font-axes-react-webkit.log`, `retouch-font-axes-liquid-webkit.log`.
All processes exited 0. The initial React/Liquid tests exposed class-token
validation refusing the quoted values; failed logs remain as
`retouch-font-axes-react-chromium.log` and `retouch-font-axes-liquid-chromium.log`.

All 377 unit tests passed in `/private/tmp/retouch-font-axes-unit-final.log`,
including independent/scoped axis preservation and invalid declaration rejection.
`/private/tmp/retouch-font-axes.png` was inspected; controls and the scope indicator
were readable. Visual-run log: `/private/tmp/retouch-font-axes-visual.log`.
git diff --check passed. `npm run test:e2e:font-axes` enables the variable-font
fixture (RT_INSPECTOR_FIXTURE remains required; renderer/browser flags select the
other adapters/engines).

Automatic font-axis discovery, font-specific min/default/max ranges, arbitrary
custom-tag addition and all legal OpenType tag syntax remain unfinished. The
editor currently bounds values to +/-10000, and unsupported axes may have no
visual effect. Only the tested font's weight axis has glyph-layout evidence;
Width/Optical size/Slant/Italic support is not inferred from that test. Liquid
coverage is a local fixture, not a fresh live Shopify verification. Full Figma
parity is incomplete; native launches remain paused.

### Custom variable-font axis entry (2026-09-09)

The Add font axis picker now includes Custom axis. Users enter a case-sensitive
four-character alphanumeric tag and an initial value, then add it with the button
or Enter. Malformed and already-listed tags are rejected without source changes;
Escape cancels. New-axis entry is disabled at the existing 16-axis limit. Custom
axes use the same scoped editing, independent removal and reset path as standard
axes, with an inline reminder to use the font designer's documented tag/range.

HTML, React and Liquid passed in Chromium and WebKit. Tests added GRAD=-12.5 beside
wght=850, verified both values in rendered CSS (and the class-based typography
preview), removed GRAD without losing wght, rejected a three-character tag and
a duplicate wght, cancelled entry with Escape, and undid source changes exactly.
Logs (all exit 0), under `/private/tmp`:
`retouch-custom-axes-html-chromium.log`, `retouch-custom-axes-html-webkit.log`,
`retouch-custom-axes-react-chromium.log`, `retouch-custom-axes-react-webkit.log`,
`retouch-custom-axes-liquid-chromium.log`, `retouch-custom-axes-liquid-webkit.log`.
git diff --check passed; the unit suite was not rerun for this shared UI extension.

The GRAD test proves declaration persistence and editing, not that the fixture
font implements GRAD or changes its glyphs. Automatic axis discovery, font-specific
ranges and tags containing other legal OpenType characters remain unfinished.
The prior +/-10000 numeric bound remains. Full parity is incomplete, and native
launches remain paused.

### Font-axis metadata parser groundwork (2026-09-09)

Added src/font-axes.cjs to read axis tags, Unicode display names, minimum/default/
maximum coordinates and hidden flags from fvar/name tables. It handles standalone
TrueType/OpenType sfnt, WOFF and WOFF2, including skipping transformed WOFF2 outline
and metrics table payloads while locating metadata. It reads metadata only; it
neither reconstructs glyphs nor installs fonts. Input is limited to 16 MB and
aggregate decompression to 32 MB, with bounded table/name/axis counts and range/
truncation/duplicate checks. Collection fonts and unknown transforms are refused.

Format references used:
https://learn.microsoft.com/en-us/typography/opentype/spec/fvar
https://www.w3.org/TR/WOFF2/

The actual local Geist fixture (28356 bytes, SHA-256
1b5ebfb3a01a97343ac96873e6d59a8cb285c66012b6a1ac509cb2765e995ba8)
reported wght / Weight, minimum 100, default 400, maximum 900, hidden false.
The complete read receipt is `/private/tmp/retouch-geist-axis-metadata.json`.
Generated metadata fixtures agreed across sfnt, WOFF and transformed-outline
WOFF2, including a negative custom-axis range and Unicode name. Tests cover input
preservation, static-font absence, missing-name fallback, truncation, invalid
ranges, duplicate axes, malformed base128 lengths and unknown transforms. The
initial WOFF test incorrectly compressed an equal-length table; it was corrected
to store raw bytes as required by WOFF. All 380 unit tests passed in
`/private/tmp/retouch-font-metadata-unit.log`; git diff --check passed.

This module is not yet wired to an API or inspector discovery. Font-file selection,
CSS source/fallback resolution, access constraints, localized-name preferences and
UI ranges remain unfinished. It is not a full font validator or exhaustive
WOFF/WOFF2 decoder. Large-memory/CPU limits have not been stress-tested. Full Figma
parity remains incomplete; native launches remain paused.

### Authenticated font metadata API (2026-09-09)

The shared sidecar now accepts POST /rt/__api/font-axes with font bytes and the
existing editor token. It returns parsed axis metadata, refuses other methods,
returns 422 for malformed/unsupported font data, and limits input to 16 MB.
It neither fetches remote URLs nor stores font bytes or changes source files.
The binary request reader now drains/discards excess data and returns a readable
413 response instead of destroying the connection before the response arrives;
this also fixes oversized image-upload error reporting.

Real sidecar integration tests passed token rejection, method handling, parsed
axis values, malformed input, unchanged source/file inventory, and oversized
font/image requests followed by a healthy server response. Focused log:
`/private/tmp/retouch-font-api-focused.log`. Chromium and WebKit posted the actual
Geist WOFF2 fixture through the shell token and obtained Weight 100/400/900 without
source changes. Existing typography flows passed in the same runs:
`/private/tmp/retouch-font-api-chromium.log` and
`/private/tmp/retouch-font-api-webkit.log`. All 382 unit tests passed in
`/private/tmp/retouch-font-api-unit.log`; all processes exited 0 and git diff --check
passed.

Inspector font-source discovery and automatic range controls remain unfinished;
this endpoint is their transport boundary, not an automatic discovery feature.
Parser CPU behavior under adversarial inputs and disconnected/slow body streams
were not stress-tested. Full parity remains incomplete; native launches remain
paused.

### Declared variable-font inspection in the typography inspector

The shared HTML/React/Liquid typography inspector can list readable @font-face
URLs for the selected element's primary computed family and inspect a chosen
file. Browser fetch uses normal CORS and same-origin credentials, a 15-second
combined timeout and a 16 MB body limit; the authenticated sidecar parses axes.
The inspector shows names, tags, ranges and defaults, bounds existing axis inputs,
and applies an axis default through the existing responsive source-write/undo
path. Inspection itself never changes source. A bounded metadata cache keyed by
page origin and URL survives iframe reloads, expires after five minutes, and is
refreshed explicitly. Failed reinspection clears old metadata/ranges and supports
retry. The font-axis npm browser command includes discovery coverage.

The actual Geist WOFF2 fixture yielded Weight 100–900, default 400. HTML, React
and local Liquid fixture flows passed on Chromium and WebKit, including range
validation, default application, cached metadata across source reloads, responsive
isolation and exact undo. Logs: /private/tmp/retouch-font-discovery-html-fixed-
{chromium,webkit}.log and /private/tmp/retouch-font-discovery-{react,liquid}-
{chromium,webkit}.log. Additional HTML browser runs injected a metadata error and
verified cleared bounds, no source changes, and successful retry on both engines:
/private/tmp/retouch-font-discovery-recovery-{chromium,webkit}.log. All 382 unit
tests passed (/private/tmp/retouch-font-discovery-units.log). All successful runs
exited 0. Two initial class-adapter Chromium runs failed before browser launch
because the WebKit-only browser cache path was supplied; corrected runs passed.
The inspector screenshot /private/tmp/retouch-font-discovery.png was inspected.

Declared files do not prove the font used for each glyph. Local sources, fallback
fonts, unreadable cross-origin stylesheets, shadow-root styles, escaped CSS names
and URLs, and full conditional stylesheet semantics remain incomplete. Metadata
can be stale until reinspection/expiry. This is fixture verification, not live
Shopify verification or full Figma parity. Native app launches remain paused;
trusted macOS distribution and broad arbitrary-site parity remain unverified.

### Sliders for inspected variable-font axes

After inspecting a declared font file, each active compatible axis with a
nonzero range has a labeled slider bounded by that font's metadata. Dragging
updates the displayed value; release writes the current responsive override
through existing history. Escape before release restores the control without
writing source. Keyboard Home can set the minimum and undo restores the prior
source exactly. Inactive axes can still be added with the font-default button.
Existing numeric controls retain precise entry; drag display rounds to two
places but commits the underlying range value.

Real browser pointer drags, Escape cancellation, release commit, keyboard Home,
rendered axis values and exact single-step undo passed for HTML, React and local
Liquid in Chromium and WebKit. All six final processes exited 0. Logs:
/private/tmp/retouch-font-sliders-{html,react,liquid}-final-{chromium,webkit}.log.
Initial WebKit runs exposed a range-control focus difference: Escape reached the
shell and cleared selection. Explicit focus alone did not resolve it; capturing
Escape during the pointer gesture did. Gesture listeners end on pointer release,
cancellation or window blur. The corrected WebKit screenshot was inspected:
/private/tmp/retouch-font-sliders-final-webkit.png. The initial crowded label was
also corrected with a stacked field layout. All 382 unit tests passed in
/private/tmp/retouch-font-sliders-final-units.log; git diff --check passed.

This does not yet preview the site's glyph appearance continuously while dragging.
Sliders rely on inspected declared-file metadata, support only the existing
compatible tag/value grammar, and do not prove actual glyph-font selection.
Broader font support, full Figma parity and trusted native distribution remain
unfinished. Native app launches remain paused.

### Live glyph preview during variable-axis drags

Axis sliders now preview the selected element's glyph appearance during input,
without writing source. Temporary inline font-variation-settings are restored
before committing the responsive edit, on Escape/cancel, on window blur/pagehide,
or when the control/target leaves the DOM. Cleanup restores the exact original
style attribute if untouched, or restores just the previewed property while
preserving concurrent unrelated inline changes. Numeric field and slider readout
follow the preview, displaying two decimal places while retaining the underlying
slider value for commit. Preview currently affects the selected live element;
comparison frames, sibling instances and the separate type sample update after
source commit, not continuously during drag.

The actual Geist fixture visibly changed glyph widths before pointer release;
source remained byte-identical until commit. HTML, React and local Liquid passed
Chromium and WebKit checks for live computed axes/glyph changes, Escape restoring
inline style, release creating one undoable edit, keyboard edits, responsive
isolation, concurrent page color preservation, and control-removal cleanup.
Six final logs: /private/tmp/retouch-font-preview-final-{html,react,liquid}-
{chromium,webkit}.log. All six exited 0. All 382 unit tests passed:
/private/tmp/retouch-font-live-final-units.log. The axis npm browser command now
includes the preview cleanup cases.

The removal test exposed a Chromium event-order bug: removal could emit change
before the element became disconnected. Deferring the save to a microtask and
rechecking connection/cancellation prevents that unwanted write. Initial class
fixture runs also hit transient detached controls during deferred panel refresh;
the harness now reacquires the slider and its bounds before each gesture.
The final two-decimal display polish has additional HTML browser runs at
/private/tmp/retouch-font-preview-display-{chromium,webkit}.log and screenshot
/private/tmp/retouch-font-live-display-chromium.png.

This supersedes the previous no-live-preview limitation for the selected element.
It does not establish full font/typography parity or arbitrary-site support.
Native app launch testing remains paused, and trusted Homebrew/macOS distribution
remains unverified.

### Responsive optical-sizing control

HTML, React and local Liquid typography now expose Optical sizing: Automatic or
Off, plus Reset optical sizing for the current screen scope. An explicit opsz
axis produces an explanatory note instead of implying that Automatic takes
precedence. React/Liquid Reset text overrides includes this property. HTML
validation accepts only auto/none (or reset), and important font shorthand
conflicts are recognized because optical sizing is a reset-only font subproperty.
Reference: https://www.w3.org/TR/css-fonts-4/#font-optical-sizing-def and
https://www.w3.org/TR/css-fonts-4/#font-prop.

HTML, React and local Liquid fixtures passed on Chromium and WebKit: base Off,
768px-and-larger Automatic, phone/tablet isolation, scoped reset revealing base
Off, explicit-axis explanation, class-adapter type-preview state, and exact source
undo. All six processes exited 0; logs are
/private/tmp/retouch-optical-{html,react,liquid}-{chromium,webkit}.log.
The 382 existing unit tests passed (/private/tmp/retouch-optical-final-units.log).
An additional focused HTML CSS test then passed important-shorthand refusal,
invalid-value rejection and independent scope reset with the full HTML CSS file
(/private/tmp/retouch-optical-focused.log). The npm command
`test:e2e:optical-sizing` runs the browser flow. git diff --check passed.

These fixtures prove computed CSS and source behavior, not optical glyph changes
in a font carrying an opsz axis. Fonts without optical sizing can legitimately
look unchanged. Actual opsz-font visual verification and complete typography
parity remain unfinished. Native launches remain paused; full arbitrary-site
parity and trusted macOS/Homebrew distribution remain unverified.

### Real optical-size font verification

The optical-sizing browser command now uses an unmodified, vendored Roboto Flex
font with its SIL Open Font License and a provenance README. The 1,787,292-byte
fixture has SHA-256
9b523f7d82593df0107173849ebb8c817471a1df4b4fb2c3cbf40cfd810c8281;
upstream Google Fonts Git blob 2a11e4cd5588a89e0047140b09c912059d1a150f.
It remains under test/fixtures/fonts, excluded by the npm package files list,
and is loaded in the test page only, never installed into macOS.

HTML, React and local Liquid passed Chromium and WebKit runs using the real font.
For the same 32px headline, Automatic rendered at 129.03125px in Chromium and
129.019485px in WebKit, compared with 134px for Off. Explicit opsz 8 versus 144
rendered at 142.5/121.625px in Chromium and 142.492188/121.625px in WebKit.
Enabling Automatic with explicit opsz 144 retained the explicit-axis width.
Inspection found Optical Size min 8, default 14, max 144, and set numeric bounds.
Responsive scope/reset, the class-adapter type sample, existing font-picker
behavior, and exact source undo passed in the same runs. All six exited 0:
/private/tmp/retouch-real-optical-{html,react,liquid}-{chromium,webkit}.log.
All 383 unit tests passed (/private/tmp/retouch-real-optical-units.log).
The HTML runs initially used the prior WOFF2 data MIME with the TTF fixture;
both browsers decoded it. The harness now correctly uses font/ttf for this
fixture, as exercised by the React/Liquid runs. git diff --check passed.

This supplies the previously missing real-opsz-font visual evidence for this
fixture. It does not prove all fonts, optical-sizing implementations, live
Shopify integration or full typography parity. Native app launches remain
paused, and full arbitrary-site/Figma parity and trusted macOS distribution
remain unfinished.

### Retain inspected ranges for large embedded fonts

The real Roboto Flex fixture exposed an inspector lifecycle gap: its base64 URL
exceeded the metadata cache's 2 MiB key budget, so inspection succeeded but the
next source reload lost ranges and sliders. Long URL keys now use Web Crypto
SHA-256 of the page origin plus URL. The cache retains metadata and a compact
identity instead of retaining a large font URL as its key. Entry count, key
budget and five-minute expiry remain bounded. Small keys keep their prior path.
If Web Crypto is unavailable or digesting fails, the previous bounded direct-key
fallback remains; oversized embedded fonts still cannot be cached on that path.
Selected-file choices retain their existing separately bounded URL mapping.

Inspector cache reads are now asynchronous and revision-guarded so an older
lookup cannot overwrite a newer render/inspection. Inspection errors await the
cache render before displaying their message. HTML, React and local Liquid
passed in Chromium and WebKit with Roboto Flex: ranges and the optical-axis
slider survived source reloads, with no extra metadata request. Real glyph,
optical precedence, responsive/reset and exact undo checks passed as well.
All six runs exited 0: /private/tmp/retouch-font-digest-{html,react,liquid}-
{chromium,webkit}.log. Both existing HTML live-preview/discovery regression runs
also exited 0, including failed reinspection, cancel, removal cleanup and undo:
/private/tmp/retouch-font-digest-regression-{chromium,webkit}.log.

Focused cache tests exercise a 3 MiB key across document replacement, URL and
origin isolation, expiry, and failed reinspection invalidation. The full unit
suite result is /private/tmp/retouch-font-digest-final-units.log. No native app
was launched. Full arbitrary-site/Figma parity, broader font discovery and
trusted native distribution remain unfinished.

### Font-provided named variable styles

The metadata parser now reads named fvar instances with Unicode names and a
complete coordinate tuple in font axis order. The endpoint and browser cache
carry axes plus instances. The inspector offers Font style preset above the
axis controls after inspection; selecting a preset applies its coordinates in
one existing responsive source/history operation. Matching explicit coordinates
select the corresponding preset. Axis overrides outside the preset are retained.
This is the font designer's named instance data, not inferred weight names.
Reference: https://learn.microsoft.com/en-us/typography/opentype/spec/fvar.

Parser tests cover both legal instance record sizes (with and without optional
PostScript name ID) in sfnt, WOFF and WOFF2, Unicode labels, fractional/negative
coordinates, and refusal of truncated records, invalid sizes/counts, reserved
flags and coordinates outside axis bounds. readFontAxes remains available; the
new readFontMetadata returns axes and instances. Inspection remains authenticated
and does not write source. The focused parser/cache/server tests passed (20),
and all 387 unit tests passed: /private/tmp/retouch-font-presets-focused.log and
/private/tmp/retouch-font-presets-units.log.

Roboto Flex supplies 20 named presets. HTML, React and local Liquid passed in
Chromium and WebKit: choosing Bold Italic wrote all 13 coordinates, including
wght 700, slnt -10 and opsz 14; the phone retained inherited settings; the tablet
retained the preset; subsequent optical edits and exact source undo passed.
Logs: /private/tmp/retouch-font-presets-html-chromium.log and
/private/tmp/retouch-font-presets-{html,react,liquid}-final-{chromium,webkit}.log
(except html-final-chromium, whose earlier successful log is named above).
The initial HTML WebKit screenshot attempt encountered a transient detached
control during panel refresh; the screenshot step now reacquires it, and the
corrected run exited 0. The Chromium screenshot was inspected at
/private/tmp/retouch-font-presets-chromium.png and visibly renders Bold Italic.
Both HTML axis/discovery/live-preview regression runs exited 0:
/private/tmp/retouch-font-presets-regression-{chromium,webkit}.log.

The parser bounds named instances at 256. Preset editing follows the existing
16-axis, alphanumeric-tag and numeric-range limits. STAT-derived style names,
static font families, localization selection, hidden-axis presentation and full
font-style discovery remain unfinished. Native launches remain paused; full
Figma/arbitrary-site parity and trusted native distribution remain unverified.

### Everyday and advanced variable-font controls

After inspection, font-designated hidden axes now appear in a collapsed Advanced
font axes section, including their numeric controls, removal actions, metadata,
sliders and default actions. They remain fully applied by presets. Common axes
are ordered Weight, Width, Optical size, Slant and Italic before other visible
axes, while unnamed/uninspected controls remain available. Advanced expansion
state survives inspector rebuilds during the editor session. Expanding or
collapsing the section never changes source.

Roboto Flex preset flows passed for HTML, React and local Liquid in Chromium and
WebKit: XOPQ starts hidden, Weight remains visible, expansion reveals XOPQ,
editing it from 96 to 97 saves at the selected scope, the section stays open,
and one undo restores exact source and Bold Italic matching. Collapse preserves
source. All six final runs exited 0:
/private/tmp/retouch-font-advanced-fixed-{html,react,liquid}-{chromium,webkit}.log.
Initial HTML/React WebKit runs exposed an intermediate unclassified-control flash
while cached metadata resolved. Controls now wait for the cache lookup before
being revealed; the browser check waits for the classified layout. The corrected
Chromium screenshot was inspected:
/private/tmp/retouch-font-advanced-fixed-html-chromium.png.
Both existing HTML axis/discovery/live-preview regressions exited 0:
/private/tmp/retouch-font-advanced-regression-{chromium,webkit}.log. All 387 unit
tests passed: /private/tmp/retouch-font-advanced-final-units.log. git diff --check
passed.

This classification depends on successfully inspected font metadata; it is not
complete font discovery. Broader typography and Figma/arbitrary-site parity
remain unfinished. Native app launches remain paused and trusted macOS/Homebrew
distribution remains unverified.

### Keep each font axis's controls together

Each active axis now forms a labeled group containing its numeric input, range
metadata, slider and default/removal actions. This eliminates the previous split
between numeric controls near the top and sliders/defaults in a separate list.
The slider keeps its accessible label and native value semantics; the numeric
input remains the single visible live value. Font default and Remove override
use compact visible labels with descriptive accessible names. Inactive axes keep
explicitly named default actions so separate candidate axes remain identifiable.
Advanced-axis classification and session expansion behavior are preserved.

HTML, React and local Liquid preset/advanced/optical flows passed in Chromium
and WebKit, including responsive isolation and exact undo. Logs:
/private/tmp/retouch-font-groups-{html,react,liquid}-{chromium,webkit}.log, except
the successful React/WebKit recheck is
/private/tmp/retouch-font-groups-react-webkit-recheck.log. Its initial parallel
run timed out waiting to click Undo after completing the preset/optical checks;
the isolated unchanged test completed with exit 0. This is recorded as a timing
failure, not proof that the underlying cause is fixed. The other five initial
preset runs exited 0. Both HTML discovery/slider regression runs exited 0:
/private/tmp/retouch-font-groups-regression-{chromium,webkit}.log. They operate
the slider/default action within the new labeled axis group and verify live
preview, failure recovery, cancellation, cleanup and exact undo. All 387 unit
tests passed: /private/tmp/retouch-font-groups-units.log. The first unit command
was issued from the repository root without a package.json; the corrected
retouch-directory run is the successful evidence. The screenshot
/private/tmp/retouch-font-groups-html-chromium.png was inspected and shows the
combined controls. git diff --check passed.

This improves one inspector workflow; it does not establish full ease-of-use,
typography, arbitrary-site or Figma parity. Native launches remain paused and
trusted macOS/Homebrew distribution remains unverified.

### Keyboard focus across inspector saves

The existing queued Tab-focus mechanism now also captures an active input,
select or textarea before a panel save disables/rebuilds the inspector. It
restores the corresponding control for the same selection. A panel observer
handles controls added or revealed later by cached font metadata. Missing targets
expire three seconds after the panel becomes available; time spent saving does
not consume that grace period. Explicit pointer/keyboard actions in the shell,
window blur, or a different selection cancel restoration. Normal browser focus
scrolling is retained, so an off-screen target becomes visible. Existing Tab
next-target behavior takes precedence over retaining the previous input.

HTML, React and local Liquid passed in Chromium and WebKit: slider Home saves,
focus survives reconstruction, and a subsequent keyboard End saves without
refocusing through the locator. The End write is deliberately held while the
panel is scrolled away; after release, the slider is focused and within the
panel bounds. Tab, Shift+Tab, unchanged Tab, clicking layer search during a held
save, and exact source undo pass in the same flow. All six final processes
exited 0: /private/tmp/retouch-panel-focus-final-{html,react,liquid}-
{chromium,webkit}.log. The npm command test:e2e:axis-keyboard runs this coverage.
All 387 unit tests passed (/private/tmp/retouch-panel-focus-units.log); syntax and
git diff --check passed. Internal focus-state/helper names were updated from Tab
to Focus to reflect the broader role.

This verifies sequential saved keyboard adjustments. Continuous key repeat
while a write is pending, caret/selection preservation for all text inputs,
all inspector control types and arbitrary-page focus scripts remain unverified.
Full Figma/arbitrary-site parity remains unfinished. Native launches remain
paused and trusted macOS/Homebrew distribution remains unverified.

### Project text-style catalog foundation

Added a project-local `.retouch/text-styles.json` catalog and authenticated
GET/POST `/rt/__api/text-styles` endpoint. Styles have stable UUID identities,
unique names and validated typography declarations, including variable-font
coordinates. Create, update and delete require the revision read by the caller;
stale requests and intervening external edits are refused. Writes use the
existing source transaction primitive. Reads do not create project files.
Malformed libraries, unsupported declarations, oversized input and symlinked
catalog paths are rejected without replacing stored data.

All 392 unit/integration tests passed (process exit 0), including real HTTP
persistence/authentication/method/body-limit checks and exact-byte preservation
on invalid or stale writes. Log: /private/tmp/retouch-text-styles-units.log.
Syntax checks and git diff --check passed. No browser UI changed in this step.

This is storage infrastructure, not a completed shared text-style experience.
Next work must connect inspector capture/application and persistent layer links,
then propagate style edits to linked uses while preserving responsive scopes,
local overrides and source undo. Catalog CRUD is not yet in source undo history.
Simultaneous writes from separate server processes have no cross-process lock;
revision checks cover sequential stale clients, not full distributed concurrency.
The library currently supports 100 styles and 512 KiB. Full Figma parity and
arbitrary-site coverage remain incomplete. Native launches stay paused; trusted
macOS/Homebrew distribution remains unverified.

### Text-style catalog inspector controls

The Typography inspector now exposes an initially collapsed Saved text styles
section in HTML and class-based React/Liquid renderers. It lazily loads the
project catalog, captures supported computed typography at the current screen
size, browses saved declarations, renames styles and deletes with an inline
cancelable confirmation. IDs survive rename and reload. Unsupported computed
values are refused explicitly rather than silently omitted. Requests have a
15-second timeout; errors remain visible and Reload text styles recovers stale
revision conflicts. Saved properties use readable labels in a collapsed detail
section, keeping the ordinary typography controls within reach.

The UI explicitly describes these as saved, unlinked typography snapshots.
Relative CSS values resolve to computed values during capture. This is not yet
linked application, variable binding, font installation, shared-library
publication or catalog undo. Next work must implement durable layer references,
responsive-scope application and update propagation through source transactions.

All six HTML/React/local-Liquid x Chromium/WebKit browser runs exited 0:
/private/tmp/retouch-text-styles-final-{html,react,liquid}-{chromium,webkit}.log.
Coverage exercises capture, duplicate rejection, rename identity, full reload
persistence, external-edit conflicts, reload recovery, cancel/delete and exact
page-source preservation. No page errors were reported. The final HTML screenshot
/private/tmp/retouch-text-styles-final.png was visually inspected. All 392 unit
tests passed (/private/tmp/retouch-text-styles-ui-units.log); syntax and diff
checks passed. Run browser coverage with test:e2e:text-styles plus the existing
fixture/renderer/browser environment settings. This does not establish live
Shopify coverage. Full parity remains unfinished; native launches stay paused.

### HTML linked text-style application and detach

HTML typography now offers Apply text style and Detach text style at the active
screen scope. The authenticated source operation resolves the catalog style on
the server and requires its current revision. Application writes normal managed
CSS plus a durable per-width style UUID and applied-property snapshot on the
source element in one transaction. Detach removes only that scope's reference,
retaining appearance. Both operations use source history and exact-byte undo.
Manual property edits retain the applied snapshot for later override-aware
propagation. Invalid metadata, unsupported widths, stale source and important
inline conflicts are refused. Metadata is bounded to 32 scopes and 128 KiB.

This does not yet propagate catalog updates. The inspector says so explicitly.
React/Liquid application remains unavailable; their catalog management remains
functional. Catalog deletion can leave a reference displayed as Unavailable
style; source declarations remain intact. Shared libraries, variable bindings,
and catalog history remain unfinished. The broader full-parity goal is active.

All 396 unit tests passed (/private/tmp/retouch-text-style-links-units.log).
HTML Chromium and WebKit browser tests apply saved heading typography to a
paragraph, detach while retaining appearance, undo both back to exact source,
then apply at 768px and verify tablet changes plus phone isolation and undo.
React Chromium and local Liquid WebKit catalog regressions also passed. All four
processes exited 0; logs: /private/tmp/retouch-text-style-links-final-
{html-chromium,html-webkit,react-chromium,liquid-webkit}.log. No browser page errors.
Syntax and diff checks passed. No native app launches were performed.

### Override-aware HTML text-style refresh planner

Added a file-level planner for refreshing every matching text-style link and
screen scope in an HTML source document. Untouched declarations follow the new
style, obsolete matching declarations are removed, local differences and resets
are preserved, and newly introduced properties respect existing local values.
Each refreshed link records the new applied baseline. Detected overrides are
stored explicitly, so a coincidental match with a later library value does not
silently convert them into inherited properties on the following update.
Reapplying a style clears those recorded overrides. Malformed link metadata and
externally modified managed CSS refuse the plan; no files are written by planning.
Multiple scopes compose into one before/after edit for the file.

This planner is not yet called by catalog mutation. The UI continues to state
that propagation is unavailable. Next work must compose catalog and all affected
file plans into one transaction, expose update controls, and integrate shared
undo. Project-wide coverage, browser propagation and React/Liquid support are
not established by this step. Local edits identical to an existing baseline
cannot be inferred as intentional overrides from values alone.

All 400 unit tests passed, exit 0:
/private/tmp/retouch-text-style-refresh-final-units.log. New cases cover scoped
updates, manual edits and resets, removed/added declarations, unrelated style
identities, corrupt managed CSS, idempotence, successive updates and coincidental
override matches. Syntax and diff checks passed. No browser UI changed and no
native launches occurred. Full parity remains unfinished.

### Transactional HTML library updates from the inspector

Update style from this layer now captures current typography and submits an
undoable source operation. It checks the selected source hash and library
revision, plans the catalog change and every matching link in the HTML page
inventory, then commits them through the shared transaction primitive. Pages
need not have been opened in the editor. Existing per-scope override handling is
retained. Invalid linked CSS or intervening file edits refuse the transaction.
One undo/redo covers both the catalog and affected source pages. Rename-only
planning avoids rewriting pages. The inspector describes the project-wide effect.

Inventory follows the HTML site's existing page discovery, excluding hidden
paths, node_modules, symlinks and the reserved root rt directory. Updates refuse
truncated inventories above 1,000 pages or more than 32 MiB of aggregate HTML.
These are explicit operational bounds, not universal-site coverage. Separate
process concurrency and files added between inventory and commit remain outside
this guarantee. Unsupported/unindexed markup requires further coverage. React
and Liquid linked-style application/updates remain unfinished. The older catalog
CRUD API is still separate from this source-history operation; direct property
updates through that endpoint do not propagate. Catalog create/delete/rename UI
history is also still unfinished.

All 404 unit tests passed, exit 0:
/private/tmp/retouch-style-update-final-units.log. Transaction tests verify two
pages and catalog together, exact undo/redo, invalid-page refusal, stale-page
refusal and rename-only behavior. HTML Chromium and WebKit browser processes
exited 0 (/private/tmp/retouch-style-update-final-{chromium,webkit}.log): update
from a layer changes the rendered paragraph plus an unvisited page, then one undo
restores both source files and catalog exactly. Existing apply/detach and screen
isolation cases also pass. Initial browser timeout was a fixture error: its
simulated page font change needed inline important priority to outrank managed
CSS. No browser product workaround was introduced for it. Syntax and diff checks
passed. Native launches remain paused; full parity is not achieved.

### Text-style update coverage for unindexed markup

File planning now compares every actual parsed text-style link owner against
source-indexed element locations, traversing template content as well as ordinary
children. If a link belongs to an unsupported or ambiguous layer, project update
refuses before writing any catalog or page changes. This closes silent omission
for linked nodes with duplicate attributes, template descendants and unsupported
SVG text. The check uses parsed attributes; comments and script-string examples
do not create false link owners.

All 407 unit tests passed, exit 0, including file-level refusal cases, false
positive checks and a project transaction case preserving all catalog/page bytes:
/private/tmp/retouch-style-link-coverage-units.log. Syntax and diff checks passed.
No browser UI changed. This guard does not add editing support for those markup
forms; that support remains required for the broader arbitrary-site goal.
Native launches remain paused. Full Figma parity remains incomplete.

### Shared undo/redo for text-style library management

Catalog create, rename and delete now commit through the shared transaction
history and return undo IDs. The inspector uses the shell's request locking and
history recording path, so library actions interleave with source edits in order.
Undoing the first save removes the newly created catalog file; redo restores the
same style identity. Undo/redo of rename and delete restores exact catalog bytes.
The empty .retouch directory may remain after undoing first creation.

Direct HTML catalog property updates now use the project propagation planner
and shared history as well. This closes the earlier documented CRUD API bypass:
the catalog endpoint no longer changes HTML style definitions independently of
linked pages. The existing selected-layer update action retains its source-hash
check. Non-HTML catalog management is undoable, while React/Liquid linked-style
application and propagation remain unfinished. Histories remain session-local;
external edits can still invalidate an old undo, which then refuses safely.

All 409 unit/integration tests passed, exit 0:
/private/tmp/retouch-catalog-history-final-units.log. A real HTTP HTML catalog
update changes two linked pages and catalog, returns one undo ID and restores all
three files exactly through the source undo endpoint. Browser tests passed in
HTML/React/local-Liquid x Chromium/WebKit, all six processes exit 0:
/private/tmp/retouch-catalog-history-{html,react,liquid}-{chromium,webkit}.log.
They exercise create/undo/redo, rename/undo/redo and delete/undo/redo, plus the
existing HTML apply/detach, cross-page update and screen isolation flows. Syntax
and diff checks passed. No native launches occurred. Full parity remains open.

### Linked text-style override visibility and reset

HTML's Saved text styles inspector now reports the number of local overrides in
the active screen scope and offers Reset text style overrides. The count includes
differing values, explicit property resets and retained overrides discovered by
previous library updates. Reset uses the current catalog revision and source
hash, restores the linked style's declarations, removes retained properties no
longer defined by the style, and clears override metadata in one undoable source
operation. Other scopes and unrelated local properties are preserved. The action
is disabled when no overrides exist or the referenced style is unavailable.

All 411 unit tests passed, exit 0:
/private/tmp/retouch-style-overrides-units.log. Scope-isolation and obsolete-
property reset cases are covered directly. HTML Chromium and WebKit browser runs
exited 0 (/private/tmp/retouch-style-overrides-{chromium,webkit}.log): edit a linked
paragraph from 32px to 40px through the inspector, observe one override, reset to
32px, observe no overrides and disabled reset, then undo reset and edit with exact
source restoration. Existing catalog history, propagation and responsive cases
also pass. Syntax/diff checks passed. Overrides identical to the original style
cannot be inferred as intentional from source values alone. React/Liquid linked
styles and full parity remain unfinished; native launches remain paused.

### Visible text-style inheritance across screen scopes

When the active HTML screen scope has no explicit text-style link, the inspector
now identifies the nearest narrower linked scope and its style name. It offers
Apply inherited style at this scope, which applies the saved definition and
creates a scoped link without changing narrower declarations. Inherited links
cannot be detached or reset accidentally from the larger scope. The UI notes
that local typography may override inherited styling; inheritance here describes
the source link, not a claim that every computed property matches the library.
Missing catalog styles are labeled unavailable and cannot be applied.

HTML Chromium and WebKit browser tests passed, exit 0:
/private/tmp/retouch-inherited-styles-focus-{chromium,webkit}.log. They verify
base inheritance at 768px, explicit scoped application with the base link retained,
nearest-scope inheritance from 768px at 1440px, no writes from inspection, and
exact undo. Existing library/edit/propagation tests also pass. A test correction
focuses the screen selector before switching presets: programmatic selectOption
alone left focus in the inspector, where viewport-driven reconstruction is
intentionally deferred. No product focus workaround was added. All 411 unit tests
passed (/private/tmp/retouch-inherited-styles-units.log); syntax/diff checks passed.
React/Liquid linked styles and full parity remain unfinished. Native launches
remain paused.

### Class-based text-style encoding foundation

Added a canonical encoder for all 12 catalog typography properties into important
arbitrary-property class tokens. Property ownership remains explicit instead of
depending on theme utility names. Encoding validates the same catalog CSS grammar,
preserves quoted Unicode family names and literal underscores, and handles
variable-font coordinates, numeric features and combined text decorations.
React and Liquid source writers preserve the generated tokens through their own
source serialization. Unsupported/injected values refuse before encoding.

All 414 unit tests passed, exit 0:
/private/tmp/retouch-text-class-encoding-units.log. Chromium and WebKit rendering
checks exited 0 (/private/tmp/retouch-text-class-encoding-{chromium,webkit}.log):
Tailwind compiles the generated tokens; all 12 computed properties match equivalent
inline CSS at 900px, and the original 390px typography returns below the 768px
breakpoint. Browser coverage is available as test:e2e:text-style-classes with the
existing fixture/browser environment variables. No page errors. Diff checks passed.

This encoder is not yet connected to linked-style application in React/Liquid.
Next work must add durable source links and override-aware propagation, and teach
existing inspector edits/reset predicates to recognize canonical property tokens
so manual edits do not leave competing declarations. Dynamic class expressions,
non-Tailwind projects and live Shopify rendering are not covered here. Full parity
remains unfinished. Native launches remain paused.

### Inspector edits for canonical typography classes

Class-based typography controls now recognize canonical font-size, font-weight,
letter-spacing, text-align, font-style, text-decoration-line and text-transform
properties alongside ordinary utilities. Manual edits replace the corresponding
canonical token while preserving important priority and other scopes. Reset text
overrides uses shared predicates covering all 12 encoded typography properties.
Existing family, line-height, optical sizing, variation and numeric property
recognition remains in use. Unrelated colors and layout classes are retained.

All 415 unit tests passed, exit 0:
/private/tmp/retouch-canonical-edits-units.log. React and local Liquid passed in
Chromium and WebKit, all four processes exit 0:
/private/tmp/retouch-canonical-edits-{react,liquid}-{chromium,webkit}.log.
Browser coverage starts with canonical property classes, edits each of the seven
newly recognized properties, checks computed styles and removal of old tokens,
verifies exact undo for each edit, then resets all text overrides and undoes it.
No page errors. Run test:e2e:canonical-typography with the fixture environment;
it defaults to React and accepts RT_E2E_RENDERER=liquid. Syntax/diff checks passed.

This prepares existing controls for linked styles; React/Liquid source links,
propagation and override metadata are still unfinished. Dynamic class expressions,
non-Tailwind styling and live Shopify are not verified by these fixtures. The
full-parity goal remains active. Native launches remain paused.

### Scoped typography class composition

The class-style encoder now composes its values into existing classes using the
inspector's property ownership predicates. It replaces only supplied typography
properties in the chosen scope, preserves other breakpoints/state variants and
unrelated color/layout classes, and emits canonical important property tokens.
Repeated composition is idempotent. Combined size/line-height utilities are
removed only when both properties are supplied; partial replacement refuses
rather than silently losing the companion property. Font shorthand conflicts
also refuse pending a structured shorthand-preservation implementation. Slashes
inside arbitrary CSS expressions are not treated as coupled utility separators.

All 417 unit tests passed, exit 0:
/private/tmp/retouch-text-style-composition-units.log. React and Liquid writer
round trips now use composed styles over existing typography and responsive
classes. Chromium and WebKit compiled/rendered composed output correctly at
900px and restored 390px styling below the 768px breakpoint, exit 0:
/private/tmp/retouch-text-style-composition-{chromium,webkit}.log. Tests verify
obsolete responsive typography tokens are removed and unrelated tokens retained.
Syntax/diff checks passed. This remains an internal foundation: durable React/
Liquid links, propagation and UI wiring are unfinished. Native launches remain
paused; full parity is not achieved.

### Durable React text-style link writer foundation

Added a React source planner that composes typography classes and serializes a
style UUID plus applied-property snapshot per responsive scope in the same source
edit. Link metadata is a literal JSX string expression, preserving quoted font
names safely. Applying again is idempotent; structural layer identity remains
stable. Detach removes only the selected scope's link and preserves classes and
other scope links. Metadata is bounded to 32 scopes and 128 KiB.

All 420 unit tests passed, exit 0:
/private/tmp/retouch-react-style-links-units.log. New cases cover base and md
application, source reparse/identity, metadata round trips, retained layout/state
classes, coupled typography replacement, idempotence and scoped detach. Stale
source, dynamic classes/metadata, duplicate class attributes, spreads and nested
variant scopes refuse explicitly. Syntax/diff checks passed.

This planner is not yet wired into the server operation dispatcher or inspector.
React update propagation, override metadata/reset, inheritance UI and browser
verification of the linked flow remain pending, as does the corresponding Liquid
writer. The conservative refusal cases need broader authoring support for the
full arbitrary-site objective. No native launches occurred; full parity remains
unfinished.

### React linked text-style apply/detach integration

React now exposes saved-style apply and detach through the typography inspector
and authenticated source operations, using catalog revision checks and shared
undo. Base and named responsive scopes serialize durable style IDs/property
snapshots alongside composed classes. Detach preserves typography. Unsupported
layers retain catalog browsing but do not expose application. The UI explicitly
states that library updates do not yet propagate in React, and does not claim an
override count before React override inspection is implemented.

Browser verification found that immediate reload after a React write could render
the old module/classes. Linked-style writes now use the existing renderer-revision
confirmation path, matching both classes and metadata before rebuilding the
inspector. Longer testing also exposed library closure during panel reconstruction;
the library now retains its open state and selected style across that rebuild.
These states remain local to the current editor page, not persisted across reload.

All 421 unit/integration tests passed, exit 0:
/private/tmp/retouch-react-linked-styles-final-units.log. A real React HTTP source
operation applies an md link and exact undo restores the file. React Chromium and
WebKit browser runs exited 0 (/private/tmp/retouch-react-linked-styles-final-
{chromium,webkit}.log): apply to another text layer, inspect serialized identity,
detach retaining rendered typography, undo both exactly, apply only at md, verify
phone isolation, undo, and complete catalog history/conflict flows. HTML Chromium,
HTML WebKit and local Liquid WebKit regressions also exited 0:
/private/tmp/retouch-react-links-regression-{html-chromium,html-webkit,liquid-webkit}.log.
Syntax/diff checks passed. React propagation/reset/inheritance and Liquid link
application remain unfinished, along with full parity. Native launches stay paused.

### React linked typography override count and reset

React links now expose per-scope override counts based on canonical property
ownership. Missing/replaced canonical tokens and competing important typography
utilities count as local overrides; normal-priority utilities and other scopes
do not. Reset text style overrides restores the current catalog definition in
the selected scope, removes properties owned by the old definition but absent
from the new one, and preserves other scopes. The operation remains revision-
checked and undoable. Initial browser testing found that ordinary class saves
kept old link metadata in the client; class-save responses now refresh that
metadata before inspector reconstruction.

All 423 unit tests passed, exit 0:
/private/tmp/retouch-react-style-reset-final-units.log. Unit coverage verifies
scoped reset, obsolete-property removal, canonical ownership and competing
important declarations. React Chromium and WebKit browser flows exited 0:
/private/tmp/retouch-react-style-reset-fixed-{chromium,webkit}.log. They change a
linked paragraph from 32px to 40px through the inspector, observe one override,
reset to 32px with no overrides, and undo reset/edit back to exact source. Existing
apply/detach, responsive isolation and catalog-history flows also pass. Syntax and
diff checks passed. Counts describe supported source-class ownership, not a
complete analysis of arbitrary CSS cascade rules. React propagation/inheritance,
Liquid linked styles and full parity remain unfinished. Native launches stay
paused.
