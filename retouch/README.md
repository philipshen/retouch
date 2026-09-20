# Retouch

Install once, run your existing dev command, and edit your app at `/rt`.
Edits are written to local source deterministically.

```sh
retouch -- npm run dev
retouch -- make everything
retouch -- pnpm turbo dev
retouch -- ./scripts/start-local.sh
```

Everything after `--` is an executable and its arguments. Retouch preserves
working directory, environment, stdio, and exit status. To use shell syntax:

```sh
retouch -- sh -c 'prepare-assets && npm run dev'
```

## Install from this checkout

```sh
cd retouch
node scripts/release.cjs /tmp/retouch-release
npm install --global /tmp/retouch-release/retouch-0.1.0.tgz
retouch --version
```

No Retouch dependency or config change is required in the target application.
The target still needs its normal dependencies, runtime, environment, and
services. Node 22 or later is required for Retouch. macOS and Linux command
wrapping are supported; Windows process-tree management is not implemented.

Homebrew distribution is prepared through `scripts/homebrew-formula.cjs`.
An owned, published tap is not yet available. See `docs/cli.md` in the source
repository for release and integration details.

## What connects automatically

Local **Next.js 16.2.x**, verified on **16.2.5** with both Turbopack and webpack,
using the existing React adapter for `.jsx` and `.tsx` source.
The preload wraps Next's evaluated development configuration; the project's
installed Next version and its normal startup command remain in charge.
Existing loaders and configuration are composed, not replaced. Unsupported
rule shapes, base paths, asset prefixes, and explicit `/rt` conflicts fail
with a diagnostic. Other Next versions require config mode until verified.

The startup wrapper can run any executable. Automatic instrumentation is
limited to supported build integrations. Vite, Vue, Svelte, and arbitrary
already-running websites are not automatically instrumented.

```sh
retouch doctor ./apps/website
```

In a monorepo, each Next app under the wrapper's working directory registers
its own writer, token, and dynamically allocated sidecar port. Unrelated
services continue normally. Stop the wrapper to stop its process group and
release its writers. Commands that deliberately daemonize or remove inherited
environment variables are outside that process-tree contract.

`NODE_OPTIONS` and `RETOUCH_SESSION_*` must reach the Node build processes.
Turbo environment filtering may require `globalPassThroughEnv` entries for
`NODE_OPTIONS` and `RETOUCH_SESSION_*` (or an appropriate local loose-env
invocation). Do not put the per-session values into committed configuration.

For Docker, sudo, remote hosts, or dev containers, install and run Retouch
**inside the environment that owns the source and dev server**. The host's
loopback session URL and absolute preload path do not automatically work there.
Do not expose the writer or registration service on a public interface.

## Vite React projects

Vite React projects can opt in with a locally installed Retouch package and an
explicit plugin. This integration has been verified with Vite 8.3.0 and React 19.2.0:

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { retouch } from 'retouch/vite';

export default defineConfig({
  plugins: [retouch(), react()],
  server: { host: '127.0.0.1' },
});
```

Run your normal Vite dev command, then open `/rt` on its port. Use a localhost
or 127.0.0.1 host. A public base such as `/docs/` opens `/rt/docs/` and loads the
app at `/docs/`; query strings, fragments and deeper app routes are preserved.
The `/rt/` namespace is reserved for the editor. The plugin stamps project `.jsx`
and `.tsx` modules during development without saving instrumentation to source.
It serves the editor and authenticated source API on the Vite origin and closes
its writer when Vite shuts down. Production builds exclude the plugin.

The browser fixture verifies text editing, exact source undo, and React state
and document retention through hot updates. SSR editing and universal
hot-update retention are not covered. Vue and initial Svelte support are described below.
Image uploads use Vite's configured public directory and base URL. Generated
upload URLs are served immediately, before Vite's file watcher catches up.
With `publicDir: false`, uploading is unavailable; directories outside the source
project cannot receive uploads. The runtime compiler requires Vite 8.

## Vite Vue projects (initial support)

Vue projects can use the same explicit integration:

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { retouch } from 'retouch/vite';

export default defineConfig({
  plugins: [retouch({ adapter: 'vue' }), vue()],
  server: { host: '127.0.0.1' },
});
```

