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


### Ligatures and contextual alternates (2026-09-13)

Type settings > Details now has Common ligatures, Rare ligatures, Historical
ligatures and Contextual alternates, each with Font default / On / Off. The
controls compose independent `font-variant-ligatures` groups, retain the expanded
disclosure after edits, support scoped reset, and show letter samples on focus
or hover. HTML declarations and React/Liquid arbitrary classes use the same
validated values. The preview and saved text style property sets include
ligatures; class-style encoding and shorthand overlap guards recognize them.

CSS `none` disables all four categories. Editing one category expands the other
three into explicit disabled values so their meaning is preserved. Validation
rejects duplicate/conflicting categories, mixed global keywords and unsupported
syntax. Reference: [CSS ligature values](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-ligatures).
Font feature availability is not yet detected; these controls do not guarantee
that every font contains every requested glyph substitution.

Validation: 1,160 unit tests passed in `/private/tmp/retouch-ligatures-units.log`;
29 focused inspector/style-class tests passed after expanding the full property
encoding fixture in `/private/tmp/retouch-ligatures-models-final.log`.
HTML Chromium and Liquid WebKit browser tests passed in
`/private/tmp/retouch-ligatures-{html,liquid}.log`; React Chromium passed in
`/private/tmp/retouch-ligatures-react-final.log`. Coverage includes independent
groups, computed preview values, responsive override/fallback/reset and exact
source undo/redo; React also verifies the focused letter sample with unchanged
source. The screenshot `/private/tmp/retouch-ligatures.png` was inspected.
The initial React run lost the editor page during baseline font-family checks,
before the ligature flow, and exited 1; the completed rerun passed. This does not
establish a cause for that initial page loss or validate every font's rendering.


### Capital forms (2026-09-13)

Type settings > Details now includes Normal, Small caps, All small caps, Petite
caps, All petite caps, Unicase and Titling caps. These use `font-variant-caps`
without rewriting text or changing `text-transform`. They support HTML CSS and
React/Liquid classes, responsive scope/fallback/reset, text-style encoding,
override reset and computed typography previews. Focusing or hovering the field
shows an alphabet sample. Font and font-variant shorthand conflicts are guarded.
See [CSS capital forms](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-caps)
for the font features and browser fallback behavior; feature availability is not
yet detected per font.

Validation: 1,161 unit tests passed in `/private/tmp/retouch-caps-units.log`.
HTML/React Chromium and Liquid WebKit passed all six non-default choices,
computed preview updates, text/transform preservation, responsive fallback/reset
and exact source undo/redo in `/private/tmp/retouch-caps-{html,react,liquid}.log`.
The saved-style fixture now checks all 14 supported typography properties.
The small-caps canvas and panel screenshot at
`/private/tmp/retouch-capital-forms.png` was inspected. Computed values across all
choices do not establish that each font provides distinct glyphs for every form.
These changes have not yet been rebuilt into the desktop candidate.


### OpenType number position (2026-09-13)

Type settings > Details > Number position now offers Normal, Superscript and
Subscript through `font-variant-position`. Source adapters, text-style encoding,
preview properties, focused samples, scoped reset and override matching support
the property. Font and font-variant shorthand conflicts are guarded. This uses
OpenType glyph substitution; universal synthetic superscript/subscript fallback
is not implemented. The control explains that it uses glyphs from the font.

Validation: all 1,162 unit tests and HTML/React Chromium plus Liquid WebKit
workflows passed in `/private/tmp/retouch-font-position-units.log` and
`/private/tmp/retouch-font-position-{html,react,liquid}.log`. They check computed
source/preview values, preserved text and case, responsive fallback/reset and
exact undo/redo. Saved-style encoding now covers all 15 supported properties.

Visual inspection of `/private/tmp/retouch-font-position.png` did not establish
a visible superscript effect in Georgia. A separate native Chromium probe found
unchanged digit widths for Georgia, Arial, Times New Roman and the fixture Geist,
despite accepted computed values. Loading the local SF Compact font (whose GSUB
table has sups/subs) changed `123` from 47.234375px to 23.828125px for both variants;
assertions passed in `/private/tmp/retouch-position-native-rendering.log`.
No system font was copied into the repository or distribution. This proves that
the browser mechanism can render available glyphs, not automatic fallback or
full text-position parity for arbitrary fonts. Reference:
[CSS font position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-position).
The desktop candidate has not been rebuilt with this change.


### Selected-range rich text and script formatting (2026-09-13)

