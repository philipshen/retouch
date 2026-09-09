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
| Layout | Auto layout, grid, wrap, hug/fill/fixed, min/max, constraints, absolute children, padding/gaps, responsive behavior | Visual horizontal/vertical/reverse flex and grid controls, wrapping, gaps, alignment/distribution, per-side padding, fixed/hug/fill sizing, minimum/maximum dimensions and breakpoint-scoped writes now exist. Full constraint, advanced grid, nested auto-layout and cross-framework equivalence work remains. |
| Appearance | Multiple fills/strokes, gradients, images and cropping, blend modes, opacity, shadows, blur/effects | Opacity, CSS border width/style/color, uniform and individual corners, basic color and shadow controls, and image fit/position controls exist. Browser tests cover border independence, corners, scope and exact undo. Multiple fills/strokes, gradient editing, crop handles/zoom/rotation, blending and complete visual/source representations remain. |
| Typography | Font selection, weights/styles, variable axes, text runs, paragraph controls, lists, decoration, sizing and resizing behavior | Inline formatting plus custom font size, line height, tracking, alignment, slant, decoration, case and scoped reset now exist. Browser tests cover named-style preservation, scoped sizes and exact undo. Font browsing, variable axes, full rich-text/paragraph/list controls and complete typography parity remain. |
| Components | Create/reuse, variants, exposed properties, overrides, nested instances, swap/reset/detach, shared libraries | Existing React and Liquid component inspection/detach; full creation/variants/library workflows remain. Live Shopify proof is incomplete. |
| Design systems | Reusable styles, tokens/variables, aliases, collections/modes, import/export and updates | Not implemented or verified. |
| Prototypes | Connections, interactions, states, transitions/animation, overlays, scrolling, variables/conditions, presentation | App interact mode exists; design authoring workflow remains. |
| Assets/export | SVG/raster/PDF export, scales, selections/frames, asset libraries/import | Image upload exists; complete export and import pipeline remains. |
| History/collaboration | Reliable undo/redo across all actions, persistence, version restoration, multiplayer behavior and review | Shared undo/redo controller is now connected to all shell history records, toolbar buttons and keyboard shortcuts. Source and browser tests cover ordered restores, refusal/retry, branch invalidation and structural redo. Persistence across editor restarts, complete gesture grouping, version browsing and collaborative editing remain. |
| Any site | Useful authoring on arbitrary public/local sites and source-connected editing across frameworks; honest source mapping and durable edits | Next/React and Shopify/Liquid adapters only. Generic site capture/edit document and additional adapters remain. A native WebView alone does not provide this. |
| Screen sizes | Easy size selection, continuous resizing, side-by-side linked views, explicit inheritance and breakpoint overrides, discoverability | New presets/custom dimensions/rotation/persistence resize the actual iframe. Zoom preserves fixed viewport dimensions and vh. Real browser test passes. Breakpoint-scoped class edits, loaded-CSS discovery, inheritance reset and exact undo are browser-verified on React/Tailwind. Linked views, continuous resize handles and the full cross-framework responsive workflow remain. |
| Desktop | Native installable app, project/site onboarding, editor operation, keyboard/file integration, recovery | Universal AppKit/WKWebView app builds and connects to live local editor. It currently requires CLI startup. Full desktop editor behavior, Intel runtime, onboarding and lifecycle verification remain. |
| Homebrew | Published immutable archive, integrity hash, cask/tap, install/launch/upgrade/uninstall, trusted macOS distribution | Universal ZIP, SHA-256 and cask generator exist. Development build is ad hoc signed. Developer ID signing/notarization, publishing and actual Homebrew installation remain unverified. |
| Ease of use | New user can open a site, select/edit, compare screens, undo and retain work without learning implementation details | Controls have labels and basic defaults. Whole-workflow usability validation remains. |

Figma reference material used to anchor the inventory:
[auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties),
[variables](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma),
[variants](https://www.figma.com/best-practices/creating-and-organizing-variants/).
This inventory still needs a complete audit against Figma's current Design UI and
documentation. Nothing in it proves full parity.

## Verification, 2026-09-08

- `cd retouch && npm test`: 194 passed. Run with local network/watch permissions;
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
   application state. Fixed phone/tablet/desktop previews now share source
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
advanced grid tracks/spans and arbitrary CSS authoring remain
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

These are linked source previews, not complete multi-canvas editing: custom
comparison dimensions, direct edits within comparison frames, synchronized app
state, per-screen override badges and general arbitrary-site support remain open.
Each preview executes its own application instance. Cross-origin pages cannot be
inspected through the current same-origin architecture.
