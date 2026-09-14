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
The selected originals must be consecutive. Selecting every original leaves
one nested operand in the target, which remains editable and releasable. The source planner retains their bytes, maps all old
identities, selects the new group, and updates the target's base index and all
result transforms. An invalid final result discards the entire planned edit.
The Original shapes inspector provides selection checkboxes and Union,
Subtract, Intersect, and Exclude controls when the group has at least two
originals. The browser prepares the nested group temporarily, computes the
containing outlines, and restores the live DOM before submitting one source
transaction. Browser coverage includes regrouping, filled-area samples, exact
undo/redo, retained document/input state, and refusal of CSS-controlled results.
Single-operand retained groups derive the same filled region for each boolean
operation, preserving the containing group paint and transform.

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
before the refusal assertion was added. The `RT_E2E_DEEP_REGROUP=1` scenario adds a fourth operand around the target,
then regroups two originals inside it. It verifies that one operation request
carries both enclosing results, checks filled-area samples and the separate
fourth operand, refuses a CSS override on the outermost result without source
or DOM changes, and restores exact source with one undo/redo. Preparing this
scenario required hiding the target's temporary original-shapes container
before computing its parent's result. Regroup selections now survive inspector
refreshes at the same source hash, preserving retry choices after refusal.

The deeper regroup scenario passes on HTML/Chromium, Liquid/Chromium, and
React/WebKit. The full unit suite passes 1,409 tests after the cascade and
selection-preservation fixes. This does not establish arbitrary nesting depth,
responsive outline regeneration, or full Figma parity.

### Locked original shapes

Boolean writes check the selected group and affected originals against the
editor's layer locks before preparing geometry and again before posting source.
This covers regrouping and original geometry edits, including a lock acquired
while descriptors load. The nested browser workflow checks that an existing
lock and a lock added during loading each produce no POST, source change, or
DOM change. Unlocking allows the same selected originals to be regrouped.

### Regrouping all originals (2026-09-14)

`RT_E2E_ALL_REGROUP=1 RT_E2E_DEEP_REGROUP=1` selects all three target originals
inside an enclosing group. HTML/Chromium, Liquid/Chromium, and React/WebKit pass
filled-area checks, the single-operand parent assertion, exact undo/redo,
lock and CSS refusal/retry checks, and retained preview state. Source tests
cover regroup-all and release through HTML, React, and Liquid. Geometry tests
cover all four operations with one operand, transformed evenodd/nonzero holes,
and empty regions. The full suite passes 1,413 unit tests.

The single-operand lifecycle is also browser-verified: change the containing
parent's operation to Exclude, release that parent while preserving its nested
operand, then undo each operation to exact source snapshots. HTML/Chromium
passes with and without another enclosing group; React/WebKit passes with the
additional enclosing group. The outer outline remains unchanged throughout
these parent-only operations, and the full workflow retains document/input
state. These are additional browser checks; no runtime code changed for this
verification step.

### Removing originals: source planner

`removeSVGBooleanOperand` accepts `operandId`, `fileHash`, and the newly computed
parent `path`. For a nested target, use it as the `edit` in
`setSVGBooleanNested`, with the usual complete ancestor `results` chain.
Removal deletes the selected original subtree, retains other source bytes,
remaps surviving identities, and preserves the independent combined paint.
If the base is removed, the first surviving original becomes the base and its
effective transform is applied to the result. The containing group remains
selected. Invalid own or ancestor paths reject the entire source transaction.

Source tests cover all three adapters, base/non-base removal, a nested target,
retained-group subtree removal, and refusal to remove the final operand. The
full unit suite passes 1,428 tests. The inspector exposes a Remove control beside each original. Browser
preparation recalculates the target and enclosing results, restoring the DOM
before saving. Lock checks run before preparation and before the source POST.
Browser tests cover primitive and retained-subtree removal, base reassignment,
paint preservation, CSS refusal, exact undo/redo, and retained document state. Removing the final original will need a separate empty-group or
group-deletion behavior.

Removal browser verification passes on HTML/Chromium, Liquid/Chromium, and
React/WebKit. The workflow removes the nested Union subtree from its top-level
parent, then separately removes Base and Cut inside the restored nested group.
It checks native filled-area samples, retained combined paint, disabled removal
of the final original, lock refusal, outer CSS-result refusal with exact DOM
restoration, source undo/redo, and retained document/input state. The full unit
suite passes 1,428 tests.
