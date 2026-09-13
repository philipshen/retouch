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

Font size, line height, and letter spacing accept calculations such as
`(16 + 4) * 2px` and `(2 - 4) / 2px`. Enter saves; Escape restores the
field's initial value without a source edit. A trailing unit applies to the
whole calculation. React and Liquid pixel fields require pixels; HTML fields
retain their authored CSS unit, including unitless line-height multipliers.
Invalid arithmetic is refused before source writes. Mixed-unit arithmetic and
unit conversion are not supported. Relative line-height and letter-spacing
fields, including shared selections, also accept percentage calculations such
as `(100 + 75)%`. Their conversion buttons validate calculations before saving;
unchanged-value conversion retains the original precision. Held arrow keys
change the draft and commit one source edit on release. Shared font size,
line height, and letter spacing also accept calculations in pixel/CSS fields.
A mixed selection shows an empty field with a Mixed placeholder; Escape
preserves each original value, while a saved result applies to every selected
layer in one undo transaction.

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

## Grid spans

Select an in-flow child of a grid to set **Span columns** and **Span rows** in
Layout. Choose a track count, all tracks, or Auto. Picking a span replaces
explicit start/end line placement on that axis; other-axis placement and element
dimensions stay unchanged. A fixed-width item may therefore stay narrower than
its spanned area; use Fill available to fill it. Spans follow the selected
breakpoint scope and support undo/redo. Unrepresented explicit placements show
Custom placement.

### Typography calculation verification (2026-09-13)

`RT_E2E_TYPOGRAPHY_CALCULATIONS=1` with `page-fonts.cjs` verifies Enter,
Escape, division-by-zero refusal, negative letter spacing, phone/tablet font
size isolation, and exact source undo/redo. HTML additionally verifies `normal`
line height followed by a calculated unitless multiplier. Chromium 145 passed
for HTML and React; WebKit 26 passed for Liquid. The accompanying full unit
suite passed 1,158 tests. These runs exercise local source adapters, not native
WKWebView or arbitrary remote-site source ownership.

`RT_E2E_RELATIVE_CALCULATIONS=1` verifies percentage calculations through Enter
and conversion buttons, division-by-zero/range/unit refusal, Escape, held-arrow
transaction grouping, shared relative line height, and exact undo/redo. Runs
with `RT_E2E_CONVERT_SPACING=1 RT_E2E_PANEL_TAB=1` also preserve appearance on
unchanged-value conversion, scale spacing with font size, and retain keyboard
focus across saves. HTML/React on Chromium 145 and Liquid on WebKit 26 passed;
all processes exited 0. The first runs exposed an outdated harness that did
not open Type settings; the harness now opens that disclosure through its
summary before interacting. The full unit suite again passed 1,158 tests.

`RT_E2E_SHARED_TYPE_CALCULATIONS=1` verifies shared font size, line height,
and letter spacing starting from different font sizes. It covers cancelling
mixed and uniform drafts, invalid arithmetic, one transaction for each shared
edit, tablet/phone isolation, restoration of each original size, and exact
source undo/redo. HTML and React passed on Chromium 145; Liquid passed on
WebKit 26, all with exit 0. The full unit suite passed 1,158 tests.

### Percentage entry in primary spacing fields

The primary line-height and letter-spacing fields accept percentages directly,
including `(100 + 50)%` and `(5 + 5)%`, without opening Type settings. These
use the same relative write and validation paths as the percentage controls:
line height writes a unitless multiplier; letter spacing writes em. Enter
commits one transaction, and Escape restores the original field value.
Recognized authored relative declarations now remain visible as percentages
after rebuilding the inspector. Bare numbers and calculations retain that
displayed unit; an explicit `px` value switches back to fixed spacing. Dragging
the label previews the percentage in the page; Escape restores the source and
appearance without saving.

The display recognizes literal unitless/em/% line height and em letter spacing
from Retouch CSS rules or unambiguous utility declarations, including supported
inherited breakpoint rules, only when they agree with the rendered value. It
does not guess relative intent from pixels, resolve arbitrary CSS functions,
or reinterpret rem as relative to the layer's own font size. Other declarations
keep their existing CSS/pixel display.

