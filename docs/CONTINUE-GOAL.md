# Continue Retouch on another machine

## Goal prompt

Continue the existing Retouch goal in https://github.com/philipshen/retouch on branch `feat/figma-design-studio`. Establish this as an active, unbounded goal if the new session does not already have it. Use an isolated worktree, preserving the existing branch history and all unrelated work.

The full objective is: achieve FULL feature parity with Figma Design, creating a Figma-like experience that works for ANY site. Also create a macOS desktop app installable through Homebrew cask. Go all-out on the design experience and innovate on intuitive management of different screen sizes. The product principles are (1) “It just works” and (2) “Intuitive controls, easy to learn.” Preserve the user's existing startup command, including Make, shell scripts, monorepo orchestrators, containers, and other methods.

Do not redefine success as the features already implemented, a limited set of frameworks, or a passing test suite. Audit the current implementation against the full objective, maintain a concrete gap list, and keep making substantial end-to-end progress. Do not mark the goal complete until its full scope is implemented and verified against real behavior. Prefer source-backed edits with exact Undo/Redo, correct repeated-instance identity, and responsive behavior that corresponds to actual browser rendering. Do not silently substitute transient DOM-only edits for durable editing.

Read this entire handoff, applicable AGENTS.md files, README.md, retouch/README.md, retouch/test/README.md, desktop/README.md, and the relevant sections of docs/design-studio-parity.md. That parity document is a long chronological evidence log, not proof of current complete parity; search it and read its recent tail rather than loading it all at once. Inspect current code and Git state before trusting any historical statement.

IMPORTANT UPDATE (2026-09-11): The user chose to continue on the original machine and explicitly resumed controlled native testing. An existing development bundle opened to its native welcome window, verified through accessibility and a screenshot; no manual approval was needed for that launch. Follow desktop/AGENTS.md: do not loop blocked launches, remove quarantine, or weaken macOS security. Rebuilt bundles, full native workflows, signing, notarization, and trusted distribution remain unverified. The prior migration-era blanket launch pause is superseded.

Work autonomously, validate changes with meaningful source/API/browser checks, record accurate evidence and limitations, and commit coherent changes. Do not claim universal support from narrow fixtures. Keep the full goal active when a turn ends with incomplete work.

## Migration snapshot, 2026-09-11

- `main` preserves earlier local inspector/Shopify work at `fed7f3c` (186 unit tests passed on the source machine). It is a separate line of development; do not merge it into the design branch blindly.
- The design branch's last implementation commit before this handoff is `bc55434`, following `707ac01`. Its 821 unit tests passed again during migration.
- The design branch already includes an earlier checkpoint of local work (`cf3b539`) and extensive subsequent editor development. Continue this branch, not main.
- Migration-era investigation was initially read-only. Subsequent work implemented and verified `setComponentPropSelection` in the React source/API layer; the multi-instance selection UI and shared inspector remain to be implemented. See the latest parity-log entry.
- No public notarized desktop release or usable published Homebrew cask was established. Source push is not a desktop release.
- Historical `/private/tmp/...` logs, screenshots, bundles, browser installations, node_modules symlinks, and app fixtures were local to the old machine and are not portable evidence. Credentials, target-site checkouts, generated artifacts and dependencies are not included. Regenerate evidence locally.

## Setup on a fresh machine

Node 22 or later is required by the project. The source machine used Node 26.8.2; verify the chosen runtime locally. From a parent directory:

```sh
git clone git@github.com:philipshen/retouch.git
cd retouch
git fetch origin
git worktree add ../retouch-design-studio --track -b feat/figma-design-studio origin/feat/figma-design-studio
cd ../retouch-design-studio
npm --prefix retouch ci
npm --prefix retouch test
```

If the branch already exists locally, inspect `git worktree list` and use its existing worktree or attach a new one without recreating/overwriting it. The repository root has no package.json; the package is `retouch/`.

The locked browser fixture environment is included under `docs/continuation/browser-fixture/`. It preserves the source machine's Next 16.2.5, React 19.2.0, Tailwind 4.1.13, and Playwright 1.58.2 environment. The e2e scripts create and clean their own disposable apps using these dependencies. From the worktree root:

```sh
npm --prefix docs/continuation/browser-fixture ci
export RT_INSPECTOR_FIXTURE="$PWD/docs/continuation/browser-fixture"
node "$RT_INSPECTOR_FIXTURE/node_modules/playwright/cli.js" install chromium webkit
RT_E2E_REACT_RELOAD_VIEWPORT=1 node retouch/test/e2e/react-selection.cjs
RT_E2E_BROWSER=webkit RT_E2E_REACT_RELOAD_VIEWPORT=1 node retouch/test/e2e/react-selection.cjs
```

Install platform browser dependencies if Playwright reports them missing. Do not reuse the old machine's PLAYWRIGHT_BROWSERS_PATH. These fresh-install instructions and copied lockfile must be verified on the destination; the migration did not perform a fresh dependency install.

Other focused browser checks, from the worktree root with RT_INSPECTOR_FIXTURE exported:

```sh
RT_E2E_REACT_COMPARISON_SELECTION=1 RT_E2E_REACT_COMPARISON_MARQUEE=1 node retouch/test/e2e/react-selection.cjs
RT_E2E_COMPARISON_MARQUEE=1 node retouch/test/e2e/comparison-multiselect.cjs
node retouch/test/e2e/comparison-locks.cjs
node retouch/test/e2e/html-compare-edit.cjs
```

Repeat relevant checks with `RT_E2E_BROWSER=webkit`. Check each test's own environment prerequisites before running it; `npm test` excludes browser e2e tests, and the generic `npm run test:e2e` expects a separately running fixture. Shopify/Moses checks need a real authorized development theme and fresh authentication; do not test changes against live/named themes.

## Recent verified behavior and unresolved bugs

- Comparison previews support host-layer Shift-click and background drag selection, lock-aware picking, scaled outlines, cross-size handoff, shared responsive editing, and history. React host-layer tests verify main/Tablet/Phone compiled CSS and preservation of unselected/other-scope styles.
- Comparison gestures attach idempotently when the iframe body becomes ready. Shared React field commits resolve live source elements after reload instead of using detached elements captured when the field was created.
- `bc55434` defers inspector rendering while the preview has no documentElement/body/defaultView. Chromium and WebKit passed a real document.open() interval, repeated reloads with viewport updates, preserved two-layer selection, a subsequent shared md opacity edit, and exact source Undo without page errors.
- The deterministic empty-document test reproduced an atWidth null-append stack. It does not retrospectively prove the stack of an older untraced intermittent error.
- An earlier WebKit comparison-removal timeout passed a diagnostic rerun; its cause remains unconfirmed. See the recent parity-log entries, not an assumption that all intermittent failures are resolved.

## Next investigation and implementation pointers

The Layers → shared inspector → atomic source operation → compiled preview → Undo/Redo slice now passes Chromium and WebKit. Modifier-click toggles compatible component usages in one source file. Shared controls include mixed values and compatible property editors, default reset and clear. History preserves the selection; preview refresh waits for compiler-stamped usage revisions.

Key files: `retouch/shell/shell.js` (`componentSelectionSection`, `refreshComponentSelection`, `setComponentPropertySelection`), `retouch/shell/layers.js`, `retouch/src/component-props.cjs` (`planSelection`), and `retouch/test/e2e/component-property-selection.cjs`. The source planner validates all usages against one original snapshot and retains dependency guards. Preserve its atomicity and exact Undo guarantees.

Canvas modifier selection now preserves component scope, resolves nested host clicks to a stamped usage root, and retains the group on incompatible picks. Both browser engines verify canvas click → This instance → nested Shift-click → shared property edit → exact Undo. Layers now also supports component Shift-click ranges and Shift-arrow expansion/contraction; both browsers verify a range shared edit and exact Undo. Command-click remains the individual toggle on macOS. Main-canvas marquee now follows component selection scope and selects fully enclosed component root groups. Both browsers verify two-root fragments at 50/100% zoom, partial-fragment exclusion, additive selection, Escape cancellation, shared editing and exact Undo. Main-canvas secondary fragment outlines now use grouped bounds, verified as exactly one box per selected component at both zoom levels and after Undo. Comparison previews now group component roots for outlines, visible counts and reveal cycling. Phone/Tablet browser checks verify scaled boxes plus shared property edits and Undo. Comparison component marquee now hands complete usage groups to the main canvas at the chosen preview size. Both browsers verify a Phone-to-Tablet handoff from one selected component to two, followed by shared edits and Undo across previews. Component comparison refresh waits for stamped usage revisions before forcing reloads, addressing a reproduced WebKit hot-update interruption. Continue with dedicated component clipping/reveal and comparison gesture edge cases, repeated occurrence identity, mixed host/instance behavior, and richer property-control UI coverage. Component groups support duplication, deletion and movement into compatible containers. The browser fixture verifies strings, default reset, expression protection and toggle/history; it does not establish every control type or arbitrary local-function component discovery. `selectMany` supports component usage IDs when component scope is requested.

## Broader unfinished scope (not an exhaustive audit)

Mixed/component-instance multi-selection; variants and shared libraries; nested overrides, slots and expression swaps; semantic identity across reordered data, portals and frameworks; multi-component/cross-file relocation; richer TypeScript contracts; arbitrary-framework and remote-site durable authoring; full document/pages/sections/guides model; vector/boolean/mask/transform parity; complete responsive auto-layout and hug/fill behavior; rich text and font resolution; assets and export; prototypes, collaboration and version browsing; cross-process atomicity; and trusted notarized Homebrew distribution with upgrade/Intel/native verification.

Responsive helpers currently have bounded media-query solving (up to 2,000 candidates and dimensions 240–7,680), and equal-width named-scope CSS cascade inheritance remains unresolved. Existing app/CLI instrumentation supports specific integrations; accepting arbitrary startup commands is not proof of automatic instrumentation for ANY site. Re-audit these gaps against current code rather than treating this list as the complete specification.

## Latest shared-property control verification

`test/e2e/component-property-controls.cjs` passes Chromium and WebKit for imported typed component usages: numeric validation/fractional edits, deterministic mixed boolean checkbox behavior, enum choices, numeric default reset, optional string clear and explicit empty text, with exact source Undo and compiled preview values. The shared inspector now treats full true/false choice contracts as checkboxes and supplies an explicit empty-text action for mixed/unset unconstrained strings. Full component selection/main/comparison regression and all 827 unit tests pass. Continue toward richer contracts, expression/slot/variant behavior and the broader goal; these primitive controls do not establish full component parity.

Shared controls also support Escape cancellation without source-operation requests, including invalid numeric input and mixed multiline text. Command/Ctrl+Enter commits multiline text; fields expand with explicit line-height styling. Chromium/WebKit primitive controls and all 827 unit tests pass. See the latest parity-log entry for keyboard evidence and the inspected screenshot.

## Selected component duplication

The source/API and Layers UI now support `duplicateComponentSelection`: one atomic transaction, normalized selected ancestor roots, composed identity maps and new copy keys. Duplicate components and Command/Ctrl+D select the copies; Undo/Redo restore exact source and before/after selections. Both browser engines verify repeated duplication, and all 831 unit tests pass. See `src/duplicate-component.cjs`, its new selection unit test, and the component-property-selection e2e fixture. Single/group duplication now guards intermediary re-export files, alias configs, missing resolution candidates and symlink targets as well as terminal definitions. Successful transactions and stale dependency/path refusals are tested; all 833 unit tests pass. Group reparenting and cross-file structure editing remain unfinished.

## Selected component deletion

`deleteComponentSelection` and the Layers button/Delete key now delete a selected usage group in one transaction. Null child slots preserve unrelated identities; import cleanup retains side effects and type references. Undo restores exact source, selected usages and their editor locks; Redo removes them again. Chromium/WebKit combined component workflows and all 837 unit tests pass. See `src/delete-component.cjs`, `test/delete-component-selection.test.cjs` and the component selection e2e fixture. Group reparenting and cross-file structure edits remain open.

## Selected component reparenting

`reparentComponentSelection` plus Layers Move into now moves a group to a shared compatible container in one file, preserving source order, bindings, identities, selection and locks through Undo/Redo. Current-parent destinations support no-op moves without history. Both browser engines and all 841 unit tests pass. See `src/reparent-component.cjs` and `test/reparent-component-selection.test.cjs`. Group drag/drop and sibling ordering, cross-file moves and preserved visual coordinates under arbitrary layout changes remain open; prior entries listing all group reparenting as unfinished are superseded by this slice.

## Component group dragging

Layers supports dragging selected component usages into a shared compatible host container. The gesture snapshots IDs and allowed destinations, refuses locked/stale usage roots, and revalidates selection/hash/destination before the atomic group move. Native drag cancellation clears visual targets without a source write. Group sibling drops remain unavailable. Browser verification covers synthetic drag events in Chromium/WebKit and a real pointer drag in Chromium, plus source order, exact Undo/Redo and selection retention; 841 unit tests pass. See the component-property-selection e2e fixture and shell Layers handlers.

Pointer-drag coverage uses a tall viewport with source and destination visible. The first Chromium attempt in the shorter viewport emitted mouse events but no native dragstart when the destination required scrolling; scrolling during a group drag remains unverified.

## Layers drag edge scrolling

