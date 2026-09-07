# Design inspector

The inspector sits on the left of the live page. Select an element in Edit mode.

| Control | Behavior |
|---|---|
| Position | Switch between flow, relative, absolute, fixed, and sticky. Absolute placement preserves the current box and suggests the nearest anchors. |
| Anchors | Pin horizontally to the left, center, right, or both edges; vertically to the top, center, bottom, or both edges. Both edges stretch with the existing positioning container. Insets also accept CSS units. |
| Measurements | Hold Alt / Option and hover. Green bands show padding; labeled lines measure padding, parent distances, or gaps to the selected element. Releasing the key dismisses the overlay without a write. |
| Image | Preview the current image, browse project assets, enter a project path, or upload a replacement. |
| Typography | See a sample in the page's fonts, family, size, line height, and weight. Swap a named typography class discovered from loaded CSS, or choose size and weight utilities. HTML semantics have a separate control. |
| Component | Inspect props, usage values, defaults, and definition source. View a live component in a separate modal canvas. Edit its shared definition, or detach the selected usage into its own module. |
| Fill / text color | Choose a palette color or enter a 3, 4, 6, or 8 digit hex value. The inspector also shows the computed color. |
| Effects | Apply a shadow preset or set X/Y, blur, spread, color, opacity, and inner shadow. |
| Opacity | Set a percentage or use the slider. |

The new style controls edit **base classes**. Existing breakpoint and state
classes stay intact and may override a base edit at the current viewport.
There is no new media-query or breakpoint editor. Authored responsive image
source choices remain outside image replacement.

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
