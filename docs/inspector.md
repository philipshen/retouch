# Design inspector

The inspector sits on the right of the live page. Select an element in Edit mode.
Liquid parity work and its remaining verification gates are tracked in
[the parity checklist](liquid-parity.md).

| Control | Behavior |
|---|---|
| Position | Switch between flow, relative, absolute, fixed, and sticky. Absolute placement preserves the current box and suggests the nearest anchors. |
| Anchors | Pin horizontally to the left, center, right, or both edges; vertically to the top, center, bottom, or both edges. Both edges stretch with the existing positioning container. Insets also accept CSS units. |
| Measurements | Hold Alt / Option and hover. Green bands show padding; labeled lines measure padding, parent distances, or gaps to the selected element. Releasing the key dismisses the overlay without a write. |
| Image | Adjust image fit and position; preview, browse project assets, enter a project path, or upload a replacement. |
| Typography | See a sample in the page's fonts, family, size, line height, and weight. Swap a named typography class discovered from loaded CSS, or choose size and weight utilities. HTML semantics have a separate control. |
| Component | Inspect props, usage values, defaults, and definition source. View a live component in a separate modal canvas. Edit its shared definition, or detach the selected usage into its own module. |
| Fill / text color | Choose a palette color or enter a 3, 4, 6, or 8 digit hex value. The inspector also shows the computed color. |
| Effects | Apply a shadow preset or set X/Y, blur, spread, color, opacity, and inner shadow. |
| Opacity | Set a percentage or use the slider. |

Style controls follow the selected breakpoint scope. Other breakpoint and state
classes stay intact and may override an edit at the current viewport. Authored
responsive image source choices remain outside image replacement.

Styles use the existing Tailwind write path. Keep the app's CSS compiler running
so newly introduced utilities become available. Anchor placement uses the real
existing CSS containing block; it does not rewrite parent layout. Rotated,
scaled, translated, or zoomed ancestor geometry is refused for automatic anchor
placement. Flow siblings can move when an element becomes absolute.

Image replacement supports literal React sources, static image imports, and
literal Liquid sources or `asset_url`. React assets go into `public/rt-assets/`;
Liquid assets go into `assets/`. Computed product images, authored `srcSet` /
picture sources, and Liquid `image_tag` pipelines need source-aware operations
that are not implemented here. Uploading and then undoing a replacement leaves
the uploaded asset available in the project.

Component actions support local React function components, default/named
exports, local re-exports, direct tsconfig/jsconfig path aliases, and module-level
same-file declarations. The instance must forward its `data-rt-i` prop to the
DOM. Unresolved packages, class components, nested closures, and computed member
bindings report a reason. Dynamic prop values are displayed as source expressions.
The live modal keeps the component's application context and providers while
hiding surrounding page layout; it does not synthesize new props or execute
copied source. Detachment copies the module beside its original dependencies and
rewires only the selected usage. Repeated renders of one usage still share that
usage's new module. Imported child components remain shared.

Undo restores the exact pre-edit file for style, tag, and image edits. Detach
undo also removes the copied module. It refuses if subsequent edits changed the
file or copied module, or another source file now refers to the copy. The last
100 source snapshots are retained for the current server session.

## Verification

Fast tests: `cd retouch && npm test`.

The browser suites use a disposable copy of `retouch/test/fixtures/inspector`:

```sh
fixture_dir=$(mktemp -d /tmp/retouch-inspector-XXXXXX)
cp -R retouch/test/fixtures/inspector/. "$fixture_dir"
npm install --prefix "$fixture_dir"
cd "$fixture_dir"
node /path/to/retouch/retouch/bin/retouch.cjs -- npm run dev -- --port 3491
```

From the repository in another terminal:

```sh
RT_INSPECTOR_FIXTURE=/path/to/disposable/fixture node retouch/test/e2e/inspector.cjs
RT_INSPECTOR_FIXTURE=/path/to/disposable/fixture node retouch/test/e2e/components.cjs
```

The first suite checks every style section, real pointer measurements, container
resizing, source persistence after reload, image replacement/upload, and undo.
The second checks props and live preview isolation, shared definition edits,
detachment, independent edits, and exact two-file undo. Both collect browser
errors and restore their disposable sources.

## Screen previews

The Screen toolbar switches the actual iframe viewport between phone (390 ×
844), tablet (768 × 1024), desktop (1440 × 900), and custom dimensions from 240
to 7680 CSS pixels. Rotate swaps dimensions; Fit workspace follows the editor
window. The chosen size persists in this site's browser storage. Pinch zoom
changes the visual scale without changing a fixed screen's media queries or
viewport-height units. Choose **Style changes** in the inspector to edit base styles, a named loaded
breakpoint, or the current width and larger. Size previews and write scopes are
independent; the inspector notes when the chosen breakpoint is outside the preview.
Style controls and the advanced class editor operate on that scope, preserving
other breakpoints and state variants. **Reset overrides at this size** returns to
inherited styles. Text, image content and HTML tag changes remain shared.