The Layers tree now scrolls near its top/bottom edge during an active drag, with bounded speed and frame timing. Drop, dragend, leaving the tree, pagehide and document replacement stop the loop. Child dragleave with null relatedTarget does not stop scrolling when pointer coordinates remain inside the tree. Chromium now verifies a real pointer group drag in the original short viewport: destination initially below the visible tree, scroll until visible, drop, exact source/order/selection Undo/Redo. Chromium/WebKit also verify both scroll directions and cancellation/leave stopping without source writes. This supersedes the prior scrolling-drag verification gap for this tested workflow. Group sibling ordering and broader structure/layout parity remain open.

## Component group sibling placement

Layers now accepts before/after drops for selected usages sharing an unselected sibling target. The `reparentComponentSelection` operation accepts explicit `direction: before|after` and delegates to `move-component.cjs.planSelection`; omitted/inside retains container movement. The planner normalizes selected descendants, preserves source order independent of selection order, reorders complete JSX sibling chunks, composes identities and emits one transaction or a no-op. Cross-container sibling placement is refused. Chromium/WebKit synthetic sibling drops verify compiled order, retained selection, no-op history and exact Undo/Redo; source tests cover before placement, comments, descendants, invalid targets and stale hashes. All 844 unit tests pass. Group ordering buttons/keyboard commands and cross-file placement remain open; earlier blanket sibling-ordering gaps are superseded for these drops.

## Component group ordering buttons

Layers provides Move components up/down/to start/to end for a group of direct sibling usages. Source movement descriptors now include ordered sibling identities, allowing the UI to disable unavailable directions. The source planner independently validates membership/container and resolves omitted destinations by direction; boundary operations are no-ops. The existing atomic selection/history path handles each command. Chromium/WebKit verify all four controls, boundary disabled states, source order and exact Undo/Redo with selection retained; 845 unit tests pass. Keyboard shortcuts, cross-container placement and broader component parity remain open.

## Ordering keyboard access

Command/Ctrl+[ and ] move selections earlier/later; adding Shift moves to start/end. Bracket commands now reach the existing guarded action dispatcher from the outer editor as well as the canvas iframe, fixing no action when a Layers row had focus. Ordering buttons expose aria-keyshortcuts and platform-specific hover hints. Chromium/WebKit verify all four group shortcuts from Layers, exact Undo/Redo, disabled-boundary no-op, repeated/composing/Alt-key refusal and zero source writes while the shared title textarea is focused. All 845 unit tests pass. The earlier blanket keyboard-ordering gap is superseded for this supported flow; cross-container/cross-file ordering and broader parity remain open.

## Cross-container component group positioning

Before/after group drops now support a target in another compatible JSX container in the same source file. Reparent descriptors expose cross-container target IDs, and Layers intersects these with each selected usage's allowed targets. Same-parent ordering keeps its existing planner; cross-container positioning preflights bindings/recursion for every root, moves into the destination parent, positions roots around the target, composes all identities and writes one transaction. Source order and exact history are retained. Cross-container parent locks are checked on hover/drop. Chromium/WebKit verify a group moved out of an aside before a host sibling, compiled structure, selection and exact Undo/Redo; source tests cover before and after from separate source containers, plus binding and recursive-target refusals. All 847 unit tests pass. Cross-file placement, arbitrary-layout coordinate preservation and broad parity remain open. Prior blanket cross-container positioning gaps are superseded for these group drops.

## Single-component cross-container positioning

Single usage before/after drops now share the guarded cross-container planner and target metadata with groups. The single move API preserves its movedComponent history response; the public group operation still requires two or more usages. Layers offers cross targets for a single usage and checks destination-parent locks. Chromium/WebKit verify moving just one selected component out of an aside, leaving its sibling there, then exact Undo/Redo and a single selected row. All 849 unit tests pass. The first WebKit run timed out at the initial shared-property HMR check before movement; the completed test was rerun successfully. Preserve `/private/tmp/retouch-single-cross-webkit-initial-hmr-timeout.log` as unresolved preview-refresh evidence. No claim that this fixes intermittent HMR or establishes arbitrary-framework parity.

## Fragment-parent cross placement

Cross-positioning now accepts children of JSX fragments, including conditional fragments, without requiring a wrapper element. Shared lexical/execution-context/recursion checks validate the fragment parent. Cross-placement writes the selected chunks directly at the target boundary with original-coordinate identity mapping; the intermediate append/reorder implementation is superseded. Same-parent ordering and inside-container moves retain existing paths. Source tests cover before/after fragments, group identities, exact inverse, guarded bindings/recursion, insertion boundaries and wrapped source expressions. Chromium/WebKit verify real compiled JSX fragment group drops and exact selection/source Undo/Redo using DOM DragEvents. All 852 unit tests pass. Cross-file editing and arbitrary-layout coordinate preservation remain unfinished.

## Known React key collisions during movement

`component-move-keys.cjs` checks statically known direct sibling keys before cross-container writes. It catches collisions with destination children and between incoming roots, using React-style primitive string coercion. Unique keys remain unchanged; same-parent reordering does not introduce a new key restriction. Individual destination metadata and group planning both use the check. The reproduced collision is refused with a reason and no source/undo mutation. Dynamic keys, spreads and runtime-generated children remain outside this static guarantee; automatic key conflict resolution is not implemented. 855 unit tests pass, plus Chromium and WebKit API/compiled-preview workflows. WebKit initially failed earlier at a Next stack-frame fetch access-control error; rerun passed, and `/private/tmp/retouch-move-keys-webkit-stack-frame-error.log` preserves the unresolved evidence.

## Preview diagnostics and superseded Layers scans

`RT_E2E_TRACE=/absolute/path.json` enables bounded timing traces in `component-property-selection.cjs`: source operation names, frame navigations, console warnings/errors, request failures, test failure details and server log. Trace output errors still allow fixture/browser cleanup. Four initial traced WebKit runs passed; one had two transient Next.js `Unexpected end of JSON input` / HTTP 500 responses. A later investigation trace captured hydration mismatches between server/client source revisions alongside a hot-update fetch access-control failure: `/private/tmp/retouch-hmr-first-webkit-final.json`. DOM revision stamps alone are insufficient to prove hydration completion; refreshWrittenElement retains its prior server-probe/HMR fallback sequence.

Fixed a separate Layers race: an awaited component scan now waits for a newer scan that superseded it before returning. The deterministic `layer-interactions.cjs` test fails on the preceding implementation (`premature: true`) and passes in Chromium/WebKit after the fix. Final full component flows pass with `/private/tmp/retouch-refresh-race-{chromium,webkit}.{json,log}`, with no page/request failures or server JSON errors in those two runs. All 855 unit tests passed during this work. The intermittent hydration/HMR issue is still open; do not treat the metadata fix or passing reruns as proof it is resolved.

## Client mount readiness for explicit client modules

The JSX stamper now adds a required module revision and callback-ref mount proof to eligible hosts in explicit `use client` modules. Server-rendered HTML contains the requirement but no mounted proof. Authored refs, spread props and reserved mount attributes are preserved by skipping this instrumentation; server modules retain existing behavior. The callback writes proof at client commit without changing source files. `clientMountReady` / `waitForClientMount` are used by editor writes (while sourceRequests reserves busy state), live refresh, reload completion and comparison readiness. The wait is bounded to four seconds; an editor write is refused without POST if the preview does not become ready.

856 unit tests pass. Full Chromium/WebKit component flows verify server/client marker distinction and an intentionally held marker delaying a real source write with zero POSTs until released. Both final traces have no page errors or hydration warnings; Chromium still saw two transient Next server JSON parse failures. Typed property controls pass both engines and React host/comparison responsive editing passes Chromium. This is readiness evidence for instrumented client-module hosts, not universal hydration detection or a complete HMR fix. Logs: `/private/tmp/retouch-client-mount-{chromium,webkit}.{json,log}`, `/private/tmp/retouch-client-mount-units.log`, and matching controls/host logs.


## History recovery while the preview is unmounted

Undo and Redo on `/rt/__api/op` bypass the client-mount wait so a source change that cannot mount does not trap history recovery. Ordinary edits still wait and refuse without a POST after the bounded timeout; busy state is released in finally. Existing history, route and concurrent-write guards remain in place.

Full Chromium and WebKit component workflows pass with missing mount proof deliberately applied before Undo and Redo, exact source restoration, and retained two-component selection. A separate held-proof timeout verifies zero source POSTs, unchanged source and released busy state. All 856 unit tests pass. Evidence: `/private/tmp/retouch-mount-recovery-{chromium,webkit}.{json,log}` and `/private/tmp/retouch-mount-recovery-units.log`. Browser checks preceded a final restriction of the bypass to the exact operation endpoint, which is the endpoint exercised by those checks. This verifies the mount guard recovery path, not recovery from every possible runtime error. Full parity and trusted native distribution remain unfinished.


## Automatic static key repair during component movement

Cross-container component moves now repair statically known incoming React key collisions instead of hiding/refusing otherwise valid destinations. Only conflicting incoming root key attributes change; destination keys, unique incoming keys, nested keys and same-parent ordering remain untouched. Generated names are deterministic for the original source and checked against statically known keys and source text. Dynamic expressions and spread-supplied keys remain outside the uniqueness guarantee and are not rewritten.

The planner validates scope, binding, containment and recursion before repair, maps the virtual key changes across every source layer, replans the move, and composes identities into one transaction against the original source. This supersedes the earlier static-key refusal and automatic-key-resolution gap for these supported same-file moves. Arbitrary dynamic keys, cross-file movement and universal framework support remain unfinished.

Validation: 860 unit tests pass, including single/group inside/before/after moves with the destination before or after the source, primitive coercion, fragment destinations, multiple incoming collisions, nested selection, binding refusal, deterministic planning and exact transaction inverse. Full Chromium/WebKit component workflows pass: Layers group Move into plus single positional drag, compiled preview, retained selection, exact Undo/Redo and unchanged nonconflicting keys. No page errors or duplicate-key warnings in these two traces; WebKit recorded one transient Next server JSON parse error, so preview reliability remains open. Evidence: `/private/tmp/retouch-key-repair-units.log` and `/private/tmp/retouch-key-repair-{chromium,webkit}.{json,log}`. No new native packaging/signing or remote push was performed.


## Single-layer sizing uses the untransformed border box

The React class Layout inspector now shares the multi-selection dimension conversion: pixel width/height include padding and borders, before CSS transforms. It reads computed dimensions (with untransformed offset dimensions as fallback) and subtracts content-box decoration when writing a fixed CSS size. Switching Hug to Fixed uses the same conversion. Previously a scaled or padded content-box layer could grow unexpectedly because its transformed bounding rectangle was written directly as a CSS dimension. Numeric validation reports an impossible size smaller than padding/borders without writing source.

860 unit tests pass. The new self-contained `retouch/test/e2e/layout-box-sizing.cjs` passes Chromium and WebKit against a compiled Next/Tailwind fixture: scaled content-box width/height, responsive padding, correct scoped source values, impossible-size validation, unchanged Phone base dimensions, Hug-to-Fixed size retention, and exact Undo/Redo. Test screen changes focus the screen control, matching real interaction and allowing the existing inspector draft-preservation guard to release. Logs: `/private/tmp/retouch-layout-box-{chromium,webkit}.log` and `/private/tmp/retouch-layout-box-units.log`. Full auto-layout/responsive parity remains unfinished; no native build or remote push in this milestone.


## Single-layer shorthand size overrides

Width/Height behavior and pixel edits now preserve important `size-*` shorthand classes while giving the edited axis sufficient priority to override them. The other axis remains governed by its existing source. Conflicting arbitrary `[width:...]` or `[height:...]` classes in the selected scope are removed by the dimension edit. The behavior menu recognizes important axis/shorthand tokens, preferring an important axis override over an important shorthand, so Fixed/Hug agrees with the supported authored classes.

861 unit tests pass. `RT_E2E_SIZE_SHORTHAND=1` extends the isolated layout box-sizing fixture with an important tablet size shorthand and a conflicting arbitrary width. Chromium/WebKit pass scoped width/height edits, unchanged other-axis sizing, retained shorthand, removed conflicting width, Phone isolation, accurate Fixed/Hug menu states, size retention and exact Undo/Redo. Evidence: `/private/tmp/retouch-size-shorthand-{chromium,webkit}.log` and `/private/tmp/retouch-size-shorthand-units.log`. Unit run preceded the final menu-reading change; both final browser runs include it. Full responsive/layout and arbitrary-framework parity remain open.


## Reset a dimension through the sizing behavior menu

Selecting Inherited / auto now removes the selected scope's axis override instead of doing nothing. It preserves size shorthand, the other dimension, constraints and other breakpoints. On a flex main axis it also removes growth, shrink and basis overrides, including arbitrary flex declarations and modern numeric/variable shorthand forms, so old flex sizing cannot silently defeat reset or Fixed/Hug/Fill. Cross-axis edits retain flex sizing.

863 unit tests pass. Chromium/WebKit each pass both plain and important-shorthand variants of `layout-box-sizing.cjs`, including width reset, retained height, inherited size, exact reset Undo/Redo and the existing Phone/Tablet checks. Final arbitrary-flex matcher coverage is in unit tests; the four browser fixtures exercise the block-layout reset. Logs: `/private/tmp/retouch-size-reset-{chromium,webkit}-{plain,shorthand}.log` and `/private/tmp/retouch-size-reset-units.log`. Full parity remains unfinished.


## Compiled flex sizing verification