Inline text editing now shows a toolbar for bold, italic, superscript and
subscript. Pointer interaction preserves the iframe text selection. Superscript
and subscript create semantic `sup`/`sub` wrappers using the constrained rich-text
source tree, so ordinary browser styling can render them even when a font lacks
OpenType script glyphs. Buttons require a nonempty selection inside the edited
layer. The toolbar is removed when the edit commits or the frame reloads and sits
above the tool dock/status toast. Text is saved through the existing Enter or
click-away commit path.

New, simple script wrappers can switch between superscript/subscript or toggle
off for a partial text range without changing the surrounding characters.
Switching nested or source-preserved script wrappers remains refused; full rich
text normalization is unfinished. Author CSS can override native sup/sub styling.

HTML now supports structured `setChildren` through the shared rich-text source
writer. Nested elements retain raw source markup through kept-node identities;
foreign IDs and invalid wrappers are rejected. The planner checks the edited
root's closing boundary and unchanged parsed elements outside its subtree before
allowing the structural transaction. This also enables inline bold/italic on
supported HTML regions, beyond the old plain-text-only adapter.

A React failure revealed that the old immediate structural reload could serve a
stale compiled revision after a successful source write. The diagnostic contained
saved `H<sup>ead</sup>line` but rendered `Headline` with the pre-edit revision.
Structural text commits now follow the reload with compiled-revision and formatted
content verification through `refreshWrittenElement`. This retains the existing
structural-reload boundary; it is not a universal no-navigation guarantee.

Validation: 1,164 unit tests passed in
`/private/tmp/retouch-inline-format-units-complete.log`. HTML/React Chromium and
Liquid WebKit formatting, actual smaller font size, switching, text preservation,
cleanup and exact undo/redo passed in
`/private/tmp/retouch-inline-script-{html,react,liquid}-settled.log`. Partial-range
switching/toggling passed in `/private/tmp/retouch-inline-script-partial.log`.
Liquid translation/setting JSON, nested attributes, dynamic placeholders and
exact undo passed in `/private/tmp/retouch-inline-format-liquid-rich-final.log`.
The full HTML editing regression passed in
`/private/tmp/retouch-inline-format-html-site.log` before the additional structural
revision wait; the final targeted HTML flow covers that wait. The final toolbar
and rendered subscript screenshot was inspected at
`/private/tmp/retouch-inline-format-toolbar-final.png`. Desktop packaging has not
yet been rebuilt with these changes.

### Reopen saved script formatting (2026-09-13)

Simple saved `sup`/`sub` wrappers can now be reopened, partially switched, or
partially toggled off. Splitting creates fresh formatting nodes instead of
copying the saved wrapper's source identity onto multiple nodes. Known renderer
location/revision metadata is accepted, including Liquid context stamps.
Authored attributes, component-instance identities, dynamic binding metadata,
and nested child structures still prevent this operation; support for editing
those structures without losing their semantics remains unfinished.

A React reopen test exposed a second structural-refresh race: the source request
had completed but the new document was still mounting. Structural inline commits
now retain the editor's busy state through the reload and compiled-content check,
with cleanup in `finally`. Subsequent editing waits for that operation to finish.

Validation: 1,164 unit tests passed in
`/private/tmp/retouch-saved-script-units-final.log`. HTML and React Chromium
145.0.7632.6 and Liquid WebKit 26.0 workflows all exited successfully in
`/private/tmp/retouch-saved-script-{html,react,liquid}-verified.log`.
`RT_E2E_SAVED_SCRIPT=1` covers save/reopen, partial switching, toggle off,
unchanged surrounding text, and exact source undo/redo. It also injects authored
class, component-instance, and dynamic-binding metadata into the rendered wrapper
to verify that refused changes leave its DOM and source unchanged. These checks
do not establish full component or dynamic-rich-text editing parity.
Desktop packaging has not been rebuilt with this change.

### Partial bold and italic toggles (2026-09-13)

Bold and italic now share the script formatter's range-splitting path. Turning
off formatting for a character inside a simple wrapper preserves the formatted
text on either side, both before saving and after reopening. The previous path
unwrapped the entire unstamped element or added another wrapper around saved
formatting. Toolbar and Cmd/Ctrl+B/I use the same operation; `b`/`i` aliases are
recognized as bold/italic when deciding whether to toggle off.

The source-preservation guard also applies to emphasis: nested children or
meaningful attributes cannot be discarded to perform a toggle. Fully general
mixed-range normalization, nested styling, and attributed-wrapper editing remain
unfinished. This is not complete Figma text-editing parity.