Named custom typography presets currently apply at base scope; size and weight
controls work at breakpoints. The project must compile newly authored Tailwind
utilities. Arbitrary CSS files and unused config-only breakpoint names still need
a fuller source integration.

Run `node test/e2e/screens.cjs` from `retouch/` for the isolated browser check.

## Layers

The left panel shows the rendered hierarchy of source-connected elements. Search
by tag, ID, label or direct text. Use disclosures to collapse groups; selecting an
element on the canvas reveals its ancestors. Click a row or press Enter to select
it without entering text editing. Arrow keys navigate and expand/collapse rows.

Use Duplicate layer, Move layer up/down or Delete layer to change source-backed
literal siblings. Cmd/Ctrl+D duplicates the focused row; Delete/Backspace deletes
it. Undo restores exact source bytes. The panel explains unavailable actions
when the current source structure cannot be edited safely. Grouping, reparenting,
component-aware structural editing, multi-selection and clipboard remain open.

## Visual layout

**Arrange children** switches between normal flow, horizontal/vertical layouts
(with reverse directions), and grid. Choose wrapping, independent horizontal and
vertical gaps, alignment/distribution, grid columns and padding on each side.

Width and height offer fixed pixels, hug content and fill available space. Fill
uses flexible growth along a flex parent's main axis and full size otherwise;
existing minimum and maximum constraints still apply. Layout controls follow the
selected style breakpoint and participate in exact source undo.

The source project must compile the generated Tailwind utilities. These controls
do not yet expose advanced track definitions, grid spans, min/max fields or the
complete nested auto-layout behavior of Figma.

## Undo and redo

Use the toolbar or Cmd/Ctrl+Z to undo and Cmd/Ctrl+Shift+Z to redo. Text inputs
retain native editing shortcuts. Buttons disable when no corresponding history
entry exists or a write/restore is pending. A new edit after undo clears redo.

Restores use exact source snapshots. If an external change conflicts, the restore
is refused and its history entry stays available for retry. History currently
belongs to the running editor/server session; it is not persisted across restarts.

## Typography properties

Text layers put typography near the top of the inspector. Set exact font size,
line height and letter spacing, then choose alignment, slant, decoration and case.
These property changes follow the chosen breakpoint scope and support undo/redo.
When a named project text style overrides utility classes, explicit property
changes use important utilities while retaining the style's other font properties.
**Reset text overrides** clears the supported property overrides in that scope
and restores the inherited/project styling.

## Borders and corners

Appearance includes border width, solid/dashed/dotted/double/none styles and a
color picker. Increasing width from a hidden border enables a solid border.
Set one radius for all corners or expand Individual corners. Mixed corner values
are shown explicitly; percentage and elliptical values remain visible as hints
until replaced with a pixel value. These controls follow breakpoint scope and
use the shared undo/redo history.

## Image framing

Select an image and choose Fill frame, Fit inside, Stretch, Original size or
Scale down. Use the nine-point position control or enter horizontal and vertical
percentages to position the image inside its frame. Set the frame's width and
height through Layout when needed. Framing edits follow breakpoint scope and
support undo/redo without changing the image source or rewriting the asset.
These controls edit CSS object-fit/object-position on IMG elements; background
images and custom crop zoom/rotation are not supported.

## Size limits

Expand **Size limits** under Layout to set minimum and maximum width and height.
Enter a number for pixels or include a unit such as `50%`, `24rem` or `80vw`.
Intrinsic values `min-content`, `max-content` and `fit-content` are also accepted.
Use `auto` for a minimum or `none` for a maximum when explicitly overriding a
limit. **Reset** removes that property's override in the selected breakpoint
scope so inherited styling applies again. Minimums take precedence when they
exceed a maximum. Limits work alongside fixed, hug and fill sizing and use shared
undo/redo. CSS functions such as `calc()` are not accepted as new input here.

## Compare screens

Click **Compare screens** to see live phone, tablet and desktop previews beside
the canvas. Blue outlines identify the selected source layer at each size. Scroll
over a preview to inspect more of its page; click its **Edit** button to use that
size in the main editing canvas. Choose the style scope in the inspector to make
shared or breakpoint-specific changes. Source edits and undo appear across the
previews, and navigation follows the main canvas. Closing the rail unloads the
extra previews.

Each preview runs independently, so temporary app state such as open menus is
not synchronized. Set the main canvas width/height and click **Pin current size** to add a custom
comparison. The × button removes a card. Up to eight sizes are remembered in
this browser for the current site; duplicate dimensions cannot be pinned twice.