`RT_E2E_FLEX_SIZING=1` adds a real flex parent and responsive arbitrary flex/grow/shrink/basis declarations to the isolated layout sizing fixture. Together with the important size shorthand variant, Chromium and WebKit verify that fixed width removes conflicting main-axis declarations, Hug-to-Fixed retains size, Fill occupies the parent's actual content width including the child's padding/borders, and Reset returns to the inherited width. Height and Phone styles remain unchanged; all transitions have exact source Undo/Redo. This closes the prior arbitrary-flex browser validation gap for the horizontal flex fixture. Column layouts, broader auto-layout parity and universal support are not established by this test. Logs: `/private/tmp/retouch-flex-sizing-{chromium,webkit}.log`. No production code changed in this verification milestone.


## Cross-axis and grid Fill uses stretch

For a flex cross axis and either grid dimension, Fill now uses an automatic dimension plus the relevant stretch alignment instead of a 100% content-box size. This allows margins, padding and borders to fit within the parent's available space. Grid width uses justify-self; grid height and flex cross-axis sizing use align-self. Other-axis alignment remains intact. Important size and place-self shorthand priority is respected. The sizing menu recognizes these stretch modes as Fill. Reset removes the axis dimension and stretch override while preserving non-stretch alignment choices and alignment shorthands.

866 unit tests pass. New self-contained `retouch/test/e2e/layout-stretch-fill.cjs` passes Chromium/WebKit for column-flex width, row-flex height, grid width and grid height. Each case measures occupied space including margins/padding/borders, preserves the other dimension, verifies Phone isolation, removes stretch on reset, and checks exact Undo/Redo. The final fixture includes an important place-self shorthand. Logs: `/private/tmp/retouch-stretch-fill-{chromium,webkit}.log` and `/private/tmp/retouch-stretch-fill-units.log`. This does not establish complete writing-mode, intrinsic-size, arbitrary-layout or framework parity. Native distribution remains unfinished.


## Writing-mode-aware sizing axes and arrangement labels

`layoutAxes` maps physical width/height to the container's inline/block/flex-main axes. Single-layer Fixed/Hug/Fill/Reset now uses this mapping for flex geometry and grid alignment, and the Fill menu reads the same axes. Arrange children labels describe visible Horizontal/Vertical directions rather than assuming CSS row is horizontal. CSS reference: https://www.w3.org/TR/css-flexbox-1/#flex-direction-property (row follows the current writing mode's inline axis).

867 unit tests pass, including vertical/sideways modes and reversed flex directions. Chromium/WebKit pass all six flex-row/flex-column/grid width/height cases in verified `vertical-lr`, including direction labels, available-space geometry, retained other dimension, Phone isolation and exact reset/history. Horizontal cases also pass. Final evidence: `/private/tmp/retouch-writing-axis-{chromium,webkit}-vertical-lr.log`, matching `-horizontal-tb.log`, and `/private/tmp/retouch-writing-axis-units.log`. An earlier fixture applied replaceAll only to the last concatenated string and therefore stayed horizontal; the final fixture parenthesizes the complete source and explicitly asserts computed parent writingMode. Earlier unsuffixed vertical-rl logs are not vertical-mode evidence. Broader writing-mode controls (including gap labels), sideways browser behavior and full parity remain unfinished.


## Physical gap controls with shorthand priority

Horizontal/Vertical gap labels and writes now map through the selected container's writing mode. A physical-axis gap edit replaces that axis's class or arbitrary property while retaining the other axis and gap shorthand. Important gap shorthand priority is carried into the new axis override, so an apparently successful control change cannot be defeated by the retained shorthand. Numeric validation remains bounded to 0..10000px.

868 unit tests pass. New isolated `layout-physical-gap.cjs` passes Chromium/WebKit with both horizontal-tb and verified vertical-lr: row-flex, column-flex and both grid axes. It measures the actual distance between child rectangles, checks unchanged other-axis computed gap, retains the important shorthand, verifies Phone base spacing, and restores exact source plus geometry through Undo/Redo. Evidence: `/private/tmp/retouch-physical-gap-{chromium,webkit}-{horizontal-tb,vertical-lr}.log` and `/private/tmp/retouch-physical-gap-units.log`. Percentage-gap display, broader writing-mode controls and full parity remain unfinished.


## Refreshed desktop package from be8e911

Built the accumulated editor/component/layout changes into `/private/tmp/retouch-desktop-editor-refresh-20260911/Retouch-0.1.0-mac.zip`. SHA-256: `848e8ae4196017e403875c297df7ac31086d35ad92711992ba3561e8cd4d4080`. All 172 packaged source files match both checkout and archive; arm64/x86_64, Info.plist, signature resources and strict ad hoc signature verify. Local file-URL cask syntax passes. Six browser workflows pass against symlinked runtime directories inside this bundle: component-property-selection, layout-physical-gap and layout-stretch-fill in Chromium/WebKit. The harness was removed after checks; the package still verifies. Receipt: `desktop/verification/2026-09-11-editor-refresh.json`.

Native self-tests were skipped at build time. The previous owned d3a021f-era app process had no discoverable window and was stopped. A single controlled refreshed-app launch produced PID 1757, but CUA returned cgWindowNotFound on launch and subsequent inspection of that same running process. It was stopped and verified absent. Native interaction remains unverified, not passed. No quarantine changes, signing-key retry, cask installation/upgrade, notarization or public release occurred. Full parity and trusted native distribution remain unfinished.


## Reproducible desktop source manifests and package verification

Builds now embed a source manifest before signing and invoke `desktop/scripts/verify-package.cjs` before archiving. The verifier checks the complete source inventory, hashes, Info.plist, arm64/x86_64 and strict signature without launching the app. `test-package-verifier.cjs` validates relocation and rejection of altered source, omitted/duplicate/traversal entries, unlisted source, plist changes and source symlinks; restored copy and original verify afterward.

Final build: `/private/tmp/retouch-desktop-manifest-final-20260911/Retouch-0.1.0-mac.zip`, SHA-256 `4fd349295a6eed679d8cfc4f832e89f253b45bb7b1e92e7ac21f286d0587a361`. Manifest reports base 492497d and dirty=true for the packaging edits, with script hashes. All 172 runtime source hashes exactly match the earlier six-workflow browser-verified bundle; ZIP source/manifest equality and cask syntax also pass. Receipt: `desktop/verification/2026-09-11-package-manifest.json`. No native launch, key-access prompt, installation or notarization was attempted. Finder inspection worked, so native window failure is not a complete desktop-tool outage; no specific Retouch startup cause was established. Full parity and native trust remain unfinished.


## Staged desktop rebuilds preserve prior usable outputs

The build now locks its destination, compiles/signs/verifies/archives in a unique sibling directory, and publishes app/ZIP/hash only after success. `publish-package.cjs` retains backups and rolls back ordinary publication failures; failed rollback preserves recovery files. Staging and the owned lock are cleaned on success or ordinary build failure. Competing locks are refused without removal. Crash/power-loss atomicity across all files is not claimed.

Five filesystem publication/rollback/lock tests pass. An actual deliberately failed npm build preserved the prior strict-signature-verified app and byte-identical archive; the subsequent successful build replaced them and passed package/relocation/tamper/ZIP/source/cask checks with no leftover staging or lock. Final archive: `/private/tmp/retouch-desktop-staged-20260911/Retouch-0.1.0-mac.zip`, SHA-256 `f30de5ee113c1f66e27693ab1e9858ff539ba48342327e1e6c8fbc61313206f8`. All 172 runtime hashes match the six-browser-workflow editor-refresh receipt. Receipt: `desktop/verification/2026-09-11-staged-build.json`. No native launch, signing-key prompt, installation or notarization occurred. Full parity remains unfinished.


## Gap fields preserve percentages and accept explicit units

The Layout gap fields now display computed percentages verbatim rather than stripping their units and presenting them as pixel counts. They accept nonnegative px, %, rem, em, vw, vh and ch values plus normal; unitless numbers remain pixel input. Invalid/oversized values show field validation without a source write. The class planner retains units and existing axis/shorthand priority behavior. Relative lengths may display their browser-computed pixel value after editing; arbitrary calc expressions and variable editing are not implemented by this field.

869 unit tests pass. Chromium/WebKit each pass percentage gap editing in horizontal-tb and verified vertical-lr with actual child-rectangle measurements, unchanged opposite gap, Phone isolation and exact Undo/Redo. Separate pixel runs pass in both engines, including rejected negative percentage input and subsequent valid edits. Evidence: `/private/tmp/retouch-gap-units-{chromium,webkit}-{horizontal-tb,vertical-lr,pixel-validation}.log` and `/private/tmp/retouch-gap-units-units.log`. The newest desktop package predates this editor change; full parity remains unfinished.


## Per-axis gap reset controls

Layout now offers Reset horizontal gap and Reset vertical gap. Each removes only the selected physical axis's gap class/arbitrary property from the active scope, preserving the opposite gap, shorthand and other breakpoints. The button is disabled when there is no matching axis override. Reset restores the shorthand/inherited spacing rather than writing a hard-coded zero.

870 unit tests pass. Chromium/WebKit pass the percentage-gap fixture in verified vertical-lr for row/column flex and both grid axes, including disabled/enabled reset states, retained shorthand and other-axis gap, actual distance after reset, exact Undo/Redo, validation and Phone isolation. Evidence: `/private/tmp/retouch-gap-reset-{chromium,webkit}.log` and `/private/tmp/retouch-gap-reset-units.log`. Full layout/framework/native parity remains unfinished.


## Gap override priority across smaller breakpoints

Scoped gap writes now inspect the existing inherited-class metadata as well as the active scope. An important inherited gap shorthand or matching gap axis promotes the new breakpoint override; an important opposite-axis declaration does not. Reset still removes only the active axis override. The existing inherited-scope resolver is reused, with its existing base/ascending-minimum-breakpoint boundary.

871 unit tests pass. Chromium/WebKit verify a base important 10px gap, a smaller-breakpoint important 12px gap and a normal tablet 20px shorthand. Editing the tablet axis produces a visible 30px gap, keeps the other gap at 12px, resets to 12px, leaves Phone at 10px and restores exact source/history. Both flex directions and both grid axes pass in verified vertical-lr. Evidence: `/private/tmp/retouch-inherited-gap-{chromium,webkit}.log` and `/private/tmp/retouch-inherited-gap-units.log`. Complex conditional/state inheritance and full parity remain unfinished.


## Sizing priority across smaller breakpoints

Single-layer sizing now considers inherited important dimensions, size shorthand, relevant main-axis flex declarations and stretch alignment when choosing the priority of a breakpoint override. Only relevant inherited properties promote the new classes; opposite dimensions and min/max constraints remain intact. Reset removes active-scope classes without rewriting inherited source.

872 unit tests pass. Chromium/WebKit exercise base important width/height plus a smaller-breakpoint important size and flex basis. At Tablet, Fixed writes the correct content-box dimension, Hug-to-Fixed retains size, Fill occupies available width, and Reset restores the inherited 120px content size. Phone stays at its original dimensions, and exact Undo/Redo passes. Evidence: `/private/tmp/retouch-inherited-size-{chromium,webkit}.log` and `/private/tmp/retouch-inherited-size-units.log`. This reuses the existing inherited-class resolver; arbitrary conditional/state cascade, full parity and trusted native distribution remain unfinished.


## Layout-mode priority across smaller breakpoints

Arrange children now considers inherited important display, flex direction and flex-flow when writing a scoped layout mode. It replaces active arbitrary display/direction properties and preserves flex-flow wrapping while overriding its direction. Unrelated important properties do not promote the new classes.

873 unit tests pass. Chromium and WebKit verify all six modes at Tablet, actual flex child ordering, inherited wrapping, unchanged Phone display and exact source Undo/Redo. Evidence: `/private/tmp/retouch-layout-mode-{chromium,webkit}.log` and `/private/tmp/retouch-layout-mode-units.log`. The existing minimum-breakpoint inheritance boundary still applies. The packaged desktop runtime predates this change; full parity and trusted native distribution remain unfinished.


## Arrangement controls respect inherited priority

Wrap children, Align children, Distribute children and Columns now replace their active arbitrary CSS properties and account for inherited important declarations, including relevant flex-flow, place-items, place-content and grid shorthands. Shorthands remain intact so their other properties survive. Invalid arrangement values are rejected by the planner.

874 unit tests pass. The expanded layout-mode browser fixture passes in Chromium and WebKit: actual computed wrapping, alignment, distribution and three-column grid override smaller-breakpoint important shorthands, with exact Undo/Redo. Existing six-mode ordering, wrapping and Phone isolation checks still pass. Evidence: `/private/tmp/retouch-arrangement-{chromium,webkit}.log` and `/private/tmp/retouch-arrangement-units.log`. Complex conditional/state inheritance, full Figma parity and trusted macOS distribution remain unfinished; the desktop package predates these changes.


## Physical padding edits and per-edge reset

Padding fields now replace active physical edge classes and arbitrary physical padding declarations. Relevant important physical-axis/all-edge shorthands in the active or inherited scope promote the new edge override. Each edge has a Reset control that removes its active override while preserving shorthands, other edges and other scopes.

875 unit tests pass. Chromium/WebKit verify all four edges against an inherited important two-value padding shorthand: changing to 30px affects only that edge, Reset restores inherited spacing, Phone stays at 10px on every edge, and exact source Undo/Redo passes. Evidence: `/private/tmp/retouch-padding-{chromium,webkit}.log` and `/private/tmp/retouch-padding-units.log`. Logical padding properties and complex conditional/state cascade remain outside this verification. Full parity and trusted macOS distribution remain unfinished; the desktop package predates this editor change.