The `RT_E2E_SAVED_EMPHASIS=1` browser workflow exercises partial unsaved toggles,
reapplying the selected character, saving, reopening, keyboard toggles, unchanged
surrounding text, and exact undo/redo. Combined runs also exercise
`RT_E2E_SAVED_SCRIPT=1` to check superscript/subscript switching and preservation
of authored metadata. Validation logs are
`/private/tmp/retouch-saved-emphasis-{html,react,liquid}.log`; unit validation is
`/private/tmp/retouch-saved-emphasis-units.log` (1,164 passing tests).
Desktop packaging has not been rebuilt with this change.

### Nested plain formatting ranges (2026-09-13)

Partial toggles now reconstruct the selected text interval through a tree of
plain formatting nodes. Removing bold from part of a bold-and-italic range
retains italic on that text, and removing italic retains bold. The two unselected
intervals keep their original formatting. Fresh nodes do not duplicate source
identities. Script switching uses the same slicing path and retains nested
emphasis. The selected result stays selected for subsequent toolbar operations.

React descriptors now expose `plainFormattingIds`, derived from JSX syntax.
Only attribute-free formatting trees containing literal JSX text are eligible;
expressions, component calls, and authored attributes are excluded. The shell
requires this evidence before reconstructing a stamped React wrapper. DOM text
alone is insufficient because it could be the rendered value of a binding.
HTML rich-text descriptors and Liquid binding metadata retain their existing
preservation boundaries. Dynamic rich-text editing, arbitrary attributed nodes,
and general normalization across independent wrappers remain incomplete.
Removing semantic markup also does not override bold/italic inherited from a
layer's CSS; a full range-level style model remains necessary for Figma parity.

`RT_E2E_NESTED_EMPHASIS=1` exercises saved nested ranges in both nesting orders,
independent partial removal, reopen, unchanged surrounding text, and exact source
undo/redo. Combined browser runs include saved emphasis, saved scripts, and
immediate script switching with smaller rendered glyphs. Logs:
`/private/tmp/retouch-nested-final-{html,react,liquid}.log`.
The unit suite passed 1,165 tests in
`/private/tmp/retouch-nested-emphasis-units.log`, including source-identity
exclusions for expressions, attributes, and components. Desktop packaging has
not been rebuilt with this change.

### Explicit weight and style on text ranges (2026-09-13)

The selected-text toolbar now includes Regular/Bold weight and Upright/Italic
style fields. These apply explicit local styles to the selected text, including
when the parent layer supplies bold or italic. Each selected text leaf receives
an override, so a selection spanning differently styled children becomes uniform
without changing the parent or its unselected text. Toolbar fields reflect known
computed values for the selection; mixed or other values show the field label.
The existing semantic formatting buttons and shortcuts remain available.

The constrained rich-text tree now accepts `style` nodes with `font-weight`
(`400`, `700`) or `font-style` (`normal`, `italic`). Other properties and values,
including inherited object keys and CSS injection strings, are rejected. Shared
HTML/Liquid output uses a literal style attribute; React emits a literal style
object. Existing source-owned ancestors retain their attributes and identities.
Serialization recognizes mounted range styles for compiled-content verification.
React also recognizes literal text nested entirely in host wrappers as mixed text,
so a fully wrapped layer can reopen for editing.

Validation: 1,168 unit tests passed in
`/private/tmp/retouch-range-styles-units.log`; additional invalid-key validation
passed in `/private/tmp/retouch-range-style-validation.log`. HTML/React Chromium
and Liquid WebKit range-style workflows exited successfully in
`/private/tmp/retouch-range-styles-{html,react,liquid}.log`. They verify computed
regular weight under a bold parent, italic then upright, an existing child weight
overridden across a whole mixed range, save/reopen, unchanged parent weight and
text, and exact source undo/redo. The light toolbar was visually inspected at
`/private/tmp/retouch-range-styles.png`.

This is an initial range-style model, not complete Figma typography parity.
Arbitrary weights, fonts, sizes, colors, text decorations, and source-aware
normalization of repeated saved style wrappers remain outstanding. Repeated
nesting still obeys the shared depth limit, and author `!important` declarations
on the styled child can take precedence. The inspector remains layer-oriented;
the toolbar handles the selected text. Desktop packaging has not been rebuilt.

Nested emphasis, saved script formatting, and immediate script switching also
passed on HTML/React Chromium and Liquid WebKit after the range-style change:
`/private/tmp/retouch-range-style-regression-{html,react,liquid}.log`.

### Reuse plain saved range overrides (2026-09-13)

A complete plain text run with an existing override for the same property can
now update that wrapper. The serializer replaces only a source-approved range
wrapper, keeping its text, instead of adding another span. A new shared source
proof recognizes exactly one literal allowed style on a plain-text span. JSX
bindings, spread/additional attributes, extra CSS declarations, nested contents,
and Liquid expressions are excluded from reuse. Other structures continue
through the existing preservation path.

