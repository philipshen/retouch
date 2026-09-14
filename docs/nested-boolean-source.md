# Nested boolean source transactions

The source planner supports retaining an existing boolean group as an operand
of a new group in HTML, JSX, and Liquid. The canvas can combine an existing group with sibling shapes while keeping
its originals. The inspector computes cascading results for nested operation,
geometry-field, and paint edits.

## Editor workflow

Select a boolean group and sibling shapes, then choose a combine operation.
Originals are always retained for nested combinations. Open **Original shapes**
and choose **Edit boolean group** to enter an inner group. Its operation,
original geometry fields, and paint controls update all affected result paths
as one undoable edit. **Back to containing boolean group** returns to its parent.
The Layers panel shows actual operands directly beneath their boolean group,
without the generated operand-container and result-path rows.

An inner group can be moved, resized, or rotated as an original of the outer
selected group. Double-clicking its visible area on the canvas opens that
original for movement, including when the original is itself a boolean group.
Hit-testing uses the nested result geometry and respects locked originals.
The inner group's own originals also support move, resize, and
rotate gestures, with a live preview of the outermost result. Ancestor source
descriptors load once before the gesture; preview frames compute locally.
Escape restores the original DOM, and a committed gesture saves one undo step.
External changes to the boolean tree cancel the gesture without overwriting
those changes. **Release boolean group** also works inside a containing group:
its originals become operands of the parent, whose current operation is then
recomputed. A transform on the released group is composed onto each original.
The containing group's paint stays unchanged and its base follows the released
base original. This can change the combined shape (for example, releasing an
inner union inside subtraction). One undo restores the entire nested group.

## Retained creation

`createSVGBooleanGroup` accepts consecutive sibling primitives and retained
boolean groups. The first selected operand supplies the result appearance.
The committed source wraps the original operand bytes, including every nested
group and its originals. Existing source IDs are mapped through wrapper
insertion; no operand source IDs are deleted.

To derive a nested operand's appearance, the planner temporarily substitutes
its result path in a separate source string. It composes the group's transform
with the result path's transform. These temporary substitutions never reach the
file. A supplied result path is expressed in the first selected operand's
visible result coordinate space (the nested result path's space for a group).

Releasing the outer group restores its operands exactly. As with flat groups,
releasing a transformed outer group retains an ordinary transformed wrapper.
Authored IDs and dynamic descendant attributes remain unsupported for creation.

## Atomic nested edits

`setSVGBooleanNested` carries:

- `id`: the target group or one of its containing boolean groups.
- `fileHash`: the original source hash.
- `targetId`: the inner boolean group to edit.
- `edit`: `setSVGBooleanOperation`, `setSVGBooleanOperand`,
  `setSVGBooleanPaint`, `setSVGTransform`, or `releaseSVGBooleanGroup`.
- `results`: `{id, path}` entries for every containing boolean group, ordered
  from nearest parent outward.

A geometry edit within the target uses `setSVGBooleanOperand`, including that
inner group's newly computed `path`. Every outer path must also be computed by
the browser. The source planner validates the exact ancestor chain, updates
base-result transforms, and applies every result in memory before returning one
source-file edit. An invalid or missing result rejects the whole operation.
Nonstructural edits keep all source identities unchanged. Release removes only
the generated inner group, operand wrapper, and result; it maps retained layer
identities through the structural change and selects the containing group.
The normal transaction and history services save this as one snapshot.

Direct nested operation, release, geometry, or transform writes are refused
because they could leave a containing result stale.

The source planner also accepts `edit.type: createSVGBooleanGroup`. For this
edit, `targetId` is the existing group whose direct originals are being
regrouped; `edit.ids`, `edit.operation`, and `edit.path` describe the new inner
group. `results` starts with the target itself, then every ancestor outward.
The selected originals must be consecutive and leave at least one other
operand in the target. The source planner retains their bytes, maps all old
identities, selects the new group, and updates the target's base index and all
result transforms. An invalid final result discards the entire planned edit.
The Original shapes inspector provides selection checkboxes and Union,
Subtract, Intersect, and Exclude controls when the group has at least three
originals. The browser prepares the nested group temporarily, computes the
containing outlines, and restores the live DOM before submitting one source
transaction. Browser coverage includes regrouping, filled-area samples, exact
undo/redo, retained document/input state, and refusal of CSS-controlled results.
Regrouping all originals into a single operand remains unfinished.

## Verification

Source tests cover three adapter implementations, two levels of ancestor
propagation, transform composition, appearance/base order, exact release,
unchanged identities, stale hashes, missing or reordered ancestor paths, and
invalid final paths with no partial edits. An authenticated HTML API test
checks one saved snapshot with exact undo and redo. Browser workflows cover HTML/Chromium, Liquid/Chromium, and React/WebKit nested
creation, actual filled-area samples, operation changes, nested geometry and
paint edits, empty-result propagation, outer operand movement, nested original
move/rotation cancellation and undo/redo, pointer resizing, external result
mutation cancellation, transformed and untransformed inner release with native
filled-area checks and exact undo/redo, exact undo and
release, and retained document/input state. Chromium also checks atomic DOM
and source restoration when CSS controls an outer result path. The existing
flat boolean workflow remains a regression check.

### Regrouping browser verification (2026-09-14)

The nested workflow now releases an inner group, selects two of the three
remaining originals in the inspector, and regroups them with Union. It checks
native SVG filled-area samples, exact source undo/redo, and retained form and
document state. HTML/Chromium and React/WebKit additionally exercise a CSS `d`
override and verify the refused regroup restores the DOM and leaves source
unchanged. HTML/WebKit and Liquid/Chromium passed the regroup/history workflow
before the refusal assertion was added. Regrouping under additional ancestors
has source-level coverage; that browser scenario still needs explicit coverage.
