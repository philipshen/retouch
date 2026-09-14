# Nested boolean source transactions

The source planner supports retaining an existing boolean group as an operand
of a new group in HTML, JSX, and Liquid. This is the source foundation for
nested boolean editing; the current canvas/inspector has not yet been wired to
create nested selections or compute cascading result paths.

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
  `setSVGBooleanPaint`, or `setSVGTransform`.
- `results`: `{id, path}` entries for every containing boolean group, ordered
  from nearest parent outward.

A geometry edit within the target uses `setSVGBooleanOperand`, including that
inner group's newly computed `path`. Every outer path must also be computed by
the browser. The source planner validates the exact ancestor chain, updates
base-result transforms, and applies every result in memory before returning one
source-file edit. An invalid or missing result rejects the whole operation.
All existing source identities must remain unchanged. The normal transaction
and history services save this as one snapshot.

Direct nested operation, release, geometry, or transform writes are refused
because they could leave a containing result stale. Nested structural release
and regrouping are not part of the cascade operation yet.

## Verification

Source tests cover three adapter implementations, two levels of ancestor
propagation, transform composition, appearance/base order, exact release,
unchanged identities, stale hashes, missing or reordered ancestor paths, and
invalid final paths with no partial edits. An authenticated HTML API test
checks one saved snapshot with exact undo and redo. Existing HTML/Chromium and
React/WebKit boolean-paint workflows remain browser regression checks; they do
not establish nested canvas support.
