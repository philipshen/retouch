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

### 2026-09-11 — Preserve authored gap units

React flex/grid gap fields now display owned relative-unit values rather than replacing rem/em lengths with computed pixels after save. Physical-axis mapping follows writing mode, and masked non-important overrides fall back to computed values. 37 layout unit tests passed. Chromium horizontal and WebKit vertical-rl browser workflows passed both flex directions and both grid gap axes, including rem source/input preservation, live root-font response without source mutation, important shorthand, other-axis preservation, reset, phone isolation and exact history. Screenshot `/private/tmp/retouch-gap-relative-chromium.png` inspected; logs `/private/tmp/retouch-gap-relative-{chromium,webkit}.log`. Full Figma parity remains incomplete.

### 2026-09-11 — Current layout desktop archive verification

Built clean source 8388be84ec197217c2f96c1562dc150e784ea1cd into `/private/tmp/retouch-desktop-layout-20260911/Retouch-0.1.0-mac.zip` (SHA-256 a5ddfde0e0fdbdba22491b1d4909f6cc3e4b1bc685169f8bf62e578d33f1b7e3). Universal arm64/x86_64, strict ad-hoc signature and all 175 bundled source hashes verified against checkout. 897 unit tests passed. Extracted bundle passed HTML grid placement/guides/static export, Tailwind grid placement/guides, relative padding and relative gap workflows in Chromium and WebKit (eight workflows).

Generated cask passed Ruby syntax; temporary-tap Homebrew installation, installed-bundle verification, quarantine retention and uninstall passed. Temporary app directory, Caskroom registration, tap and specific trust entry verified absent; developer mode disabled. External harness removed. Receipt: `desktop/verification/2026-09-11-layout-inspector.json`. Native launch was not attempted; earlier GUI visibility issue remains unresolved. Developer ID/notarization, trusted distribution and upgrades remain unverified. Full parity remains incomplete.

### 2026-09-11 — Native window diagnostic narrows the failure

The current clean layout archive was launched once with its existing bounded `--diagnose-window` flag. It completed normally: windowCreated=true, windowVisible=true, windowFrame={{144,69},{1440,992}}, webFrame=1440x894, webLoading=false, screenCount=1. applicationActive=false and windowOcclusionVisible=false. This confirms window construction/load and narrows the prior missing-capture issue; it does not establish foreground/native visual usability.

CUA getApp then launched the same bundle as process 18935 and returned cgWindowNotFound; a second inspection of the existing process also failed. Owned process terminated. Diagnostics `/private/tmp/retouch-desktop-layout-window.json`, empty stderr `/private/tmp/retouch-desktop-layout-window.stderr`; receipt updated in `desktop/verification/2026-09-11-layout-inspector.json`. No quarantine removal or security changes. No native self-tests run. Native capture/activation investigation and full parity remain incomplete.

### 2026-09-11 — Compact gradient-stop rows

HTML and React gradient editors now show each stop as one position/color/remove row, replacing stacked fields and per-stop cards. Full accessible input/remove names remain intact; DOM/Tab order follows the visual order. Existing stop rails and gradient geometry controls remain functional. Browser assertions cover row height <=36px, non-overlap, alignment and input order. React gradient workflows passed Chromium and WebKit; full HTML workflow passed Chromium on the final run. Screenshot `/private/tmp/retouch-gradient-stops-final-chromium.png` inspected. Final logs `/private/tmp/retouch-gradient-stops-final-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`.

Earlier HTML runs exposed a missing breakpoint option before gradient testing (screen-size helper now waits for pending editor work) and a later intermittent deleted-group selection-restoration timeout. The latter did not recur on the final run and remains an investigation item, not a claimed fix. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Restore history selection after preview invalidation

Investigated the deleted-group selection timeout. History restored recorded selection IDs only when `sel` remained set after preview refresh; reload can clear a stale occurrence, causing successful source undo to skip selection restoration. History now restores recorded IDs independently of temporary preview selection state.

New `html-history-selection.cjs` duplicates and deletes a real two-layer HTML selection, deliberately clears stale selection after refresh, and verifies exact restored IDs/source through undo/redo and duplication undo. It failed before the fix at restored-selection verification, then passed Chromium and WebKit. Added it to `test:e2e:html`. Full Chromium HTML editing workflow passed as well. Logs `/private/tmp/retouch-history-selection-{before,chromium,webkit,html-full}.log`. The forced invalidation reproduces the identified race condition; this does not prove every possible intermittent selection issue is eliminated. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Gradient-stop keyboard drafts

HTML and React gradient stop colors/positions now share Enter-to-save and Escape-to-cancel handling. Cancel restores the initial value, clears custom validation and suppresses unchanged writes without clearing selection; IME composition is ignored. React Chromium/WebKit gradient workflows passed invalid-color Enter rejection, error clearing, valid-color/position cancellation, color/position Enter commits and existing source/render/history behavior. Full Chromium HTML workflow passed with the same cancellation checks and color Enter commit. Logs `/private/tmp/retouch-gradient-keyboard-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Full parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Focused gradient defaults

HTML and React gradients now group Color blending, Hue direction, Repeat and repeat guidance under a per-gradient Gradient options disclosure. Type, geometry and compact stops stay visible. Disclosure state survives source refresh and newly revealed hue controls, and accessible summary names identify each fill. React Chromium/WebKit gradient workflows and full Chromium HTML workflow passed; screenshot `/private/tmp/retouch-gradient-options-chromium.png` inspected. Logs `/private/tmp/retouch-gradient-options-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Full Figma parity remains incomplete.

### 2026-09-11 — Gradient-stop color previews

Compact gradient stop color fields now include a decorative inline swatch with a checkerboard transparency background. Valid color drafts update that swatch without writing source; Escape restores the original preview. Native CSS color syntax is retained rather than converted to a hex-only value. React gradient workflows passed Chromium and WebKit, and the full Chromium HTML workflow passed, including swatch visibility, valid draft preview, invalid color handling, cancellation restoration and existing source/render/history checks. Screenshot `/private/tmp/retouch-gradient-swatches-chromium.png` inspected. Logs `/private/tmp/retouch-gradient-swatches-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. This is a preview alongside the text editor; a full Figma-style gradient color picker remains unfinished. Full parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Consistent Fill section actions

React gradient creation now uses the compact plus action in the Fill heading, matching the HTML section treatment. Adding from a collapsed gradient list opens the editing controls. Clear background images and Reset gradient fills move under Fill options while preserving their original handlers, accessible labels and disabled state. React gradient workflows passed Chromium/WebKit with collapsed-list creation and initial hidden clear controls; full Chromium HTML workflow passed. Screenshot `/private/tmp/retouch-fill-actions-chromium.png` inspected. Logs `/private/tmp/retouch-fill-actions-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Full Figma parity remains incomplete.

### 2026-09-11 — Duplicate gradient fills

HTML and React gradient cards now provide an accessible duplicate action in the card heading. It inserts an identical fill immediately behind the selected fill, retaining stops, geometry, repeat and color-interpolation settings, with the existing eight-fill bound. Edits use the current screen scope and the normal single source transaction.

React gradient workflows passed Chromium/WebKit and full Chromium HTML workflow passed. Tests compare complete parsed stacks, edit the duplicated fill independently, preserve original/neighbor fills, and verify exact source undo/redo. Screenshot `/private/tmp/retouch-duplicate-fill-chromium.png` inspected; logs `/private/tmp/retouch-duplicate-fill-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Bidirectional gradient ordering

HTML and React gradient cards now include Move down when another fill follows, complementing Move up. The action swaps adjacent fills through the existing scoped source transaction. React gradient workflows passed Chromium/WebKit; the full Chromium HTML workflow passed. Checks compare complete parsed stacks after reordering independently edited duplicates and verify exact source restoration on undo. The HTML test initially had a duplicate local variable declaration; renaming the test variable resolved it before the successful run. Logs `/private/tmp/retouch-gradient-order-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Compact gradient card actions

HTML and React gradient cards now group move up/down, duplicate and remove as 22px icon actions in the card heading. Original source handlers, disabled states, full accessible names and tooltips remain attached. This removes repeated text action rows from the editing body. Chromium/WebKit React gradient workflows and the full Chromium HTML workflow passed, including heading bounds, compact height, accessible icon actions, independent edits, ordering and exact undo/redo. Screenshots `/private/tmp/retouch-gradient-actions-page-fonts-chromium.png` and `/private/tmp/retouch-gradient-actions-html-site-chromium.png` inspected. Logs `/private/tmp/retouch-gradient-actions-geometry-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Full visual/feature parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Keyboard navigation for fill actions

Gradient card actions are now named horizontal toolbars with one tab stop per row. Left/right arrows wrap through enabled actions, Home/End select the first/last action, and native Enter/Space activation is retained. Modifier shortcuts are left alone. Focus updates the row's tab stop; disabled buttons are excluded from navigation. React gradient workflows passed Chromium/WebKit and the full Chromium HTML workflow passed, asserting one tab stop, focused action names after each navigation key, no source write while navigating, Enter-to-reorder and exact undo restoration. Logs `/private/tmp/retouch-gradient-toolbar-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Preserve useful focus after fill actions

Gradient actions now queue focus through the existing selection-bound panel focus mechanism before writing source. Move actions target the moved fill's type control; duplication targets the new copy. Removal targets the next remaining fill (or preceding last fill), and removing the sole fill targets the section add button. Deliberate subsequent interaction still cancels queued focus. React gradient workflows passed Chromium/WebKit and full Chromium HTML workflow passed, checking actual activeElement after duplication, Enter reordering, removal with remaining fills and last-fill removal, with exact source restoration after undo. Logs `/private/tmp/retouch-gradient-focus-removal-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Reverse gradient stops

