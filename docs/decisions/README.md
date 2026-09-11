# Decision records

One record per trade-off discussion. Each record lists every alternative considered, the arguments for and against as they were actually made, the decision, and its consequences. Records are never rewritten after acceptance; a reversal gets a new record that supersedes the old one.

Format: Status · Date · RFC references · Context · Options considered · Decision · Consequences · Discussion log.

| ID | Title | Status | RFC |
|---|---|---|---|
| [DR-0001](0001-build-time-instrumentation.md) | Build-time instrumentation is unavoidable | Accepted (rev 2) | R-1, §4.1 |
| [DR-0002](0002-mounting-and-origin.md) | Where the editor mounts: path, port, process, origin | Accepted (rev 6); supersedes the positions of revs 3–5 | OQ-B1, OQ-B4, R-8, §8 |
| [DR-0003](0003-structural-ids.md) | Structural element IDs; no transported manifest | Accepted (rev 6) | R-10, OQ-C1, OQ-C3, OQ-D1 |
| [DR-0004](0004-gesture-semantics.md) | What a drag means in code; gesture tiers; snapping | Accepted (rev 7) | OQ-E1, OQ-E2, OQ-D3 |
| [DR-0005](0005-commit-model-and-write-integrity.md) | Continuous commits; preview without writes; write integrity | Accepted (rev 8) | OQ-F1, R-11 |
| [DR-0006](0006-iframe-vs-in-page.md) | Iframe under a reserved route vs. in-page injection | Accepted (rev 9) | OQ-B5 |
| [DR-0007](0007-url-mapping.md) | How the mirror URL maps to the app URL | Accepted (rev 12) | OQ-B6 |
| [DR-0008](0008-name-and-route-prefix.md) | Name and route prefix: Retouch, `/rt/` | Accepted (rev 11) | OQ-G3, OQ-B1 (c) |
| [DR-0009](0009-component-model.md) | The component model: instances, lift to prop, detach | Accepted (rev 13) | R-12, OQ-C2, OQ-E3, OQ-E2 |
| [DR-0010](0010-app-state-while-editing.md) | Reaching and holding app state while editing | **Provisional, to be felt out in P1** (rev 14) | OQ-E4, OQ-B2 |
| [DR-0011](0011-v1-operator.md) | The v1 operator: solo developer on localhost | Accepted (rev 15) | OQ-F2 |
| [DR-0012](0012-v1-scope-and-license.md) | v1 scope confirmation, Next.js inclusion, MIT license | Accepted (rev 16) | OQ-A1…A3, OQ-D2, OQ-D4, OQ-G2 |
| [DR-0013](0013-images-and-colors.md) | Image swap (R-9 amendment) and Figma-style color pickers | Accepted (rev 17) | R-9, OQ-E2, OQ-D3 |
| [DR-0014](0014-rich-text-editing.md) | Rich in-place text editing (setChildren, bold/italic, seamless delete) | Accepted (rev 18) | R-5, R-6, OQ-E2 |
| [DR-0015](0015-adapter-abstraction.md) | Language-adapter seam; Liquid plan (two axes: adapter + integration) | Accepted (rev 19); React done | R-1, R-10, OQ-A1 |
| [DR-0016](0016-command-wrapper.md) | Machine-wide installation and arbitrary startup commands | Accepted (rev 20) | §5.1, OQ-B1, OQ-G1 |
| [DR-0017](0017-liquid-string-origins.md) | Trace Liquid strings to their stored source | Accepted (rev 21) | R-1, R-6, R-10, R-11 |
| [DR-0018](0018-inline-edit-whitespace.md) | Preserve layout during inline text editing | Accepted (rev 22) | R-5 |
| [DR-0019](0019-max-width-drag.md) | Max-width dragging with Tailwind snapping | Accepted (rev 23) | OQ-E1, OQ-D3, R-6 |
| [DR-0020](0020-design-inspector.md) | Left design inspector, anchors, and component workspace | Accepted (rev 24) | OQ-E1, OQ-E2, OQ-D3, R-6, R-9, R-11, R-12 |
| [DR-0021](0021-right-inspector.md) | Right inspector | Accepted (rev 25) | DR-0020 panel placement |
| [DR-0022](0022-adapter-edit-plans.md) | Adapter edit plans and renderer capabilities | Accepted (rev 26); parity in progress | DR-0015, DR-0020 |
| [DR-0020](0020-invisible-resize-edges.md) | Invisible max-width edge targets | Accepted (rev 24) | OQ-E1 |
| [DR-0021](0021-component-usage-and-selection.md) | Single-use source editing and component selection chrome | Accepted (rev 25) | R-6, R-12 |
| [DR-0022](0022-text-before-renderer.md) | Select standalone text before its shared renderer | Accepted | R-12 |
| [DR-0023](0023-canvas-zoom.md) | Single-site canvas zoom with neutral gray surroundings | Accepted (rev 27) | OQ-B3 |
| [DR-0024](0024-pinch-and-page-coverage.md) | Pinch zoom with increased vertical page coverage | Accepted (rev 28) | OQ-B3 |

| [DR-0025](0025-source-synchronized-preview.md) | Source-synchronized previews without editor-triggered reloads | Implemented with documented renderer boundaries | Undo/redo, HMR, Liquid mirror |
