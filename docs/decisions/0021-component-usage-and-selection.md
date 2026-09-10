# DR-0021: Source usage determines component treatment

- Status: Accepted (rev 25)
- Date: 2026-09-07

A locally resolved component used at exactly one authored call site behaves as
inline content in the editor. Its definition remains in its original file;
selecting and editing it follows the host source ID. A loop at one call site
still counts as one usage. Definitions used at multiple call sites retain
component selection and detachment. This rule applies through the adapter seam
to Liquid snippets/theme modules and React function components.

The writer index counts resolved definition identities across indexed call
sites and invalidates the count cache on file changes. Do not use rendered DOM
counts or component names as identity. Unresolved definitions are not assumed
to be single-use.

Selection outlines use red for noneditable hosts, blue for editable hosts,
and purple for components. Remove source-name and text-edit labels. Components
show a stable, compact component badge with a diamond icon and a detach button
whose tooltip is detach. The badge invokes the existing detach operation with
the hovered or selected usage's context. Text focus does not introduce green.
Top/bottom edges use ns-resize cursors; left/right use ew-resize cursors.

## Explicit creation

Components created through the editor carry an `@retouch-component` declaration
comment. They remain components even at one authored call site, because creation
expresses the intent to reuse the definition. Ordinary pre-existing single-use
components retain the inline behavior above. The React compiler forwards the
instance marker on a marked declaration's direct root host only in instrumented
output; production source needs no editor prop or DOM attribute.
