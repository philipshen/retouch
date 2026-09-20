# Stroke parity audit

Audit checkpoint: `c94ea17a`, 2026-09-20. This is one part of the full Figma
Design objective; it neither replaces nor narrows that objective.

The current [Figma stroke reference](https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties)
includes multiple stroke fills, inside/center/outside positioning, weight,
variable width profiles, individual sides, endpoint styles, basic/custom dashes,
brush/dynamic strokes and joins. Its custom dash UI uses a text pattern.
SVG export preserves inside/outside appearance through more complex geometry.

| Requirement | Current repository evidence | Remaining work |
| --- | --- | --- |
| Stroke paints | `retouch/shell/svg-paint.js` and the inspector expose single SVG paint and scoped stroke properties. | Multiple independently editable stroke fills and their order/visibility. |
| Alignment | SVG source operations expose stroke width and geometry; no alignment model or position control was found in the current source/control inventory. | Inside/center/outside rendering while retaining editable originals. |
| Caps, joins, dashes | `svg-paint.js` parses regular/custom patterns; `inspector-ui.js` provides style, dash/gap, custom text, caps and joins. `test/e2e/svg-stroke-settings.cjs` covers source/history and scopes. | Per-point/vector-network equivalence, endpoint placement and full geometry fidelity still need proof. |
| Width profiles | No profile model or authoring control found. | Profiles, direct width handles, serialization and rendering/export fidelity. |
| Brush/dynamic strokes | No corresponding model or control found. | Brush source/assets, dynamic parameters, editable geometry and export. |

The source inventory is evidence of implementation boundaries, not a substitute
for rendered feature tests. Similar-looking CSS borders or shadows do not by
themselves prove vector stroke alignment or multiple stroke-fill parity.

## Next implementation acceptance criteria

The next slice is stroke alignment, with its full remaining scope preserved:

- Keep original paths/primitives and existing paint available for later editing;
  do not replace editable geometry with a screenshot.
- Preserve center behavior; inside/outside must match the selected boundary on
  rectangles, rounded corners, ellipses and curved/compound paths.
- Account for transforms, viewBox scaling, fill rules, joins and caps. Unsupported
  cases must be visible and atomic until their implementation is complete.
- Integrate source revisions, layer selection, exact undo/redo, responsive scopes
  and linked previews through existing adapter protocols.
- Verify pixel boundaries and hit geometry at multiple scales, plus edits after
  conversion and undo. Test HTML/React/Liquid source serialization separately
  from browser rendering; do not generalize one adapter's result to all sites.
- Verify exports and the packaged editor after integration. Public trusted macOS
  delivery remains a separate unfinished requirement.

## Fresh adjacent evidence

Forty-six focused SVG paint/crop/mask source tests passed on the checkpoint.
Chromium and WebKit each passed 36 HTML mask pixel checks and the 200% zoom,
90-degree image crop workflow. Exact commands and log paths are recorded in
[the main ledger](design-studio-parity.md#appearance-and-stroke-requirements-audit).
These checks establish that the old blanket mask/crop gaps were stale; they do
not establish the missing stroke features above.