With `@vitejs/plugin-vue` present, `retouch()` also selects Vue automatically.
Retouch uses the Vue plugin's template compiler options for source mapping.
The Vue adapter supports literal text, literal image sources, text-layer tag
changes, layer names, link destinations, and responsive CSS in `.vue` files.
The Link inspector edits or removes literal anchor destinations while preserving
nested content and event handlers. Vue-bound destinations remain read-only.
Static native text supports in-place rich formatting and text links. The compiler
and browser must agree on its structure; Vue expressions, directives and component
children require further preservation support. Existing
responsive text-run styles survive formatting; deleting a run removes its owned
rules. Splitting a run with responsive style ownership remains unavailable.
Vue text editing uses temporary child nodes and
restores the framework-owned nodes before writing, allowing HMR to retain preview
documents and application state for the verified static-text flows. Layout, appearance and
typography controls support individual layers and selections within one SFC.
Add text and Add frame work inside native content containers, including
self-closing containers. The canvas Text tool supports click placement and dragged
text boxes, then selects the new text for immediate typing.
Duplicate and Delete also support selections of up to 100 source layers in one
SFC, including roots in different containers, as one atomic undo step. Selecting
a parent and its descendant processes that subtree once. Copies retain independent
responsive styles; a refused root prevents the entire batch from writing.
Multi-layer ordering also supports earlier/later and first/last placement within
one native source parent, preserving the selected roots' relative order. Move into
and tree drag/drop also move selections into a compatible container as one undo
step; all selected roots must share the destination's template scope. Frame and
Group wrap consecutive native sibling layers; Group uses display:contents to
retain their participation in the parent layout. Remove frame/Ungroup releases
the children and removes only the wrapper's owned responsive styles.
Native sibling actions include duplicate, copy/paste, delete, and moving layers
earlier/later or to either end. Copies receive independent responsive styles;
deleting a subtree removes its owned styles. Exact undo restores source bytes.
Structural edits across control-flow, component-sibling, comment or mixed-text
boundaries remain unavailable. Copies containing IDs, refs, keys or unknown bound
attributes need separate identity handling. Move into and layer-tree drag/drop
support native containers
in the same SFC and the same loop, slot and v-pre scope. The destination picker
filters out incompatible source containers; crossing these scopes remains unsupported. Containers using v-html or v-text cannot receive
new children.
Retouch stores styles in a dedicated block while preserving authored script/style
blocks and template expressions. During development, a stable CSS module lets Vite
update styles independently without resetting component state; authored styles
remain in production builds. Saved text, color and effect styles support application
to one layer or same-file selections, breakpoint inheritance, local overrides,
reset and detach. Shared style updates include unvisited Vue files and the catalog in
one undo step. The Vite integration tracks each component's source revision so
simultaneous template/style updates retain state; script changes still use Vue's
normal component reload. `retouch()` returns a Vite plugin array, accepted in the
same `plugins: [retouch(), vue()]` configuration.
Collection variables support typed property bindings, aliases, per-binding modes,
responsive inheritance, local overrides, and same-file selections. Collection
edits propagate through linked Vue files and undo restores the catalog and source
while waiting for both template and stylesheet revisions. Inspector refreshes
preserve uncommitted variable/mode/unit choices for the same source and scope.
Computed inline styles, other structural operations,
component-property edits, external templates, template
preprocessors and SSR editing remain incomplete.
Broad or dynamically named bindings that can replace source markers are not
editable yet. Repeated template elements share their authored source identity.

The browser fixture verifies repeated text edits, literal interpolation syntax,
exact undo, compiler-normalized whitespace, retained preview documents and live
Vue state, base paths, immediate image uploads, responsive padding and typography,
same-SFC selection styling, comparison screens, sibling ordering and lock remapping,
duplicate/delete/copy/paste, batch duplicate/delete across containers, independent
styles and exact history, multi-layer ordering, frame/group/release, keyboard
shortcuts with input-field guards, moving between containers through the picker
and tree drag/drop, text/frame insertion, canvas text placement and
dragged text boxes with immediate typing and undo, and production style retention with transient
instrumentation excluded. Tested with Vite 8.3.0, Vue 3.5.42 and
`@vitejs/plugin-vue` 6.0.9 in Chromium and WebKit. This does not establish compatibility with every Vue setup.

## Vite Svelte projects (initial support)

Svelte 5 projects can enable Retouch before the Svelte Vite plugin:

```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { retouch } from 'retouch/vite';

export default defineConfig({
  plugins: [retouch({ adapter: 'svelte' }), svelte()],
});
```

Run the normal development command and open `/rt` on the same loopback port.
With only the Svelte plugin present, `retouch()` detects it automatically. Mixed
Vue/Svelte projects require an explicit adapter choice.

This initial integration maps native source layers through conditional branches,
loops, snippets, and slots. Literal text, layer names, literal link destinations,
and literal image sources write back to `.svelte` files with exact source undo.
Expressions, raw HTML, text bindings, marker-conflicting spreads, and responsive
image bindings remain protected. Layout, appearance, and typography controls write
responsive CSS into the component's existing stylesheet (or create one when
absent). Single and multiple selections support base styles, minimum-width
overrides, screen-scope reset, and exact undo/redo. Computed inline styles,
important inline conflicts, ambiguous style identities, and non-CSS preprocessors
are refused. Saved typography, color, and effect styles support applying,
inheriting at another screen scope, local overrides, reset, detach, and
multi-selection. Updating a library style also updates linked layers in unvisited
Svelte components, with catalog and source changes in one undo transaction.
Shared collection variables support aliases, numeric units, responsive mode
bindings, local overrides, reset, detach, and removal. Collection updates include
unvisited Svelte components and restore catalog and source together through undo.
Literal Svelte images expose responsive candidate URL, density/width, media,
sizes and format controls, including candidate addition/removal and exact history.
Picture sources must be explicit native children with literal responsive attributes;
bindings and generated picture children remain protected. Existing pictures support
adding, reordering and removing sources with exact history. Creating a picture
wrapper around a plain image still needs stylesheet adaptation; deleting a source
with its own managed responsive styles is also unavailable.

