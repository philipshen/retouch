# DR-0020: Left design inspector and component workspace

- Status: Accepted (rev 24)
- Date: 2026-09-07
- RFC references: OQ-E1, OQ-E2, OQ-D3, R-6, R-9, R-11, R-12

## Decision

The user requested absolute positioning, anchors, Alt-hover measurement, images,
typography classes and samples, components, colors, shadows, and opacity on the
left. They explicitly deferred media-query and responsive-design editing.
The starting worktree was committed and pushed as `2d33500` before implementation.

Keep existing flow-based gestures. Add an explicit Position control with
geometry-preserving absolute conversion and base-class anchor constraints.
This supersedes the deferral of explicit absolute positioning in OQ-E1.
Anchors use existing containing blocks; center uses `calc(50% ± offset)` and
opposite-edge anchors use auto size. Measured insets and custom appearance
values may use arbitrary Tailwind values. This is a panel-specific extension to
OQ-D3; max-width dragging retains its named-size snapping.

Use loaded CSS to discover typography styles and a separate iframe to preview
the actual fonts. Keep changing the HTML element separate from changing its
typography class. Do not mistake arbitrary font-size utilities for text colors.

Resolve component imports with the source parser. A component workspace shows
the actual mounted instance in a separate page frame with surrounding layout
hidden, alongside source props/defaults and its definition. It preserves the
app's providers and dynamic expressions. Shared styles require an explicit
definition action. Detachment copies the source module beside its dependencies
and adds a new import for exactly one usage. Existing usage IDs remain stable
because the import is appended after existing declarations. Hashes guard both
the usage and definition, and a failed usage write removes the newly created copy.

Retain exact source snapshots for undo of the new controls. Before undoing
detach, check the copied module and references added by other source files.
Disable property controls while selection or a style write is pending. Wait
for the framework's updated rendered markup before reloading changed images
or structural edits, so a fast reload cannot strand the old render.

## Alternatives

1. Freeform positioning for every drag. Rejected: the user asked for an explicit
   position control and deferred broader responsive-design decisions.
2. Rewrite HTML tags as typography styles. Rejected: tags encode semantics and
   do not represent a project's named type classes.
3. Clone component DOM as a static preview. Rejected: it loses the actual mounted
   component and its application context.
4. Inline arbitrary component JSX when detaching. Rejected: hooks, closures,
   imports, and local logic cannot be preserved by a generic inline rewrite.
5. Copy the component module, preserving its dependencies and props. Selected.

## Evidence and limits

Native Figma was inspected on 2026-09-07. Its current design inspector exposes
position, auto layout, appearance opacity, fills, effects, and component
properties. The implementation and reproducible browser checks are documented
in [the inspector guide](../inspector.md).

Tailwind supports [arbitrary property values](https://tailwindcss.com/docs/adding-custom-styles)
and [custom shadows](https://tailwindcss.com/docs/box-shadow). The source compiler
remains responsible for emitting their CSS. No breakpoint classes or media
queries are generated or rewritten by the new controls.