The interaction follows the pixel/percentage spacing support described in
[Figma's typography reference](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties).
The reference image was inspected against the light-theme inspector. This is
an interaction improvement, not a claim that the whole typography panel now
matches Figma: font-specific style discovery, source units outside the recognized forms,
and type-settings layout still differ.

Verification: the expanded typography-calculations workflow passed on the
final source for HTML/React with Chromium 145 and Liquid with WebKit 26,
including percentage range refusal, source writes, responsive isolation, and
exact undo/redo. All three processes exited 0; 1,158 unit tests passed. The
light-theme screenshot was inspected at
`/private/tmp/retouch-primary-percent.png`.

### Retaining percentage display (2026-09-13)

The typography calculation workflow additionally checks saved `150%`/`10%`
displays, bare-number calculations in the retained unit, explicit pixel
conversion and conversion back, Escape from a percentage draft, and a live
percentage scrub cancelled without a source write. The light-theme inspector
screenshot was inspected at `/private/tmp/retouch-percent-display-final.png`.
The source-unit parser separately rejects pixel/rem values, CSS functions,
unknown properties, and missing values as evidence of percentage intent.

Final-source verification passed on Chromium 145 for HTML and React and on
WebKit 26 for Liquid, all with terminal exit 0. The full unit suite passed
1,159 tests. Shared selection display and arbitrary external stylesheet
provenance remain outside this display change.

### Primary named font weights (2026-09-13)

The primary typography row pairs a named weight selector with font size.
Choices use standard CSS weights from Thin (100) through Black (900), including
Regular (400), Medium (500), Semi Bold (600), and Bold (700). Custom values stay
visible as numbers. Custom… opens Type settings and focuses the numeric field;
calculations, Enter to save, and Escape to cancel work there too. Changing the
weight preserves font family, size, and slant and uses the selected breakpoint.

These are CSS weight names, not an inventory of font files or a combined
weight/slant style picker. The selected font determines which faces or variable
weights actually render. The light-theme screenshot was inspected at
`/private/tmp/retouch-weight-style.png`.

`RT_E2E_WEIGHT_STYLE=1` verifies the primary dropdown, Custom focus without a
source write, cancellation, custom calculation, range refusal, preservation
of other typography properties, phone/tablet weights, and exact undo/redo.
HTML/React passed on Chromium 145 and Liquid passed on WebKit 26, with terminal
exit 0. The full unit suite passed 1,159 tests.

Additional Chromium runs for HTML and React combined named weights with the
existing variable-font/custom-weight workflow. Both exited 0 and retained
537.5/725.5 fractional weights, responsive isolation, reset, and exact undo.
The loaded variable-font canvas probe increased glyph alpha coverage from
336,292 to 421,076 at the heavier weight. This proves a rendered variation for
that fixture, not support for every font's named instances.

### Broader typography regression checks (2026-09-13)

After the primary weight and percentage-display changes, the HTML numeric
editing workflow passed on Chromium 145 and WebKit 26. It covers live preview,
cancel, commit, inline-style restoration, and exact undo for shadows, blur,
opacity, rotation, dimensions, spacing, borders, font size, weight, and text
spacing. The updated relative-spacing cases independently assert `151%`
displays with a `1.51` source multiplier and `13.5%` with `0.135em` source.
The initial failure was an obsolete pre-percentage-display expectation; an
added source assertion was also corrected to accept the managed rule's
`!important` suffix.

React's canonical text-override workflow passed on Chromium. The named-weight
workflow additionally proves that focused selection stays on the primary
weight dropdown after its save/rebuild. The Liquid text-style library workflow
passed on WebKit. All five final workflow processes exited 0. This pass changes
regression coverage and documentation only; production code is unchanged.

### Floating Type settings (2026-09-13)

The Type settings icon now sits beside text alignment and opens a floating
panel. It retains custom weight, relative spacing, font properties, variable
axes, number formatting, and resets. Custom… in the weight selector opens and
positions this panel before focusing the numeric input. Close and Escape from
panel controls return focus to the opener; a click elsewhere dismisses it.
Escape in an editable field retains that field's cancellation behavior.
Native selects no longer let Escape clear the canvas selection.

The panel shares the bounded positioning and resize observation used by
Stroke settings, with a sticky close header and internal scrolling. The
compact-window stacking order keeps its bottom controls above the tool dock.
The original inline disclosure's open preference is retained. Figma's
Basics/Details/Variable tab organization and preview area remain unfinished.

`RT_E2E_TYPE_SETTINGS_POPOVER=1` tests close, Escape, outside dismissal, native
select Escape, Custom focus, viewport bounds, actual scrolling, and bottom
control hit testing at 1000 x 280, all without source writes. Combined with the
named-weight workflow, it passed for HTML/React on Chromium 145 and Liquid on
WebKit 26, all with terminal exit 0. The small-window screenshot was inspected
at `/private/tmp/retouch-type-settings-small.png`. Stroke's compact-window and
border-visibility regression also passed. The final-source unit suite passed
1,159 tests.

The relative-spacing, conversion, and Tab-focus workflows passed for HTML and
React on Chromium after updating their navigation to reopen a popup dismissed
by an outside click. The full HTML-site workflow also passed, covering page
navigation/export, image previews and uploads, gradients, geometry, selection,
frames, responsive styles, and exact undo. That older harness was refreshed to
scroll lazy thumbnails into view, assert disabled invalid-color submission,
compare color channels/alpha instead of a hex serialization, and start marquee
selection clear of the rotation handles with a top-level hit test.

Action-search reveal uses the popup's immediate open method before focusing a
hidden control. The popup workflow exercises Command/Ctrl+K, Edit font weight,
and focus inside the opened panel. Visible labels now say Style, Decoration,
and Case. The normal-window screenshot was inspected at
`/private/tmp/retouch-type-settings-labels.png.regular.png`.

The final popup/action-search/named-weight runs exited 0 for HTML and React
on Chromium 145 and Liquid on WebKit 26. The final unit run passed 1,159 tests.


### Type settings categories (2026-09-13)

Type settings now groups the existing controls into Basics, Details (number
formatting), and Variable (font axes), following the category organization in
[Figma's text property reference](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties).
The existing React/Liquid font preview sits above the tabs inside the popup.
Tabs have linked tabpanels, selected state and roving keyboard focus; Left/Right,
Home and End navigate them. The selected category survives inspector rebuilds.
Custom weight and action search select the target category before focusing its
field. Tab changes never write source.

This is organization of the controls already implemented, not complete Figma
text parity. The Variable category remains available for manual axis editing
when font metadata is unknown; it is not yet conditional on detected variable
font support. HTML does not yet have the equivalent embedded type preview, and
feature-specific hover previews and the full OpenType control set remain missing.

Validation: 1,159 unit tests passed in
`/private/tmp/retouch-type-tabs-units.log`. React Chromium and Liquid WebKit
popup, category navigation, weight editing and responsive history checks passed
in `/private/tmp/retouch-type-tabs-{react,liquid}-final.log`. HTML axes, number
formatting, category navigation and exact history passed in
`/private/tmp/retouch-type-tabs-html-verified.log`; switching from another category
to Custom weight and action-search focus passed in
`/private/tmp/retouch-type-tabs-focus.log`. Regular and 1000-by-280 screenshots
were inspected at `/private/tmp/retouch-type-tabs.png.regular.png` and
`/private/tmp/retouch-type-tabs.png`. These changes are newer than the packaged
`90ab1c6` desktop candidate.

The combined React optical-sizing, variable-axis and number-formatting workflow
also passed in `/private/tmp/retouch-type-tabs-react-features-complete.log`.
The harness now explicitly opens the popup/category after outside Undo clicks,
uses the direct axis disclosure rather than matching its outer popup, and opens
that disclosure only when closed. These checks retain preview, responsive scope,
reset and exact source history assertions; the non-variable fixture does not
prove variable-font glyph rendering.


### Shared typography preview for HTML (2026-09-13)

HTML Type settings now includes the same sandboxed iframe preview as React and
Liquid. `typographyPreview` is shared through the inspector API: it copies the
selected text as text content, imports the site's stylesheet references with its
document URL as the base, and applies the selected element's computed typography.
It remains inside the floating panel above the category tabs. The HTML browser
harness now checks preview font family, optical sizing and variable-axis values
instead of excluding HTML from those assertions.

Validation: 1,159 unit tests passed in
`/private/tmp/retouch-shared-type-preview-units.log`. HTML Chromium passed optical
sizing, axis edits, scoped reset, responsive isolation, popup keyboard/focus and
exact source undo in `/private/tmp/retouch-html-type-preview.log`. Liquid WebKit
passed the same regression flow in
`/private/tmp/retouch-shared-type-preview-liquid.log`. The HTML panel screenshot
was inspected at `/private/tmp/retouch-html-type-preview.png.regular.png`.
The fixture uses a static font: computed axis propagation is verified, not a
claim of visible variable-font glyph changes. Feature-specific hover samples,
full OpenType controls and native desktop validation remain unfinished.


### Contextual number previews (2026-09-13)

The Details tab previews numerals instead of the selected text. Hovering or
focusing Number width, Number style, Fractions, Ordinals or Zero style shows a
sample suited to that control. Keyboard focus receives the same samples as the
pointer; leaving a control restores the focused control's sample or the category
default. Returning to Basics restores the selected text. The iframe retains
computed typography and font resources; only its sample text changes, without
source writes. Pending samples also survive iframe load and inspector rebuild.

HTML Chromium and Liquid WebKit browser checks cover all five focus samples,
pointer enter/leave, category restoration, source preservation, popup keyboard
behavior and compact scrolling. Both passed in
`/private/tmp/retouch-type-samples-{html,liquid}.log`; all 1,159 unit tests passed
in `/private/tmp/retouch-type-samples-units.log`. These samples demonstrate the
currently applied font settings; they do not yet preview alternative dropdown
choices before applying them or prove that the font supports every feature.