## Responsive size-limit priority and arbitrary declarations

Minimum/maximum width and height now replace active arbitrary physical constraint declarations as well as utility classes. Matching inherited important constraints promote the new scoped value. Reset recognizes both declaration forms; own-value lookup recognizes arbitrary properties and prefers important active declarations.

876 unit tests pass. Chromium/WebKit verify all four constraints against smaller-breakpoint important arbitrary properties, including the actual constrained dimension, retained opposite dimension, invalid negative input without source writes, Reset, Phone isolation and exact source Undo/Redo. Evidence: `/private/tmp/retouch-limits-{chromium,webkit}.log` and `/private/tmp/retouch-limits-units.log`. Logical dimensions, arbitrary conditional/state inheritance, full Figma parity and trusted macOS distribution remain unfinished. The desktop package predates these editor changes.


## Grid span priority and arbitrary placement

Row/column span writes now replace active arbitrary grid-axis shorthand/start/end declarations alongside placement utilities. Relevant important inherited placement and grid-area shorthand promote the new span. Grid-area itself remains intact to preserve the other axis.

877 unit tests pass. Chromium/WebKit verify numeric, full and auto spans on both axes against an inherited important grid-area, including measured dimensions, unchanged opposite axis, Phone isolation and exact source Undo/Redo. Evidence: `/private/tmp/retouch-grid-span-{chromium,webkit}.log` and `/private/tmp/retouch-grid-span-units.log`. Named-area authoring, complex conditional/state cascade, full Figma parity and trusted macOS distribution remain unfinished. The desktop package predates these changes.


## Reset grid placement independently by axis

Grid children now expose Reset column placement and Reset row placement. These remove active axis placement classes/arbitrary declarations without writing auto or removing shared grid-area rules. Buttons are disabled when that scope has no removable axis override.

878 unit tests pass. Chromium/WebKit verify Reset after numeric/full/auto spans on both axes, restored inherited geometry, disabled state after removal, preserved opposite-axis source, exact Reset Undo/Redo and existing Phone isolation. Evidence: `/private/tmp/retouch-grid-reset-{chromium,webkit}.log` and `/private/tmp/retouch-grid-reset-units.log`. Full Figma parity and trusted macOS distribution remain unfinished; the packaged desktop runtime predates this change.


## Desktop artifact refreshed with responsive layout changes

Built the universal desktop app from clean commit `a7c55aef5e4e12c28c5ea19b90c4efb737e89dbf`. Archive: `/private/tmp/retouch-desktop-layout-refresh-20260911/Retouch-0.1.0-mac.zip`, SHA-256 `dcd66381c8f31b6ffaa17852c6f9637e00c800bf48b1aa37a48b5172df15f8d3`. All 172 packaged source hashes match the checkout; the extracted ZIP, strict ad hoc signature, relocation/tamper checks and local cask Ruby syntax pass.

Eight browser workflows passed against the runtime inside the app: layout modes/arrangement, padding, size limits and grid spans/reset in Chromium and WebKit. Browser harness was removed after completion; logs remain beside the artifact. Receipt: `desktop/verification/2026-09-11-layout-refresh.json`. No native launch, signing-key prompt, cask installation or notarization occurred. Native interaction and trusted distribution remain unverified; full Figma parity remains unfinished.


## Grid row count control

The grid inspector now exposes Rows alongside Columns. Both use the rendered track count, excluding named-line labels, and create equal tracks through scoped utilities. Row writes replace active arbitrary row templates and respect inherited important row/grid templates without changing column templates. The inspector explains that content can create additional implicit tracks.

879 unit tests pass, including row priority/validation and named-line count parsing. Chromium/WebKit verify Rows and Columns each produce three computed tracks despite inherited important templates, preserve the opposite template, show the new count and pass exact Undo/Redo. Existing layout-mode and Phone checks pass. Evidence: `/private/tmp/retouch-grid-rows-{chromium,webkit}.log` and `/private/tmp/retouch-grid-rows-units.log`. Custom track sizing, subgrid authoring, full Figma parity and trusted macOS distribution remain unfinished. The latest desktop package predates this change.


## Grid item flow and gap filling

Grid containers now expose Place grid items with Across rows, Down columns and gap-filling variants. Writes replace active flow utilities/arbitrary properties and respect relevant inherited important grid/flow declarations. The UI explains that filling gaps may move later items into earlier empty spaces and normalizes the computed `dense` form to row gap filling.

880 unit tests pass. Chromium/WebKit verify all four modes with measured positions in a grid containing holes, inherited important flow, Phone isolation and exact source Undo/Redo. Test assertions wait for responsive rendering and handle the browser's `dense` serialization (confirmed by a direct Chromium probe); initial premature/exact-serialization assertions were corrected. Evidence: `/private/tmp/retouch-grid-flow-{chromium,webkit}.log` and `/private/tmp/retouch-grid-flow-units.log`. Full Figma parity, general custom-track authoring and trusted macOS distribution remain unfinished; the desktop package predates this change.


## Visual direction: copy Figma's light Design interface

User steering takes precedence over the previous feature-by-feature approach: use Figma's light interface and edit-section structure as closely as possible, adapting field types for websites. The reference is https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar and its properties-panel image https://help.figma.com/hc/article_attachments/31937313497879. Continue refining against screenshots, not inventing a different visual language.

Implemented white sidebars, light gray canvas, bundled Inter 4.1 with its OFL license, compact inset controls, sentence-case headings, paired dimensions/padding, SVG layout-mode segments, a floating canvas tool dock, editable layer heading, and Position/Layout/Appearance/Fill/Stroke/Effects ordering. Typography is contextual to text; component properties remain ahead of geometry. Source metadata, detailed explanations, and specialist controls use disclosures. Layer actions have a disclosure at the bottom of the Layers panel. HTML property groups are merged into the same primary sections; text editing and image framing remain accessible.

880 unit tests pass. Chromium/WebKit pass the new light-inspector test (font loaded, section order, segmented layout, opacity edits, exact undo, layer actions, screenshots), the existing layout-mode/arrangement workflow, and the full HTML-site workflow (including multi-selection, effects, assets, page navigation and history). The HTML test now opens the two deliberately collapsed action/appearance disclosures. Screenshots: `/private/tmp/retouch-figma-light-{chromium,webkit}.png` and `/private/tmp/retouch-figma-paint-{chromium,webkit}.png`. Logs: `/private/tmp/retouch-inspector-light-{chromium,webkit}.log`, `/private/tmp/retouch-light-html-{chromium,webkit}.log`, `/private/tmp/retouch-light-{chromium,webkit}.log`, `/private/tmp/retouch-light-units.log`.

This is a concrete visual baseline, not proof of pixel-identical Figma behavior across every section or complete Design parity. Further work should prioritize visual fidelity and coherent edit sections. The unfinished custom-grid-track experiment was saved outside the working tree at `/private/tmp/retouch-custom-tracks-wip.patch` and `/private/tmp/retouch-custom-tracks-wip.cjs`; named-line underscores hit the writer's class-token guard. Do not resume that feature ahead of the user's design direction.


## Desktop bundle includes the Figma light baseline

Clean source commit `ca6dae186908015a0aeff54d479c7212ecc95c1e` is packaged at `/private/tmp/retouch-desktop-figma-light-20260911/Retouch-0.1.0-mac.zip`, SHA-256 `46b0162d8c6e81b296e03221c6a14a4b1e3572d1a848b8987e6caa6df7ea05f2`. All 175 packaged runtime files match the checkout, including the inspector organizer, Inter font and license. Universal architecture, strict ad hoc signature, extracted ZIP and cask syntax checks pass. The light-inspector workflow passes in Chromium/WebKit using the runtime inside this app. Receipt: `desktop/verification/2026-09-11-figma-light.json`. Native launch and installation were not attempted; trusted signing/notarization remain unfinished.


### Typography presentation refinement (2026-09-11)

Continued the Figma light-panel direction: paired weight/size and line-height/letter-spacing fields, SVG text alignment segments backed by the original select callbacks, and disclosures for text content, preview, and advanced type settings. Existing accessible input names and source mutation handlers are preserved. Width/height CSS labels now use W/H.

Validation: 880 unit tests passed; inspector-light.cjs passed in Chromium and WebKit, including alignment editing, exact source undo, content disclosure visibility, and screenshots. Screenshot: /private/tmp/retouch-figma-type-chromium.png. This source refinement is newer than the ca6dae1 desktop bundle; no new native launch or packaging claim. Full pixel parity remains unfinished.

The full HTML browser workflow also passed in Chromium after updating its text-content disclosure interactions.


### Figma layout clipping control (2026-09-11)

React layout now exposes Clip content under sizing, with mixed overflow shown as an indeterminate checkbox. The class planner replaces local shorthand/axis overflow together, retains other scopes, and promotes overrides when inherited overflow is important. Reset reveals inherited rules; inline-controlled overflow is disabled. HTML clipping now clears local axis overrides in the same operation. Checkbox fields use a compact label/control layout.

Validation: 881 unit tests passed. Chromium and WebKit inspector-light workflows passed, including mixed state, important inherited clipping, unclipping, and exact undo. Full Figma/any-site parity remains incomplete.


Desktop refresh: /private/tmp/retouch-desktop-layout-clip-20260911/Retouch-0.1.0-mac.zip. SHA256 aeaa6e24d6188fce2d6e3dea80ee75e1efc1c5b29275b0ffa2ac9ed56ab2e0ff. Clean source commit 20fdbe5, 175 packaged source files, universal arm64/x86_64, strict ad hoc signature verification. Extracted archive hashes match checkout. Bundled inspector-light browser workflows passed in Chromium and WebKit, including typography and clipping. Local cask Ruby syntax passed; native launch, cask installation, Developer ID signing, and notarization were not verified. Receipt: desktop/verification/2026-09-11-layout-clip.json. The full HTML Chromium browser workflow also passed after the clipping changes.


### Physical flex alignment picker (2026-09-11)

React flex layouts now have the same nine-point physical alignment picker as the HTML adapter. A click writes justify-content, align-items, and (for wrapping) align-content in one class update/history operation. It reuses the existing writing-mode, RTL, reversed-direction, and reverse-wrap mapping. Local conflicting utilities are replaced; inherited important place-items/place-content and individual alignment rules promote overrides. Inline-controlled alignment disables the picker. Grid retains its existing controls.

The light inspector places the picker beside the horizontal/vertical gap fields. Chromium and WebKit inspector-light workflows passed with actual child bounding-box checks for top-left and bottom-right placement across row, column, row-reverse, and column-reverse, including inherited important rules and exact undo. 882 unit tests passed. Screenshot: /private/tmp/retouch-figma-alignment-chromium.png. This source change is newer than the 20fdbe5 desktop archive. Full Figma/any-site parity remains unfinished.


### Physical layout mode buttons across writing directions (2026-09-11)

Fixed a presentation mismatch: the native layout menu already mapped CSS row/column to physical directions, but the segmented icon buttons assumed horizontal writing. Layout now supplies its inline-axis orientation to the organizer; Vertical and Horizontal buttons keep their visual order/icons and choose the corresponding CSS direction.

Validation: 882 unit tests passed. Full inspector-light workflows passed for vertical-rl RTL in Chromium and WebKit, plus horizontal-tb RTL and sideways-lr RTL in Chromium. The latter runs explicitly test both physical mode buttons. All runs exercise four flex directions with actual corner placement, inherited important styles, clipping, typography, and exact undo. These source changes and the preceding alignment picker are newer than the 20fdbe5 desktop archive. Full parity remains incomplete.


### Visible responsive edit-range feedback (2026-09-11)

The inspector now labels the scope selector Edit styles for and keeps an accessible edit-range status visible below it. Base scope, matching preview, mismatched preview, and unknown match are distinct states. A mismatched scope keeps Preview this breakpoint directly accessible; supporting comparison actions and explanatory details remain in Breakpoint options. This fixes the light organizer hiding the mismatch warning/action alongside advanced details.

Chromium and WebKit inspector-light passed: switching a Tablet edit scope to Phone visibly reports mismatch, the direct preview action restores a matching viewport, and preview-only changes preserve source. Chromium breakpoint-preview also passed comparison editing/undo/redo, reload/persistence/reuse, source integrity, and separate preview history after updating its flow to open Breakpoint options for comparison buttons. This source refinement is newer than the packaged 20fdbe5 desktop archive. Full parity remains unfinished.


### Readable breakpoint labels (2026-09-11)

The style scope selector now presents simple minimum-width conditions as pixel ranges, for example 768 px and larger · md, retaining named identity when multiple scopes share a threshold. Generated scopes omit raw min-[...] syntax. Complex and non-width conditions retain their original descriptions. em/rem ranges use the initial font size, and absolute CSS units use their pixel conversion; labels do not round away fractional thresholds. Underlying scope values and authoring behavior are unchanged.

Validation: 883 unit tests passed; the focused responsive suite passed again after removing label rounding. Chromium and WebKit inspector-light workflows passed with the named 768 px label assertion, responsive match/preview recovery, physical layout edits, clipping, typography, and exact source undo. New source UI remains newer than the 20fdbe5 desktop archive. Full Figma/any-site parity remains incomplete.


