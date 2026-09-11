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