Native text containers support inline formatting and literal edits around protected
live expressions, preserving authored events and bound link destinations. Styled
runs can be split with independent responsive style ownership. Native sibling
layers support reorder, duplicate, delete, and copy/paste within the same source
parent, with independent copied styles and exact history. Multi-selection supports
duplicate/delete across native parents in one component, reorder within one
parent, and moving selected roots into another compatible container. Each action
is one source transaction and undo step; invalid roots refuse the whole edit.
Operations across mixed
text, control-flow or component siblings remain unavailable; copies containing
IDs, refs, spread attributes or computed style identities are refused. Content
containers support new text and frame layers, including expanding empty tags,
click-to-place text and dragged text boxes. Containers with bound generated
content refuse insertion. Layers can move between native containers in the same
component and lexical scope using Move into or layer-tree drag. Moves across
loop, branch, declaration, slot or namespace boundaries are refused. Consecutive
native siblings can be grouped or framed; ungrouping preserves child styles and
removes only wrapper styles. Groups use `display: contents`; arbitrary authored
CSS selector behavior after adding a wrapper remains unverified. Wrappers with
bindings, directives or local declarations cannot be removed.

Direct imports of project `.svelte` components expose component instances in the
canvas, Layers and component library. Relative imports and project TypeScript/
JavaScript path aliases are supported when the bundler uses matching mappings.
Property and shared-default review revisions include alias resolution; source
transactions also guard the relevant config and preferred fallback paths. Existing literal string,
number and boolean properties can be edited in the inspector with exact
undo/redo. Select several usages in one source file to edit shared properties,
or copy properties and choose which compatible values to paste. These batches
validate every selected value before saving and use one undo step. Literal defaults
from rune destructuring or legacy `export let` declarations appear as inherited
values. Reset removes an override; editing an inherited value creates one. Shared
property reset is supported, with definition revision checks and exact history.
Reset properties removes all supported default overrides on an instance or the
selected usages in one step; already-inherited usages are left unchanged. Property updates preserve mounted child state and synchronize open
screen previews. Native root markers are forwarded without additional DOM
wrappers. Native roots can be grouped as an instance, including conditional branches
that share a root present in every branch. Repeated usages retain separate
instance groups even when they render different branches. Component definitions
with repeating roots, unaccounted root text/output or no common branch anchor
remain individual selection targets. Supported local TypeScript contracts provide
choice controls and optional properties that can be set or unset.

Use Layers to duplicate, delete, reorder or move linked usages into compatible
native containers. Multi-selection uses one undo step. Container moves preserve
Svelte lexical scopes and runtime branches. Supported surviving rune state stays
with its instance; new copies initialize independently. Deleted instances restored
by undo initialize fresh.

The Components panel also discovers unused definitions with identifiable native
roots. Select a frame and choose Insert into frame to create a linked usage.
Required supported primitive properties have initial-value controls; optional
properties keep their defaults. Insertion and swapping reuse accessible relative
or aliased runtime imports, keeping the existing script unchanged. Type-only or
shadowed imports receive a fresh local name. Exact undo/redo and synchronized
previews apply to either path. Project
component dependencies are checked for cycles and fixed DOM IDs. Nested imports
ending in `.svelte` can use project `tsconfig.json` / `jsconfig.json` path mappings,
including relative config inheritance and ordered fallback paths. The app bundler
must resolve those aliases to the same files. Changes to config, resolved sources,
or previously missing preferred paths invalidate the pending source transaction.
Aliases defined only by executable bundler config, symlinked/external definitions,
unsupported required contracts, dynamic roots and spread-controlled properties
remain outside this insertion workflow.
For literal usages without authored child content, Swap selected instance keeps
compatible overrides and lists the overrides that will be removed. Supply any
new required properties before applying. The replacement initializes fresh;
unaffected instances and supported parent state remain retained. Undo restores
the exact source, with the restored instance initialized anew. Bound properties,
spreads, directives and child content must be preserved before such a swap.
Detach instance creates an independent sibling Svelte module and preserves the
usage's properties, bindings and child content. Managed responsive styles receive
independent identities; relative imports and assets retain their paths. The shared
definition is unchanged, and undo/redo restores both files exactly. Undo refuses
to delete a detached module referenced by another source file. Detachment applies
to the authored usage, including all of its repeated runtime occurrences. The
detached instance and an instance restored by undo initialize fresh; supported
parent and unaffected instance state remain retained. Nested component imports
stay shared.