Desktop refresh: /private/tmp/retouch-desktop-responsive-light-20260911/Retouch-0.1.0-mac.zip. SHA256 97a1fae340349bb8a069c01f71d41ec87d8b115cb311c2b832add49a1a5fbada. Clean source f8394de, 175 source files matching the extracted archive, universal arm64/x86_64, strict ad hoc signature verification. Bundled inspector-light passed Chromium/WebKit; bundled breakpoint-preview passed Chromium comparison edit/history, reload/persistence/reuse, source and preview-history checks. Local cask Ruby syntax passed. Native launch, installation, upgrades and trusted distribution remain unverified. Receipt: desktop/verification/2026-09-11-responsive-light.json. Desktop README now names this current artifact and distinguishes historical native evidence. Full parity remains incomplete.


### HTML typography presentation parity (2026-09-11)

HTML typography already belonged to Typography; its CSS-labeled fields now receive the same compact presentation as React: paired weight/size and line-height/letter-spacing, physical text alignment icon buttons, and less common style/decoration/case controls in Type settings. Paint labels are shortened without changing accessible field names or write handlers.

Full HTML browser workflows passed in Chromium and WebKit, including the added alignment edit/exact undo check and paired-field assertion, and the explicit Type settings disclosure for italic/underline edits. Final label shortening was checked in a fresh Chromium preview with alignment/undo and a visually inspected screenshot at /private/tmp/retouch-html-type-chromium.png. The current f8394de desktop archive predates this refinement. Full parity remains incomplete.


### Compact Fill and Effects actions (2026-09-11)

The HTML Add gradient action is now a plus button on the Fill header, retaining its accessible name and original callback. Clear background images/reset gradient fills and clear layer/background filter actions live in Fill options/Effect options disclosures. This removes standalone inactive actions from the main field list. Background blur also has a shorter visible label.

Full HTML workflows passed in Chromium and WebKit after explicitly opening the disclosures where needed, including adding and editing multiple gradients, clearing filters, responsive gradient reset, and exact undo. The current screenshot was visually inspected at /private/tmp/retouch-html-type-chromium.png. Current desktop archive f8394de predates this and the preceding HTML typography presentation changes. Full parity remains incomplete.


### Compact workspace toolbar visibility (2026-09-11)

Reproduced a light-toolbar regression at 720px window width: opening the right inspector drawer covered the dock's right edge. Dock placement now considers the canvas area left visible by compact Layers/Inspector drawers and responds to workspace-layout changes even when canvas dimensions do not change.

The added no-overlap regression failed before the fix and passed afterward in Chromium and WebKit. The full workspace-panels workflow also passed panel persistence, compact drawers, selection, Escape/focus, source edits/undo, and return to wide layout. Screenshot inspected: /private/tmp/retouch-compact-chromium.png. This source change is newer than the f8394de desktop archive. Full parity remains unfinished.


### Spatial individual-corner fields (2026-09-11)

Both HTML and React individual-corner fields now use a spatial 2x2 grid: top-left/top-right above bottom-left/bottom-right. HTML corners live in an Individual corners disclosure, with the shared CSS radius paired with opacity. Original accessible field names and write callbacks are retained.

React Chromium inspector-light and HTML WebKit workflows passed one-corner edits with other-corner preservation and exact undo. The first HTML Chromium full run passed the corner checks but timed out later at a missing breakpoint option in the shadow workflow (line 254); an unchanged rerun passed the full workflow. That intermittent resize/scope synchronization remains unexplained. Screenshot /private/tmp/retouch-corners-chromium.png was visually inspected. These source changes postdate the f8394de desktop archive. Full parity remains incomplete.


### Retain viewport refreshes while inspector work is pending (2026-09-11)

Found a reproducible dropped refresh: both viewport refresh paths discarded changes when panelTasks was nonzero. The shared queued refresh now marks the panel deferred in that state, and busyPanel completion queues a retry. Focused inspector interaction continues to defer replacement. Embedded-window resize uses the same queue.

New viewport-busy.cjs failed before the change and passed afterward in Chromium/WebKit: hold the inspector busy across an actual iframe resize, release it, and verify the new 820px breakpoint option appears without a source change. A separate normal-resize case preserves a focused 77px draft and its DOM control. Artificially making a draft field busy was excluded from that draft test because busy-state disabling itself commits/blurs the field. The full Chromium HTML workflow and 883 unit tests passed. This is a proven refresh gap; the precise cause of the previous intermittent shadow-workflow failure remains unproven. Source changes postdate desktop archive f8394de. Full parity remains incomplete.


Desktop refresh: /private/tmp/retouch-desktop-inspector-refresh-20260911/Retouch-0.1.0-mac.zip. SHA256 8be2210219b5cab2ddf41915fbcc7da73c709c95558e6e73e3c22d27c9a3ed33. Clean source af62db6, 175 source files matching the extracted archive, universal arm64/x86_64, strict ad hoc signature verification. Six bundled-runtime workflows passed: HTML editing, compact workspace panels, and busy viewport refresh/draft preservation, each in Chromium and WebKit. Cask Ruby syntax passed. Native launch, installation, upgrades, Developer ID signing and notarization remain unverified. Receipt: desktop/verification/2026-09-11-inspector-refresh.json. Full parity remains incomplete.


### Corner radius inherited priority (2026-09-11)

Reproduced a React corner edit failing to override sm:!rounded-[20px] at the md scope. Added cornerRadiusClasses for single/all-corner writes: preserve unrelated corners/scopes, remove conflicting active physical radius declarations, and promote the authored utility when active or inherited radius rules are important. The existing numeric radius controls now use this planner.

The inherited-radius Chromium browser regression failed before wiring the fix. Chromium and WebKit inspector-light now pass single-corner edits with other-corner preservation, shared radius edits affecting all four corners, and exact undo. 884 unit tests passed, including arbitrary physical radius replacement and scope preservation. This verifies the tested class cascade; general complex/logical/inline cascade parity remains unfinished. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


### Radius override reset controls (2026-09-11)

React radius controls now expose a compact shared reset and one reset per physical corner. The planner accepts null to remove active overrides: a single-corner reset preserves shared shorthand radii and other corners; the shared reset removes all active radius overrides. Other breakpoint/state tokens remain intact. Individual reset buttons are organized alongside their spatial corner fields.

885 unit tests passed. Chromium and WebKit inspector-light passed edits against inherited important radii, single/shared resets revealing the inherited 20px radius, undo restoring the edited radii, and final exact source undo. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


### Stroke width/style priority and resets (2026-09-11)

React stroke width and style now use a shared class planner that replaces active utility/arbitrary-property overrides and preserves priority against inherited important border rules. Width edits that need to enable a visible style use the same planner. Compact reset controls remove local width/style overrides and stay in the Stroke section. Color behavior is unchanged.

886 unit tests passed. Chromium and WebKit inspector-light passed edits against inherited sm:!border-[2px] and sm:!border-dashed, width edits preserving style, style edits preserving width, resets revealing inherited values, and exact source undo. Arbitrary physical width/style replacement and reset scope preservation have unit coverage. General shorthand/logical/inline cascade completeness remains unproven. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


### Light context menus and drawer shadows (2026-09-11)

Removed the canvas context menu's hard-coded dark background, separator colors, and system font. It now uses the light workspace palette and Inter, with a visible keyboard-focus outline and lighter shadow. Compact drawer shadows also match the lighter elevation treatment.

Chromium/WebKit canvas-context-menu workflows passed explicit light background/text assertions, selection and duplication, exact undo, framing/reparenting, keyboard navigation/focus return, native-input guards, and compact bounds/scrolling. Screenshot /private/tmp/retouch-light-menu-chromium.png was visually inspected. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


### Compact HTML layout groups (2026-09-11)

HTML Layout now pairs physical padding edges, groups minimum/maximum dimensions under Size limits, and groups margins under Outer spacing. CSS-heavy visible labels are shortened while accessible names and existing callbacks remain intact. Common width/height and padding controls stay visible.

Full HTML workflows passed in Chromium/WebKit with the added minimum-width edit/undo and disclosure checks, alongside existing padding/shorthand coverage. A focused fresh Chromium preview additionally passed margin editing/exact undo and visually verified final labels at /private/tmp/retouch-html-layout-chromium.png. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


### Contextual HTML layout and focused-scope refresh (2026-09-11)

Flow layouts now place inactive direction/wrap/alignment/gap fields in Layout options. Flex exposes these fields; grid exposes its applicable alignment/gap controls while retaining flex-only direction/wrap in options. Dimensions and padding stay prominent. Mode changes and exact undo are covered in the HTML browser workflow; screenshot /private/tmp/retouch-contextual-layout-chromium.png was visually inspected.

The first Chromium full run reproduced the missing breakpoint option after resize. A new deterministic viewport-busy case reproduced it by resizing and immediately focusing the style-scope selector: focus preservation prevented its options from refreshing. The viewport queue now permits refresh while that selector is focused, while editable drafts remain protected. The targeted case failed before the fix and passed afterward in Chromium/WebKit, alongside busy-refresh and draft-preservation cases. Both full HTML workflows and 886 unit tests passed after the fix. Source changes postdate desktop archive af62db6. Full parity remains incomplete.


Desktop refresh: /private/tmp/retouch-desktop-design-controls-20260911/Retouch-0.1.0-mac.zip. SHA256 8432e7e52ecb8d763d765c59af9fab53bb0326019ec8f63c25a7400d2e2a569b. Clean source 843f6ef, 175 source files matching the extracted archive, universal arm64/x86_64, strict ad hoc signature verification. Eight bundled-runtime workflows passed: inspector-light, HTML editing, context menus, and viewport-busy/focused-scope/draft preservation, each in Chromium/WebKit. Local cask Ruby syntax passed. Native launch, installation, upgrades, Developer ID signing and notarization remain unverified. Receipt: desktop/verification/2026-09-11-design-controls.json. Full parity remains incomplete.


### Scope refresh through pointer completion with focus preservation (2026-09-11)

Reproduced another scope refresh stall by holding the panel pointer-preservation window across a resize, then releasing it while the scope selector retained focus. Scope navigation now uses the same non-draft focus rule throughout viewport, pointer-release, click-completion, and focusout refresh paths. Rebuilt scope selectors explicitly regain focus without scrolling.

The pointer regression failed before the change. Final viewport-busy tests passed in Chromium/WebKit for synthetic pointerup and click completion, new width options, preserved selector focus, busy-refresh recovery, and focused editable drafts. The broader breakpoint-preview test caught focus loss during implementation; after explicit focus restoration it passed in both browsers with comparison edit/undo/redo, persistence/reuse, and preview history. Workspace-panels also passed both browsers during the change, and 886 unit tests passed. These browser event tests do not establish native macOS interaction verification. Source changes postdate desktop archive 843f6ef. Full parity remains incomplete.


### Compact light action palette (2026-09-11)

The Actions dialog now uses compact Inter typography, a white surface, a lighter backdrop/shadow, and 32px result rows. Viewport-relative limits keep the search and scrollable results usable in short windows. Chromium and WebKit passed the full actions workflow, including source edits, history, layer operations, availability, native input shortcut guards, and keyboard navigation to the final result at 360x320. The test's stale <h1> badge expectation was updated to H1. Screenshot /private/tmp/retouch-actions-light-chromium.png was visually inspected; both browser logs are /private/tmp/retouch-actions-light-{chromium,webkit}.log. These source changes postdate the latest packaged desktop archive. Full Figma parity remains incomplete.


### Variable collection table (2026-09-11)

Added a light collection table with variable rows and named-mode columns, color swatches, alias names, type labels, and selected-variable highlighting. Clicking names focuses the name editor; clicking mode values focuses the matching typed literal/alias editor. Existing save, validation, revision conflict handling, and history paths remain in use. This is table-based browsing with the existing detailed editor, not complete Figma inline-table parity. The light dialog uses compact typography, a sticky heading/Close control, and bounded horizontal table scrolling.

Final variable-library browser workflows passed in Chromium and WebKit: color/number/boolean/string persistence, alias resolution, protected deletion, exact undo, stale revision protection, table navigation/focus, and compact 420x640 containment with visible Close. Final Chromium screenshot /private/tmp/retouch-variable-grid-chromium.png visually inspected; logs /private/tmp/retouch-variable-grid-{chromium,webkit}.log. Source postdates the packaged desktop archive; native verification and full Figma parity remain incomplete.


### Inline variable mode values (2026-09-11)

Mode cells now open typed inline editors for color, number, boolean, string, and existing aliases. Save/Enter commits through the existing revision-checked library replacement path; Cancel/Escape restores the cell without closing the dialog. Successful saves restore cell-button focus. Validation/conflict errors retain the draft and editor focus. Detailed editors still provide literal/alias switching and variable creation.

Chromium and WebKit variable-library workflows passed with direct persistence/restoration for all four literal types, alias selection and cancellation, empty-number rejection, exact file undo for an inline color edit, and stale external-file protection retaining an unsaved cell draft. Existing mode preview, alias protection, detailed editing, and compact dialog checks passed. Screenshot /private/tmp/retouch-variable-inline-editor-chromium.png visually inspected; logs /private/tmp/retouch-variable-inline-{chromium,webkit}.log. Native archive has not been rebuilt for these changes; full Figma parity remains incomplete.


### Inline literal and alias conversion (2026-09-11)

Inline mode cells now offer Value/Alias switching with independent draft retention, explicit target selection, typed alias options, save/cancel, and keyboard focus recovery. Browser testing found saves only resolved default modes, allowing a same-collection Dark-mode cycle. Save planning now resolves every named mode with other collections at defaults before preparing writes. This does not exhaustively validate all cross-collection mode combinations; their preview/application validation remains necessary. Legacy/external cyclic-library preview tests now seed files directly rather than relying on an accepted cyclic save.

