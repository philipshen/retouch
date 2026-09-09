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
| Canvas | Frames, pages, sections, zoom/pan, rulers/guides, grids, multiple selection, alignment/distribution, snapping, grouping, stacking, locking/hiding | Bounded canvas zoom/scrolling and linked screen comparisons exist. HTML supports multi-selection, range selection, gray/page marquee gestures and framing a consecutive sibling selection. Full document/pages/sections, guides, snapping, pixel-preserving groups, locking/hiding and cross-renderer equivalence remain. |
| Layers | Complete searchable tree, nesting/reparenting, reorder, rename, duplicate, delete, copy/paste across contexts | Searchable live layer hierarchy, disclosure, keyboard navigation, canvas-linked selection and literal sibling duplicate/delete/reorder UI exist. HTML also supports rename and reparenting by picker or drag/drop. HTML multi-selection, shared CSS and group duplicate/delete/reparenting exist; cross-context clipboard and broader source structures remain. |
| Geometry | Shapes, vector/pen editing, vector networks, boolean operations, masks, strokes, corners, transforms | HTML frame aspect ratios, content clipping, SVG primitive creation/geometry and responsive solid fill/stroke controls are verified. Full vector authoring, boolean operations, arbitrary masks and a shared geometry model remain. |
| Layout | Auto layout, grid, wrap, hug/fill/fixed, min/max, constraints, absolute children, padding/gaps, responsive behavior | HTML provides direct stack presets, physical nine-position flex alignment (including wrapped/RTL/vertical layouts), adaptive grids, equal tracks/spans, hug/fill, min/max, spacing and breakpoint-scoped writes. Full constraints, absolute-child authoring, advanced grids, nested auto-layout equivalence and cross-framework coverage remain. |
| Appearance | Multiple fills/strokes, gradients, images and cropping, blend modes, opacity, shadows, blur/effects | HTML supports linear/radial gradient stacks with draggable stops, shadow stacks, layer/backdrop blur, blend modes, opacity, borders/corners and image fit/position. Browser/source tests cover these scoped edits and undo. Multiple strokes, arbitrary paint/filter representations and full crop handles/zoom/rotation remain. |
| Typography | Font selection, weights/styles, variable axes, text runs, paragraph controls, lists, decoration, sizing and resizing behavior | Inline formatting plus custom font size, line height, tracking, alignment, slant, decoration, case and scoped reset now exist. Browser tests cover named-style preservation, scoped sizes and exact undo. Font browsing, variable axes, full rich-text/paragraph/list controls and complete typography parity remain. |
| Components | Create/reuse, variants, exposed properties, overrides, nested instances, swap/reset/detach, shared libraries | Existing React and Liquid component inspection/detach; full creation/variants/library workflows remain. Live Shopify proof is incomplete. |
| Design systems | Reusable styles, tokens/variables, aliases, collections/modes, import/export and updates | Not implemented or verified. |
| Prototypes | Connections, interactions, states, transitions/animation, overlays, scrolling, variables/conditions, presentation | App interact mode exists; design authoring workflow remains. |
| Assets/export | SVG/raster/PDF export, scales, selections/frames, asset libraries/import | Image upload exists; complete export and import pipeline remains. |
| History/collaboration | Reliable undo/redo across all actions, persistence, version restoration, multiplayer behavior and review | Shared undo/redo controller is now connected to all shell history records, toolbar buttons and keyboard shortcuts. Source and browser tests cover ordered restores, refusal/retry, branch invalidation and structural redo. Persistence across editor restarts, complete gesture grouping, version browsing and collaborative editing remain. |
| Any site | Useful authoring on arbitrary public/local sites and source-connected editing across frameworks; honest source mapping and durable edits | Next/React, Shopify/Liquid and local static HTML have source adapters with different capabilities. HTML has responsive CSS, structural edits and batch selection operations. Arbitrary remote-site capture/authoring, other frameworks, dynamic structure and equivalent capabilities across adapters remain. A native WebView alone does not provide this. |
| Screen sizes | Easy size selection, continuous resizing, side-by-side linked views, explicit inheritance and breakpoint overrides, discoverability | Presets/custom dimensions/rotation/persistence resize the actual iframe; zoom preserves viewport dimensions. Linked comparison previews exist, with edits on the main canvas. React/Tailwind scopes and HTML responsive layouts/styles have browser/source verification. Full editable multi-canvas views, continuous resize handles and cross-framework parity remain. |
| Desktop | Native installable app, project/site onboarding, editor operation, keyboard/file integration, recovery | Universal AppKit/WKWebView build and bundled CLI launcher tests pass. Earlier native UI fixtures passed startup/edit/undo/Stop; interaction with the latest packaged source (4670764) remains unverified after cgWindowNotFound. Newer editor changes are not yet packaged. File flows, Intel runtime and broader lifecycle verification remain. |
| Homebrew | Published immutable archive, integrity hash, cask/tap, install/launch/upgrade/uninstall, trusted macOS distribution | Universal ZIP, SHA-256 and cask generator exist. Development build is ad hoc signed. Local cask install/uninstall passed. Developer ID signing/notarization, publishing, upgrades and quarantined launch remain unverified. |
| Ease of use | New user can open a site, select/edit, compare screens, undo and retain work without learning implementation details | Controls have labels and basic defaults. Whole-workflow usability validation remains. |

Figma reference material used to anchor the inventory:
[auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties),
[variables](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma),
[variants](https://www.figma.com/best-practices/creating-and-organizing-variants/).
This inventory still needs a complete audit against Figma's current Design UI and
documentation. Nothing in it proves full parity.

## Verification baseline and historical checks

- `cd retouch && npm test`: 268 passed. Run with local network/watch permissions;
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