HTML and React gradient options now provide Reverse stops. It mirrors each stop position around 50 percent and reverses the ordered colors, preserving geometry, repetition, interpolation and neighboring fills through the existing scoped writer. The action retains keyboard focus after refresh. React gradient workflows passed Chromium/WebKit and full Chromium HTML workflow passed, comparing complete parsed rendered stacks and exact source restoration after undo. Logs `/private/tmp/retouch-gradient-reverse-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Visual gradient color picker

Gradient stop swatches now open a light, anchored color dialog. It provides an sRGB saturation/brightness plane with pointer and arrow-key editing, a hue spectrum, alpha slider, checkerboard preview, CSS value input and Apply/Cancel. Display P3 stays in its original gamut and exposes RGB channel controls; other supported CSS colors retain text editing. Draft changes do not write source. Apply uses the existing scoped stop handler and focus restoration; Escape/Cancel and unchanged Apply do not write. The dialog is clamped to the window and repositions on resize. Fixed inherited busy-fieldset state being copied permanently onto React swatches during rendering.

Validation: 897 unit tests passed. React gradient workflows passed Chromium/WebKit and full Chromium HTML workflow passed, covering draft cancellation, invalid-value rejection, P3 alpha, applied source colors and exact undo. New `test/e2e/paint-picker.cjs` passed both engines with actual pointer/keyboard HSV values, alpha preservation, P3 channel writes, no-op Apply and 360px window bounds; registered in test:e2e:html. Logs `/private/tmp/retouch-picker-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log` and `/private/tmp/retouch-picker-unit.log`; screenshots with the same browser names inspected in Chromium and WebKit.

This is an initial visual picker: live canvas draft preview, eyedropper, explicit color-model conversions and the complete Figma paint UI remain unfinished. The latest desktop archive predates these changes. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Live gradient color preview

The visual picker now previews valid draft colors on the selected canvas element, gradient card and stop rail. It overrides only background-image temporarily; source remains unchanged until Apply. Apply restores the temporary DOM style before the existing source transaction. Cancel/Escape, target removal and dialog close restore preview state. Restoration preserves unrelated concurrent styles and does not overwrite an independently changed background image. Cancel/target-removal cleanup is synchronous; a focused Chromium test exposed a race when relying solely on the queued dialog close event. The backdrop is transparent so canvas colors remain accurate.

React gradient E2Es passed Chromium/WebKit with live appearance changes, no draft source writes, exact cancellation and source undo. The full HTML workflow initially stopped before the picker at the shadow section's breakpoint selector (missing min-768 option); its bounded rerun passed. Logs `/private/tmp/retouch-picker-live-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`, `/private/tmp/retouch-picker-live-html-site-chromium-retry.log`. Focused paint-picker tests passed Chromium/WebKit after the synchronous cleanup fix, covering original absent styles, important background values, unrelated concurrent width changes, independently replaced background images, neighboring fills and target invalidation. Chromium gradient workflow also passed with the transparent backdrop; screenshot `/private/tmp/retouch-picker-live-untinted-chromium.png` inspected and log of the same stem. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Precise opacity controls

The color picker now pairs its opacity slider with a numeric percentage field and renders a transparent-to-opaque color track over a checkerboard. Empty/out-of-range percentages block Apply. Non-byte alpha values use CSS rgb alpha instead of lossy hex serialization; parsing functional sRGB colors preserves their alpha through HSV edits. The control remains synchronized with raw CSS value and Display P3 channels, and live previews use the existing cleanup transaction.

Focused paint-picker tests passed Chromium/WebKit with 12.34 percent retained through hue/saturation editing, invalid/empty percentage rejection, 50 percent Apply and transparency track rendering. React gradient workflows passed both engines and the full HTML Chromium workflow passed with numeric alpha application and exact undo. Logs `/private/tmp/retouch-picker-alpha-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`; screenshot `/private/tmp/retouch-picker-alpha-page-fonts-chromium.png` inspected. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — Compact RGB channel editing

The picker now exposes R/G/B fields in a compact row for both sRGB (integer 0–255) and Display P3 (0–1). Channels synchronize with hue, the visual surface, opacity and the CSS value, preserving precise alpha. Empty/out-of-range channels block Apply. Numeric channel drafts retain the active input string so decimal P3 values can be typed without refresh removing the decimal point. Percentage display no longer rounds precise alpha to two decimal places. A ResizeObserver repositions the popup when switching between P3/text and the taller sRGB controls; focused tests exposed an off-window Apply button before this fix.

Focused picker tests passed Chromium/WebKit after the resize fix, covering 12.34567 percent alpha through RGB changes, channel range/empty validation, P3 decimal typing and 360px-window editing. React gradient workflows passed both engines and full HTML Chromium passed with RGB source application, live preview and exact undo. Logs `/private/tmp/retouch-picker-rgb-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log`; screenshot `/private/tmp/retouch-picker-rgb-page-fonts-chromium.png` inspected. Syntax and diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-11 — HSL channels and picker draft lifetime

The color picker now offers RGB/HSL channel display for sRGB colors. Switching models leaves the draft unchanged; HSL channel edits preserve alpha and use existing live preview and source Apply. Hue, saturation and lightness have appropriate ranges, validation and compact labels; achromatic colors avoid undefined values. Display P3 remains in its original channel model without implicit gamut conversion.

Browser testing exposed a delayed same-selection inspector rebuild closing the external picker. The picker now records its source input, and shell draft/focus detection includes an open picker tied to the panel. Same-selection refreshes defer while it is open; changing/removing the selection still invalidates the target. Both integration tests force renderPanel while editing and verify the open draft survives.

Validation: 897 unit tests passed. Focused picker tests passed Chromium/WebKit with HSL primary colors, saturation/lightness changes, black/white edges, precise alpha, invalid hue and model-switch no-op behavior. React gradient Chromium and full HTML Chromium passed (`/private/tmp/retouch-picker-hsl-fixed-{page-fonts-chromium,html-site-chromium}.log`); React WebKit passed when rerun alone (`/private/tmp/retouch-picker-hsl-final-webkit.log`). Earlier broad runs timed out in draft/padding/bootstrap paths; concurrent unit tests also drove load above 100, so final WebKit ran after other jobs completed. Screenshot `/private/tmp/retouch-picker-hsl-page-fonts-chromium.png` inspected. Syntax/diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-12 — Enter applies color drafts

Enter in the color picker's CSS or numeric channel/opacity fields now runs the same validated Apply action as the button. It rejects incomplete/out-of-range fields, preserves no-op behavior and performs one source edit. IME composition and modified Enter keys are ignored, and range/select/button keyboard behavior remains native.

Focused picker tests passed Chromium/WebKit with text/numeric Enter commits, invalid channel Enter rejection, composition and modified Enter no-op checks. React gradient Chromium passed (`/private/tmp/retouch-picker-enter-page-fonts-chromium.log`). Initial concurrent WebKit/HTML runs timed out later in the workflows; individual reruns passed (`/private/tmp/retouch-picker-enter-webkit-retry.log`, `/private/tmp/retouch-picker-enter-html-retry.log`), including real source application and exact undo. Syntax/diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-12 — Packaged color editor verification

Built a fresh universal desktop archive from clean source `9ddf6634191d95ae997d574433b78b4b8fa310db`, including the visual RGB/HSL/P3 gradient picker, precise opacity, live canvas previews, cancellation cleanup and Enter Apply. Archive `/private/tmp/retouch-desktop-color-20260912-9ddf663/Retouch-0.1.0-mac.zip`, SHA-256 `511392a53013595f5da37c97184908c4095b5c42f01cae86041cfcec20af87b7`. All 176 manifest source hashes match checkout; arm64/x86_64 and strict ad-hoc signature verification passed. Source suite: 897 passed with concurrency 4.

Five browser workflows against an extracted-bundle harness passed: focused picker Chromium/WebKit, React gradients Chromium/WebKit, full HTML Chromium. The extracted signature still verified after testing and the external harness was removed. Temporary Homebrew cask install/verification/uninstall passed with quarantine preserved; app directory, registration, tap and trust entry were verified absent, and developer mode returned to disabled. Receipt `desktop/verification/2026-09-12-color-picker.json` records logs and provenance.

Native launch tests were not run for this build. Native foreground/capture, Developer ID signing, notarization, trusted public brew distribution and upgrades remain unfinished, as does full Figma parity.

### 2026-09-12 — Literal CSS colors in the visual picker

Literal HSL/HSLA and standard named colors now resolve into the visual picker without requiring manual hex conversion. Opening and unchanged Apply preserve the original spelling; channel edits retain precise alpha. Context-dependent variables, currentColor and system colors stay text-based rather than being resolved against the editor's theme. A temporary hidden color probe is removed immediately after browser resolution.

The shared CSS validator now uses a bounded literal HSL grammar supporting signed hue values, deg/grad/rad/turn units, legacy comma syntax, modern space/slash syntax and alpha percentages. It rejects mixed syntax, arbitrary units, relative/variable expressions and injection. Source-write tests cover the accepted forms.

Validation: 898 unit tests passed. Focused picker tests passed Chromium/WebKit for named-color channels, signed HSL, percent alpha, original spelling/no-op Apply and contextual-color fallback. Sequential React gradient Chromium/WebKit and full HTML Chromium workflows passed with literal HSL drafts, forced panel refresh, live preview, cancellation and exact undo. Results `/private/tmp/retouch-picker-literal-results.json`; logs `/private/tmp/retouch-picker-literal-{page-fonts-chromium,page-fonts-webkit,html-site-chromium}.log` and `/private/tmp/retouch-picker-literal-full-units.log`. Syntax/diff checks passed. Latest desktop archive predates this change; full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-12 — Visual shadow color editing

HTML and React shadow color fields now expose an inline swatch opening the shared RGB/HSL/P3 picker. Draft colors preview the selected shadow on the canvas through a temporary box-shadow override, retaining the remaining shadow stack and geometry. Cancel/target removal restores the original style; concurrent unrelated styles and independently replaced shadows are preserved. Apply uses the existing scoped writer and single undo transaction. The compact swatch sits inside the color field without covering its label.

New `RT_E2E_SHADOW_PICKER=1` page-fonts workflow (also `npm run test:e2e:shadow-picker`) passed HTML Chromium and React Chromium/WebKit. It checks two shadows with mixed drop/inner types, live preview without source writes, forced panel refresh, exact cancellation, neighbor/geometry preservation, Enter Apply and exact undo back to the initial file. Results `/private/tmp/retouch-shadow-picker-results.json`; screenshots `/private/tmp/retouch-shadow-picker-<renderer>-<engine>.png` (React Chromium inspected). Focused picker tests passed both engines with concurrent box-shadow restoration checks. All 898 units and the existing Chromium gradient workflow passed (`/private/tmp/retouch-shadow-picker-units.log`, `/private/tmp/retouch-shadow-picker-gradient-regression.log`). Syntax/diff checks passed. Full Figma parity and native foreground/capture usability remain incomplete.

### 2026-09-12 — Compact shadow geometry

Shadow controls now pair X/Y and Blur/Spread into two compact rows using the existing inspector field design. Visible labels omit repeated shadow names and unit suffixes; accessible names retain the shadow index and pixel units. HTML and React use the same organization, with existing color swatches and source handlers preserved.

Validation: sequential shadow picker workflows passed HTML Chromium and React Chromium/WebKit, including row geometry, label order, overflow checks, live color preview, scoped source application and exact undo. Results `/private/tmp/retouch-shadow-layout-results.json`; logs and screenshots `/private/tmp/retouch-shadow-layout-<renderer>-<engine>.{log,png}`. HTML and React Chromium screenshots were visually inspected; paired fields fit without overlap. JavaScript syntax and diff checks passed. Full unit suite was not repeated for this presentation-only change (898 passed at the preceding shadow picker commit). The desktop archive predates this change. Full Figma parity remains incomplete.

### 2026-09-12 — Shadow removal in the heading

Each shadow now has a compact minus icon in its heading with its full removal name retained for accessibility and tooltips. Activating it preserves the existing scoped source handler and queues focus to the surviving shadow's type field, or Add shadow when the stack is empty. Other shadow actions retain their existing behavior.

Validation: HTML Chromium and React Chromium/WebKit shadow workflows passed. New checks cover icon dimensions and heading bounds, Enter removal of two successive shadows, focus after both partial and empty-stack removal, and exact undo restoration before the existing picker/source/undo workflow. Logs `/private/tmp/retouch-shadow-remove-{html,react,webkit}.log`; inspected screenshot `/private/tmp/retouch-shadow-remove-react.png`. Syntax and diff checks passed. No new desktop build or native launch was performed. Full parity remains incomplete.

### 2026-09-12 — Duplicate and reorder shadows

HTML and class-based shadow editors now support duplication immediately behind the chosen shadow and moving a shadow down, alongside existing up/removal actions. Copies preserve color, geometry and inner/drop type and remain independently editable. Duplication respects the existing 16-shadow editor limit. All four actions use the shared compact heading toolbar, accessible names/tooltips, a single tab stop and arrow/Home/End navigation. Focus follows the moved or duplicated shadow; removal retains empty-stack focus recovery.

Validation: HTML Chromium and React Chromium/WebKit shadow workflows passed with keyboard toolbar navigation, independent duplicate edits, movement both ways, focus recovery, exact source undo and the existing color preview/apply/cancel coverage. All 27 tests in inspector-shadow-stack.test.cjs and html-css.test.cjs passed. The React Chromium gradient workflow also passed after sharing toolbar organization. Logs `/private/tmp/retouch-shadow-actions-{html,react,webkit,units,gradient}.log`; screenshot `/private/tmp/retouch-shadow-actions-react.png` visually inspected. Syntax/diff checks passed. No native launch or desktop rebuild was performed. Full Figma parity remains incomplete.

### 2026-09-12 — Effect creation in the section heading

Add shadow is now a labeled plus button in the Effects heading for HTML and class-based editors. It opens a collapsed shadow stack and focuses the new shadow's type control. Clear/reset shadows sit in Effect options alongside filter clearing. Last-shadow removal restores focus to the heading plus action. Source handlers, disabled states and scope behavior are preserved.

Validation: shadow workflows passed HTML Chromium and React Chromium/WebKit with heading placement, hidden options, creation focus, duplication/reordering, empty-stack focus and exact undo. WebKit additionally checked automatic opening of the collapsed stack before the test helper could open it. Full HTML Chromium passed reset inheritance, filter/gradient workflows and exact undo. Its first run failed because a later unconditional options toggle closed the now-open section; both accesses now open it only when needed. Logs `/private/tmp/retouch-effect-heading-{html,react,webkit}.log` and `/private/tmp/retouch-effect-heading-html-full-fixed.log`; screenshot `/private/tmp/retouch-effect-heading-react.png` inspected. Syntax/diff checks passed. No desktop rebuild/native launch was performed. Full Figma parity remains incomplete.

### 2026-09-12 — Visual HTML solid paint editing

HTML background, border and text color fields now have inline swatches opening the shared visual picker. Drafts preview on the canvas without source writes; Apply uses the existing scoped CSS writer and preserves precise alpha. Cancel and target removal restore the prior inline styling. Border preview tracks each physical color longhand, preserving independently replaced sides and unrelated concurrent styles.

Validation: new `test:e2e:solid-picker` workflow passed HTML Chromium/WebKit for all three properties, including forced panel refresh, live preview, exact cancellation, 0.1234 alpha source persistence and exact undo. Focused picker tests passed both engines with mixed important border colors, concurrent height edits and an independently replaced border side. Logs `/private/tmp/retouch-solid-picker-{chromium,webkit,focused-chromium,focused-webkit}.log`; screenshot `/private/tmp/retouch-solid-picker.png` inspected. Syntax/diff checks passed. React solid paint integration remains unfinished: its palette writer currently accepts hex/P3 rather than the shared picker's broader CSS and precise-alpha formats; rounding values to fit that writer would not be faithful. No desktop rebuild/native launch was performed. Full Figma parity remains incomplete.

### 2026-09-12 — Precise class-based solid colors

React/Liquid color override composition now accepts supported literal CSS colors without routing overrides through the hex/P3-only palette catalog validator. Saved palette definitions retain their existing validation. Shared RGB validation now requires three channels and one optional alpha with coherent comma or space/slash syntax, rejecting malformed counts, units and injection. Source class encoding preserves decimal alpha exactly and keeps the existing scoped ownership checks.

Color override fields now show the actual computed value and expose the visual picker with temporary property previews. These controls remain under Color overrides; consolidating the existing primary Fill/Stroke controls with them remains outstanding. Added `test:e2e:class-solid-picker`; the existing HTML script remains available.

Validation: React Chromium/WebKit and local Liquid Chromium solid workflows passed background, border and text edits with 0.1234 alpha, live previews, forced panel refresh, exact cancellation and undo. All 57 relevant color/palette/selection/HTML CSS tests passed, including new precise-alpha class generation and malformed-color rejection. Logs `/private/tmp/retouch-react-solid-{chromium,webkit,liquid,palette-tests}.log`; screenshot `/private/tmp/retouch-react-solid-webkit.png` inspected. Liquid fixture verification is not live Shopify verification. Syntax/diff checks passed. No desktop rebuild/native launch was performed. Full Figma parity remains incomplete.

### 2026-09-12 — Primary class-based paint controls

React/Liquid precise color fields now live directly in Fill, Stroke and Typography, replacing duplicate basic color controls. Clear-local actions use compact reset icons beside each field. Existing background/text preset palettes remain under Color presets; their swatches and hex entry now call the precise color writer so a preset replaces an existing explicit override instead of being hidden beneath it. SVG-specific overrides retain their existing disclosure.

Validation: final React Chromium/WebKit and local Liquid Chromium solid workflows passed section placement/visibility, live preview, precise alpha, cancellation, clear-local inheritance, preset replacement and exact undo. The React Chromium gradient workflow passed after Fill reorganization. Logs `/private/tmp/retouch-main-paints-actions-react.log`, `/private/tmp/retouch-main-paints-final-{webkit,liquid,gradient}.log`; screenshot `/private/tmp/retouch-main-paints.png` inspected. Syntax/diff checks passed. No desktop rebuild/native launch was performed. Full Figma parity remains incomplete.

### 2026-09-12 — Packaged primary paint editor

Built universal desktop archive from clean source `78ca0faa34258584db1ff007710b5af2a69f050b`, including compact shadow creation/actions, visual solid colors and consolidated primary paint fields. Archive `/private/tmp/retouch-desktop-paints-20260912-78ca0fa/Retouch-0.1.0-mac.zip`, SHA-256 `cb0c19d9e8477491fa067606b5c17ce4a9496c5eaf05ced451104d217c44a631`. All 176 source hashes match checkout; arm64/x86_64 and strict ad-hoc signature verified. All 899 source unit tests passed.

Extracted-bundle workflows passed HTML solid colors, React solid colors Chromium/WebKit, React shadows Chromium/WebKit and full HTML Chromium. Initial shadow Chromium timed out waiting for the new stack to open; a diagnostic rerun passed, and its cause remains unconfirmed. The receipt retains both results. External harness removed after terminal runs; signature verified again afterward.

Temporary Homebrew cask install, installed verification and uninstall passed with quarantine preserved. Temporary app directory, Caskroom registration, tap and trust entry verified absent; developer mode restored to disabled. The initial untrust command used a path rejected by Homebrew; the fully qualified cask name succeeded and trust absence was verified. Receipt `desktop/verification/2026-09-12-primary-paints.json` records provenance/logs. Native launch was not run. Foreground usability, Developer ID/notarization, trusted public distribution, upgrades and full Figma parity remain incomplete.

### 2026-09-12 — Persist stack opening before source refresh

A deterministic browser reproducer confirmed an opening-state race matching the packaged shadow timeout: a synchronous source refresh can detach the old details node before its queued toggle event records that it was opened. Shadow and gradient stack details now expose a state-setting method that updates persisted expansion immediately; heading add actions call it before the source writer. Normal manual toggling retains its existing persistence behavior.

New `paint-stack-refresh.cjs` replaces the inspector synchronously inside the source-save callback. It failed on shadow opening before the fix and passes for shadows and gradients in Chromium/WebKit afterward. Registered it in test:e2e:html. The full React Chromium shadow workflow and React WebKit gradient workflow passed (`/private/tmp/retouch-stack-refresh-shadow.log`, `/private/tmp/retouch-stack-refresh-gradient.log`). Syntax/diff checks passed. The earlier packaged timeout has no event trace proving this exact cause; this fixes a reproduced mechanism with the same symptom. Latest desktop archive predates the fix. Full parity and trusted native distribution remain incomplete.

### 2026-09-12 — Keyboard navigation in color presets

Background/text preset palettes now expose named toolbars and swatches with one roving swatch Tab stop. Left/right traverse swatches, up/down move between palette rows, and Home/End reach the first/last swatch. Navigation skips disabled buttons, stops canvas shortcuts and does not write source. Hex entry retains its normal Tab stop and Enter activation remains native on swatches.

Validation: React Chromium/WebKit and local Liquid Chromium solid workflows passed with one swatch Tab stop, horizontal/vertical navigation, end/wrap behavior, Tab into hex input, no source writes during navigation, Enter preset application and exact undo. Logs `/private/tmp/retouch-preset-keyboard-{react,webkit,liquid}.log`. Syntax/diff checks passed. No desktop rebuild/native launch was performed; full parity remains incomplete.

### 2026-09-12 — Direct paint field commit and cancel

Solid paint fields now use the existing draft keyboard behavior: Enter applies through validation, Escape restores the original field value, and unchanged values do not write. HTML fill/stroke/text fields and class-based color override fields share this behavior with gradient stop editing. Picker application retains the same source handler.

Validation: solid workflows passed HTML Chromium, React Chromium/WebKit and local Liquid Chromium. Each property checks Escape cancellation, invalid Enter rejection, composing Enter no-op, precise-alpha direct Enter application and exact undo, followed by the existing visual picker, reset and preset workflow. Logs `/private/tmp/retouch-paint-keys-{html,react,webkit,liquid}.log`. Syntax/diff checks passed. No desktop rebuild/native launch was performed; full parity remains incomplete.

### 2026-09-12 — Hex color model

The shared visual picker now offers Hex alongside RGB/HSL. The Hex field accepts three or six digits with an optional #, displays six uppercase digits when synchronized, and preserves the separate opacity value. Switching models does not alter the draft. Empty or invalid Hex input blocks Apply/Enter; Display P3 retains its existing channel model without implicit gamut conversion.

Validation: focused picker tests passed Chromium/WebKit for shorthand, optional prefix, model-switch no-op, precise alpha retention, invalid/empty rejection, opacity synchronization and Enter Apply. Solid editing workflows passed HTML Chromium, React Chromium/WebKit and local Liquid Chromium using Hex edits with 0.1234 alpha followed by exact undo. Logs `/private/tmp/retouch-picker-hex-{html,react,webkit,liquid}.log`; screenshot `/private/tmp/retouch-picker-hex.png` inspected. Syntax/diff checks passed. No desktop rebuild/native launch was performed; full parity remains incomplete.

### 2026-09-12 — Visual SVG fill and stroke editing

SVG fill and stroke fields now expose the shared visual picker and direct Enter/Escape editing in HTML and class-based renderers. SVG paint controls are organized into the main Fill and Stroke sections. Drafts use scoped inline previews and restore the original style on cancellation. Opening a none fill/stroke starts a black draft so visual controls are usable; Cancel restores none and source remains untouched until Apply. Other contextual/unsupported paint values retain the picker’s text fallback.

New test:e2e:svg-picker passed HTML Chromium, React Chromium/WebKit and local Liquid Chromium, verifying primary section placement, precise alpha through Hex mode, live previews, none cancellation, application and exact source undo. React initially matched Next.js devtools SVG shapes; the locator now targets the actual page SVG. Logs `/private/tmp/retouch-svg-picker-html.log`, `/private/tmp/retouch-svg-picker-final-{react,webkit,liquid}.log`; screenshot `/private/tmp/retouch-svg-picker.png` inspected.

Full HTML SVG Chromium regression passed geometry, responsive paint, stroke styles, insertion/deletion/order/copy, lock preservation and exact source/selection undo/redo (`/private/tmp/retouch-svg-picker-geometry-complete.log`). The older test needed explicit opening of More properties and Layer actions before accessing their controls; previous attempts timed out on those collapsed sections. Syntax/diff checks passed. No desktop rebuild/native launch was performed; full parity remains incomplete.

### 2026-09-12 — Primary SVG geometry section

SVG primitive geometry now appears as Geometry in the main inspector, before Layout. Position, size, radii, centers and line endpoints use paired compact fields with full accessible names and existing reset/source handlers. A persistent note identifies SVG coordinates and their shared-across-screen-sizes scope, distinguishing them from responsive CSS layout fields.

Validation: full HTML SVG workflows passed Chromium/WebKit, including geometry pair visibility/alignment, source edits, viewBox scaling, locks, creation/deletion/order/copy and exact undo/redo. React SVG picker workflows passed Chromium/WebKit with geometry visibility assertions. Screenshot `/private/tmp/retouch-geometry-primary.png` inspected; logs `/private/tmp/retouch-geometry-primary-{html,html-webkit,react,react-webkit}.log`. Liquid's adapter does not yet expose svgGeometry or setSVGGeometry, so the first cross-renderer geometry assertion failed there; geometry assertions are limited to the implemented HTML/React paths, and the independent Liquid paint workflow passed (`/private/tmp/retouch-geometry-primary-liquid-paint.log`). Liquid primitive geometry remains an explicit parity gap. Syntax/diff checks passed. No desktop rebuild/native launch was performed; full parity remains incomplete.

### 2026-09-12 — Liquid SVG primitive geometry writer

Liquid now exposes geometry for indexed SVG primitives and routes setSVGGeometry through a dedicated source-preserving planner. Literal coordinates can be replaced, inserted or reset while retaining quoted formatting, surrounding Liquid templates and structural IDs. Template-driven/duplicate coordinates and generated attribute expressions are locked. The writer rejects stale hashes, unsupported values and non-SVG/foreignObject contexts, then verifies the parsed structure before returning edits.

Validation: all 902 unit tests passed, including 81 Liquid tests. New planner checks cover quote preservation, unquoted attributes, insertion/reset/no-op, dynamic ownership, invalid/stale requests, namespace boundaries and primitive field descriptions. Live Liquid Chromium passed width editing, rendered SVG geometry, exact undo/redo and the fill/stroke picker workflow. Liquid WebKit passed with a template-driven X coordinate disabled while literal width remained editable. Logs `/private/tmp/retouch-liquid-geometry-{all-tests,regression,browser,webkit}.log`. Syntax/diff checks passed. This covers indexed primitives; Liquid path elements and SVG canvas insertion remain outside current adapter indexing/capabilities. Live Shopify and trusted native distribution remain unverified; no desktop rebuild/native launch was performed. Full parity remains incomplete.

### 2026-09-12 — Liquid path indexing and vector editing

Liquid now indexes and stamps path elements inside SVG namespaces, enabling selection, path-data fields and the existing vector point editor. Paths outside SVG or inside foreignObject HTML remain excluded. Dynamic path data stays read-only; literal paths use the geometry planner with structure/hash checks. Neighboring structural identities remain stable.

Validation: all 903 unit tests passed. New tests cover indexing/stamping, compound-path source replacement, preserved template attributes/IDs, dynamic path refusal and namespace exclusions. New test:e2e:liquid-path passed Chromium/WebKit for tree selection, vector point movement, draft-only overlay movement, Escape cancellation, source commit, preservation of other contours and exact undo/redo. The first browser assertion incorrectly expected drafts to mutate the page path; the test now checks overlay movement while both source and page path remain unchanged until commit. Logs `/private/tmp/retouch-liquid-path-{all-tests,browser-fixed,webkit}.log`. Syntax/diff checks passed. SVG canvas insertion and other Liquid adapter parity remain unfinished. No desktop rebuild/native launch or live Shopify verification was performed; full parity remains incomplete.


### 2026-09-12 — Light vector editing and pen controls

Vector point editing and pen drawing now use the shared light palette: white floating toolbars, gray 28px controls, Inter labels, subtle borders/shadows, blue anchors and tangent lines, and a blue Done action. Arc and point arrangement controls use the same tokens. Moving a contour has a light blue selected state. Editing behavior and source planners are unchanged.

Validation: Liquid path editing passed Chromium and WebKit, including white-toolbar/blue-Done computed-style assertions, draft cancellation, source commit and exact undo/redo. HTML arc editing passed Chromium; contour drawing passed Chromium and WebKit across 50/100/200% transforms, pending edits, nested cancellation and undo/redo. WebKit also asserted the pen toolbar is white. Screenshots `/private/tmp/retouch-vector-light.png` and `/private/tmp/retouch-pen-light.png` were inspected; vector capture waits for the transient toast to disappear. Logs `/private/tmp/retouch-vector-light-{final,webkit,arcs,draw,draw-webkit}.log`. Syntax and diff checks passed. The prior 903-unit baseline was not rerun for these style-only changes. Toolbar structure still needs closer Figma alignment; full visual/feature parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification was performed.


### 2026-09-12 — Compact vector toolbar and secondary actions

Vector editing now uses compact, accessible icons for corner/smooth points, contour movement/drawing, selection and deletion. Duplicate/delete/reverse/open/close contour and handle visibility are grouped under More vector actions; Done and Cancel remain visible. Action names and explanatory tooltips are retained, including the changing Delete points label. Status announcements remain available to assistive technology. Figma's secondary vector toolbar is the structural reference: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers . This is an adapted control layout, not full Figma vector-tool parity.

Options close after an action or outside pointer interaction. Escape closes options and restores toggle focus before a second Escape cancels editing. Arrow keys/Home/End navigate toolbar buttons without moving vector points; native selects/checkboxes retain their input behavior. The popup anchors to the toolbar and limits its height with scrolling. Testing caught clipping when a wrapped toggle anchored its popup outside the canvas; anchoring to the full toolbar fixed it.

Validation: Liquid path workflow passed Chromium/WebKit with menu visibility, bounds, Escape/focus, keyboard navigation without draft movement, commit and exact undo/redo. Chromium additionally passed a 1100x480 window, including reaching the last contour action in the constrained popup. HTML Chromium passed contour operations, arc-to-Bezier conversion and multi-point selection/editing across 50/100/200% transforms with source isolation/history. Logs `/private/tmp/retouch-vector-compact-{actions-fixed,arcs,multi,final,webkit,small}.log`; screenshots `/private/tmp/retouch-vector-compact.png` and `/private/tmp/retouch-vector-compact-webkit.png` inspected (the former intermediate capture exposed the wrapping issue). Syntax/diff checks passed. Full units were not rerun; prior baseline remains 903. Full feature/visual parity remains incomplete. No push, desktop rebuild/native launch or live Shopify verification this increment.


### 2026-09-12 — Direct canvas entry into vector editing

Double-clicking an editable SVG path/polygon/polyline now enters point editing directly; selecting it on the canvas and pressing Enter does the same. The inspector button remains available and documents both gestures. A shared field eligibility check retains dynamic/invalid geometry restrictions. Shift+Enter and non-vector navigation continue through the existing layer navigation path, while text retains its inline editing path.

Selection reads from a first click can still be pending when the double-click arrives. Direct entry now waits for those reads to drain and verifies the current selection identity/classification before opening. Escape cancels pending entry and invalidates an unresolved gesture; selection clearing invalidates it too. Source writes/history operations continue to guard editing. The initial double-click test failed because a busy selection read discarded the gesture; a deliberately delayed first resolve then exposed premature opening while an older read was pending. Both cases were fixed.

Validation: test:e2e:vector-entry was added. HTML Chromium/WebKit and React WebKit passed Enter, double-click, a delayed selection response, transformed point editing at 50/100/200%, source preservation, undo/redo and cancellation. HTML Chromium/WebKit additionally passed an explicitly held selection response followed by Escape, proving the queued editor stays closed after the response arrives. Liquid WebKit passed direct path entry plus the path/picker-toolbar workflow. The broad HTML Chromium workflow passed responsive styles, text/image editing, asset operations, navigation and exact undo. Logs `/private/tmp/retouch-vector-entry-{delayed-fixed,cancel,final-webkit,react-webkit,liquid-webkit,html-regression}.log`. Syntax/diff checks passed. The 903-unit baseline was not rerun for this shell interaction change. Native packaging, live Shopify, arbitrary source coverage and full Figma parity remain unfinished; no push/native launch/build this increment.


### 2026-09-12 — Numeric vector point position

Point editing now exposes paired X/Y fields in the light inspector. A single selected anchor uses its SVG coordinates; multiple selected anchors use their local top-left and move together, preserving relative spacing and Bézier handles. Position is preview-only until Enter or Done. Escape cancels. Invalid/empty inputs and translations that would put anchors/handles outside the existing supported coordinate range block saving. Fields follow canvas point movement and hide while editing a tangent handle, moving a contour, or drawing another contour. Point position appears before the matching flat Arrange points section.

A late inspector metadata refresh initially removed the new fields while leaving the vector overlay active. Same-selection refreshes now defer during vector editing, then resume after the editor ends. The focused workflow explicitly forces renderPanel during editing to verify controls survive.

Validation: new test:e2e:svg-point-position passed HTML Chromium and React WebKit with single and grouped positioning at 50/100/200% zoom under nested SVG transforms, decimal values, attached handle preservation, untouched neighbors/contours, draft-only page/source isolation, invalid/empty input, Enter/Escape and exact undo/redo. Liquid WebKit passed numeric path editing and undo plus its existing point workflow. Logs `/private/tmp/retouch-point-position-{html-fixed,final,liquid}.log`; inspected final section screenshot `/private/tmp/retouch-point-position-final.png`. Syntax/diff checks passed. Existing 903-unit baseline was not rerun for shell interaction changes. Tangent-handle numeric coordinates and full vector/Figma parity remain incomplete. No push, desktop rebuild/native launch or live Shopify verification this increment.


### 2026-09-12 — Precise Bézier handle coordinates

The vector X/Y inspector now follows the selected incoming or outgoing Bézier handle. It names the handle and indicates Independent, Aligned or Mirrored movement; coordinate edits use the existing handle coupling rules. Anchors and unrelated nodes/contours remain unchanged. Invalid edits, including a valid entered coordinate that would push the opposite mirrored handle out of bounds, cannot be applied. Values remain drafts until Enter/Done and Escape cancels. The active handle now exposes aria-pressed and a blue fill; anchor arrangement controls hide while a handle is selected.

Validation: new test:e2e:svg-handle-position passed HTML Chromium and React WebKit for incoming/outgoing coordinates in all three coupling modes, fixed anchors, preserved independent opposite handles, aligned opposite lengths/direction, mirrored symmetry, 50/100/200% transformed previews, source isolation, Enter/Escape, coordinate limits and exact undo/redo. The final HTML pass also verifies active-handle selection state. Existing single/grouped anchor position workflow passed again. Logs `/private/tmp/retouch-handle-position-{final,react-webkit,anchor-regression}.log`; inspected `/private/tmp/retouch-handle-position.png` (captured before the final selected-handle blue fill addition). Syntax/diff checks passed. Existing 903-unit baseline was not rerun for these shell changes. Full vector/Figma feature and visual parity remain incomplete. No push, native build/launch, or live Shopify verification this increment.


### 2026-09-12 — Delete the selected Bézier handle

Delete/Backspace and the vector toolbar now distinguish a selected Bézier handle from its anchor. The toolbar becomes Delete handle; removing it collapses only that control point, preserves the anchor and opposite handle, and returns focus to the anchor. This works independently of the movement coupling mode and on a two-anchor open contour where anchor deletion is unavailable. The draft remains unsaved until Done/Enter, and existing path validation rejects an invalid resulting contour.

Validation: new test:e2e:svg-delete-handle passed HTML Chromium and React WebKit. It covers incoming/outgoing handles via Delete, Backspace and the toolbar, all coupling modes, unchanged anchors/opposite handles/neighbors/other contours, two-point contours, draft cancellation and exact undo/redo. Existing multi-point selection/translation/corner/deletion workflow also passed Chromium at 50/100/200% transforms, confirming normal anchor deletion/minimum counts remain intact. Logs `/private/tmp/retouch-delete-handle-{html,react-webkit,anchor-regression}.log`. Syntax/diff checks passed. Prior 903-unit baseline was not rerun for this shell-only fix. Full Figma/vector parity, native distribution and arbitrary-site support remain incomplete. No push, desktop build/launch or live Shopify verification this increment.


### 2026-09-12 — Desktop vector/inspector package verification

Built clean source edcea30f974144f08d823c3cd65907a75182db21 into `/private/tmp/retouch-desktop-vectors-20260912-edcea30/Retouch-0.1.0-mac.zip`, SHA-256 `1e0fa12823b8715dbbb0316ad7a4735e75dfe8826bcabc38bf2fc1a03dd9e6d6`. All 903 unit tests passed. The universal arm64/x86_64 bundle passed strict ad-hoc signature verification; all 177 manifest source files matched the clean checkout. Extracted-bundle workflows passed HTML numeric handle editing, Liquid WebKit direct vector entry/numeric position and React WebKit handle deletion. The initial Liquid harness run lacked its dev-only liquidjs dependency; adding external test dependencies fixed the harness without altering bundled source. Both results are retained in the receipt.

A generated cask passed Ruby syntax and an isolated Homebrew install, installed-bundle verification, quarantine check and uninstall. Temporary app directory, Caskroom registration, tap and specific trust entry were verified absent; developer mode returned to disabled and unrelated trust entries were preserved.

One controlled CUA native launch started the expected bundle process, but returned cgWindowNotFound. Inventory confirmed Retouch running; inspecting that same running app returned the same error. The owned PID was terminated and verified absent. Native foreground usability remains unverified; automated native self-tests were not run. No quarantine removal or security-setting change was used. External test harness was removed and extracted signature reverified. Receipt: `desktop/verification/2026-09-12-vector-inspector.json`. Developer ID/notarization, trusted public distribution/upgrades, native usability and full Figma/arbitrary-site parity remain incomplete. No push was performed.


### 2026-09-12 — Convert SVG primitives to editable paths

The main Geometry inspector now offers Convert to vector path for supported literal rectangles (including rounded corners), circles, ellipses and lines. A shared planner generates exact line/elliptical-arc path data, removes primitive geometry attributes, preserves other source attributes and neighboring identities, and updates opening/closing tags. HTML, React and Liquid adapters expose the operation. Conversion is one history edit, and the converted path remains selected and immediately exposes point editing. Undo/redo restores exact source and the intended layer selection.

Source guards reject percentages/dynamic geometry, invalid or degenerate dimensions, unsupported ranges, child content, refs/generated geometry and HTML template ownership. Browser preflight compares the converted probe's bounds and paint/transform properties, checks CSS path/corner overrides, and refuses animations or shape-marker changes rather than silently changing appearance. This remains a bounded primitive conversion; arbitrary styled/generated shapes are not full parity.

Validation: all 908 unit tests passed, including conversion for all four primitive types across all three adapters, paired/self-closing tags, stable IDs/styling, exact rounded-corner radii clamping, stale writes and refusal cases. Browser workflows passed HTML Chromium rounded rectangles and lines, React WebKit ellipses, and Liquid WebKit circles. They verify CSS-tag-selector refusal without writes, bounds/paint and 21 sampled path positions, editable-point entry, exact undo/redo and restored selection. Browser getTotalLength approximates rounded rects differently from paths (265.9416 vs 266.2726 for the tested radius-8 shape, whose analytic perimeter is about 266.2655); the test allows 0.2% length approximation while retaining 0.1 SVG-unit sampled-position checks. A first HTML run revealed old-tag occurrence restoration clearing selection; conversion now restores selection by its retained source identity. Logs `/private/tmp/retouch-svg-convert-{final-units,html-selection,line,react-final,liquid-webkit}.log`. Syntax/diff checks passed. New test:e2e:svg-convert supports renderer/shape variants. No desktop rebuild/native launch/push or live Shopify verification; the latest desktop archive predates this conversion work. Full Figma/arbitrary-site parity remains incomplete.


### 2026-09-12 — Preserve accessible metadata during SVG conversion

Primitive-to-path conversion now accepts title/desc children and surrounding comments/whitespace. Metadata content, IDs, aria-labelledby/aria-describedby and source label bindings remain byte-for-byte unchanged. HTML, React and Liquid use their parsed child structure to distinguish metadata from animations, graphic children or unparsed template output. The browser appearance probe now includes metadata text and attributes, so selectors such as path:empty do not incorrectly block conversion of a named/described shape; inline event attributes are omitted from that temporary probe.

Validation: all 909 unit tests passed. New checks cover accessible metadata, comments and React/Liquid label bindings across all adapters, preserved identities, and continued refusal of non-metadata children and unknown child expressions. HTML Chromium, React WebKit and Liquid WebKit conversion workflows passed with the rendered accessible name, description references/content, metadata and exact undo/redo intact. A focused HTML pass additionally verifies metadata-sensitive :empty styling in the conversion probe. Logs `/private/tmp/retouch-svg-metadata-{all-tests,html,react-webkit,liquid-webkit,probe}.log`. Syntax/diff checks passed. Arbitrary dynamic/generated geometry and full Figma/arbitrary-site parity remain incomplete. No desktop rebuild/native launch, push or live Shopify verification this increment.


### 2026-09-12 — Keep vector hints clear of editing controls

Vector and pen entry now place concise guidance in the existing top status area, with fuller instructions in its tooltip, instead of success toasts over the floating toolbar. Starting either tool removes stale success toasts. Hints follow tool lifetime: nested contour drawing temporarily replaces the vector hint and restores it on cancellation; ending the outer editor restores the preceding status. Cleanup only restores text it still owns, preserving a newer error/notice.

Validation: new test:e2e:vector-hints passed Chromium and WebKit with no entry success toast, correct nested Pen/Vector hint switching, restoration after Escape and preservation of a newer error message. The complete contour drawing workflow passed in the same runs, including transforms, pending edits, cancellation and exact undo/redo. Screenshot `/private/tmp/retouch-vector-hint.png` inspected: pen guidance is readable at the top and the floating controls are unobstructed. Logs `/private/tmp/retouch-vector-hint-{html,webkit}.log`. Syntax/diff checks passed. The prior 909-unit baseline was not rerun for this UI-only increment. Full Figma/arbitrary-site parity remains incomplete; no push, desktop rebuild/native launch or live Shopify verification.


### 2026-09-12 — Drag vector coordinate labels

Vector X/Y labels now offer horizontal dragging to adjust the selected anchors or handle. Normal movement changes one SVG unit per pixel, Shift uses ten and Alt/Option uses 0.1. The labels expose a resize cursor and modifier tooltip; direct numeric input remains available. Pointer capture retains the drag outside the label. Changes stay in the vector draft until Done/Enter. Escape during a drag restores its starting geometry while retaining earlier draft changes; pointer cancellation/lost capture also rolls back the current drag. Group translation and handle coupling reuse the existing validated geometry operations.

Validation: new test:e2e:vector-scrub passed HTML Chromium and WebKit. It covers normal/Shift/Alt increments, multiple anchors and their handles, mirrored handles, source remaining unchanged during preview, Escape restoring only the current drag, committing the earlier draft, and exact undo. Logs `/private/tmp/retouch-vector-scrub-{html,webkit}.log`. Syntax and diff checks passed. Prior 909-unit baseline was not rerun for this shell-only increment. This interaction currently applies to vector coordinates; a shared main-inspector numeric-label interaction and full visual/feature parity remain unfinished. No desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Shared inspector numeric label dragging

Controls built with inspector.number now support horizontal label dragging, extending the interaction to class-backed typography, corner radii, opacity, effects and gradient positions. The label shows a resize cursor and modifier tooltip. Normal movement uses one unit per pixel, Shift ten, and Alt/Option 0.1, bounded by the field's min/max. Disabled, read-only, empty and invalid controls cannot start a drag. Values change in the field during the gesture; the existing change handler saves once on release (these fields do not yet preview every drag movement on the canvas). Escape, focus loss, window blur and canceled/lost pointer capture restore the starting field value. Enter finishes the gesture. Numeric controls outside the shared helper are not covered yet.

Validation: new test:e2e:inspector-scrub passed Chromium and WebKit against the React fixture. Corner-radius gestures verify normal/Shift/Alt increments, the lower bound, no source write during drag, breakpoint-scoped source edits, rendered appearance after release, one exact Undo per gesture, Escape/Tab cancellation, no-op clicks and ordinary typing. WebKit initially encountered a detached field during the post-undo inspector refresh; the test now reacquires the locator only for that specific transient detachment and passed. All 22 focused inspector/filter/shadow unit tests passed; syntax/diff checks passed. Logs `/private/tmp/retouch-inspector-scrub-{chromium,webkit,units}.log`. Full 909-unit baseline was not rerun. Full visual/feature parity and shared live numeric previews remain unfinished; no desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Live opacity preview during numeric dragging

The shared numeric-drag lifecycle now accepts an optional preview controller and restores it before committing or canceling. Opacity label dragging uses the existing property preview to show the value on the selected canvas element without source writes. Its temporary inline opacity is removed before the single release-time source edit, preserving existing inline style bytes or unrelated concurrent runtime changes. Drag cleanup also observes removal of the inspector field or preview target, restoring the draft on interruption. When the edit-range indicator says the preview is outside the selected breakpoint, opacity dragging updates the field without applying a misleading canvas override.

Validation: test:e2e:inspector-scrub passed Chromium and WebKit with live computed opacity during drag, Escape restoration, preservation of unrelated runtime style changes, breakpoint mismatch without canvas override, inspector-field removal without a source write or leftover style, release-time rendered opacity and exact Undo. Existing radius gestures, modifiers, bounds, Tab cancellation and direct typing still pass. The breakpoint test initially left focus in the numeric field while programmatically selecting a screen size, deferring the inspector refresh; it now focuses the screen selector as a user would before changing it. All 22 focused inspector/filter/shadow unit tests passed, plus syntax/diff checks. Logs `/private/tmp/retouch-inspector-preview-{chromium,webkit,units}.log`. Other numeric fields and the separate opacity slider still lack this live-drag preview. Full Figma/arbitrary-site parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Live typography and corner-radius numeric previews

A reusable numericPreview binding now supplies the existing drag lifecycle with property-specific formatting and the edit-range guard. Class-backed font size, weight, line height (pixels and relative), letter spacing (pixels and relative), shared corner radius and individual corners now preview on the canvas while dragging. Opacity uses the same binding. Source still changes once on release and temporary inline styles restore before saving or canceling. The property-preview helper tracks all four radius longhands for shorthand previews, preserving a concurrent runtime edit to one corner while restoring the others.

Validation: test:e2e:inspector-scrub passed Chromium and WebKit. Coverage includes all-radius live preview across modifiers/bounds, an individual corner without changing its neighbor, runtime corner changes surviving cancellation, and preview/cancel/commit/exact Undo for font size, weight, pixel/relative line height and pixel/relative letter spacing. Existing opacity interruption, edit-range and runtime-style checks remain passing. The relative-field test initially attempted to drag a control inside collapsed Type settings; it now opens containing details through their summaries before dragging. Inspected screenshot `/private/tmp/retouch-relative-preview-debug.png` to diagnose that hidden-control test failure. All 22 focused inspector/filter/shadow tests passed; syntax/diff checks passed. Logs `/private/tmp/retouch-type-preview-{chromium,webkit,units}.log`. Live previews for remaining fields, other source-adapter numeric controls and full visual/feature parity remain incomplete. No desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Live shadow geometry and blur previews

Class-backed shadow-stack X/Y offsets, blur and spread now bind to numeric live previews that serialize the complete shadow stack while replacing only the edited value. Layer and backdrop blur controls preview through the existing withBlur helper, preserving other filter functions. The shared drag lifecycle restores temporary inline properties on cancellation or before the single source commit, and retains its selected-breakpoint guard.

Validation: test:e2e:inspector-scrub passed Chromium and WebKit for shadow X/Y/blur/spread preview, Escape restoration, release-time rendering and exact one-step Undo. The fixture includes an authored drop/inner shadow pair plus Tailwind's generated transparent ring entries; checks locate the authored shadow by geometry and compare the entire stack to prove all other entries remain intact. An initial two-entry assumption failed because the rendered stack has six entries; a direct-property fixture also passed before the final tests returned to the Tailwind stack. Layer/backdrop blur workflows retain brightness/contrast and restore original inline style after cancellation/commit. Existing opacity/radius/typography workflows passed in both runs. All 22 focused inspector/filter/shadow unit tests passed, plus syntax/diff checks. Logs `/private/tmp/retouch-effects-preview-{chromium,webkit,units}.log`. Other-adapter controls, remaining numeric previews and full visual/feature parity remain incomplete; no desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Live numeric gradient previews

Class-gradient angle, center X/Y and stop-position fields now preview the complete gradient stack during label dragging. The shared numeric-preview binding accepts an optional inspector render callback; the gradient binding synchronizes its thumbnail, stop strip, moved stop marker and angle/center geometry handles, restoring them on cancellation before the single source commit. Stop positions sort for gradient rendering while the dragged marker retains its identity through crossings. The compact stop-position field now exposes a draggable percent suffix; native spinner arrows are hidden in that compact field so all three digits remain readable.

Validation: test:e2e:inspector-scrub passed Chromium and WebKit with a two-layer linear/radial fixture, angle changes, X/Y center movement and moving the first stop across another stop. Checks preserve all colors, stops and other gradient layers, verify live canvas/thumbnail state, exact cancellation, source-free dragging, commit and one-step exact Undo. WebKit additionally verifies angle/center/stop handle state and thumbnail restoration. An initial test found the position label was hidden by the compact stop layout; the visible percent suffix resolves the actual missing drag target. Inspected `/private/tmp/retouch-gradient-numeric-webkit.png`; removed native spinner arrows after the first image and reran WebKit successfully, then inspected the final image. All 29 focused inspector/filter/shadow/class-gradient unit tests passed, with syntax/diff checks. Logs `/private/tmp/retouch-gradient-preview-{chromium,webkit,units}.log`. HTML/Liquid gradient numeric controls and full visual/feature parity remain incomplete. No desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Shared gradient numeric interaction across source adapters

HTML gradient angle, center and stop-position controls now use the shared numeric helper, including the compact draggable percent suffix and source-free canvas preview. GradientNumeric, housed alongside the existing gradient geometry tool, provides the common preview/thumbnail/marker binding for HTML and class-based inspectors. Existing HTML angle/stop precision is preserved when adopting the helper, and class-gradient inputs now retain their fractional initial values as well instead of rounding them to two decimals. The Liquid fixture uses the class-based inspector and therefore exercises that shared path.

Validation: new test:e2e:html-gradient-numeric passed HTML Chromium, HTML WebKit and Liquid WebKit. The two-layer fixture includes fractional angle/center/stop values; checks cover input precision, live angle/center changes, stop crossing with colors and neighboring layers intact, synchronized thumbnails, cancellation without source/style residue, release commit and exact Undo. The initial Liquid test expected HTML Fill labels and timed out; it now selects the actual class-inspector Gradient controls. The complete React Chromium inspector-scrub regression also passed after extracting the binding. All 29 focused inspector/filter/shadow/class-gradient tests and syntax/diff checks passed. Logs `/private/tmp/retouch-{html-gradient-numeric,html-gradient-numeric-webkit,liquid-gradient-numeric,gradient-shared-react,gradient-numeric-shared-units}.log`. Broader HTML numeric fields and full visual/feature parity remain incomplete; no desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — HTML effect, opacity and rotation numeric dragging

The existing HTML opacity, rotation, layer/background blur and shadow geometry inputs now bind directly to the shared numeric drag lifecycle and live property previews. Their existing numeric precision, validation and source writers remain in use. Shadow previews replace only the edited geometry value within the full stack; blur previews preserve neighboring filter functions. Rotation previews use the rotate property and preserve the page's independent transform.

Validation: new test:e2e:html-effect-numeric passed Chromium and WebKit for opacity, rotation, layer/background blur and shadow X/Y/blur/spread. Fractional values remain intact, source is unchanged during preview, Escape restores appearance and exact inline style state, release saves the rendered result, and one Undo restores exact source. Both engines preserve the initial translate/scale transform and neighboring shadows/filter functions. The first WebKit test used a half-pixel opacity drag and observed pointer-coordinate rounding; the gesture now uses whole pixels while retaining fractional field values. All 51 focused inspector/shadow/filter/HTML CSS tests passed, plus syntax/diff checks. Logs `/private/tmp/retouch-html-effect-numeric-{chromium,webkit,units}.log`. Remaining HTML fields and full visual/feature parity remain incomplete. No desktop rebuild/native launch, push or live Shopify verification.


### 2026-09-12 — Desktop package with the accumulated numeric inspector work

Built clean source 04837dfde7e03399735bf351f2c907eb5c299097 into `/private/tmp/retouch-desktop-inspector-20260912-04837df/Retouch-0.1.0-mac.zip`, SHA-256 `9b3ffa2c8d19070cee87ce6ac858d774431b9d8666d9ea8392c961d361c32242`. All 909 unit tests passed. The universal arm64/x86_64 bundle passed strict ad-hoc signature verification, and all 178 manifest source files matched the checkout. Extracted-bundle tests passed the full React Chromium numeric inspector workflow plus HTML effects, Liquid gradients and vector label dragging in WebKit. These tests execute the archive's bundled source with development-only test dependencies supplied externally.

A generated local cask passed syntax, isolated Homebrew install, installed-package verification, quarantine preservation and uninstall. Temporary app directory, cask registration, tap and specific trust entry were verified absent; trust JSON exactly matches the initial state and developer mode is disabled. External test harness was removed after every workflow terminated, and the extracted signature was reverified. Receipt: `desktop/verification/2026-09-12-numeric-inspector.json`.

Native launch/self-tests were not attempted this increment. Native window usability remains unverified after the previous cgWindowNotFound result; there has been no native implementation fix since that attempt. Developer ID/notarization, trusted public distribution/upgrades and full Figma/arbitrary-site parity remain incomplete. No push or live Shopify verification.


### 2026-09-12 — Unit-preserving HTML typography dragging

The shared numeric-drag helper now accepts an optional value reader/formatter and bounds while retaining its existing default behavior. HTML font-size, line-height, letter-spacing and numeric font-weight fields use it for supported single numeric CSS quantities. A drag preserves the entered unit (including em/rem/percent), previews the formatted value and saves once on release. Escape restores the original value and appearance. Keywords, compound expressions and unsupported units remain available through direct typing and do not start numeric dragging; no implicit conversion is performed for them.

Validation: the HTML effect-numeric workflow now also passes Chromium and WebKit for em font size, percentage font size, em/rem letter spacing, unitless line height and font weight. It verifies preserved field units after saving, visible preview without source writes, cancellation, exact one-step drag undo followed by undo of the setup edit, and unchanged normal line height when its label is dragged. An initial gesture missed its label during inspector refresh; tests now hover the visible drag target before reading coordinates. The keyword test initially expected a write for an already-normal value and was corrected to verify the no-op. The full React numeric-inspector regression passed after generalizing the shared helper. All 51 focused inspector/HTML CSS tests and syntax/diff checks passed. Logs `/private/tmp/retouch-html-type-quantity-{chromium,webkit,units}.log` and `/private/tmp/retouch-quantity-react-regression.log`. Other HTML quantity fields and full visual/feature parity remain incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest archive predates this increment.


### 2026-09-12 — Unit-preserving HTML layout dragging

HTML size/min/max-size, gap, padding/margin, border-width and corner-radius quantity fields now use the existing unit-preserving numeric drag binding. Single numeric lengths retain their unit, preview without source writes, and commit once on release. Margins may be negative; padding, size and corner values clamp at zero. Keywords and multi-value expressions still use direct editing. Property previews now use the shared CSS family definitions for shorthand ownership, so restoring a padding/margin/border-width preview can preserve a newer runtime longhand change.

Validation: test:e2e:html-effect-numeric passed Chromium and WebKit with percentage width, em height/padding/margins/corners, pixel border width and a padding lower-bound case, in addition to the prior typography/effect workflows. Tests open collapsed CSS options before setup edits, verify live computed changes, unchanged source during drag, preserved field units after commit, cancellation, exact one-step drag Undo and setup Undo. Both engines also verify that canceling a padding preview retains a concurrent inline padding-left change while restoring the other sides. An initial setup attempted to fill a hidden layout field; the test now opens ancestor details before editing. All 51 focused inspector/HTML CSS tests and syntax/diff checks passed. Logs `/private/tmp/retouch-html-layout-quantity-{chromium,webkit,units}.log`. Full visual/feature parity and general expression-aware dragging remain incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest desktop archive predates this increment.


### 2026-09-12 — Cancel numeric previews when the view changes

A new responsive workflow reproduced an active width preview leaking into a smaller screen: after changing from 768px to 390px mid-drag, the temporary inline width:120px!important remained. Numeric dragging now subscribes to window resize and the existing screen/viewport/before-zoom events while active, restoring the preview and field value before a changed view can retain the draft. All interruption listeners are removed when the gesture ends.

Validation: new test:e2e:numeric-responsive passed Chromium and WebKit. It verifies cancellation without source writes on screen change, native browser viewport resize and the actual zoom control change handler; a width edit committed at the 768px scope stays absent at 390px; a subsequent edit made while viewing 390px updates the scoped field without a misleading canvas preview, appears at 768px, and both edits undo exactly. The full HTML quantities/effects and React numeric-inspector regression workflows passed Chromium. All 51 focused inspector/HTML CSS tests and syntax/diff checks passed. Logs `/private/tmp/retouch-numeric-responsive-webkit.log`, `/private/tmp/retouch-numeric-{responsive,html-regression,react-regression}-final.log` and `/private/tmp/retouch-numeric-responsive-units.log`. The initial failing regression is described above; its log was overwritten by the passing rerun. Full Figma/arbitrary-site parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest desktop archive predates this fix.


### 2026-09-12 — Gradient handle interruption cleanup

Gradient stop, angle and center drags now cancel on screen/viewport changes, zoom and window resize, matching numeric-drag behavior. Their active interruption listeners are removed at gesture end. Both implementations now use the shared property-preview controller for temporary background-image ownership; cancellation preserves a newer runtime background instead of unconditionally restoring the original property (the stop rail previously did so).

Validation: new test:e2e:gradient-interruption passed HTML Chromium, HTML WebKit and Liquid WebKit. It covers all three handle types under screen changes, browser viewport resize, the actual zoom change handler and a runtime background replacement followed by Escape. Checks prove no source write and removal of preview styles, or retention of the newer runtime value. The test waits for the asynchronous browser resize event before releasing the pointer; an initial run released first and committed the still-active drag. HTML WebKit also needed to reacquire a handle when inspector refresh removed it after a view change. The full Liquid Chromium gradient workflow passed, covering ordinary handle movement, commits, cancellation, layer operations and exact undo/redo. All 29 focused inspector/filter/shadow/class-gradient tests and syntax/diff checks passed. Logs `/private/tmp/retouch-gradient-interruption-{html,html-webkit,liquid-webkit,units}.log` and `/private/tmp/retouch-gradient-handles-regression.log`. Full visual/feature parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest archive predates these fixes.


### 2026-09-12 — Gradient previews respect the selected edit range

A new regression reproduced a gradient handle scoped to 768px temporarily changing the canvas at 390px. Property previews now accept an explicit respectScope option, enabled for gradient handles and shared numeric previews. When the current preview is outside the selected range, temporary canvas overrides are suppressed while inspector thumbnails/markers still update. Numeric previews now retain their inspector render callback outside the range instead of returning no preview controller, so numeric gradient fields behave consistently with handles. Saving still writes the selected scope; cancellation restores the inspector preview.

Validation: new test:e2e:gradient-scope passed HTML Chromium, HTML WebKit and Liquid WebKit. It covers stop/angle/center handles plus numeric angle, stop and center fields: thumbnails change while the smaller canvas and source stay unchanged; Escape restores the thumbnail; release writes an edit visible only when the matching screen is reopened; Undo restores exact source/appearance. The numeric responsive workflow and full Liquid Chromium gradient workflow also passed, confirming in-range previews/commits and view-change cleanup remain intact. All 58 focused inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Logs `/private/tmp/retouch-gradient-scope-{html-final,html-webkit,liquid-webkit,numeric-regression,handles-regression,units}.log`. The initial reproduced mismatch is described above; its first log was overwritten by the passing run. Full visual/feature parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest archive predates this fix.


### 2026-09-12 — Responsive color-picker previews

A new test reproduced solid-color picker previews leaking onto a canvas outside the selected breakpoint. Property previews now respect the edit range by default, and shadow/gradient color previews share that controller for canvas ownership and cleanup. Gradient thumbnails/stop swatches continue updating in the inspector outside the range; the current canvas remains unchanged. The color dialog shows a concise range note when opened outside the selected breakpoint, explaining where the edit applies.

Validation: new test:e2e:paint-scope passed HTML Chromium, HTML WebKit and Liquid WebKit for text, background, border, shadow and gradient-stop color. Checks cover unchanged smaller-canvas appearance/inline style and source during preview, thumbnail feedback/restoration, Escape cancellation, scoped save visible at the matching size and exact Undo. The Liquid shadow test initially searched for an inaccessible picker button inside collapsed Shadow stack; it now opens ancestor details through the associated input first. Existing HTML shadow-picker, Liquid solid-picker and full Liquid gradient workflows passed Chromium, retaining in-range preview, precision and history coverage. All 58 focused inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Inspected `/private/tmp/retouch-paint-scope-note.png`: the two-line edit-range explanation is readable in the light picker. Logs `/private/tmp/retouch-paint-scope-{html-final,html-webkit-final,liquid-webkit,shadow-regression,solid-regression,gradient-regression,units}.log`. The original failing solid-preview regression was rerun successfully. Full visual/feature parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest archive predates this fix.


### 2026-09-12 — Recent colors in the light picker

The shared color picker now shows up to twelve recent applied color choices in a compact checker-backed swatch grid. Clicking a swatch previews it; Apply commits through the existing source editor and Escape cancels. History retains alpha and Display P3 values, deduplicates equivalent parsed colors, persists per editor browser origin, and offers Clear plus keyboard navigation. Invalid stored entries are ignored and in-memory history remains available when storage writes fail. These are recent choices, not a shared project library or a receipt that a subsequent source write succeeded.

Validation: new test:e2e:recent-colors passed HTML Chromium, HTML WebKit and Liquid WebKit. Coverage includes cancelled choices, preview without source writes, reload persistence, equivalent-color deduplication, precise alpha/P3 retention, malformed storage, quota failure fallback, twelve-entry limit, keyboard selection and clearing without source changes. The existing HTML Chromium paint-scope workflow passed, retaining responsive preview/save/Undo coverage. All 58 focused inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Visually inspected /private/tmp/retouch-recent-colors.png: compact light picker, eight swatches per row with transparent-color checkerboards. Logs /private/tmp/retouch-recent-colors-{html,html-webkit,liquid,scope-regression,units}.log. Full visual/feature parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest desktop archive predates this feature.


### 2026-09-12 — Screen eyedropper integration

Added a compact eyedropper icon to the light color-picker header. It invokes the browser EyeDropper API from a user click, preserves the current paint alpha, and previews the returned sRGB color through the shared paint preview. Apply uses the existing source/history path. Browser cancellation keeps the draft; failures show a retry message; a pending operation is aborted when the dialog closes or its source input disappears. Late responses cannot mutate a closed picker. Unsupported browsers expose a disabled control with an availability explanation.

Validation: test:e2e:eyedropper passed HTML Chromium, HTML WebKit and Liquid WebKit with simulated API responses. It covers capability fallback, pending state, precise alpha retention, preview without source writes, cancellation, operational failure/retry, invalid returned data, Apply/exact Undo, close/source-detachment abort and late resolution. Chromium exposed the actual API; WebKit did not. These are integration tests, not proof of real screen-pixel selection. The test initially targeted the first document dialog rather than the active paint dialog during source removal; corrected to the exact dialog locator. All 58 focused inspector/HTML CSS/class-gradient tests passed. Recent-colors regression passed HTML Chromium. Visually inspected /private/tmp/retouch-eyedropper.png. Logs /private/tmp/retouch-eyedropper-{html,html-webkit,liquid-webkit,recents-regression,units}.log. API contract reference: https://wicg.github.io/eyedropper-api/ . Interactive screen sampling, a WebKit/native sampling implementation and full Figma parity remain incomplete. No desktop rebuild, native launch, push or live Shopify verification.

Additional regression: HTML Chromium paint-scope workflow passed (/private/tmp/retouch-eyedropper-scope-regression.log), retaining out-of-range preview suppression, scoped saves and exact Undo. Syntax and diff checks passed.


### 2026-09-12 — macOS screen-sampling bridge

The desktop source now injects a NativeEyeDropper adapter into the main /rt document. The shared picker uses it when the browser EyeDropper API is absent. A narrow WKScriptMessageHandlerWithReply endpoint requests NSColorSampler, converts its chosen color to sRGB, and returns only the selected hex color. Requests require the app's own web view, the health-checked editor origin/port, its main /rt frame and an active key window. Only one sampler may be active. Document navigation invalidates pending results; page abort ignores late results. NSColorSampler exposes no programmatic cancellation method; Escape dismisses its system UI. This adds no project-command bridge.

Validation: both arm64 and x86_64 macOS 13 Swift type-checks passed. A standalone Swift-toolchain check executed the exact extracted native URL/frame policy and color-conversion helpers (no application/window/sampler creation), checking wrong ports/schemes/hosts/paths, subframes, missing connection, default ports, alpha-independent RGB conversion and P3-to-sRGB clipping. Five tests of the actual injected JavaScript passed for installation scope, activation/abort, result validation, native errors/transport failure and late-result cleanup. HTML and Liquid WebKit end-to-end picker workflows passed using that adapter with simulated native replies; Chromium browser-provider regression passed. All 58 focused inspector/HTML CSS/class-gradient tests passed. Logs /private/tmp/retouch-native-sampler-{typecheck,intel-typecheck,policy,adapter-units,html-webkit,liquid-webkit,browser-regression,units}.log. Native application launch, actual WK message delivery, system sampler UI, screen-pixel selection and native cancellation remain unverified; these checks must not be described as native end-to-end success. Full Figma parity and trusted desktop distribution remain incomplete.


### 2026-09-12 — Native sampler development package

Built clean source f8eaccd into /private/tmp/retouch-desktop-sampler-20260912-f8eaccd/Retouch-0.1.0-mac.zip (SHA256 979623c2db072fcd7ff6c82519eaea12cac1bfac62f3b948f5c90e72d064df8c). Extracted archive passes strict ad hoc signature and universal arm64/x86_64 checks. All 178 packaged source hashes plus native source/build/verifier hashes match checkout. All 909 unit tests passed. Bundled HTML and Liquid WebKit picker workflows passed using the exact injected adapter with simulated native responses. The initial external Liquid harness lacked its development-only liquidjs dependency; added external development dependencies and reran successfully without changing the signed bundle. Both workflows were terminal before removing the external harness. Generated local cask passes Ruby syntax; this build was not installed or launched. Actual WK message delivery, native sampler UI/pixel selection, notarization, trusted distribution and full Figma parity remain unverified/incomplete. Receipt desktop/verification/2026-09-12-native-sampler.json.


### 2026-09-12 — Color notation and profile controls

The light picker now offers Hex, RGB, HSB, HSL and CSS notation. Changing notation alone preserves the color value/source. HSB numeric editing keeps chosen hue/saturation while brightness is zero, including across opacity input/blur, so raising brightness restores the intended color. Hex accepts 3/4/6/8 digits; 4/8 digits explicitly set alpha while 3/6 retain the existing precise alpha. CSS mode presents the editable CSS value without redundant channel fields.

A separate Color profile selector converts the current paint between sRGB and Display P3 using the existing palette converter. Conversion preserves the original alpha independently of the converter's 8-bit serialization. In-gamut conversion previews immediately; out-of-sRGB colors offer Convert to sRGB or Keep Display P3 before clipping. Editing another color clears stale conversion choices. Apply uses the existing source/history path; Escape restores the original preview. RGB and CSS remain available for P3; Hex/HSL/HSB controls and the visual plane for P3 are still incomplete and are disabled/hidden rather than silently changing the profile. Conversion to sRGB stores 8-bit RGB channels. This is per-paint conversion, not a whole-file/export color-management implementation.

Reference: Figma's https://help.figma.com/hc/en-us/articles/360043042113-About-color-models distinguishes notation from rendering profiles. Validation: test:e2e:paint-models passed HTML Chromium, HTML WebKit and Liquid WebKit for unchanged notation switches, HSB edits, zero-brightness hue retention, CSS mode, hex alpha, invalid hex rejection, profile round-trip, clipping/keep/edit cancellation, source saves and exact Undo. The zero-brightness regression initially produced white after opacity blur; opacity sync now preserves the draft HSV state. Existing HTML Chromium solid-picker and Liquid Chromium gradient workflows passed. All 64 focused palette/inspector/HTML CSS/class-gradient tests plus syntax/diff checks passed. Inspected /private/tmp/retouch-paint-models.png. Logs /private/tmp/retouch-paint-models-{html,html-webkit,liquid-webkit,solid-regression,gradient-regression,units}.log. No desktop rebuild; latest f8eaccd archive predates these controls. Full Figma parity remains incomplete.

Native observation preflight this turn: Finder's existing accessibility tree was readable, but selecting already-running Chrome through native CUA failed with -10005 cgWindowNotFound. No Retouch launch was attempted and no security setting was changed. Native sampler UI/message-delivery verification remains pending; this is not a Retouch build launch result.


### 2026-09-12 — Display P3 visual and model editing

Display P3 paints now use the visual saturation/brightness plane, hue slider and Hex/HSB/HSL controls as well as RGB/CSS. Notation switches preserve the original literal/profile; edits serialize P3 channels and retain alpha. The plane and hue ramp use explicit Display P3 CSS colors/interpolation, returning to the existing sRGB styling when the profile changes. P3 Hex labels/title identify that the bytes describe channels in the selected P3 profile rather than a CSS sRGB hex literal. Six-digit input retains alpha; eight-digit input sets it. HSB hue/saturation at zero brightness survive opacity edits for P3 as they do for sRGB. Screen sampling converts returned sRGB samples into the active P3 profile and preserves alpha.

Validation: new test:e2e:p3-picker passed HTML Chromium, HTML WebKit and Liquid WebKit. It covers all model switches, visible P3 plane/ramp CSS, keyboard/pointer edits, preview without source writes, cancellation/style restoration, P3 hex with alpha, HSL and HSB editing including zero brightness, Apply/reopen/exact Undo, and returning to sRGB rendering. The expanded sampler workflow passed Chromium's browser provider and WebKit's native adapter using simulated sampling responses, verifying conversion into P3 without changing source before Apply. Existing HTML color-model/conversion workflow and full Liquid gradient workflow passed Chromium. All 64 focused palette/inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Inspected /private/tmp/retouch-p3-picker.png. Logs /private/tmp/retouch-p3-picker-{html,html-webkit,liquid-webkit,sampling-chromium,native-adapter,models-regression,gradients-regression,units}.log. Physical display color accuracy and actual native sampling remain unverified. No desktop rebuild/launch, push or live Shopify verification; the latest f8eaccd package predates these changes. Full Figma parity, whole-file/export color management and trusted desktop delivery remain incomplete.


### 2026-09-12 — HSL draft values at black, white and gray

A new regression reproduced HSL hue resetting from 240 to 0 while editing black. The picker now retains an HSL draft independently of the rendered RGB channels. Hue/saturation choices survive zero/full lightness, gray colors, opacity changes/blur and notation switches within the open picker. Raising/lowering lightness uses those chosen values. Literal color changes, HSB edits and visual controls refresh the HSL draft so stale values do not override a new color. This is in-picker editing state; hidden hue/saturation are not persisted as source metadata for a closed black/white paint.

Validation: test:e2e:hsl-draft passed HTML Chromium, HTML WebKit and Liquid WebKit, each covering black/white/gray in sRGB and Display P3. Checks cover hue/saturation retention, exact alpha, no source writes while previewing, visual-hue/direct-value/HSB synchronization, Escape/style restoration and Apply/exact Undo. Original failure retained in /private/tmp/retouch-hsl-draft-reproduction.log. P3 picker and profile/model conversion regressions passed HTML Chromium. All 64 focused palette/inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Inspected /private/tmp/retouch-hsl-draft.png. Passing logs /private/tmp/retouch-hsl-draft-{html,html-webkit,liquid-webkit,p3-regression,models-regression,units}.log. No desktop rebuild/native launch, push or live Shopify verification. Latest f8eaccd desktop archive predates this change. Full Figma parity and native sampler/distribution verification remain incomplete.


### 2026-09-12 — Compact Figma-reference paint layout

Compared the picker with Figma's color-model reference image (https://help.figma.com/hc/article_attachments/360056934834, linked by https://help.figma.com/hc/en-us/articles/360043042113-About-color-models). The light picker now has a full-width square plane, stacked hue/opacity tracks with the eyedropper alongside, and a compact model/channels/alpha row. CSS mode moves its value into that same row; other models retain an additional direct CSS field for site authoring. The header contains Solid, a small live swatch, the profile selector and Close. Closing cancels the preview. Recent swatches use a compact nine-column grid. Apply/Cancel remain as an intentional adaptation to Retouch's source-edit preview transaction; this is not a claim that the complete Figma paint panel is reproduced.

Validation: existing HSL workflows passed HTML Chromium and Liquid WebKit, with the latter exercising Close as well as Escape, field synchronization, alpha, Apply and exact Undo. Color-model/conversion, sampler integration (simulated sampling replies), recent-colors and breakpoint paint-scope workflows passed HTML Chromium. All 64 focused palette/inspector/HTML CSS/class-gradient tests and syntax/diff checks passed. Visual review caught WebKit's native double-arrow selects and an inconsistent tiny P3 swatch; explicit chevrons and a separate color overlay on the checkerboard resolve those differences. Inspected final /private/tmp/retouch-compact-picker-webkit-final.png and /private/tmp/retouch-compact-picker-scope.png, alongside the earlier conversion and layout captures. Logs /private/tmp/retouch-compact-picker-{hsl,liquid-webkit-final,models,sampling,recents,scope,units}.log. Full feature/visual parity, native foreground/sampling verification and trusted desktop distribution remain incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest f8eaccd package predates this layout.


### 2026-09-12 — Linked color styles in the paint picker

The picker now exposes a searchable Color styles section for property-backed paints whose inspector provides the existing color-style apply capability. Selecting a style previews its exact color; Apply color style calls the existing source operation with the library revision and the input's own paint property. This creates a real link, so later library updates propagate. Manual color changes clear the pending link choice; notation-only changes preserve it. The shared library manager publishes its scoped options on the inspector container for the originating input, rather than introducing a separate source-writing implementation.

Library loading is lazy, bounded to 15 seconds and aborted when the dialog closes. Closed/detached pickers cannot start a save or fetch. While saving, controls are disabled; errors retain the dialog and recreate its preview controller for retry. Stale library revisions are rejected without source writes; Reload refreshes the definitions before another Apply. The new list uses named swatches and existing keyboard-accessible buttons. Text, background and border are verified; SVG/multiple-selection paths and linked gradient stops/shadow colors need separate coverage or implementation and are not claimed complete.

Validation: test:e2e:picker-styles passed HTML Chromium, HTML WebKit and Liquid WebKit. It covers search, preview without writes, Escape restoration, clearing a pending link through manual editing, real source link creation, library-update propagation, exact Undo, stale-revision error/reload/retry, and correct background/border targets regardless of the library panel's selected target. The setup initially tried to open Saved color styles inside collapsed ancestor sections; it now opens those ancestors through their actual summaries. All 909 unit tests passed. Existing HTML Chromium breakpoint paint-scope regression and syntax/diff checks passed. Inspected /private/tmp/retouch-picker-styles.png. Logs /private/tmp/retouch-picker-styles-{html-final,html-webkit-final,liquid-webkit-final,scope-regression,all-tests}.log. No desktop rebuild/native launch, push or live Shopify verification; f8eaccd remains the latest package and predates this integration. Full Figma parity, native sampler verification and trusted desktop distribution remain incomplete.


### 2026-09-12 — Responsive and SVG picker-style verification

Closed the previously unverified SVG and responsive paths for linked styles chosen in the picker. New test:e2e:picker-style-scope passed HTML Chromium, HTML WebKit, Liquid WebKit and React Chromium. Each workflow applies the saved style separately to text, background, border, SVG fill and SVG stroke at the 768px range while previewing 390px. Checks prove unchanged smaller-canvas paint and inline styles during preview and after save, source link identity, visible paint at 768px, restoration on return to 390px, and exact source/appearance Undo for every target.

No runtime fix was needed. The initial HTML test attempted to select the 768px range before creating it through the 768px canvas; its corrected setup follows the existing responsive UI flow (open 768px, choose its range, return to 390px). React/Liquid already offered md. Logs /private/tmp/retouch-picker-style-scope-{html-final,html-webkit,liquid-webkit,react}.log; initial HTML setup failure /private/tmp/retouch-picker-style-scope-html.log. Syntax/diff checks passed. Multiple-selection picker links, linked gradient stops/shadow colors, arbitrary-framework support, complete Figma parity and native delivery still require work. No desktop rebuild/native launch, push or live Shopify verification; the latest f8eaccd package predates the color-style picker integration.


### 2026-09-12 — Linked paint context and saved-field refresh

The light paint picker now identifies the linked color style, local overrides, unsaved color changes and inherited responsive links. Use linked color and Use inherited color here stage a preview; Apply performs the existing revision-checked source operation. Cancel restores the canvas without changing source. Current style swatches reflect link state, and staged actions use concise captions.

Verification exposed a stale inspector after a successful style save: rendering was deferred while the dialog was open, then focus returned to the old input and kept the refresh deferred. Successful linked-style Apply now closes the dialog, refreshes the saved control and restores focus to its rebuilt field. Cancel and failed writes retain their existing behavior.

New test:e2e:picker-link-context covers context labels, draft cancellation, local override save, reset preview/cancel/apply, inherited links outside the current viewport, exact source Undo and refreshed-field focus/value. HTML Chromium, HTML WebKit, React Chromium and Liquid WebKit passed; final caption/focus assertions passed HTML Chromium and Liquid WebKit. The prior complete picker-style regression passed, including revision rejection/retry. All 909 unit tests passed; syntax/diff checks passed. Inspected /private/tmp/retouch-picker-link-context-final.png. Logs /private/tmp/retouch-picker-link-context-{html-final,liquid-webkit-final,html-webkit,react,styles-regression,all-tests}.log; stale-panel reproduction /private/tmp/retouch-picker-link-context-stale-panel.log.

Full Figma parity remains incomplete. No desktop rebuild/native launch, push or live Shopify verification; the latest f8eaccd package predates this picker work. Multiple-selection style links, gradient/shadow links, complete visual parity, arbitrary-site support and trusted native delivery remain open.


### 2026-09-12 — Paint controls in short windows

Confirmed that an expanded linked-color picker scrolls Apply out of view at a 1024x600 viewport. The light header and transaction footer now remain sticky within the scrolling dialog; scroll padding reserves their space when fields receive focus. The color plane, values and library continue scrolling between them.

New test:e2e:picker-small-window checks actual hit-test visibility of Close and Apply at the top, midpoint and bottom of the dialog, then edits a draft and closes without source writes. HTML Chromium and Liquid WebKit passed. The existing HTML Chromium linked-context workflow passed, including override/reset/inherited source writes and Undo. Syntax/diff checks passed; inspected /private/tmp/retouch-picker-small-webkit.png. Logs /private/tmp/retouch-picker-small-{html-final,webkit-final}.log and /private/tmp/retouch-picker-sticky-regression.log. Original failure evidence /private/tmp/retouch-picker-small-before-final.log. Initial test setup resized before opening and encountered inspector refresh; the final test resizes an open picker and waits for scroll layout before hit testing. No full unit repeat for this CSS-only runtime change.

Full Figma parity remains active and incomplete. No desktop build/launch, push or live Shopify changes. Current desktop package still predates the recent picker work.


### 2026-09-12 — Preserve active panel edits across compact transitions

Investigated the earlier resize-before-picker timeout. The selection and input survived, with no browser errors; workspace-panels.js hid both panels whenever the layout crossed 1100px. This removed the focused inspector from view. On entry to compact mode, the workspace now keeps the visible panel containing the active control open. An open paint picker identifies its originating input as the active panel control. Initial compact loading and unfocused transitions retain existing behavior; wide-panel visibility preferences remain unchanged.

New test:e2e:panel-resize-draft passed HTML Chromium and Liquid WebKit: focus a color field, enter an unsaved draft, cross wide/compact boundaries three times, verify selection, draft, focus and unchanged source, then cancel and reopen the picker. The compact-picker WebKit workflow now asserts its originating inspector stays visible, and passed. Existing Chromium workspace tests passed panel visibility persistence, compact drawers, selection, Escape and unchanged source. Syntax/diff checks passed. Logs /private/tmp/retouch-panel-resize-{html,webkit,open-picker,workspace}.log. Investigation evidence /private/tmp/retouch-picker-closed-resize-{probe,detail,ancestors}.log and /private/tmp/retouch-closed-resize.png. Full unit suite not repeated for this isolated workspace transition change.

The full Figma/native goal remains incomplete. No desktop rebuild/launch, push or Shopify mutation. Trusted distribution, native verification, arbitrary-site coverage and remaining feature/visual parity are still open.


### 2026-09-12 — Updated light-picker desktop artifact

Built clean bce2bdf into /private/tmp/retouch-desktop-light-20260912-bce2bdf/Retouch-0.1.0-mac.zip. SHA-256 1aa55d440a1870c23b9ef55e9565b8d30dda814b88d86c02e1b66fd8f88717f3. Extracted archive verifies universal arm64/x86_64 and strict ad hoc signature; all 178 source files plus native/build/verifier hashes match checkout. All 909 unit tests passed. An external harness exercised extracted packaged code in WebKit: HTML linked-style context, override/reset/inherited writes and Undo; Liquid repeated wide/compact transitions retaining draft, selection and focus. Both passed, then the harness was removed. Local cask generated and Ruby syntax passed. Receipt desktop/verification/2026-09-12-light-picker.json and desktop README updated.

Native launch/self-tests, real screen sampling, installation/upgrades and notarization were not performed for this build. No public release or push. The full Figma/native goal remains incomplete; this artifact updates the previous f8eaccd package with the subsequent picker and workspace work.


### 2026-09-12 — Shared color picker and linked style application

Shared HTML and React/Liquid color fields now expose the same light picker as individual layers. A shared preview controller delegates to each selected element's existing property preview, preserving its original inline state independently. Existing selection style operations apply the chosen style to all selected layers in one history operation. The inspector organizer avoids duplicating pre-mounted swatches. Shared class fields display their common computed color and accept the same literal CSS colors as individual fields, including fractional RGB opacity; mixed values remain empty. Escape restores shared field drafts and swatches. A mixed-selection note explains that the chosen color applies to all layers.

New test:e2e:picker-multi passed HTML Chromium, React Chromium and Liquid WebKit. Final workflows begin with different selected colors, verify simultaneous preview without source writes, exact per-layer cancellation, two real style links with one Undo, an unaffected unselected layer, and literal rgb(12 34 56 / 0.2345) source persistence followed by exact Undo. Common-color variants passed before mixed fixtures were added. All 909 unit tests, syntax and diff checks passed. Inspected /private/tmp/retouch-multi-picker.png. Logs /private/tmp/retouch-multi-picker-{css-html,css-liquid,react-final,units-final}.log. Initial HTML setup used the single-layer CSS label suffix; corrected to Shared Text color.

Mixed pickers initially have no single color model to display: entering a literal or choosing a saved/recent color initializes the visual controls. Shared existing-link/override context and responsive/SVG/background/border picker workflows still need dedicated coverage; gradient/shadow style links remain unfinished. No native build/launch or push. Latest desktop bce2bdf artifact predates this increment. Full Figma parity remains active.


### 2026-09-12 — Existing selection colors in the mixed picker

The shared picker now reads the selected elements' current solid paints when opened and presents distinct Selection colors swatches above the visual plane. Semantic color keys deduplicate equivalent values; swatch tooltips include layer counts. Roving keyboard focus supports arrows, Home and End. Choosing a swatch initializes the visual controls and previews that value across the selected layers; it remains a draft until Apply. Pressed state updates with subsequent color edits. Original computed paint strings retain their profile/alpha representation for the preview and source operation.

Extended test:e2e:picker-multi passed HTML Chromium, React Chromium and Liquid WebKit. It verifies a two-color mixed selection, no initial mutation, keyboard End/Enter choice, visible visual controls, preview without writes, per-layer Escape restoration, choosing an existing color then Apply and exact Undo, and unchanged unselected paint. Existing linked-style and fractional-opacity workflows remain included. All 64 focused palette/inspector/HTML CSS/gradient tests and syntax/diff checks passed. Inspected /private/tmp/retouch-selection-colors.png. Logs /private/tmp/retouch-selection-colors-{html-final,react,liquid-final,units}.log.

Full parity remains incomplete: existing-link context for shared selections and dedicated responsive/SVG/background/border shared-picker coverage remain open, along with gradient/shadow links and the broader native/arbitrary-site goal. No desktop rebuild, launch or push; bce2bdf remains the latest packaged source.


### 2026-09-12 — Shared responsive paint coverage and HTML SVG fields

New test:e2e:picker-multi-scope verifies shared text, background and border paints at 768px while previewing 390px. Both literal and linked-style paths passed HTML Chromium, React Chromium and Liquid WebKit. Each case proves no smaller-canvas mutation during preview/save, both selected layers painted at 768px, an unchanged third layer, restoration at 390px and exact source/appearance Undo. Linked operations create two style links.

The SVG variant exposed missing HTML shared fill/stroke fields. HTML all-SVG selections now include Shared SVG fill and Shared SVG stroke using the existing shared CSS operation and picker. The variant passed HTML Chromium, HTML WebKit, React Chromium and Liquid WebKit with literal and linked paints, two shapes plus an unchanged third shape, the same responsive checks and exact Undo. Run with RT_E2E_SVG_COLORS=1 in addition to test:e2e:picker-multi-scope. Inspected /private/tmp/retouch-multi-picker-svg-scope.png. All 29 HTML CSS/selection tests and syntax/diff checks passed. Logs /private/tmp/retouch-multi-picker-scope-{html,liquid,react}.log and /private/tmp/retouch-multi-picker-svg-{html,html-webkit,liquid,react,units}.log. Missing-field reproduction /private/tmp/retouch-multi-picker-svg-before.log.

Existing-link context for shared selections and linked gradient/shadow paints remain open, as do complete Figma visual/feature parity, arbitrary-site support and native delivery. No desktop rebuild/launch, push or Shopify changes; latest packaged source remains bce2bdf.


### 2026-09-12 — Shared linked-style context

The shared paint picker now summarizes explicit links in the selected range. A common style is shown only when every selected layer links to the same definition; its local-override count and selection size are visible. Use linked color stages that definition for all selected layers through the existing selection apply operation. Partially linked selections show a linked-layer count, and different linked definitions are marked Mixed styles. Such selections do not expose a common-color reset. Draft edits update the context without source writes. This summary deliberately counts explicit links in the selected range; inherited shared-link summaries remain unfinished.

New selectionState helper tests cover common, different, partial and empty links, property-specific overrides and inherited ranges not misreported as explicit links. New test:e2e:picker-multi-context passed HTML Chromium, React Chromium and Liquid WebKit. It covers common link display, two local overrides, reset preview/cancel/apply, exact three-step Undo and a one-of-two linked selection. Existing single-layer linked context regression passed HTML Chromium. All 910 unit tests passed; syntax/diff checks passed. Inspected /private/tmp/retouch-shared-context.png. Logs /private/tmp/retouch-shared-context-{html,liquid,react,single-regression,units}.log.

No desktop rebuild/launch, push or Shopify changes. Latest package still uses bce2bdf. Shared inherited-style summaries, gradient/shadow links, full Figma parity, arbitrary-site support and trusted native delivery remain incomplete.


### 2026-09-12 — Shared inherited links and scope-navigation focus

Shared color context now resolves inherited links per selected layer using HTML numeric scope inheritance or the existing class responsive resolver. A common inherited definition is shown only when every selected layer inherits that ID; differing source labels are summarized as Multiple ranges. Mixed explicit/inherited selections show separate counts. Use inherited color here stages the definition, and Apply adds explicit links to all selected layers in the selected range through the existing operation.

New test:e2e:picker-multi-inherited passed HTML Chromium, React Chromium and Liquid WebKit: base links on two layers, 768px scope while viewing 390px, inherited name/source/selection count, preview/cancel without writes, four resulting base-plus-scoped links, unchanged smaller canvas, target-size paint and exact Undo. Helper tests cover common/different inherited definitions, different source ranges, mixed own/inherited links and the class resolver.

The React workflow exposed queued post-save focus returning to the shared input during a screen-size change without pointer/keyboard events. This left Edit range status stale and allowed temporary preview styles on the smaller canvas. Trace confirmed md scope and a 390px iframe with stale data-match=true and focus back on Shared Text color. The focus queue now clears on changes outside the inspector or to Style screen scope, supporting accessibility activation too. The final React workflow and Liquid WebKit workflow passed after the fix; single-layer linked/focus regression passed HTML Chromium. Full 911-unit suite passed before this final focus listener change; affected browser workflows were rerun afterward. Syntax/diff checks passed. Inspected /private/tmp/retouch-shared-inherited.png. Logs /private/tmp/retouch-shared-inherited-{html,react-fixed,liquid-final,focus-regression,context-regression,units}.log. Failure/trace logs retained as react, react-final and react-trace variants.

No desktop rebuild/launch, push or live Shopify changes. Latest packaged source remains bce2bdf. Gradient/shadow style links, full Figma parity, arbitrary-site breadth and native trusted delivery remain incomplete.


### 2026-09-12 — Mixed-picker controls and native preflight

Native preflight: CUA inventory succeeded, but selecting the already-running Google Chrome native app returned Computer Use server error -10005: cgWindowNotFound. No Retouch launch was attempted and no macOS security settings changed. Native foreground/sampling verification remains unavailable; this does not establish a failure of the packaged Retouch build.

Continued editor work: empty mixed-color pickers now hide unusable model/channel/opacity controls until a concrete color is chosen, while keeping available screen sampling and CSS entry accessible. Apply is disabled when the CSS color value is empty or unsupported, and CSS entry has a placeholder. Selecting an existing color restores the visual controls and enables Apply. Invalid subsequent literal input disables Apply without saving; Cancel restores each original paint.

Extended multi-picker workflow passed HTML Chromium and Liquid WebKit, including disabled/enabled controls, swatch keyboard choice, invalid input, per-layer cancellation and existing literal/style save/Undo paths. Existing color-model conversion and browser sampler workflows passed HTML Chromium (sampling replies simulated). Syntax/diff checks passed. Inspected /private/tmp/retouch-mixed-controls.png before the placeholder-only addition. Logs /private/tmp/retouch-mixed-controls-{html,liquid,models,sampler}.log. No full unit repeat for this dialog state change.

Full Figma/native parity remains active. No desktop rebuild, install, launch, push or live Shopify changes. Latest packaged source remains bce2bdf; native trusted distribution and broader feature/visual/site coverage remain incomplete.


### 2026-09-12 — Detach saved paint styles from the picker

Linked paints now expose Detach style in the picker. It commits the existing single/selection detach operation immediately, preserving saved appearance, removing explicit links in the selected range and remaining undoable. It is hidden for inherited-only links and disabled while a different color draft or style choice is pending. This prevents detachment from silently discarding that draft. The tooltip explains that the saved paint is kept.

Extracted the existing style-write lifecycle into a shared helper for Apply and Detach: restore owned previews before writing, disable controls during the request, retain the dialog with retry feedback on error, then close and refresh/focus the source field after success. Detach does not add a recent color.

New test:e2e:picker-detach passed single-layer HTML Chromium and Liquid WebKit with injected conflict, unchanged source on failure, retry, draft-disable behavior, preserved paint and exact Undo. RT_E2E_PICKER_MULTI=1 variants passed React Chromium and Liquid WebKit with two removed links, preserved per-layer appearance and exact Undo. Existing full picker-style regression passed HTML Chromium, including revision conflict/reload/retry and other property targets. All 911 unit tests and syntax/diff checks passed. Inspected /private/tmp/retouch-picker-detach.png. Logs /private/tmp/retouch-picker-detach-{html-final,single-liquid,multi-liquid,multi-react,style-regression,units}.log.

No native launch/rebuild, push or Shopify changes. Full Figma/native parity remains incomplete; latest packaged source is still bce2bdf. Further mixed/overridden detachment and broader interaction coverage remain useful; gradient/shadow style links and trusted native delivery remain unfinished.


### 2026-09-12 — Overridden and partially linked detachment verification

Expanded test:e2e:picker-detach to create a saved local rgb(12 34 56 / 0.2345) override before detaching. HTML Chromium, React Chromium and Liquid WebKit passed preservation of appearance and exact fractional-alpha source, pending-draft detachment disablement, conflict/retry without writes, removal of the style link, and exact three-step Undo through detached, overridden and linked source states.

Expanded test:e2e:picker-multi-context to detach a one-of-two linked selection. HTML Chromium, React Chromium and Liquid WebKit passed: the unlinked selected layer and third unselected layer retain their paint; the explicit link is removed; Undo restores the partially linked source exactly. The inherited-only picker test now asserts no Detach style action and passed Liquid WebKit. No runtime fix was required. Syntax/diff checks passed. Logs /private/tmp/retouch-detach-override-{html,react,liquid}.log, /private/tmp/retouch-detach-partial-{html,react,liquid}.log and /private/tmp/retouch-detach-inherited-liquid.log. Unit suite not repeated for test-only changes.

Full Figma/native parity remains incomplete. No desktop rebuild/launch, push or live Shopify changes; packaged source remains bce2bdf. Native window access remains unverified after the last cgWindowNotFound preflight; no launch was retried this turn.


### 2026-09-12 — Exact sRGB opacity in reusable color styles

Found palette opacity edits quantizing sRGB alpha to a hex byte. The shared palette codec now accepts explicit color(srgb r g b / alpha), with bounded numeric validation matching the Display P3 form. Hex remains canonical when all channels and alpha are byte-representable; otherwise the explicit sRGB form retains their numbers. HTML CSS validation and class encodings accept this form. Library RGB edits preserve existing alpha, opacity edits preserve current channels, and displayed opacity no longer rounds to two decimals. Converting back from Display P3 still uses the existing 8-bit sRGB channel policy but now retains exact alpha. Existing clipping confirmation remains.

New test:e2e:palette-precision passed HTML Chromium, React Chromium and Liquid WebKit: edit to 23.45%, save, alter RGB, retain alpha 0.2345 in catalog, apply the exact definition through the picker, verify source link/value, Undo and reopen the saved definition. Codec tests cover non-byte sRGB alpha/channels, catalog/class acceptance, malformed/out-of-range rejection and profile roundtrip alpha. All 912 unit tests passed. Existing full color-library create/update/Undo/Redo/export/conflict/delete/import workflow, Display P3 workflow and picker color-model conversion workflow passed HTML Chromium. Updated the prior palette test expectation from rounded #33669980 to exact 50% color(srgb ... / 0.5); also fixed its helper to open collapsed ancestor sections. Syntax/diff checks passed. Logs /private/tmp/retouch-palette-precision-{html,liquid,react,catalog,p3,models,units}.log.

This supplies precise storage for further picker-to-library work; creating new styles directly from the picker is not implemented yet. Browser-computed color capture still has its existing normalization limits. Old builds lack explicit sRGB palette support, so a new desktop artifact is required before desktop verification of these definitions. No desktop rebuild/launch, push or Shopify changes; latest packaged source remains bce2bdf. Full Figma/native parity remains incomplete.


### 2026-09-12 — Create reusable color styles inside the picker

Added a compact Create color style disclosure within the picker library. It captures the parsed draft as exact sRGB or Display P3, requires a name and uses the existing revision-checked catalog operation. Saving changes the library, selects the new style and leaves the picker open; Apply separately creates the source link. The form states this distinction, so Cancel after saving preserves the library entry. Catalog creation and source linking are independently undoable. Enter in the name field saves the library entry rather than triggering source Apply.

Creation is disabled before library loading or without a concrete parsed color. During saving, controls are disabled and Escape cannot interrupt the request; errors retain the form and draft for retry. Successful creation refreshes the list and revision, clears search/name and selects the returned definition. Existing layer source remains unchanged until Apply.

New test:e2e:picker-create passed HTML Chromium, React Chromium and Liquid WebKit for precise sRGB and Display P3 alpha. It verifies required name, injected conflict/retry, unchanged source during creation, exact saved/selected color, Cancel persistence, catalog Undo/Redo, source Apply and separate Undo. RT_E2E_PICKER_CREATE_EMPTY=1 passed HTML Chromium for a missing catalog and Undo restoring its absence. Existing full picker-style regression and all 912 unit tests passed. Syntax/diff checks passed. Inspected /private/tmp/retouch-picker-create.png. Logs /private/tmp/retouch-picker-create-{html,liquid,react,empty,existing-regression,units}.log.

No desktop rebuild/launch, push or live Shopify changes. Latest packaged source remains bce2bdf and lacks this work and explicit sRGB palette support. Full Figma/native parity, gradient/shadow links and broader arbitrary-site/native delivery remain incomplete.


### 2026-09-12 — Packaged shared palettes and cask installation

Built clean 671f988 into /private/tmp/retouch-desktop-palette-20260912-671f988/Retouch-0.1.0-mac.zip, SHA-256 a4c5a231e635a089d922ee5d0010d4f5c4e44473b008286fc73d33c4b793cb0a. All 178 source files and native/build/verifier hashes match checkout; extracted and installed copies verify universal arm64/x86_64 and strict ad hoc signature. All 912 unit tests passed. External harness against extracted packaged source passed WebKit HTML style creation and Liquid inherited links plus overridden-paint detachment/retry. Harness removed and extracted signature reverified.

Generated cask passed syntax and installed/uninstalled in an isolated app directory through a temporary local tap and isolated XDG trust configuration. Installed quarantine retained. Cleanup verified app, registration, tap and temporary trust/config absent; developer mode remains disabled. Homebrew uninstall unexpectedly auto-removed git 2.55.0. Restored identical version, verified binary and restored not-installed-on-request status. Future isolated installation tests must set HOMEBREW_NO_AUTOREMOVE=1 and HOMEBREW_NO_INSTALL_CLEANUP=1; README records this. Receipt desktop/verification/2026-09-12-palette-creation.json includes logs and the incident.

No native launch, system sampling, notarization, upgrade or public release verification. Latest native preflight remains cgWindowNotFound; no launch was retried. No push or live Shopify mutation. Full Figma/native/arbitrary-site goal remains incomplete.


### 2026-09-12 — Preserve computed paint precision and copied drafts

Use selected layer color now retains reported fractional sRGB channels and alpha instead of quantizing them to hex bytes. RGB percentage/literal and explicit sRGB inputs normalize through the exact palette serializer. Values that are byte-representable still use hex. This also improves the picker parser, which uses the same capture helper. Browser-side computed-style rounding remains a limit; this change avoids adding further rounding and cannot recover unavailable source precision.

WebKit verification exposed the capture draft being replaced by a deferred inspector refresh, yielding the catalog value instead of the just-copied computed value. The capture action now focuses the color-value input after copying, preserving the draft. Final precision workflows passed HTML Chromium, React Chromium and Liquid WebKit, explicitly checking focus and exact equality with the browser-reported channel/alpha numbers, unchanged source on capture, and existing source Undo/reopen behavior. Added helper tests for fractional RGB channels/percent alpha and high-precision explicit sRGB. Updated older tests that expected intentional hex rounding; the refreshed-field check now validates known channels with a narrow tolerance for browser alpha serialization.

All 913 unit tests passed before the final focus addition; affected browser workflows were rerun afterward. Existing Display P3/color-library lifecycle, picker model conversion and linked-style context regressions passed HTML Chromium. Syntax/diff checks passed. Logs /private/tmp/retouch-computed-capture-{html-final,react-final,liquid-final,catalog,models,context,units}.log. The initial WebKit failure is retained in /private/tmp/retouch-computed-capture-liquid.log.

No desktop rebuild/launch, push or Shopify changes. Latest package uses 671f988, predating this increment. Full Figma/native/arbitrary-site goal remains incomplete.


### 2026-09-12 — compact dimension controls

Reviewed the full light inspector again against Figma's properties-panel reference (https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar). Combined each pixel width/height field with its existing Auto/Fixed/Hug/Fill select in one control, removing the separate resizing row. Existing accessible labels and event handlers remain on their original controls. This applies where the pixel-size and resizing controls exist; raw CSS sizing remains separate.

Validation: 16 inspector unit tests passed; inspector-light browser flow passed in Chromium and WebKit, including layout edits, opacity, corners and exact Undo; WebKit numeric-scrub flow passed. Full screenshots inspected at /private/tmp/retouch-compact-dimensions.png and /private/tmp/retouch-compact-dimensions-webkit.png. Logs: /private/tmp/retouch-dimensions-unit.log, /private/tmp/retouch-compact-dimensions.log, /private/tmp/retouch-compact-dimensions-webkit-layout.log, /private/tmp/retouch-compact-dimensions-webkit.log. No new desktop package or native UI verification. Full Figma parity remains incomplete and the goal stays active.


### 2026-09-12 — consistent collapsed dropdowns

Replaced browser-specific select arrows with a shared light-theme chevron throughout the editor, including the screen toolbar, responsive scope, sizing, layout options and paint model/profile controls. Fixes the missing WebKit layout-options affordance caused by the visually hidden select text. The real select retains its menu, accessible name and event behavior; multi-select/listbox controls are excluded and forced-colors uses native appearance. Removed duplicate picker arrows and browser number steppers. This is collapsed-control styling, not custom Figma-equivalent popup menus.

Validation: inspector-light passed in Chromium and WebKit (layout, opacity, corners, source edits and exact Undo). Paint-model workflow passed in both engines (model/profile changes, alpha preservation, clipping confirmation, Apply/Cancel/Undo). Inspected both workspace screenshots and WebKit picker screenshot; values and chevrons fit. Evidence: /private/tmp/retouch-consistent-controls-{chromium,webkit}.png, /private/tmp/retouch-consistent-controls-paint.png, matching inspector logs, /private/tmp/retouch-consistent-controls-paint.log and /private/tmp/retouch-consistent-controls-paint-webkit.log. No native application launch or package rebuild; full parity remains incomplete and the goal stays active.


### 2026-09-12 — switch editing to the current preview range

When the current preview is outside the selected edit range, the inspector now offers an explicit `Edit <width> px and larger` action alongside `Preview this breakpoint`. It reuses the existing current-width scope choice, including discovered named/unit-aware class scopes, and existing scope-change handling. Switching ranges keeps the preview size and source unchanged; subsequent edits use the selected range. The action stays visible outside Breakpoint options and is also searchable in Actions. It is absent when the range already matches, is unknown, or no valid current-width choice exists.

Validation: 32 responsive/inspector unit tests passed. React Chromium inspector-light now exercises the visible action, unchanged source/preview on range switch, a real opacity edit in the new range and exact Undo. HTML WebKit breakpoint-preview exercises the Actions route, unchanged source/preview, a 390px opacity edit, precedence of an existing 768px override and exact Undo, followed by the existing comparison/edit/history/reload suite. Evidence: /private/tmp/retouch-edit-preview-{unit,react,html,actions}.log and visually inspected /private/tmp/retouch-edit-preview-range.png. No desktop package rebuild/native launch. Full parity remains incomplete; goal active.


### 2026-09-12 — identify paint properties independently of swatches

A live compact WebKit review showed technical labels such as Background color (CSS) wrapping in the Fill section. The organizer's generic first aria-label lookup found the swatch button (Edit Background color...) before the field, bypassing the concise-label mapping. It now prioritizes labeled inputs/selects/textareas and only falls back to other controls. The same lookup is used for field pairing and property section organization. Visible text/fill/stroke fields now read Color; accessible field and swatch names retain the full property description.

Validation: 22 inspector/palette UI units passed; compact HTML WebKit drawer/persistence/selection/Escape/edit/Undo flow passed; HTML Chromium shared SVG paint responsive/literal/linked-style/Undo flow passed; React Chromium full light inspector/responsive-switch/layout/opacity/corners/Undo flow passed. Inspected before /private/tmp/retouch-compact-workspace-review.png and after /private/tmp/retouch-compact-paint-labels.png. Logs: /private/tmp/retouch-paint-labels-{unit,svg,react}.log and /private/tmp/retouch-compact-paint-labels.log. No native launch/package rebuild; full goal remains active.


### 2026-09-12 — clearer primary font controls

Font menus and search label WebKit's unquoted -webkit-standard family as Browser default, retaining the exact option/source value. Font status identifies it as a browser default; a quoted custom family named "-webkit-standard" remains distinct. The main picker has the concise visible label Font. HTML's raw Font family (CSS) field is under Type settings. Reset font family stays beside the primary picker in both HTML and React; initial browser runs exposed its hidden placement, fixed before the final runs.

Validation: 16 inspector units passed; direct checks confirmed default/quoted-name identity and null status handling. Full HTML WebKit and React Chromium page-font workflows passed, including catalog/search/keyboard apply/cancel, named and underscore families, responsive isolation, reset, preview and exact source Undo. Compact WebKit editing/Undo also passed. Final logs: /private/tmp/retouch-font-controls-html-final.log, /private/tmp/retouch-font-controls-react-final.log, /private/tmp/retouch-font-controls-compact-final.log, /private/tmp/retouch-font-controls-unit.log. Visually inspected /private/tmp/retouch-font-controls-final.png. No desktop package rebuild/native launch. Full parity remains incomplete; goal active.


### 2026-09-12 — refreshed desktop inspector archive

Built clean f8f5e83 into /private/tmp/retouch-desktop-inspector-f8f5e83/Retouch-0.1.0-mac.zip. All 913 units passed. Extracted universal arm64/x86_64 bundle passed strict ad hoc signature/inventory verification before and after packaged HTML fonts, HTML breakpoint comparisons and React inspector browser flows. All 178 source hashes plus native/build/verifier hashes matched the clean checkout. Generated local cask syntax passed; installation was not repeated. External harness removed. Receipt: desktop/verification/2026-09-12-inspector-refresh.json. Native launch/sampling/editing, notarization/trusted distribution and full Figma parity remain unverified/incomplete; goal stays active.


### 2026-09-12 — shared React/Liquid padding

Added uniform and per-edge padding fields to the shared Layout section, with Mixed states and adjacent reset controls. A single operation updates all selected source layers and uses existing padding validation, important/shorthand precedence, physical-to-logical edge mapping and responsive scope handling. Uniform reset clears that scope's padding declarations; per-edge reset reveals remaining shorthand/inherited values. Inputs accept the existing supported nonnegative lengths/percentages. Inline padding disables these controls and is rechecked before writing. Explanatory notes in shared groups now live under Details, retaining direct refusal/status messages. Numeric dragging/live preview for these new fields is not implemented.

Validation: all 914 unit tests passed. New helper tests cover important inherited shorthands, RTL logical edges, scoped reset, percentages and invalid input. RT_E2E_SHARED_PADDING=1 passed on React Chromium and Liquid WebKit: two selected layers, untouched third layer, uniform/per-edge values, Mixed display, invalid draft, reset, responsive isolation and exact Undo. Reset can normalize serialized class ordering; Undo restores exact bytes. Existing Liquid shared-section persistence/edit/Undo workflow passed. Logs: /private/tmp/retouch-shared-padding-{all-units,react-verified,liquid-verified,sections}.log. Visually inspected /private/tmp/retouch-shared-padding-final.png. Latest desktop archive predates this change; no native launch or package rebuild. Full parity remains incomplete; goal active.


### 2026-09-12 — shared horizontal/vertical gaps

Added paired shared gap fields for React/Liquid selections, with mixed values, unit/normal validation, per-axis resets and inline-gap guards checked again at write time. Existing layout gap rules map physical horizontal/vertical axes separately for each container's writing mode and preserve scope/shorthand priority. Gaps affect flex/grid layouts; other display modes retain CSS gap declarations for subsequent layout changes. These fields commit on typing/Enter; dragging/live preview remains unimplemented.

Validation: all 915 unit tests passed. Helper tests cover inherited important gaps, vertical writing, percentages/normal, reset and invalid values. RT_E2E_SHARED_GAPS=1 passed in React Chromium and Liquid WebKit: mixed flex/grid containers with different writing modes; measured actual child gaps of 12px horizontal and 20px vertical; untouched third layer; reset to original 4px/8px shorthand values; invalid draft; breakpoint isolation; exact source Undo. The fixture retains direct text for stable layer names. Existing Liquid shared-padding regression also passed. Evidence: /private/tmp/retouch-shared-gaps-{all-units,react-final,liquid-final,padding-regression}.log and visually inspected /private/tmp/retouch-shared-gaps.png. Last push remains f5d4b9d; desktop archive predates this change. No native launch/package rebuild. Full goal remains active.


### 2026-09-12 — compact shared inspector labels and resets

Shared property rows now omit redundant Shared prefixes and use concise names such as Basis, Alignment, Column span and Row span. Reset actions move beside their matching fields as icon buttons. Existing full accessible field/button names, titles and handlers remain intact, including the shared font picker reset. Existing custom gap/padding rows retain their deliberate short labels. This reduces shared Layout height while preserving presets and section disclosures.

Validation: 29 inspector/shared-style unit tests passed. Liquid WebKit shared-gap geometry/responsive/reset/Undo flow passed; React Chromium shared-section persistence, collapsed-field visibility, editing and Undo flow passed. Visually inspected /private/tmp/retouch-shared-layout-compact.png. Logs: /private/tmp/retouch-shared-layout-{unit,compact,sections}.log. No new desktop archive/native launch or push. Full goal remains active.


### 2026-09-12 — distinct shared paint sections and font reset verification

Shared text paint now belongs to Typography, background/SVG fill to Fill, and border/SVG stroke to Stroke. Appearance retains opacity/visibility/blending. This fixes the ambiguity introduced by concise Color labels inside one shared Appearance group. New Fill/Stroke sections use the existing persisted disclosure state. The relative-spacing explanation is under Typography Details. Extended the shared relative-typography browser flow to reset a common font to each layer's original mixed family and Undo back to the common font/source.

Validation: shared font reset/relative typography passed on React Chromium; shared responsive literal/linked paint editing and Undo passed on Liquid WebKit. Extended React shared-section test passed collapse-state preservation for Fill/Stroke through edits and reload. 35 inspector/shared/palette units passed. Evidence: /private/tmp/retouch-shared-typography-reset.log, /private/tmp/retouch-shared-paint-sections.log, /private/tmp/retouch-shared-paint-persistence-final.log, /private/tmp/retouch-shared-paint-unit.log. Visually inspected /private/tmp/retouch-shared-paint-sections.png. The shared inspector still nests these groups under its outer Layout section; exact visual parity is not established. No push/package rebuild/native launch. Full goal stays active.


### 2026-09-12 — shared sections at panel level

Removed the redundant outer Layout container around shared Size, Layout, Appearance, Typography, Fill, Stroke and Effects disclosures. Existing disclosure elements and handlers are preserved, so keyboard toggles and saved collapse state survive panel refresh. Shared sections now use the light single-layer panel's heading weight, spacing and dividing rules. General shared-editing explanations are in a separate disclosure. Figma properties reference rechecked: https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar . This is a hierarchy improvement, not proof of full visual parity.

Validation: 35 inspector/shared/palette units passed. React Chromium and Liquid WebKit shared-section browser flows passed edits, keyboard toggles, scope changes, Undo and persisted collapse state after reload. Final WebKit screenshot visually inspected: /private/tmp/retouch-shared-hierarchy-final.png. Logs: /private/tmp/retouch-shared-hierarchy.log, /private/tmp/retouch-shared-hierarchy-webkit-final.log, /private/tmp/retouch-shared-hierarchy-unit.log. Earlier screenshot revealed CSS specificity overriding headings; corrected and final WebKit run passed. No desktop rebuild or native launch. Last remote push remains 905ac3d; this increment is local. Full goal remains active.


### 2026-09-12 — inline shared paint reset actions

Shared text/background/border/SVG paint clear actions now sit beside their matching field using the existing reset icon style. Full accessible names, tooltips, disabled states and source callbacks remain intact. Reset guidance lives in Typography/Fill/Stroke Details with the corresponding controls instead of Appearance. This continues the compact light inspector treatment.

Validation: 35 inspector/shared/palette units passed; Liquid WebKit shared-section persistence flow passed and /private/tmp/retouch-shared-paint-rows.png was visually inspected. React Chromium complete color-style flow passed, including clearing shared background overrides, retaining links and exact source Undo. Logs: /private/tmp/retouch-shared-paint-rows-unit.log, /private/tmp/retouch-shared-paint-rows.log, /private/tmp/retouch-shared-paint-reset.log. No desktop rebuild/native launch/push. Full goal remains active.