Chromium and WebKit full variable-library workflows passed, including alias-to-literal and literal-to-alias persistence, retained switch drafts, missing target rejection, and a Surface/Canvas Dark-mode cycle rejected without file changes or lost focus. Prior typed editing, exact undo, conflict-draft retention, preview, and compact layout checks passed. All 886 unit tests passed (/private/tmp/retouch-variable-alias-units-final.log). Browser logs /private/tmp/retouch-variable-alias-{chromium,webkit}.log; Chromium screenshot visually inspected. Packaged native app not refreshed; full parity remains incomplete.


### Variable search and pinned names (2026-09-11)

Collection tables now filter by case-insensitive name/type terms, show matching counts and an empty state, and retain each collection's search query across rerenders. Filtering toggles existing rows rather than rebuilding cells, preserving hidden unfinished drafts without writing files. Name cells and their header stay pinned while scrolling horizontally across modes.

Full variable-library workflows passed in Chromium and WebKit with multi-term filtering, empty results, selection/query persistence, hide/reveal draft preservation with unchanged source, and pinned names in a compact horizontally scrolled table. Existing inline edits, aliases, cycle rejection, undo, conflicts, and mode preview passed. Logs /private/tmp/retouch-variable-search-{chromium,webkit}.log; screenshot /private/tmp/retouch-variable-search-chromium.png visually inspected. Maximum-size collection performance has not been benchmarked. Native package refresh and full Figma parity remain unfinished.


### Table-focused variable dialog (2026-09-11)

Collection creation, rename, deletion and reload now live in Collection settings, initially expanded for an empty library and collapsed after creation. Explanatory copy moves to About variables. Search, modes and the value table remain directly accessible. Visual review also found canceled inline drafts left stale validation errors; cancel now reports Edit canceled.

Final full variable-library workflows passed in Chromium/WebKit, including initial collection creation, collapsed management controls, reopening settings for revision-conflict protection, and clearing canceled numeric-validation errors. Existing direct values, alias conversion/cycle rejection, exact undo, search draft preservation, and compact scrolling checks passed. Final /private/tmp/retouch-variable-layout-chromium.png visually inspected; browser logs /private/tmp/retouch-variable-layout-{chromium,webkit}.log. Native package refresh and full parity remain incomplete.


### Packaged variable and action editor (2026-09-11)

New local archive: /private/tmp/retouch-desktop-variables-20260911/Retouch-0.1.0-mac.zip. SHA256 49ed3997c07c592e8d3acb0b3c7ae4e0a7cf1ff8b5befb7a22f79ea5377aad99. Clean source 64eb2aa; all 175 packaged source hashes match checkout. Extracted ZIP verification passed for universal arm64/x86_64 and strict ad hoc signature. Six workflows ran against the extracted bundled runtime and passed: variable-library, actions, viewport-busy, each Chromium/WebKit. Local cask generation and Ruby syntax passed. Receipt desktop/verification/2026-09-11-variable-editor.json. Native launch, Homebrew installation/upgrade, Developer ID/notarization and trusted distribution remain unverified for this archive. Full Figma parity remains incomplete.


### Compact light component library (2026-09-11)

Component library uses compact light typography, subtle backdrop/shadow, purple component marks, and divided result rows. The results scroll inside the dialog while heading/search remain visible. The existing insertion dialog shares the lighter controls. Chromium/WebKit component-library-search tests now load real CSS and cover 30 results at 420x420, keyboard navigation to the last insertion callback, retained search/Close visibility, and original usage/selection search behavior. Screenshot /private/tmp/retouch-components-light-chromium.png visually inspected.

A real React library-only run passed search, source/off-page navigation, source refresh, single/required-property insertion, property edits, exact undo/redo, and compact bounds. Run uses page-fonts.cjs with COMPONENT_PROPERTY_EDIT, COMPONENT_CHOICES, COMPONENT_LIBRARY, COMPONENT_LIBRARY_ONLY, UNUSED_COMPONENTS, COMPONENT_INSERT, REQUIRED_INSERT flags; log /private/tmp/retouch-components-real-final.log. Updated stale Main badge assertions. Earlier broad run completed library checks but failed in subsequent property-edit setup waiting for This instance; this remains unresolved, and the new explicit library-only mode does not claim those later checks passed. Browser fixture logs /private/tmp/retouch-components-light-{chromium,webkit}.log. Source postdates native archive 64eb2aa; full parity remains incomplete.


### Visible component editing scope (2026-09-11)

Resolved the prior full component workflow failure: inspector organization moved the untitled scope switch into collapsed More properties. The organizer now places that switch in the selection heading. It exposes a Component editing scope group and aria-pressed states for This instance/Component. A focused pre-fix browser assertion reproduced the hidden control.

Chromium and WebKit library workflows now verify visibility, switching both directions, selected state and unchanged source. The original full Chromium React workflow with component choices, library, unused components, ordinary insertion and required-property insertion passed through component property UI/source/render verification (/private/tmp/retouch-component-scope-full.log). All 886 units passed (/private/tmp/retouch-component-scope-units.log). Targeted logs /private/tmp/retouch-component-scope-{chromium,webkit}.log; pre-fix /private/tmp/retouch-component-scope-before.log. This supersedes the previous unresolved This instance failure. Source postdates packaged archive 64eb2aa. Full Figma parity remains incomplete.


### Light responsive component detail view (2026-09-11)

Component detail dialogs now use the light compact typography/shadow and a bounded flex layout. At <=700px the preview stacks above properties/source, retaining a usable preview area and a fixed dialog header. Wide layout retains two columns. Source-only components continue to omit preview. Preview iframes remain hidden with a loading status until their isolation stylesheet attaches; readiness is exposed via aria-busy=false. This prevents the initial whole-page flash seen during visual review.

Real React component-library workflows passed in Chromium/WebKit with unused/off-page source views, mounted SingleCard isolation, readiness status, 420x540 bounds, preview dimensions, source scrolling with visible Close, selection scope switching and unchanged source. Tests now await isolation rather than merely the footer's first mount. Final /private/tmp/retouch-component-detail-chromium.png visually inspected; logs /private/tmp/retouch-component-detail-{chromium,webkit}.log. Framework dev indicator remains visible in this development preview. Native archive postdates neither this nor the preceding scope changes; full parity remains incomplete.


### Preserve fragment roots in component previews (2026-09-11)

Preview isolation now uses the existing component root grouping metadata instead of only the first matching element. It retains all roots in the selected first group and their ancestor paths while hiding unrelated page branches. A real two-root React fragment reproduced the missing second root before the fix.

Final Chromium/WebKit library workflows passed fragment-root visibility, hidden unrelated heading, preview readiness and compact bounds, duplicate/branch edits, definition navigation and exact undo/redo. Stale Footer/Section badge expectations in the branch workflow were updated to current labels. The single-root Chromium library regression also passed. Final screenshot /private/tmp/retouch-fragment-preview-chromium.png.preview.png visually confirms both Single card and Fragment sibling; framework development indicator remains visible. Logs /private/tmp/retouch-fragment-preview-{chromium,webkit}.log and /private/tmp/retouch-single-preview-regression.log; pre-fix /private/tmp/retouch-fragment-preview-before.log. Repeated runtime occurrence selection and arbitrary portal-root grouping remain separate gaps. Source postdates desktop archive 64eb2aa; full parity remains incomplete.


### Preview the selected repeated occurrence (2026-09-11)

The library View component action now passes its selected rendered element to the preview. The preview captures its index among grouped occurrences and isolates the corresponding group in the preview document. Inspector-launched previews use the current rendered selection when IDs match. Unselected occurrences stay hidden; grouped fragment roots stay together. Matching is positional across the two documents; independently reordered or nondeterministic runtime data remains a separate identity limitation.

Mapped React list fixtures with distinct First/Second occurrence values passed in Chromium/WebKit for single-root and fragment components. Tests choose the second library entry, assert both first roots hidden and both second roots visible, check rendered title, readiness, compact geometry, source access and unchanged source. Logs /private/tmp/retouch-occurrence-preview-{chromium,webkit}.log and /private/tmp/retouch-occurrence-fragment-{chromium,webkit}.log. Screenshot /private/tmp/retouch-occurrence-fragment-chromium.png.preview.png visually inspected. Native package refresh and full parity remain incomplete.


### Preserve preview identity through reordering (2026-09-11)

Preview selection now reuses captureOccurrence/restoreOccurrence from component-instances rather than an unconditional group index. Unique DOM IDs (or supported ancestor identity paths) take precedence; unkeyed occurrences use the existing exact structure check. If restoration fails, the iframe hides and reports Waiting for the selected component rather than showing a different instance. Child changes and relevant ID/source-identity attribute changes trigger recovery.

Chromium/WebKit repeated-fragment tests passed after moving the selected second group's DOM roots ahead of the first, temporarily removing them, and reinserting them. Assertions cover correct selected visibility, hidden unselected roots, waiting state while missing, recovery, compact bounds and unchanged source. An unkeyed positional Chromium regression also passed. Logs /private/tmp/retouch-preview-identity-{chromium,webkit}.log and /private/tmp/retouch-preview-positional-regression.log. These are controlled DOM reorder tests; arbitrary nondeterministic runtime state and portals remain unproven. Source postdates desktop archive 64eb2aa; full parity remains incomplete.


### Homebrew install/uninstall verification (2026-09-11)

Verified the 64eb2aa archive via Homebrew in /private/tmp/retouch-cask-install-check-20260911. Direct standalone cask loading was rejected because current Homebrew requires a tap; a temporary philipshen/retouch-local-verification tap installed successfully with --require-sha and --appdir. Installed bundle passed all 175 source hashes, universal architecture and strict signature checks. com.apple.quarantine was present and untouched. No native launch attempted.

Uninstallation passed. App directory, cask registration, temporary tap and auto-added cask trust entry were verified absent. tap-new help automatically enabled Homebrew developer mode; it was restored to disabled and verified. No other tap trust entries were modified. Install/uninstall logs /private/tmp/retouch-cask-{install,uninstall}-20260911.log. Receipt desktop/verification/2026-09-11-variable-editor.json updated. This establishes local quarantined install/uninstall for archive 64eb2aa, not later source commits, upgrades, native editing, public release, Developer ID signing or notarization. Full parity remains incomplete.


### Refresh component previews (2026-09-11)

Mounted component detail views now have an accessible Refresh preview control in the fixed header. Refresh hides the old frame, restores loading status, loads the captured route, and reuses the selected occurrence bookmark. Existing observers disconnect before reload/onload; close clears both the observer and load handler. Source-only views do not get a refresh control.

Chromium/WebKit mapped-fragment identity workflows passed including DOM reorder, missing-instance recovery, then an explicit refresh. A marker in the old preview document proves a new document loaded; tests verify the selected second occurrence remains visible, first hidden, and source unchanged. Compact preview/source checks passed. Screenshot /private/tmp/retouch-preview-refresh-chromium.png.preview.png visually inspected; logs /private/tmp/retouch-preview-refresh-{chromium,webkit}.log. Native package refresh and full Figma parity remain incomplete.


### Keyboard component browsing (2026-09-11)

Component search Up/Down enters results. Result buttons use Up/Down to move between components while retaining an available action, Left/Right to move between enabled actions, Home/End to reach boundary rows, and Escape/Up-from-first to return to search. Native select keys are preserved. The light dialog shows a small navigation hint and focused-row background.

Chromium/WebKit CSS-backed library tests passed keyboard navigation across 30 compact-window results, disabled-action skipping, native instance-picker arrows, search return, and keyboard insertion callback. Real React mapped-fragment workflows used search Down/Right/Enter to open the selected occurrence preview, then passed identity reorder/removal/recovery and refresh checks in both browsers. Logs /private/tmp/retouch-component-keyboard-{chromium,webkit}.log and /private/tmp/retouch-component-keyboard-react-{chromium,webkit}.log. Screenshot /private/tmp/retouch-component-keyboard-chromium.png visually inspected. Source postdates current native archive; full parity remains incomplete.


### Compact editable component properties (2026-09-11)

Editable component property tables now use Inter and two visible columns, giving value controls 68% of available width. Defaults remain in label tooltips and aria-description on fields; read-only component-detail tables retain all three columns. Reset buttons use a compact icon with their existing accessible names. Typed editors, explicit text commit/cancel, reset/unset and validation callbacks are unchanged.

Full component-property UI/source/render workflows passed in Chromium/WebKit with choices, booleans, numbers, multiline text, empty/unset values, reset, repeated-instance isolation, draft focus, bounded long-text scrolling and exact undo/redo. The short-text size assertion was updated because wider controls no longer need the old narrow-column wrapping; long-text overflow/cap checks remain. Logs /private/tmp/retouch-component-fields-{chromium,webkit}.log. Screenshot /private/tmp/retouch-component-fields-chromium.png visually inspected. Native package refresh and full Figma parity remain incomplete.


### Identify selected components by name (2026-09-11)

The selection heading now displays the component tag/name instead of generic component text. Component layer rows use the theme's purple rather than the previous pale purple. The organizer uses explicit host-tag metadata for text-section ordering, independently of displayed component names. Multiple-selection headings retain their counts.

