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
| Canvas | Frames, pages, sections, zoom/pan, rulers/guides, grids, multiple selection, alignment/distribution, snapping, grouping, stacking, locking/hiding | Existing single-site zoom/selection/resize. Most document and multi-selection operations still absent or unaudited. |
| Layers | Complete searchable tree, nesting/reparenting, reorder, rename, duplicate, delete, copy/paste across contexts | Source structure backend exists; full tree and complete canvas interactions remain. |
| Geometry | Shapes, vector/pen editing, vector networks, boolean operations, masks, strokes, corners, transforms | Full vector authoring and geometry model remain. |
| Layout | Auto layout, grid, wrap, hug/fill/fixed, min/max, constraints, absolute children, padding/gaps, responsive behavior | Some CSS controls exist; complete visual layout workflow and equivalence tests remain. |
| Appearance | Multiple fills/strokes, gradients, images and cropping, blend modes, opacity, shadows, blur/effects | Partial inspector controls exist; complete visual editors and source representations remain. |
| Typography | Font selection, weights/styles, variable axes, text runs, paragraph controls, lists, decoration, sizing and resizing behavior | Basic inline formatting and inspector exist; full typography parity remains. |
| Components | Create/reuse, variants, exposed properties, overrides, nested instances, swap/reset/detach, shared libraries | Existing React and Liquid component inspection/detach; full creation/variants/library workflows remain. Live Shopify proof is incomplete. |
| Design systems | Reusable styles, tokens/variables, aliases, collections/modes, import/export and updates | Not implemented or verified. |
| Prototypes | Connections, interactions, states, transitions/animation, overlays, scrolling, variables/conditions, presentation | App interact mode exists; design authoring workflow remains. |
| Assets/export | SVG/raster/PDF export, scales, selections/frames, asset libraries/import | Image upload exists; complete export and import pipeline remains. |
| History/collaboration | Reliable undo/redo across all actions, persistence, version restoration, multiplayer behavior and review | Source transaction/history baseline covered by unit tests; UI and full collaborative editing remain. |
| Any site | Useful authoring on arbitrary public/local sites and source-connected editing across frameworks; honest source mapping and durable edits | Next/React and Shopify/Liquid adapters only. Generic site capture/edit document and additional adapters remain. A native WebView alone does not provide this. |
| Screen sizes | Easy size selection, continuous resizing, side-by-side linked views, explicit inheritance and breakpoint overrides, discoverability | New presets/custom dimensions/rotation/persistence resize the actual iframe. Zoom preserves fixed viewport dimensions and vh. Real browser test passes. Breakpoint-aware writes and linked views remain. |
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

- `cd retouch && npm test`: 179 passed. Run with local network/watch permissions;
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

1. Add explicit base/breakpoint edit scope shared by all inspector operations;
   preserve existing variants and source undo. Discover project breakpoints.
2. Add linked screen canvases with one selected source element and visible
   inheritance/overrides, then verify actual writes across widths.
3. Build the layer/document and generic-site authoring model that supports the
   remaining canvas/vector/layout/component operations without requiring JSX.
4. Expand feature families above with browser/source round-trip verification.
5. Integrate desktop project startup, site capture, persistence and file flows;
   publish and verify the cask distribution when a release is ready.