Clicking a recognized text-run wrapper re-enters its parent text layer when the
parent belongs to the same unchanged source file and there is no component
instance boundary. This allows repeated direct text clicks to retain the parent
editing context. Parent resolution is guarded against a newer selection.

`RT_E2E_REPEATED_RANGES=1` performs ten saved weight changes on the same word,
reopening by clicking the text run each time. It asserts one rendered span and
one source span after every save, actual computed weight, unchanged text, and
exact undo/redo of every snapshot. Combined runs include the original range-style
workflow. Logs: `/private/tmp/retouch-repeated-ranges-{html,react,liquid}.log`.
The unit suite passed 1,172 tests in
`/private/tmp/retouch-repeated-ranges-units.log`, including proof exclusions and
serialization that distinguishes untouched source nodes from approved updates.

Reuse currently requires a complete plain-text span for the same style property.
Partial selections, differently nested properties, attributed spans, and rich
text stored through indirect bindings still need broader normalization support.
Desktop packaging has not been rebuilt with this change.

### Split and merge plain range overrides (2026-09-13)

Partial selections inside a source-approved plain style span now split into
before, selected, and after runs. The unselected text retains the old style;
the selected run receives the chosen value without another nesting level.
Equivalent plain neighbors touching an edited run merge back together. This
uses the same source evidence as complete-run reuse and does not merge across
attributes, bindings, separating text, or nested structures.

Splitting and merging replace DOM node identities, so the selected range is
restored from its text offsets inside the edited layer. Changing a middle run
back to match its neighbors therefore retains the original character selection,
even though the result has become one span again.

Validation: `RT_E2E_PARTIAL_RANGES=1` passed on HTML/React Chromium and Liquid
WebKit in `/private/tmp/retouch-partial-ranges-{html,react,liquid}.log`. Checks cover
saved partial splits, computed outer/inner weights, no nested spans, neighbor
merging, retained selection, resplitting after reopening, and exact undo/redo.
The same runs passed the existing explicit range-style workflow, including
mixed ranges and inherited styles. All 1,172 unit tests passed in
`/private/tmp/retouch-partial-ranges-units.log`.

Broader normalization across different properties, nested or attributed runs,
and indirectly stored rich text remains unfinished. Desktop packaging has not
been rebuilt with this change.

### Font size for selected text (2026-09-13)

The selected-text toolbar now has a pixel-size field. It accepts 0.1–1000 px
with up to three decimal places. Enter applies and saves the value; Escape
cancels the field draft and returns focus to the text. Invalid values leave
both source and preview unchanged. Moving between text and toolbar controls
retains the edit; leaving that editing area saves through the existing source
transaction. This fixes a focus-transfer bug exposed by the new numeric field.

A shared range-style validator now serves the toolbar, serializer, source proof,
and HTML/Liquid/React writers. `font-size` uses the same source-approved reuse,
partial splitting, and neighbor merging as weight/style. The selected text can
change size while its parent and unselected text retain their original size.
The serializer also recognizes mounted pixel-size wrappers for refresh checks.

`RT_E2E_RANGE_SIZE=1` covers decimal rendering, Enter and blur saves, Escape and
invalid-value preservation, toolbar focus retention, saved wrapper reuse,
partial split/merge, unchanged parent size/text, and exact source undo/redo.
Final browser logs are `/private/tmp/retouch-range-size-final-{html,react,liquid}.log`.
The combined runs also cover explicit range styles, partial style normalization,
and nested bold/italic. The final light-theme toolbar and selected text were
visually inspected at `/private/tmp/retouch-range-size-final.png`.
All 1,175 unit tests passed in `/private/tmp/retouch-range-size-units-final.log`.

Relative units, expressions, per-screen range-size overrides, and general
attributed/nested range normalization remain unfinished. Range styles currently
apply across screen sizes. The latest desktop archive still contains `c25f59a`;
this font-size change has not been packaged or verified in the native app.

### Solid color for selected text (2026-09-13)

The range toolbar now includes a color field and swatch. It accepts hex (with
or without `#`), RGB/rgba, explicit sRGB, and Display P3, including alpha. Enter
saves the range color; Escape and invalid input preserve the existing edit.
The selected word changes independently of its parent text layer. Approved
plain color runs reuse, split, and merge through the shared range-style path.