Chromium/WebKit real React library workflows passed the explicit HeadlineCard heading check plus source/instance scope switching and unchanged source. Chromium inspector-light passed typography/section ordering, layout and appearance edits, exact undo and workspace checks. Logs /private/tmp/retouch-component-heading-{chromium,webkit}.log and /private/tmp/retouch-component-heading-inspector.log. Updated the older Card fixture's generic badge assertion to Card. Source postdates native archive; full parity remains incomplete.


### Packaged component editor and Homebrew verification (2026-09-11)

New archive /private/tmp/retouch-desktop-components-20260911/Retouch-0.1.0-mac.zip, SHA256 a6216639105d53de6adf2a8ab9f744d09f89c5bc939d6a2c886a936212d032e9, clean source 910447c. All 175 extracted source hashes match; universal arm64/x86_64 and strict ad hoc signature checks passed. Six bundled runtime workflows passed: editable component fields, repeated-fragment preview identity/recovery/refresh, library keyboard browsing, each Chromium/WebKit. All 886 units passed. Local cask Ruby syntax, temporary-tap install and uninstall passed. Installed bundle verification passed with quarantine intact. App directory, cask registration, temporary tap and auto-added trust entry were verified removed; developer mode restored to disabled. No native launch attempted. Upgrade, Developer ID signing, notarization and public trusted distribution remain unverified. Receipt desktop/verification/2026-09-11-component-editor.json. Full Figma parity remains incomplete.


### Find filtered selections in Layers (2026-09-11)

Layer search Up/Down focuses matching rows without choosing contextual ancestor rows for a text query. Escape clears a nonempty query. Show selected layer appears when search/lock filtering hides the selection; it clears filters, expands selected ancestors and focuses the existing selection. No source writes are involved.

Chromium/WebKit layer-navigation workflows passed descendant-match focus, empty-result key behavior, reveal/focus recovery, unchanged selection/source, and existing child/parent/sibling/locks/collapse/native-input checks. Screenshot /private/tmp/retouch-layer-search.png visually inspected; logs /private/tmp/retouch-layer-search-{chromium,webkit}.log. Source postdates desktop archive 910447c; full Figma parity remains incomplete.


### Recover partially filtered multi-selections (2026-09-11)

Layer selection recovery now checks all selected tree items, so it appears when only part of a multi-selection is hidden. The label becomes Show selected layers for multiple selected items. Locked-only keyboard search skips unlocked context ancestors. Revealing clears filters without removing locks or changing selected items.

Chromium/WebKit layer-navigation workflows passed locked-only focus, filter clearing with the original lock preserved, and partial multi-selection recovery with exact selected-row preservation. Existing navigation/native-input/source-preservation checks also passed. Logs /private/tmp/retouch-layer-filter-selection-{chromium,webkit}.log. Source postdates native archive 910447c; full Figma parity remains incomplete.


### Consistent vector lock controls (2026-09-11)

Layer lock/unlock controls now use compact monochrome SVG masks rather than platform emoji. Existing accessible labels, aria-pressed state, hover/focus visibility and inherited-lock disabling are preserved.

Full layer-lock workflows passed Chromium/WebKit: canvas selection exclusions, parent inheritance, child-lock preservation, iframe/editor reload, deliberate tree selection, ordered source/lock undo/redo, batch locking, route/branch restoration, guarded shortcuts and filtered recovery. Tests check rendered mask and accessible state; a stale filter step now opens Layer actions first. Screenshot /private/tmp/retouch-layer-lock-icon-chromium.png visually inspected; logs /private/tmp/retouch-layer-lock-icon-{chromium,webkit}.log. Source postdates archive 910447c; full parity remains incomplete.


### Light-theme layer type icons (2026-09-11)

Layers now identify text, image/media, container, SVG, component, and generic elements with compact monochrome vector icons. Icons inherit selection/component colors while retaining existing row text, accessible names, and stable button identity.

Chromium and WebKit layer-interactions workflows passed live-refresh click preservation, modifier selection, rename focus, reparented keyboard navigation, search and disclosure. Added rendered-mask checks for host layer types; the Chromium isolated-layer screenshot /private/tmp/retouch-layer-types.png was inspected. Component icon classification is implemented but not separately exercised by this focused workflow. This source change postdates the packaged 910447c archive. Full Figma visual and functional parity remains incomplete.


### Continuous layer selection and disclosure controls (2026-09-11)

Selection and hover backgrounds now span each full layer row, including indentation, disclosure, type icon, name and lock. Hover no longer overrides the selected background. Component rows retain purple selection styling. Disclosure arrows use consistent vector chevrons with collapsed rotation and hidden leaf indicators.

Chromium and WebKit layer-navigation workflows passed parent/child/sibling navigation, locking, collapse, filtered selection recovery, multi-selection, native input guards and unchanged source. New checks confirm full-row selected color survives hover, the name button is transparent, and leaf chevrons are hidden. The complete Chromium workspace screenshot /private/tmp/retouch-layer-row.png was visually inspected. Native archive remains at source 910447c; these changes are not packaged. Full Figma parity remains incomplete.


### Compact HTML padding controls (2026-09-11)

The HTML Layout section keeps the shared padding field visible and groups individual side controls under Individual padding, reducing the default section height while retaining existing controls and reset callbacks. Disclosure state persists across inspector renders.

The complete HTML browser workflow passed Chromium and WebKit. Added checks cover uniform padding, a top-only override preserving the other sides, disclosure persistence after save, and exact source restoration through undo. The existing later edge-spacing sequence now opens the disclosure before editing. Responsive CSS, standalone export, reset, text/image editing, asset search/upload and page navigation also passed. Logs: /private/tmp/retouch-padding-{chromium,webkit}.log. Inspector screenshot /private/tmp/retouch-padding-inspector.png inspected. React spacing controls are unchanged. This source postdates archive 910447c; full Figma parity remains incomplete.


### Named component canvas badges and React layer verification (2026-09-11)

Canvas component badges now display the resolved component name for both selection and hover, preserving the existing badge node, detach control and identity. React component-layer checks now cover the component vector icon, purple full-row selection under hover, collapse/expand rotation and selection/source preservation. A legacy selection-chrome expectation was updated to the resolved name; that legacy harness was not run in this turn.

The actual Next/React component library workflow passed Chromium and WebKit with library search, refresh, compact bounds, selection and component scope switching. Added checks confirm badges switch from HeadlineCard to hovered Badge and back, and use Inter. No insertion flags were enabled in this run. Screenshot /private/tmp/retouch-component-layers.png inspected; logs /private/tmp/retouch-component-layers-{chromium,webkit}.log. The first visual impression suggested a font mismatch, but computed styles confirmed Inter already applied; no font change was required. Changes postdate native archive 910447c. Full Figma parity remains incomplete.


### Inline component property resets (2026-09-11)

Editable component property reset buttons now occupy a reserved trailing slot beside the field, reducing row height and keeping multiline text resets at the top. Reset-bearing rows have a 40px minimum table-cell height so checkbox reset buttons remain inside their row. Readonly tables and existing reset callbacks are unchanged.

Full React component property UI/source/render workflows passed Chromium and WebKit after the final height correction, including text drafts, keyboard commits, validation, choices, resets and undo/redo. Added geometry checks cover text/number/select reset placement and checkbox row containment. Logs /private/tmp/retouch-inline-reset-{chromium,webkit}.log. The initial-state screenshot /private/tmp/retouch-inline-reset-initial.png was inspected and exposed the checkbox height issue; it predates the final 40px correction, which is covered by geometry checks. Source postdates native archive 910447c; full parity remains incomplete.


### Packaged layer and inspector updates (2026-09-11)

Universal ad hoc development archive /private/tmp/retouch-desktop-layers-20260911/Retouch-0.1.0-mac.zip was built from clean source 4dba5a35ca73e5d68771c5e003021645f5ea2082. SHA256 322e198e63aa131e1ea6773738c795818debf863372b9074e47eb64c9b41bdf8. All 175 packaged source hashes match the checkout, arm64/x86_64 architecture and strict signature checks passed, and 886 units passed.

Eight bundled-runtime browser workflows passed: Layers navigation, broad layer locks, HTML editing and combined React library/property editing in Chromium and WebKit. The combined React run exposed a geometry-test race across a panel refresh; the test now waits and reads both controls in a single DOM evaluation. Final combined workflows passed against unchanged bundled app source. External browser harness removed after jobs finished.

Homebrew temporary-tap install/uninstall passed with isolated app directory and quarantine retained. Installed bundle verification passed; app directory, cask registration, temporary tap and trust entry verified removed, developer mode disabled. Native launch was not attempted; upgrade, Developer ID/notarization and trusted distribution remain unverified. Receipt: desktop/verification/2026-09-11-layer-inspector.json. Full Figma parity remains incomplete.


### Bound long component canvas names (2026-09-11)

Component canvas badges now cap at 240 CSS pixels, truncate long names with an ellipsis, expose the full name through a native title, and prevent the icon/detach button from shrinking. The paint loop avoids rewriting unchanged label text.

Chromium and WebKit React library workflows passed. A synthetic long resolved component name exercises the actual badge renderer; checks verify truncation, full title, maximum width, and the detach button remaining inside the badge at full width. Existing selected/hovered name and component layer checks also pass. Screenshot /private/tmp/retouch-long-component-badge.png visually inspected; logs /private/tmp/retouch-long-badge-{chromium,webkit}.log. This does not establish viewport-edge clamping or arbitrary zoom placement. Source postdates the 4dba5a3 packaged archive; full parity remains incomplete.


### Keep component badges inside page edges (2026-09-11)

Component badge horizontal placement now clamps against the iframe page width, accounting for inverse badge scaling at canvas zoom. Its maximum width also shrinks with the rendered page width, with a 60px floor to preserve the icon and action.

Chromium and WebKit React library workflows passed. A synthetic long name and temporary runtime positioning put the selected component at the right edge; browser checks require the badge to remain within the iframe bounds at 50%, 200% and 100% zoom. Runtime fixture styling is restored and the existing source-preservation assertion passes. Logs /private/tmp/retouch-edge-badge-{chromium,webkit}.log. This covers page-edge clamping, not clipping against a panned canvas viewport or pages rendered narrower than the minimum badge width. Source postdates the 4dba5a3 archive; full parity remains incomplete.


### Custom Tailwind grid track editing (2026-09-11)

Layout now exposes Custom grid tracks for grid containers, with independent column/row expressions, compact inline resets and persistent disclosure state. Supports fixed/flexible tracks, minmax, repeat, named lines and auto, using the selected responsive scope and inherited important priority. Invalid/unsupported expressions do not write source. A scoped class-token allowance now permits escaped literal underscores in grid templates; JSX writer tests prove named line round trips and reject unrelated escapes.

888 unit tests passed. Full Next/Tailwind browser workflows passed Chromium and WebKit after the final inline reset styling: both axes, fixed-flex/minmax/repeat/named lines/auto, invalid values, other-axis preservation, inherited important rules, reset, Phone isolation and exact undo/redo. Logs /private/tmp/retouch-grid-tracks-{chromium,webkit}.log; final screenshot /private/tmp/retouch-custom-grid-inspector.png visually inspected. The former deferred custom-track experiment is now implemented and verified for React/Tailwind. Live Shopify/Liquid custom-track rendering and arbitrary CSS syntax breadth are not proven. Source postdates archive 4dba5a3; full Figma parity remains incomplete.


### Custom grid tracks for HTML sites (2026-09-11)

HTML grid containers now expose the same Custom grid tracks disclosure with separate Column sizes/Row sizes fields, compact inline resets, validation feedback and persistent expansion. Writes use the existing responsive HTML CSS authoring path. A bounded shared browser/server parser accepts fixed/fractional tracks, auto/min-content/max-content, minmax, fit-content, named lines and numeric repeat. Existing adaptive column syntax remains supported. Expressions are limited to 2048 characters, repeat counts up to 24 and at most 128 expanded tracks; arbitrary functions/CSS variables are not newly supported.

889 unit tests passed. New self-contained HTML browser workflows passed Chromium/WebKit for both axes with fixed-flex/minmax/repeat/named lines/auto, malformed input refusal, other-axis preservation, reset, phone breakpoint isolation and exact source undo/redo. Original inline authored grid values restore after reset. Logs /private/tmp/retouch-html-grid-{chromium,webkit}.log; screenshot /private/tmp/retouch-html-grid-inspector.png visually inspected. Source postdates packaged archive 4dba5a3. Full Figma parity remains incomplete.


### Standalone HTML grid export verification (2026-09-11)

The custom HTML grid browser workflow now renders each saved markup version in a separate page with JavaScript disabled and no editor scripts. Both axes are checked at 768, 767, 390 and 1024 viewport pixels, covering the exact breakpoint boundary, original narrow-screen layout and custom larger-screen tracks. Named grid lines must survive in the computed standalone template.

Chromium/WebKit passed all static-export checks together with fixed-flex/minmax/repeat/named lines/auto editing, invalid input refusal, axis preservation, resets and exact source history. Logs /private/tmp/retouch-html-grid-export-{chromium,webkit}.log. This verifies self-contained saved HTML/CSS for these grid workflows; arbitrary site/framework export remains incomplete. No runtime source changes or new package in this turn. Full Figma parity remains incomplete.


### Keyboard commit and cancellation for custom grid tracks (2026-09-11)

HTML and Tailwind custom track fields now save with Enter and discard drafts with Escape. Escape restores the displayed authored/computed value and clears validation errors. An unchanged-value guard prevents cancellation blur from creating a source edit. IME composition is ignored; handled keys do not reach canvas shortcuts. Each field exposes the shortcuts in its title.