Use Default… beside a property to edit its shared literal default. Rune `$props()`
destructuring and legacy `export let` defaults support strings, finite numbers and
booleans, with supported local TypeScript choices enforced. All inheriting usages
update; explicit overrides stay unchanged. The definition edit is one undo step,
and comparison previews synchronize. Exact editor default changes preserve supported
synchronous rune state in each surviving instance and nested component, including
through undo/redo. Ordinary runtime mounts and external script edits still initialize
fresh; legacy local state and asynchronous rune initialization are not covered. Computed defaults,
`$bindable` defaults and unsupported declared types are not editable here.
Variants and broader component authoring remain unfinished.

Simple literal text, managed styles, style links, and variable bindings use development-only Svelte store
bindings and an independent stylesheet so the component stays mounted, including
through undo/redo. New conditional instances read the current text and styles.
The inline editor temporarily edits cloned child nodes and restores Svelte's
original nodes before the source update. Rich-text and layer changes use ordinary Svelte
HMR with per-instance retention of synchronous top-level `$state`/`$state.raw`
variables, including signal values, object/array proxies and compiler-elided
direct values, provided the script is unchanged. A committed component insertion
can also preserve parent state across its proved import-only script addition or
removal. New mounts, other script edits, and same-source dependency reloads initialize fresh
state. This does not guarantee retention for async initializers, nested/class
state, external stores, effects, or arbitrary component lifecycle behavior. Production builds retain the saved
styles and their literal ownership attributes, while omitting development source
markers and the live-update runtime. SvelteKit SSR/hydration, custom preprocessing,
and other Svelte compiler versions remain unverified.

Live updates carry ordered versions. Preview verification and returning to a
backgrounded page request fresh snapshots, so a missed or delayed text/style
message can recover without remounting. Old broadcasts and stale module
initialization cannot roll the preview back. Snapshots are limited to components
already served by this Vite instance. Vite itself reloads the page after an actual
websocket disconnect or server restart; state retention through those events is
not provided by this integration.

Verified with Vite 8.3.0, Svelte 5.57.1, and `@sveltejs/vite-plugin-svelte` 7.3.0.

## Explicit config mode

The existing `withRetouch` export remains available for locally installed,
project-pinned use. When running through the automatic wrapper, that existing
wrapper defers to session registration, avoiding a second sidecar.

An explicit session hook is also available for environments that load their
own configuration bridge:

```js
import { withRetouchSession } from 'retouch/next';
export default async () => withRetouchSession(nextConfig, { appRoot: process.cwd() });
```

Run that configuration with `RETOUCH_AUTO_NEXT=0 retouch -- <startup command>`
to disable private-API interception. This mode requires that the hook import be
resolvable (a project dependency or an explicit installation path). It returns
the original config when no session is active or in production. It still needs
the session environment and network reachability; it is not a container bridge.

## Shopify

```sh
retouch shopify /path/to/theme
```

This existing integration uses Shopify CLI and an isolated development theme,
with a stamped temporary copy and writes to the original local source. It
requires authenticated Shopify CLI access. The generic command wrapper does
not automatically intercept arbitrary Shopify startup scripts.

Liquid text edits can follow locale keys, block/section/theme settings, literal
assignments and aliases, captures, and snippet arguments to their stored source.
The inspector shows the destination file/key and identifies shared translations.
Nested block instances keep separate text sources even when they use one snippet.
Stored richtext HTML and translation templates are editable in the inspector;
plain stored strings can also be edited inline. Expressions without a unique local
source remain read-only. Run the theme's CSS watcher for new Tailwind classes.

## Design inspector

