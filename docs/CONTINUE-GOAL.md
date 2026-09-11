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

Canvas modifier selection now preserves component scope, resolves nested host clicks to a stamped usage root, and retains the group on incompatible picks. Both browser engines verify canvas click → This instance → nested Shift-click → shared property edit → exact Undo. Layers now also supports component Shift-click ranges and Shift-arrow expansion/contraction; both browsers verify a range shared edit and exact Undo. Command-click remains the individual toggle on macOS. Main-canvas marquee now follows component selection scope and selects fully enclosed component root groups. Both browsers verify two-root fragments at 50/100% zoom, partial-fragment exclusion, additive selection, Escape cancellation, shared editing and exact Undo. Main-canvas secondary fragment outlines now use grouped bounds, verified as exactly one box per selected component at both zoom levels and after Undo. Comparison previews now group component roots for outlines, visible counts and reveal cycling. Phone/Tablet browser checks verify scaled boxes plus shared property edits and Undo. Continue with comparison component marquee (`retouch/shell/compare.js`), dedicated component clipping/reveal verification, repeated occurrence identity, mixed host/instance behavior, and richer property-control UI coverage. Structural group actions are unavailable. The browser fixture verifies strings, default reset, expression protection and toggle/history; it does not establish every control type or arbitrary local-function component discovery. `selectMany` still targets host IDs.

## Broader unfinished scope (not an exhaustive audit)

Mixed/component-instance multi-selection; variants and shared libraries; nested overrides, slots and expression swaps; semantic identity across reordered data, portals and frameworks; multi-component/cross-file relocation; richer TypeScript contracts; arbitrary-framework and remote-site durable authoring; full document/pages/sections/guides model; vector/boolean/mask/transform parity; complete responsive auto-layout and hug/fill behavior; rich text and font resolution; assets and export; prototypes, collaboration and version browsing; cross-process atomicity; and trusted notarized Homebrew distribution with upgrade/Intel/native verification.

Responsive helpers currently have bounded media-query solving (up to 2,000 candidates and dimensions 240–7,680), and equal-width named-scope CSS cascade inheritance remains unresolved. Existing app/CLI instrumentation supports specific integrations; accepting arbitrary startup commands is not proof of automatic instrumentation for ANY site. Re-audit these gaps against current code rather than treating this list as the complete specification.