Four full browser workflows passed: HTML and Next/Tailwind, each in Chromium/WebKit. Tests cancel both invalid and valid unfinished drafts without source changes, commit all track forms through Enter, and retain responsive isolation, per-axis reset and exact history. HTML standalone export checks with JavaScript disabled also passed. Logs /private/tmp/retouch-{html-grid,grid}-keyboard-{chromium,webkit}.log. Source postdates packaged archive 4dba5a3; full Figma parity remains incomplete.


### Live CSS variables in custom grid tracks (2026-09-11)

HTML track validation now accepts CSS variable references in track breadths, minmax and fit-content, with bounded simple fallbacks and nesting. The HTML parser still rejects malformed variable names, unsafe functions and invalid fallback breadths. Tailwind's existing variable syntax was exercised without a runtime implementation change.

889 unit tests passed. Full HTML and Next/Tailwind grid workflows passed Chromium/WebKit, now including var(--track_size) minmax(0, 1fr) and var(--missing, 80px) 1fr for both axes. Tests change the runtime custom property from 80px to 90px and back, confirm rendered tracks follow it, and verify the authored reference/source remains unchanged. Existing validation, Enter/Escape, responsive isolation, reset and exact history checks pass; HTML standalone CSS export checks with JavaScript disabled also pass. Logs /private/tmp/retouch-{html-grid,grid}-vars-{chromium,webkit}.log. New syntax support is bounded rather than arbitrary CSS expression support. Source postdates packaged archive 4dba5a3; full Figma parity remains incomplete.


### Explicit HTML grid item placement (2026-09-11)

HTML children of grid containers now expose Custom grid placement with independent Column/Row line expressions and compact resets. Numeric lines, negative lines, named lines and start-plus-span forms are supported by a bounded browser/server validator. These fields share keyboard commit/cancel behavior with custom tracks, while keeping independently remembered disclosure state. Visible labels are compact; accessible names remain Column placement and Row placement.

890 unit tests passed. Chromium/WebKit placement workflows verify actual element offsets for 2 / 3, middle / right, 2 / span 2 and -2 / -1 on both axes; invalid-value refusal, Escape recovery, Enter commit, reset and exact undo/redo also pass. Saved HTML renders the placements with JavaScript disabled at 768 and 1024px and restores the original position at 767px. Existing custom-track browser workflows passed both engines after the shared section refactor. Final Chromium screenshot /private/tmp/retouch-grid-placement.png inspected; logs /private/tmp/retouch-grid-placement-{chromium,webkit}.log and /private/tmp/retouch-grid-placement-tracks-{chromium,webkit}.log. Equivalent custom placement for Tailwind is still outstanding. Source postdates archive 4dba5a3; full Figma parity remains incomplete.


### Explicit Tailwind grid item placement (2026-09-11)

Tailwind grid children now expose Custom grid placement with Column/Row expressions and compact per-axis resets. Updates replace only the chosen axis's span/start/end declarations, preserve shared grid-area and other-axis classes, and inherit relevant important priority. Numeric, negative and named lines plus start/span forms use the same bounded validation as HTML. Named line underscores remain escaped through Tailwind classes. Existing span controls remain available; their reset controls now live beside custom placement fields.

891 unit tests passed. Actual Next/Tailwind placement workflows passed Chromium/WebKit with 2 / 3, middle / right, content_start / middle, 2 / span 2 and -2 / -1 on both axes. Tests verify rendered offsets, inherited sm important priority overridden at md, other-axis preservation, invalid values, Escape recovery, Enter commit, Phone isolation, reset and exact undo/redo. Final screenshot /private/tmp/retouch-tw-grid-placement.png inspected; logs /private/tmp/retouch-tw-placement-{chromium,webkit}.log. Live Shopify/Liquid placement is not established. Source postdates archive 4dba5a3; full Figma parity remains incomplete.


### Discover actual grid lines from placement fields (2026-09-11)

HTML and Tailwind placement fields now attach native datalists derived from the selected item's computed parent grid. Suggestions include adjacent named line pairs, named starts with auto ends, numbered tracks, automatic placement and full-grid span. Invalid/reserved names are excluded, suggestions are de-duplicated and bounded, and unknown/non-resolved track counts do not invent numeric options.

892 unit tests passed. All four HTML/Next-Tailwind Chromium/WebKit placement workflows passed with actual-parent suggestion assertions plus placement, responsive, validation and history coverage; HTML standalone export checks remain green. Tests inspect linked datalist values and use normal field editing; native suggestion-popup interaction is not automated in this receipt. Logs /private/tmp/retouch-{html,tw}-grid-suggestions-{chromium,webkit}.log. Source postdates archive 4dba5a3; full Figma parity remains incomplete.


### Controlled native launch investigation (2026-09-11)

The previously verified 4dba5a3 archive was launched once. Process 5449 ran, but two CUA inspections returned cgWindowNotFound. A one-second sample showed an idle AppKit event loop; this does not prove a startup hang or a visible warning. The owned process was stopped.

Source inspection confirmed NSApplication.delegate is weak in the installed SDK. The launcher now uses withExtendedLifetime(delegate) around app.run() to make ownership explicit. A universal diagnostic build compiled and passed strict package verification, but its single launch (process 6078) also returned cgWindowNotFound through CUA. That process was stopped and absence of both owned PIDs verified. The change has not established the cause or fixed native window visibility. Native tests were not run and no quarantine/security settings were changed.

Diagnostic artifact /private/tmp/retouch-desktop-lifetime-20260911/Retouch-0.1.0-mac.zip is based on 71e36b0 with sourceTreeDirty true for the delegate edit, not a clean release. Receipt desktop/verification/2026-09-11-native-lifetime.json; original archive receipt updated with its native attempt. Do not repeat launches without new evidence or a concrete next diagnostic. Browser/source work remains available; full parity and trusted desktop delivery remain incomplete.


### Light native welcome screen (2026-09-11)

The native window now explicitly requests Aqua appearance, and its welcome HTML uses the light editor palette, compact typography, white cards and clear Open a project/Connect to an editor instructions. It continues to point at the real native controls and preserves the user's normal startup command, including Make and shell scripts.

The exact HTML extracted from Swift passed Chromium/WebKit rendering checks at 1440x900 and 800x500 under a dark system color preference. All headings remain visible and the content fits without scrolling. Screenshot /private/tmp/retouch-native-welcome-light.png visually inspected. Universal Swift compilation and strict package verification passed. Native launch was not attempted; the previous cgWindowNotFound result remains unresolved, and Aqua appearance is compiled rather than native-verified.

Diagnostic artifact /private/tmp/retouch-desktop-welcome-light-20260911/Retouch-0.1.0-mac.zip has sourceTreeDirty true relative to 26781f9 and SHA256 d84dd8cfbb86763e024b7fe0ab0a2a73bf121cdd0e6c5b0a83985ff84431c01d. Receipt desktop/verification/2026-09-11-light-welcome.json. This is not a clean release or proof of notarized distribution. Full Figma parity remains incomplete.


### Optional canvas grid guides (2026-09-11)

HTML and Tailwind grid selections now expose Show grid guides. When enabled, the canvas draws non-interactive dashed boundaries for the selected grid or the immediate grid parent of a selected item. Geometry uses resolved track sizes, gaps, content alignment, RTL direction, padding, borders and positive axis-aligned scaling. Unresolved/subgrid track sizes, more than 64 tracks per axis, rotations and vertical writing are not drawn. Guides are session state only and do not change source.

893 unit tests passed. All four HTML/Tailwind Chromium/WebKit placement workflows passed with guide toggle/geometry/source-preservation checks plus existing editing/history coverage. New runtime tests cover padding, borders, centered RTL alignment and scale(1.25), and require guides to disappear on rotation. Screenshot /private/tmp/retouch-html-grid-guides.png visually inspected. Logs /private/tmp/retouch-{html,tw}-grid-guides-{chromium,webkit}.log. Complex scrolling/clipping and other transform/writing-mode geometry remain incomplete. Native window visibility remains unresolved; no native launch in this turn. Full Figma parity remains incomplete.


### Clip grid guides to scrolling containers (2026-09-11)

Grid guide segments now intersect rectangular overflow and paint-containment clips from the grid and its ancestors, plus the iframe viewport. Cross-axis spans cover resolved overflowing tracks, so scrolling does not shorten visible guides to the unscrolled container's original size. Offscreen boundaries are omitted.

All four HTML/Tailwind Chromium/WebKit placement workflows passed. New checks scroll a 320px grid inside a 200px container by 70px horizontally and 60px vertically, verify visible segment endpoints and shifted track edges, and then verify clipping by an overflow-hidden ancestor. Runtime styles/scroll are restored and source remains unchanged. Existing RTL/scaling/rotation and editing/history checks remain green. Screenshot /private/tmp/retouch-scrolled-grid-guides.png visually inspected; logs /private/tmp/retouch-{html,tw}-grid-clip-{chromium,webkit}.log. Curved clips, clip paths, vertical writing and rotated grids remain incomplete. Native window visibility remains unresolved; no native launch in this turn. Full Figma parity remains incomplete.

### 2026-09-11 — Compact layout gap fields

Tailwind flex/grid gap fields now use inline accessible reset controls and Enter-to-save/Escape-to-cancel, with unchanged drafts producing no write. The physical-gap browser workflow checks cancellation of valid and invalid drafts, reset alignment, actual spacing, responsive isolation and exact history. Chromium horizontal pixel gaps and WebKit vertical-rl percentage gaps passed all four flex/grid cases. Screenshot `/private/tmp/retouch-gap-fields.png` inspected. Playwright fallback used because agent-browser is unavailable. Full Figma parity remains incomplete; native visibility and trusted distribution remain unverified.

### 2026-09-11 — Shared React padding and individual-edge disclosure

React/Tailwind Layout now shows one Padding field, displaying Mixed when physical edges differ. A shared edit writes all four edge overrides in one source transaction. Individual padding uses the same compact disclosure structure as HTML, retains its open state during source refresh, and keeps per-edge reset controls. Shared and individual fields support Enter/Escape and unchanged-draft suppression. Chromium and WebKit passed shared mixed/uniform editing, invalid input, one-step undo/redo, inherited important shorthand, phone isolation, four independent edges and disclosure persistence. Screenshot `/private/tmp/retouch-shared-padding.png` inspected. Full parity remains incomplete; this control currently accepts pixel values, while HTML has broader CSS value support.

The shared organizer also passed the full Chromium HTML editing workflow, including spacing, standalone export, responsive styles, reset and exact undo.

### 2026-09-11 — Reset the complete padding group

The shared React Padding field now has an inline Reset padding action. It removes physical/logical padding utilities and arbitrary padding declarations owned by the current scope, including shared shorthands, while preserving unrelated tokens and other variants. Inherited spacing remains intact. Tailwind utility coverage was checked against https://tailwindcss.com/docs/padding . All 34 layout unit tests passed. Chromium and WebKit passed the complete padding workflow plus group reset, disabled state, inherited rendering and exact reset undo/redo. Screenshot `/private/tmp/retouch-padding-reset.png` inspected. Logical declaration removal is unit-tested; no claim of complete logical-padding authoring parity. Full Figma parity remains incomplete.

### 2026-09-11 — Physical padding edits over logical styles

Reproduced a live failure where shared padding saved but important logical padding kept the old rendered spacing (the original important base shorthand masked this). The writer now maps inline/block start/end to physical edges using computed writing-mode and direction. It recognizes relevant important logical shorthands/utilities and replaces/reset same-scope logical edge declarations alongside the selected physical edge. Shared padding passes that same mapping to its single transaction. The mapping follows https://www.w3.org/TR/css-writing-modes-4/#logical-to-physical and current Tailwind logical padding conventions.

35 layout unit tests passed, including mapping, important priority and owned logical-edge cleanup. Browser workflows passed in Chromium for horizontal baseline, RTL, vertical-rl and sideways-lr, plus WebKit vertical-rl: actual four-edge rendering, shared edit, inherited logical important priority, other-edge retention, phone isolation, group/edge reset and exact history. Reproduction log `/private/tmp/retouch-logical-padding-before.log`; passing logs `/private/tmp/retouch-logical-padding-{rtl,vertical-rl,sideways-lr,webkit,baseline}.log`. Browser fixture uses Tailwind 4.1.13; this does not establish compatibility with every Tailwind version or arbitrary stylesheet cascade. Full Figma parity remains incomplete.

### 2026-09-11 — Relative-unit padding authoring

Shared and individual React padding inputs now accept px, %, rem, em, vw, vh and ch (bare numbers remain pixels), with bounded nonnegative validation. Owned physical arbitrary padding lengths remain visible in their authored units; masked non-important overrides fall back to computed values. Mixed/shared editing, Enter/Escape and scoped atomic writes remain intact.

36 layout unit tests passed. Pixel baseline and rem workflows passed in Chromium; percentage workflow passed in Chromium; rem also passed in WebKit. Relative-unit runs verified actual geometry after root font-size or containing-block width changes without source mutation, plus original units in inputs/source, all four edges, reset, phone isolation and exact history. Screenshot `/private/tmp/retouch-relative-padding-rem-chromium.png` inspected. Logs `/private/tmp/retouch-padding-relative-{rem-chromium,percent-chromium,rem-webkit}.log`. CSS variables/calculations and full arbitrary cascade resolution remain incomplete; full Figma parity is not achieved.