Solid-color parsing is shared with the palette editor. Source writes retain
an authored color token when its browser style still matches, while rendered
refresh comparisons use CSSOM values. This matters because WebKit and Chromium
report different rounded alpha values for the same hex color. Reopening and
splitting `#11223380` preserves that exact source alpha, including the unselected
runs. Neighbor merging does not conflate distinct authored color values merely
because their reported browser values round to the same result.

Combined checks also exposed a deferred blur race after Escape: focus had already
returned to the text when the scheduled blur handler ran. The handler now keeps
that edit active instead of removing its toolbar.

Validation: 1,179 unit tests passed in
`/private/tmp/retouch-range-color-units-final.log`. The standalone CSS paint
regression passed for HTML/React Chromium and Liquid WebKit in
`/private/tmp/retouch-range-color-fixed-{html,react,liquid}.log`. That harness path
returns early; it does not count as text-range validation. Separate combined
color/size/style logs are
`/private/tmp/retouch-range-color-verified-{html,react,liquid}.log`.
`RT_E2E_RANGE_COLOR=1` verifies cancel/invalid preservation, rendered channels,
exact authored alpha on reopen, Display P3, wrapper reuse, partial split/merge,
unchanged parent color/text, and exact source undo/redo. The final light toolbar
was inspected at `/private/tmp/retouch-range-color-verified.png`.

Range color now exposes the solid paint picker (see below). Shared color-style
links, variables, multiple text fills, and per-screen range overrides remain incomplete. General
nested/attributed range normalization remains incomplete. The latest desktop
archive predates the range-size and range-color changes.


### Selected-text visual color picker (2026-09-13)

The selected-text toolbar swatch opens the existing light solid-color picker,
including its color plane, hue, alpha, CSS/hex/RGB controls, and color profiles.
The picker previews just the selected text without writing source. Apply restores
the preview first, then saves through the range-style writer as one history step.
Cancel, Escape, and closing the picker restore the selection and original nodes,
including source-owned metadata on existing styled spans. Selections crossing
several text nodes use the same preview transaction. Opaque source-owned text
is rejected before preview begins.

Focus guards retain the text-edit session through the native dialog's deferred
close event. A changed editing document or unexpected DOM mutation invalidates
the draft, avoiding a stale range write. Range color currently applies across
screen sizes; the picker explicitly labels that scope instead of inheriting the
inspector's breakpoint message. Opening the swatch uses the selected text's color
and clears an invalid typed draft.

Validation: 1,179 unit tests passed in
`/private/tmp/retouch-range-picker-units-verified.log`. Color and size browser
checks passed in `/private/tmp/retouch-range-picker-final-{html,react,liquid}.log`
(HTML/React Chromium 145; Liquid WebKit 26.0). The color checks cover live preview,
Cancel/Escape, selection restoration, original node identity across mixed runs,
Apply with exact hex alpha, reopening saved colors, Display P3, partial split and
merge, and exact source undo/redo. The light picker screenshot is
`/private/tmp/retouch-range-picker-final.png`.

This is a web-shell change. The last desktop archive still predates range size,
range color, and this picker integration; native execution and release evidence
must be refreshed for a new bundle.


### Selected-text named and custom weights (2026-09-13)

The range weight menu now includes Thin through Black (100–900), plus Custom.
Custom reveals a numeric field beside the menu and accepts 1–1000 with up to
three decimal places. These bounds follow
[CSS Fonts Level 4](https://www.w3.org/TR/css-fonts-4/#font-weight-prop).
Enter saves; Escape cancels the field draft. Invalid values leave source intact.
Reopening a nonstandard weight selects Custom and shows its saved value.
The shared validator also enables source-proven wrapper reuse and partial-run
splitting for these weights in HTML, React, and Liquid. The available font still
determines which glyph weights can actually render; this control does not install
missing font faces or infer a custom variable-font axis range.

Validation: 1,180 unit tests passed (`/private/tmp/retouch-range-weights-units.log`).
Combined range-style and color-picker checks passed on HTML/React Chromium 145
and Liquid WebKit 26.0 (`/private/tmp/retouch-range-weights-final-*.log`), covering
all named weights, fractional 537.25, invalid bounds, Cancel, reopening,
partial splits, mixed ranges, and exact source undo/redo. Additional loaded Geist
variable-font checks passed on HTML Chromium and Liquid WebKit
(`/private/tmp/retouch-range-weights-variable-*.log`): the selected run width
changed from about 53.09px at 100 to 60.68px at 900. A custom-weight toolbar capture
is `/private/tmp/retouch-range-weights.png`; its run log is
`/private/tmp/retouch-range-weights-visual.log`.

Range font-family selection, general nested-style normalization, arbitrary font
axes, and responsive range typography remain incomplete. The current desktop
archive does not yet contain this web-shell change.