The right inspector includes explicit positioning and anchors, Alt/Option-hover
padding and spacing measurements, image browsing/uploads, typography classes and
font previews, fill/text colors, shadows, and opacity. Local React components
have a live preview and props panel, shared-definition editing, and module
detachment with exact undo. The screen toolbar previews phone, tablet, desktop or custom dimensions, with
rotation and remembered sizing. Pinch zoom preserves the selected screen
viewport. Choose base or breakpoint style scope in the inspector to preserve other screen
sizes while editing. Reset overrides restores inheritance. Named breakpoints are
discovered from loaded CSS; text and image content remain shared across sizes. See the
[inspector guide](https://github.com/philipshen/retouch/blob/main/docs/inspector.md)
for supported source patterns and browser verification.

### Local HTML documents

```sh
retouch html ./my-web-directory --port=9400
```

Open `http://localhost:9400/rt`. Use the **Page** picker to switch between HTML
documents, and its refresh button to discover newly added files. The **Page URL**
field also accepts a route directly. Undo and Redo return to the page where the
edit was made. Select and edit literal HTML text, supported HTML
tags and plain image paths. Existing CSS and scripts are served as authored;
saved changes reload the preview, and undo/redo restores source snapshots.
Choose a trusted local web directory. Hidden files, package manifests and paths
outside that directory are not served.

The **Appearance** section sets opacity in percent and rotation in degrees.
Both follow the selected screen scope and support reset. Rotation combines with
existing transform rules rather than replacing them.

**Appearance** also offers blend modes and a blend-group isolation control.
The **Blur** section adjusts layer and background blur in pixels. Layer blur
affects the selected element and its children; background blur is visible through
transparent areas. Supported existing color filters and drop shadows stay in
order. Reset removes the selected screen's override; Clear removes that filter
stack at the selected scope. Multiple authored blur functions or unsupported
filter expressions require clearing the stack before using the blur control.

Select a range of HTML layers with **Shift-click** in Layers; use **Cmd/Ctrl-click**
to toggle individual layers. On the canvas, Shift-click also toggles a layer.
Shift plus Up/Down/Home/End extends the Layers range. **Select visible layers**,
or Cmd/Ctrl+A while a row is focused, selects the displayed design layers. With
a search active, it selects matching rows rather than their context ancestors;
collapsed children and the HTML/body document roots are excluded.
Drag from empty HTML page background or the surrounding gray canvas to surround
layers with a marquee. Drag at least four screen pixels to begin, at any zoom.
Changing zoom or screen size cancels an active marquee. Only fully enclosed layers are selected, and an enclosed parent represents its
children. Shift adds to the current selection; Escape cancels. Marquee selection
does not write source or enlarge the bounded canvas scroll area. Starting a
marquee on content is not implemented yet. The **Shared styles** inspector shows
common values and marks differing values as Mixed. Changes and resets apply to
all selected layers at the chosen screen scope in one undo step. If any layer
refuses the change, the entire edit is refused. Up to 100 layers in one HTML
body are supported. **Frame selection** wraps one layer or consecutive sibling
layers in an editable HTML container. **Remove frame** removes that container
and keeps its children. Both actions restore source and selection with undo.
The **Layout** section offers **Horizontal stack**, **Vertical stack**, and a
nine-position child alignment control for flex containers. **Child wrapping**
chooses a single line, wrapped lines, or reverse wrapping. Alignment moves both
children and their wrapped lines toward the chosen position. These
controls follow the selected screen scope and each use one undo step.
**Adaptive grid** fits columns automatically using a configurable minimum column
size. Below that minimum, a single column shrinks to the container. The minimum
can also vary by screen scope; authored child dimensions and spans still apply.
**Frame aspect ratio** accepts ratios such as `1:1` or `16/9` and makes height
automatic in the same undo step. Content and minimum sizes can still increase
height. **Clip content** contains overflow at the frame boundary; its reset
restores inherited clipping. Both controls follow the selected screen scope.
**Visible layer** and **Shared Visibility** hide/show HTML layers while preserving
their layout space and display mode. Hidden layers remain selectable in Layers;
reset removes the chosen scope’s visibility override.
**Corners** includes uniform rounding and four independent corners. A corner can
use two lengths for elliptical rounding. The uniform field also accepts CSS
slash notation, such as `30px 10px / 15px 5px`, for both radius axes. Setting uniform rounding replaces that
scope’s individual overrides; resetting one corner restores inherited rounding.
The inspector retains its scroll position when the same selection refreshes after
an edit. Selecting a different layer opens its inspector at the top.
A frame changes the document hierarchy, so parent selectors and flex/grid layout
can change; this is not a guarantee of identical appearance. **Duplicate layers** and **Delete layers** apply to the
selection in one undo step. Selecting a parent and its child handles the subtree
once. Copies get independent responsive styles, and undo restores the selection.
Keyboard Duplicate/Delete also apply to the selected group. Drag any selected
row onto a container or a row edge to move the set together, or use **Move into…**.
Moves preserve source order and linked responsive styles, with one undo step.
Group clipboard and shared gradient/shadow controls remain unfinished. A plain
click returns to one layer.

The **Gradient fills** section creates stacked linear or radial gradients with
live previews. Edit angle or center, add/remove color stops, change their colors
and percentage positions, and move fills forward. Drag color handles on the stop rail
to preview their position on the canvas; release to save one undo step, or press
Escape to cancel. Arrow keys move the focused stop by 1%, Shift by 10%, and
Home/End move to the ends. Up to eight fills with sixteen
stops each are supported. Clear removes background images at the current screen
scope; Reset restores inherited styling. Existing image URLs and unsupported
gradient expressions are identified before replacement. Canvas gradient handles,
conic/repeating gradients and arbitrary image-fill editing remain open.

The **Shadows** section edits up to 16 stacked drop or inner shadows, with X/Y
offset, blur, spread and CSS color controls. Move a shadow up to bring it forward.
Clear hides shadows at the selected screen scope; Reset removes that override
and restores inherited styling. Controls author pixel lengths and preserve
separate overrides at larger screen sizes.

The **Typography** section supports font stacks, numeric weights, italic, text
decoration and case, plus size, line height and letter spacing. Font families
must be loaded by the page or available on the computer; entering a name does
not install a font. Typography changes follow the selected screen scope.

Children of flex containers expose **Fill available space**, **Hug contents**,
and individual grow, shrink and basis controls. Fill/Hug adjust sizing along the
parent’s flex direction and writing mode; each preset saves as one undo step and follows the
selected screen scope. Existing maximum-size constraints still apply.

Set a container’s **Display** to grid to expose **Grid columns** and **Grid rows**.
Counts create equal tracks; grid children expose column and row spans. Controls
follow the screen scope and reset to the authored layout.

For HTML and Tailwind-backed layouts, **Layout → Custom grid tracks** accepts separate
column and row sizes, such as `160px 1fr`, `repeat(3, minmax(0, 1fr))`, or
`[content_start] 80px [rest] 1fr`. These fields follow the selected screen scope.
Each axis has its own reset; invalid track expressions leave the source unchanged.
Press Enter to save a track expression or Escape to discard the draft.
CSS variables remain live: `var(--sidebar_width, 160px) 1fr` follows the page’s
shared size, using the fallback when that variable is unset.

For HTML and Tailwind grid children, **Layout → Custom grid placement** chooses column and row
lines independently: `2 / 4`, `2 / span 2`, `-2 / -1`, or `content_start / content_end`.
Placement follows the selected screen scope, with separate resets and Enter/Escape editing.
The fields suggest numbered tracks and named lines from the current parent grid.
Enable **Show grid guides** in Layout to see track boundaries for the selected grid
or its item. Guides are visual only and do not modify the site. Axis-aligned,
horizontal-writing grids with resolved track sizes are supported.

The CSS properties panel edits dimensions, flex direction/wrapping, gap, padding,
typography, colors and borders. Padding and margin support one to four values
and individual edges; gap supports row/column values. Negative margins and letter
spacing are supported. Setting padding or margin replaces its existing edge
overrides at the selected size. Align/distribute controls operate on flex/grid
containers. Select a screen size and choose its minimum-width
scope to add a responsive override; each property has a reset button. Changes
persist as element-specific style rules in the HTML and work without Retouch.
Existing stylesheets stay intact. Generated declarations use `!important`; authored
important rules with stronger specificity can still win. Important inline values
are refused. The panel accepts a limited set of simple CSS values.

Select an image to choose **Image fit**, pick one of nine positions, or enter
horizontal and vertical percentages. These framing changes follow the selected
screen scope; each has its own reset. Set a frame width and height to make
cropping visible. Use **Browse project images** to search the web folder with
thumbnail previews, or **Choose image…** to upload into `rt-assets`. Undo restores
the image reference; uploaded files remain in the folder for reuse. Hidden files,
dependency directories and symlinks are excluded from the image list.

Use **Layer name** to name an HTML layer for the editor, or press F2 on its
focused layer row. Names participate in layer search and Undo/Redo. Clear the
name to return to the page’s original label. Visible text and accessibility
labels are preserved.

Select an HTML content container and choose **Add text** or **Add frame**. The
new layer is selected immediately; a frame can contain further text and frames.
New frames start with a visible dashed border and minimum height, which can be
restyled through the inspector. Creation participates in Undo/Redo.

The Layers panel can copy, paste, duplicate, move and delete complete literal HTML
siblings. Copy/Paste uses an editor-local clipboard; Ctrl/Cmd+C and Ctrl/Cmd+V
work when a layer row is focused. Paste inserts after the selected sibling and
requires the copied source to remain unchanged in the same parent.
Mixed text/comment boundaries and implicitly closed parents are refused. Styled layers and their nested styled children copy their responsive rules to
independent identities. Layers with authored IDs, keys or refs cannot yet be
duplicated. Undo restores exact source snapshots.

Drag an HTML layer onto a container row in **Layers**, or use **Move into…**,
to append it inside that container in the same document. Valid drop targets are
highlighted while dragging. Drop near the top or bottom edge of a row to place
the layer before or after it; a line shows the insertion position. This also
works between parents in the same document. Linked styles remain attached, and Undo/Redo restores the
source. Moving into the layer itself or its descendants is refused.

Rich markup editing, cross-document moves and remote-site capture remain open.


### HTML browser verification

From `retouch/`, with Playwright available in a disposable fixture directory:

```sh
RT_INSPECTOR_FIXTURE=/path/to/fixture npm run test:e2e:html
RT_E2E_BROWSER=webkit RT_INSPECTOR_FIXTURE=/path/to/fixture npm run test:e2e:html
```

Install the matching Playwright browsers before running. The command covers the
HTML editor round trip and horizontal/vertical flex sizing. Both suites create
and remove their own temporary sites. Set `PLAYWRIGHT_BROWSERS_PATH` when using a
separate browser cache. WebKit tests exercise the browser engine; the native Mac
app still needs its own AppKit/WebView integration checks.


Inline SVG roots, groups and common paths/shapes now appear in Layers. Rectangles,
circles, ellipses and lines expose **SVG geometry** coordinates/sizes with reset
and source-preserving undo. Attributes use SVG coordinates, px or percentages and
are shared across screen sizes; the viewport and authored CSS can affect rendering.
Definitions, SVG text and foreign content are not indexed yet. Path/pen editing
and SVG structural drag/drop remain unfinished.

**SVG paint** edits fill, stroke, stroke width, line ends, line joins and dash
patterns at the selected screen scope. Use `none` for no fill or stroke. Reset
removes that scope's override; undo restores exact source. Solid CSS colors and
`currentColor` are supported; SVG gradient/pattern references are not editable yet.

Select an HTML content container or an explicitly closed SVG canvas/group to use
**Add shape**: rectangle, circle, ellipse or line. HTML containers get a new
200 × 200 SVG canvas; existing SVGs use their viewBox (or numeric dimensions) to
size the shape. The new shape is selected for geometry and paint editing. Undo
and redo restore both source and selection. Group transforms and page styles
still affect rendering; drawing a shape directly by dragging is not implemented.

**Delete layer** also removes a selected SVG shape, group or canvas, including
its contents. The parent becomes selected; undo restores the original layer,
its paint and selection. Other SVG structural actions remain unfinished.

Inside an SVG canvas or group, **Send backward** and **Bring forward** swap a
layer with its neighboring SVG layer. Later layers normally paint on top.
The moved layer stays selected, including through undo/redo; its geometry and
paint rules travel with it. Reordering across definitions or other unindexed
SVG nodes is not supported yet.

**Duplicate layer** copies a complete SVG shape, group or canvas and selects the
copy. Geometry and responsive paint start identical, with independent managed
style identities so later edits affect only the copy. Undo/redo restore source
and selection. SVG layers with authored IDs, template content or unsupported
descendants cannot be duplicated yet; SVG clipboard operations remain unavailable.

Drag the handle on the preview's right edge to explore screen widths between
presets. Layout responds while dragging; release saves the preview size and
Escape cancels. Focus the handle and use Left/Right for 1 px steps, Shift for
10 px steps, or Home/End for the 240–7680 px limits. Zoom changes the drag scale
without changing the screen's CSS pixels. Preview resizing does not write source
or change the style scope. If the edge is outside the workspace, zoom out or
use the width field.

The bottom-edge handle resizes preview height with the same release-to-save
and Escape-to-cancel behavior. Up/Down keys step 1 px; Shift steps 10 px.
Height resizing updates viewport units and height media queries while keeping
width fixed. Both edge handles operate in CSS pixels at any canvas zoom.

The comparison matching the main canvas has a blue header and a Current label.
An unpinned canvas size leaves every comparison unmarked.

Switching back to a previously used main-screen size restores its page scroll
and canvas pan at the current zoom. Positions are separate for each page URL and
size in the current preview document; reloading the page clears them. Resizing
gestures and screen-size undo keep their existing pan behavior. This remembers
the page scroll and nested scroll regions, including open shadow roots and RTL
horizontal positions. Same-origin embedded pages restore their page and nested
scroll while their document and URL remain unchanged (up to 20 frame levels).
Replaced widgets and reloaded/navigated embeds keep their own state. Closed shadow
roots, cross-origin embeds and opaque sandboxed frames are not captured.

Click a layer in a comparison preview to open that screen size on the main
canvas and select the matching layer. Links in comparison previews select
instead of navigating. This enters Edit mode and keeps your style scope; choose
the intended scope in the inspector before changing styles. Keyboard users can
focus a preview and press Enter or Space to open its size with the current
selection. Comparisons remain previews; editing happens on the main canvas.

Component creation and structural undo/redo synchronize open comparisons against
the saved source revision. If live updates fail, Retouch can reload a stale
comparison only after a fresh server render proves that revision. The reload
preserves scroll position but can reset app state in that preview. A stale or
unavailable server render leaves a retry control instead of reporting success.

Comparison selection hints distinguish hidden, absent and off-screen layers.
Scroll a comparison to bring an off-screen layer and its outline into view.

Drag the bottom-right corner to resize width and height together. Hold Shift
to preserve the starting aspect ratio; release Shift to return to free resizing.
The ratio stays within the preview's size limits. Escape restores the original
dimensions. When the corner has keyboard focus, arrows resize the corresponding
axis by 1 px, or 10 px with Shift.

Changing a screen preset during a resize discards the older drag. Zooming or
resizing the workspace cancels the drag and restores its starting dimensions,
so releasing the pointer cannot overwrite a newer screen choice.

Choosing a layer reveals it immediately, even on sites that use smooth scrolling.
Fit screen and source-edit reloads also restore page scroll immediately, so a
site animation does not continue moving the preview after an editor action.

Use **Hand** to drag the canvas, or hold **Space** while dragging for a temporary
hand tool. Drag distances stay in screen pixels at every zoom. The hand moves
the preview within the finite workspace without changing page scroll or layer
selection; use the wheel inside the preview to scroll the page. Release Space
to return to editing, or press Escape to leave the hand tool. Text fields and
Interact mode retain their normal keyboard behavior. Changing the preview size
or zoom exits the hand tool. Choosing a move, resize, gap-adjustment or drawing
tool also exits Hand. Switching to Hand discards an uncommitted tool preview.

Use **Zoom to selection** (Shift+2) to reveal and fit selected layers. It keeps
them centered while native scrolling settles, then enables editing controls.
A new zoom or screen command cancels the pending fit. If the page keeps moving
for a second, pause its scrolling or animations and try again.

Use **Zoom** in the screen toolbar to set the canvas percentage, or **Fit screen**
to bring a fixed preview fully into the available canvas. Fixed screens support
1–6400% zoom. Fit workspace supports 25–6400% and follows the workspace size.
Zoom preserves the iframe viewport, including viewport units and height media
queries, without rewriting preview CSS. Zooming out shows a smaller viewport;
scroll inside it to reach more of the page. Fit screen returns a workspace to
100%. Fitting preserves fixed CSS dimensions, viewport units and the page's
scroll position. Resize handles follow the new zoom immediately. Pinch zoom
keeps the point under the pointer anchored where canvas and page bounds allow.
It pans the canvas first, preserving page scroll; any necessary page adjustment
is immediate even when the site uses smooth scrolling.


Select an existing SVG canvas or group to use **Draw rectangle**, **Draw circle**,
**Draw ellipse**, or **Draw line**. Drag inside the SVG to preview the shape and
release to add it in one undo step. Hold Shift for equal width/height or
45-degree line angles; hold Option/Alt to draw from the starting point as the
center. Combine both modifiers, or release them during the drag to return to
free drawing. Drawing follows the viewBox, group transforms and canvas zoom. Escape, zooming or changing screen size cancels the preview.
Geometry is shared across screen sizes. Drawing a new SVG directly on an HTML
container and freehand/vector path tools remain unfinished.


React/JSX shapes inside an explicit SVG now expose the same **SVG geometry**
coordinates as HTML rectangles, circles, ellipses and lines. Literal strings and
numeric expressions can be changed or reset with exact source undo/redo. Dynamic
expressions and spread-controlled values are disabled. Geometry applies across
screen sizes and component instances sharing that source. Shape components whose
SVG ancestor is outside their JSX definition are not handled yet.

The real Next.js regression test creates and cleans up its own project/server:

```sh
RT_INSPECTOR_FIXTURE=/path/to/next-and-playwright-fixture npm run test:e2e:react-svg
```

Set `RT_E2E_BROWSER=webkit` (and the browser cache path when needed) for WebKit.


React SVG canvases and groups with explicit closing tags now offer **Add** and
**Draw** controls for rectangles, circles, ellipses and lines. Drawing supports
canvas zoom, SVG transforms, Shift constraints and Option/Alt center origins.
Release creates a JSX shape in one undo step; Escape discards the preview. The
change applies to every rendered instance of that source container. Containers
with spread props, explicit children props or injected HTML are not supported.
SVG drawing directly into an HTML/JSX layout container remains unfinished.


React SVG layers in Tailwind projects now expose **SVG paint** controls for fill,
stroke, stroke width, line ends, line joins and dash patterns. Choose a screen
scope before editing to create a breakpoint override. Reset removes that scope's
paint utility and reveals the inherited CSS or original SVG attribute. Dynamic
class expressions, spread-controlled classes and inline property overrides are
protected. These controls require Tailwind; general React CSS authoring and SVG
paint servers/gradients remain unfinished.


**Delete layer** now removes complete React SVG child shapes, groups or nested
canvases even when neighboring shapes have dynamic attributes. It selects the
parent and preserves exact source and selection through undo/redo. Component
roots and selections enclosed by JSX rendering expressions remain unsupported.
Compiled React host elements carry a source revision marker so preview refreshes
can distinguish a saved revision from an older render with the same layer IDs;
this marker is not written to project source.


Within a React SVG canvas or group, **Send backward** and **Bring forward** move
a selected shape or group past its neighboring SVG layer. Later siblings normally
paint on top. The move preserves the complete JSX subtrees and intervening
comments, keeps the moved layer selected, and supports exact undo/redo. Expression
blocks, component siblings and unsupported SVG nodes stop a move in that
direction; changing their ordering is not implemented.


**Duplicate layer** now copies literal React SVG shapes, groups and nested
canvases, selects the copy, and gives its JSX nodes distinct source identities.
Numeric geometry expressions and literal Tailwind classes are retained; editing
the copy's geometry or paint leaves the original unchanged. Authored IDs, keys,
refs, spreads and dynamic expressions remain protected. Existing generic literal
duplication/clipboard support is retained outside the specialized SVG path.
