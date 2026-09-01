# RFC-0001: The Editable Mirror

| | |
|---|---|
| RFC | 0001 |
| Status | Draft |
| Author | P. Shen |
| Created | 2026-09-01 |
| Product | Retouch — CLI `npx retouch`; route prefix `/rt/` (configurable); decided rev 11 (OQ-G3, DR-0008) |
| Revised | 2026-09-01 (rev 14) |
| Companion | Prior-Art Survey (`docs/prior-art-survey.html`), 2026-09-01 |
| Decisions | `docs/decisions/` (DR-0001 … DR-0007); index in `docs/decisions/README.md` |

> **Note to AI assistants editing this document**
> 1. This is a normative engineering RFC. The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used per RFC 2119/8174 and carry that meaning only; do not use them decoratively.
> 2. Write declarative, falsifiable statements. Prohibited: marketing language, hedging qualifiers ("arguably", "essentially"), rhetorical questions, em-dash asides, emoji, exclamation marks, and unattributed superlatives.
> 3. Quantities carry units. Latency targets carry percentiles. "Fast", "clean", and "simple" are not specifications; replace them with measurable criteria or delete them.
> 4. Identifiers are stable: requirements are R-n, open questions are OQ-xn, figures are Figure n. Never renumber. Mark removed items *Withdrawn* with a one-line reason.
> 5. Every claim about an external system cites the Prior-Art Survey (PAS) or a primary source, or is marked [UNVERIFIED].
> 6. Diagrams live in the HTML version (`docs/rfc-0001-editable-mirror.html`, canonical) as inline SVG; this markdown mirror references them by figure number. Keep both files in sync; the HTML is authoritative on conflict.
> 7. Record every substantive change in Section 9 (Revision History) with date and summary.
> 8. Every revision that resolves or changes a trade-off has a decision record in `docs/decisions/` (DR-n) listing all alternatives considered and the arguments as made; the revision-history row names it. Records are never rewritten after acceptance; a reversal gets a new record that supersedes the old one.

## 1. Abstract

This RFC specifies the architecture of an open-source library that mounts an editable mirror of a running web application at a reserved route on that application's own development server. A user manipulates the mirror through direct-manipulation gestures (select, reorder, resize, spacing adjustment, text edit). Each gesture is translated into a typed edit operation and applied to the application's source files by a deterministic rewriter. No machine-learning model participates in the mapping or write path.

Section 4 fixes six design constraints established by the companion Prior-Art Survey. Section 5 specifies the system decomposition. Section 6 enumerates the open questions that block detailed design, each with options and decision criteria. Section 7 defines the prototypes whose measurements resolve them.

## 2. Motivation

Code-generating tools produce working frontends for users who cannot comfortably edit the generated source. The smallest changes (spacing, order, copy, color) today require either editing unfamiliar code or re-prompting a model, which is slow, non-deterministic, and can regress unrelated code. The survey establishes that (a) every major AI application builder shipped a deterministic "visual edit" fast path during 2025–2026, confirming demand, and (b) no implementation exists as an embeddable library that attaches to an existing project: all shipped systems either own the development environment (Onlook, Utopia, Codux) or are bound to a hosted builder (Lovable, v0, Replit). This RFC targets that gap.

## 3. Terminology

| Term | Definition |
|---|---|
| host application | The user's web application whose source files are the write target. |
| mirror | The instance of the host application rendered inside the editor for manipulation. Served from the same dev server and origin as the host application. |
| mirror process | *Hardened mode only (deferred, rev 6).* A separate process that serves the editor shell on its own port and hosts the token and writer, so that none of them share an origin or process with host-application code. In the MVP these live in the dev-server process. |
| route prefix | The reserved path under which the plugin serves the editor shell and the writer endpoint: `/rt/` by default, configurable per project. `/rt/<app path>` mirrors `/<app path>` (OQ-B6). |
| editor shell | The document served under the route prefix by the plugin, on the host application's own origin. Hosts the overlay and embeds the host application in a same-origin iframe. |
| overlay | Editing chrome (selection outlines, handles, guides, panels) rendered by the editor shell above the iframe. Owns all pointer input while edit mode is active. |
| agent | A script injected into the host application's frame. Performs hit-testing, geometry queries, DOM mutation, and text-editing activation; answers RPC requests from the editor shell. Holds no credential, has no file access, never originates ops. |
| session token | A random secret generated when the dev server starts, delivered to the editor shell and held in a closure (never in storage or URLs), required on every op the writer accepts. |
| launch mode | `npx retouch` boots the host application's own dev server, with the plugin appended, on the project's usual port. No repository changes. |
| config mode | The plugin is registered in the project's build config (one line). The mirror route is then available whenever the dev server runs. |
| attach mode | *Hardened mode only (deferred, rev 6).* A separate mirror process discovers and connects to a running dev server that has the plugin. |
| stamp | The build-time transform that attaches an element ID to each eligible JSX element in compiled output. Source files are never modified by stamping. |
| AST path | The sequence of steps from a file's root node to one JSX element through the syntax tree, e.g. `FunctionDeclaration[Card] → ReturnStatement → JSXElement → children[2] → children[1]`. It passes through expressions (map callbacks, conditionals) as ordinary tree steps. |
| element ID | A structural ID: `hash(relative file path, AST path)`. A pure function of source, so the plugin and the writer compute it independently (R-10). |
| source span | A (file path, byte range) pair addressing one JSX element in pre-transform source. Obtained by the writer by parsing the file at write time. |
| index | The writer's map from element ID to (file path, AST path), built by parsing project source from disk and updated on file change. Replaces the transported manifest of revs 2–5. |
| component definition | The file and function that declare a component (Figma: main component). Edits to it change every instance. |
| component instance | A usage site of a component, e.g. `<Button …>` in a page (Figma: instance). Its overrides are its props. |
| instance ID | A structural ID for a usage site, passed to the component at build time as the prop `data-rt-i`. It reaches the DOM only if the component forwards props to a DOM element. |
| lift | The op that exposes a literal value inside a definition as a prop with the old value as its default, and sets a new value at one usage site (Figma: expose a component property). |
| detach | The op that makes one usage site independent of its definition, by duplicating the definition module or by inlining its JSX (Figma: detach instance). |
| operation (op) | A typed, serializable description of one edit, e.g. `setClasses`, `setText`, `setProp`, `insertChild`, `removeChild`, `reorderChild`. The op log is the unit of undo, redo, and replay. |
| write-back | Application of an op to source files by the rewriter. |
| re-derivation | Regeneration of the manifest and remapping of live element IDs after any source change, including the library's own writes. |

## 4. Design constraints (normative)

Fixed by the survey's findings. Each cites its section in the Prior-Art Survey (PAS).

| ID | Requirement | Rationale |
|---|---|---|
| R-1 | DOM-to-source mapping MUST be produced by build-time instrumentation. The system MUST NOT read framework internals (React fibers, devtools hooks) for mapping. | React 19 removed `fiber._debugSource` and `findFiberByHostInstance`; every runtime-inspection tool broke (PAS §2). Build-time stamping is the only mechanism with a support guarantee the library itself controls. |
| R-2 | Write-back MUST edit the authoring representation (JSX attributes, literal children, literal props) via AST- or byte-offset-based rewriting. The system MUST NOT write to compiled output, generated CSS, or CSS files addressed by selector. After write-back, running the project's configured formatter MUST be an identity operation. | Selector-to-element mapping is many-to-many; no surveyed deterministic system writes CSS files (PAS §3). Formatter idempotence prevents write-back and format-on-save from fighting. |
| R-3 | Every edit MUST be expressed as a typed op. The overlay applies an optimistic DOM patch and appends to the op log; the disk write is the commit. Ops MUST be invertible (undo) and replayable against a re-derived manifest. | Onlook and Lovable converged on the two-track model independently (PAS §1, §3). Replayability is required by re-derivation (§5.3). |
| R-4 | Style ops in v1 target the element's Tailwind class attribute. Class conflict resolution MUST follow tailwind-merge semantics (per-property class groups, variant-aware, last-wins). | A class string is a single-attribute write target with a pure value-to-class function; all surveyed writers converged on it (PAS §3). |
| R-5 | The overlay MUST NOT insert elements into the host document's flow. Text editing uses per-element `contenteditable="plaintext-only"` with `beforeinput` interception, committed on blur or Escape. The system MUST NOT use `document.execCommand` or document-level `designMode`. | Overlay-in-flow perturbs the layout being measured. `execCommand` is deprecated; `designMode` has no commit boundary and makes injected UI editable (PAS §4). |
| R-6 | If an op cannot be applied deterministically, the system MUST refuse the gesture and state the reason and source location. The system MUST NOT fall back to best-effort rewriting. | Gutenberg's validate-and-flag model is the proven pattern for coexisting with hand edits (PAS §1). Refusal preserves the core guarantee. |
| R-7 | The library MUST refuse to mount when `NODE_ENV=production`, MUST bind to localhost by default, MUST restrict writes to files under the project root, and MUST NOT load third-party origins into the mirror. | The mirror is a code-writing surface; Hypothesis Via documents the abuse mode of open mirrors (PAS §4). |
| R-8 | *Deferred to hardened mode (rev 6); not required for the MVP.* The session token, the editor shell, and the writer MUST NOT share an origin, a process, or a port with host-application code. | Added rev 5 against in-page malicious code. Deferred because a malicious npm package already has machine access at install time and in the dev-server process; the split defends only against remote scripts and dev-time XSS, which does not justify a second process in the MVP (§8.3). The interfaces stay RPC-shaped so the split can be added without a rewrite. |
| R-9 | The writer MUST accept only typed ops and MUST validate every op against its type's value grammar before applying it: class tokens matching the project's Tailwind grammar; text written as escaped JSX text; prop values as literals, with `href`, `src`, `srcset`, `action`, `formaction`, `on*`, and `dangerouslySetInnerHTML` excluded. The writer MUST reject requests whose `Host` header is not a loopback name, MUST require a custom request header and the session token on every op, and MUST write only to files that parse as JSX/TSX. The agent MUST NOT originate ops. | These controls are cheap and are needed for determinism regardless. Together they bound any misuse of the endpoint to cosmetic JSX edits with no code execution, and block all remote attackers (CSRF, DNS rebinding). Added rev 6. |
| R-10 | Element IDs MUST be a pure function of source: `hash(relative file path, AST path)`. The writer MUST build its index by parsing project files from disk and MUST NOT accept mapping data from the plugin or the browser. | Removes the transported manifest (a forgeable input), keeps IDs stable across attribute and text edits, yields fresh byte spans at write time, and makes all instances of one callsite share one ID (OQ-E3). Added rev 6. |
| R-11 | Write integrity. (a) Preview MUST NOT write: gesture feedback is applied to the mirror DOM only (inline styles, class attributes) and is discarded on failure. (b) The writer MUST re-parse the edited text and run the project's formatter before writing, and MUST NOT write if either fails. (c) Writes MUST be atomic: write to a temporary file in the same directory, then rename. (d) Each op MUST touch exactly one file, with one exception: detach (R-12) is a two-file transaction. (e) Every op MUST carry the content hash of the file version it was computed against, and the writer MUST reject on mismatch (§5.3). (f) The library MUST NOT perform version-control operations. (g) Every op MUST be invertible, and undo MUST restore byte-identical content. | The codebase is never in a state the user did not author: at every instant a source file is either its previous content or a parsed, formatted, single-op successor. Added rev 8. |
| R-12 | Component model. (a) An edit made on a component instance MUST target the usage site by default; editing the definition and detaching MUST be explicit actions. (b) Lift MUST add a destructured prop with the previous literal as its default, rewrite the definition's class attribute to `cn(<static literal>, <prop identifiers…>)`, and set the prop at the usage site; the writer MAY edit a `cn()` call only when it matches this generated shape. (c) Lift MUST be refused unless the value is a literal in the definition and the component's parameter shape is on the supported list. (d) Detach MUST create the new file before editing the usage site and MUST remove the new file if the usage edit fails. Inline detach MUST be refused unless the definition is a pure JSX-return function with no hooks, state, or logic. (e) Instance-level ops MUST be refused with a reason when the instance ID is absent from the DOM. | The Figma component model (main, instance, overrides, properties, detach) mapped onto code, with every step deterministic. Added rev 13; DR-0009. |

### 4.1 Why R-1 cannot be relaxed to a framework-only dependency

R-1 raises the question of whether element-level mapping can be obtained from React alone, with no hook into the project's build. Five alternatives were examined; each fails to produce span-level mapping on current React.

1. **Fiber inspection (`_debugSource`).** Removed in React 19 (PR #28265). It worked on React ≤ 18 only because those toolchains already ran the `jsx-source` Babel transform in dev presets, i.e. it was build-time instrumentation that happened to be pre-installed, not a runtime capability of React.
2. **`jsx-dev-runtime` interception.** Through React 19.1, `jsxDEV` still receives source metadata in development; aliasing the runtime module could capture it without a custom transform. React 19.2 removed the parameter entirely (PAS §2). Rejected as a foundation: it is pinned to a version window that has already closed.
3. **Owner stacks (`captureOwnerStack` / `_debugStack`, React 19.1+).** Requires no build hook: a synthesized error stack is symbolicated against source maps fetched at runtime. Its granularity is the component owner chain; frames resolve inside component function bodies, and multiple JSX elements produced by one component cannot be distinguished (PAS §2). Sufficient for file-level "open in editor"; insufficient for span-level deterministic write-back.
4. **Source maps alone.** They map generated-JS positions to source positions but provide no path from a DOM node to a generated-JS position. A runtime hook is still required to obtain that position, and after item 1 none exists for host elements.
5. **Static DOM–AST matching.** Parse source from disk (file-system access only, no build hook) and match the rendered DOM against the JSX tree structurally (tag names, literal class strings, literal text). Deterministic where the match is unique; ambiguous exactly where precision matters (mapped lists, conditionals, dynamic classes). No surveyed system ships it. Retained as a candidate inspect-grade fallback under OQ-A2, not as a write path.

Conclusion: R-1 stands. The dependency is, however, narrower than "requires Vite." The library does not require adopting a build system; it requires registering one transform and one middleware in the build configuration the project already has. A JSX project has a compile step by definition, so the true prerequisite is "a build the user can add one plugin to," which for the v1 target (OQ-A1) is one line in `vite.config.ts` — and the registration need not be a file edit at all: the mirror process can perform it at boot time (launch mode, OQ-B1), making zero repository configuration possible. The framework-only variant that is possible without any build hook — component-level mapping via owner stacks — supports inspection, not editing, and is recorded under OQ-A2 option 2.

## 5. System overview

### 5.1 Components

The MVP is one process and one origin. The bundler plugin runs inside the project's own dev server and provides four things: the stamper (structural IDs on compiled JSX, agent injection into served HTML), the mirror route serving the editor shell at `/rt`, the index (built by parsing project files from disk, R-10), and the writer. The shell embeds the host application in a same-origin iframe, so the application keeps its cookies, storage, and pinned CORS and redirect configuration, and the shell may read the iframe's DOM directly. Figure 1 (HTML version) shows the topology. The plugin reaches the dev server either by launch mode (`npx retouch`, no repository changes) or by config mode (one registered plugin); OQ-B1 covers the mechanics. The two-process hardened mode of rev 5 is deferred (R-8, §8.3).

```
 browser · origin localhost:3000            dev-server process :3000
 ┌─────────────────────────────┐            (npx retouch launch, or plugin in config)
 │ shell page  /rt       │  POST op   ┌────────────────────────────────┐
 │  overlay · op log · token ──┼──+ token──►│ bundler plugin                 │
 │        │                    │  + header  │  writer          │ stamper     │
 │        │ DOM access ·       │            │  Host+token check│ structural  │
 │        │ agent RPC          │            │  op grammar check│ IDs; agent  │
 │        ▼                    │            │  parse → span    │ injection   │
 │ iframe  same origin         │            │  AST edit →      ├─────────────┤
 │  host app: stamped DOM,     │            │  format → write  │ index       │
 │           app state, HMR    │◄──HMR──────│        │         │ id→file,path│
 │  agent: geometry, DOM patch,│            │        │         │ from disk   │
 │         never originates ops│            └────────┼─────────┴──────▲──────┘
 └─────────────────────────────┘                     │ writes         │ on change:
                                              source files (project root only, R-7)
                                                                       recompile, re-index
```

### 5.2 The edit cycle

Figure 2 (HTML version) specifies the cycle for a single gesture. Step 4 carries the session token and the custom header (R-9).

1. Shell resolves gesture → op.
2. Agent applies optimistic DOM patch.
3. Op appended to the log. *(Steps 1–3 = Budget A: one frame at 60 Hz, 16.7 ms.)*
4. Op POSTed with the token and header to the writer (the commit; asynchronous from the UI).
5. Writer validates the op; index resolves element ID → (file, AST path); the file is parsed for a fresh span.
6. AST/offset rewrite; project formatter pass.
7. File written.
8. Bundler recompiles and re-indexes; HMR update replaces the optimistic patch. Any visual difference between the optimistic patch and the HMR-rendered result indicates a defective op-to-code mapping.
9. Shell confirms selection (IDs unchanged unless siblings moved). *(Steps 4–9 = Budget B: the commit round trip; it bounds how quickly a second edit to the same file can commit, OQ-C3.)*

### 5.3 Re-derivation

Any source change can change the index: the library's own writes (step 7), the user's editor, or version-control operations. Because IDs are structural (R-10), an attribute or text edit leaves every ID in the file unchanged; only inserting, removing, or reordering JSX nodes changes the IDs of the nodes after them. The writer re-parses a file on every write, so byte spans are always fresh. Staleness is therefore about the file, not the ID: each op carries the content hash of the file version the shell last saw, and the writer MUST fail closed on mismatch, after which the shell re-reads and re-submits. When the op that caused a structural change is the library's own, the writer returns the old-to-new ID mapping so the shell keeps its selection. External changes detected by the file watcher additionally surface a conflict notice instead of silently remapping (R-6).

## 6. Open questions

Each question states its options, the criteria that decide it, and a provisional position where the survey supports one. A provisional position is a default for prototyping, not a decision. Three questions gate the majority of detailed design and SHOULD be resolved first: **OQ-E1, OQ-C1, OQ-F1**.

### 6.1 Scope

**OQ-A1. Which build tools, frameworks, and styling systems does v1 support?**
- Options: (1) Vite + React + Tailwind only. (2) Add Next.js (webpack/turbopack) at launch. (3) Framework-agnostic mapping from the start, following the code-inspector-plugin bundler matrix.
- Criteria: share of target users covered per unit of stamper/writer surface area; each additional bundler multiplies transform-plugin maintenance (PAS §2).
- Provisional: option 1. The mapping-layer interfaces (element ID, source span, manifest) are framework-neutral so that Vue (sourcemap tracing) and Svelte (`__svelte_meta`) can be added without interface changes.

**OQ-A2. Is any capability offered for applications whose build cannot be instrumented?**
- Options: (1) none; the bundler plugin is a hard prerequisite. (2) A localhost-only CLI proxy that injects the agent (select-and-inspect only; write-back is impossible without the manifest). (3) A general rewriting proxy for arbitrary sites.
- Criteria: option 3 is rejected on survey evidence (CSP stripping, cookie emulation, service-worker neutralization required; mature implementations are AGPL; abuse profile documented by Hypothesis Via, PAS §4). The open question is only whether option 2's inspect-only mode justifies its maintenance cost.
- Provisional: option 1 for v1.

**OQ-A3. Does the mirror exist outside the dev server (preview or production builds)?**
- Options: (1) dev server only. (2) Plus a read-only annotated preview build for review and commenting. (3) Editing against a deployed site through a connected local checkout.
- Criteria: write-back requires source on disk and a rebuild channel; options 2–3 add distribution and auth surfaces (interacts with OQ-F2, R-7).
- Provisional: option 1. Option 2 is additive and not blocked by any v1 decision.

### 6.2 Mirror architecture

**OQ-B1. How does the mirror process obtain an instrumented dev-server process?**
- Status: resolved for the MVP (rev 6): one process, one origin. Options 1 and 5 below are adopted as config mode and launch mode respectively; they are the same plugin with two ways of registering it. Option 4 (parallel port) is withdrawn: it changes the application's origin for no MVP benefit. Option 2 is withdrawn (cross-origin for no reason). Option 3 survives only as the inspect-only fallback of OQ-A2. The rev 5 trust split (separate mirror process, attach mode) is deferred to hardened mode (R-8, §8.3).
- Options (retained for history): (1) dev-server middleware: the plugin serves the shell at a reserved route (`/rt`) on the user's own dev server; the iframe is same-origin; requires one plugin registration in the project's build config. (2) A separate editor process on its own port, cross-origin. (3) A CLI proxy wrapping an unmodified dev server. (4) Parallel dev-server instance: a CLI boots a second instance of the project's own dev server (Vite's programmatic API, loading the project's config file and appending the mirror plugin) on its own port; the shell and the app iframe are both served by that instance, so same-origin is preserved; the user's primary dev server and build config are untouched (the embed pattern Vitest and Storybook use). Additional capability: the instance owns its module graph, so unsaved ops can be served as virtual modules, rendering the op log's state through real HMR without disk writes (cross-reference OQ-F1). (5) Same-port launcher: a CLI (`npx retouch`) boots the project's own dev server itself — the project's config file loaded programmatically, the mirror plugin appended — and binds the project's usual port, replacing the primary dev server for the session. Origin identity with normal development is exact (cookies, localStorage, CORS allowlists, redirect URIs all match); zero repository changes; retains option 4's module-graph ownership. Injection: for Vite, the option-4 programmatic embed; for other Node toolchains, process-level loader-hook preloading (`NODE_OPTIONS --import`), the mechanism APM auto-instrumentation agents use, version-sensitive per toolchain [UNVERIFIED for Turbopack].

- Modes (MVP):

  | Mode | Repository changes | Origin | Mechanism |
  |---|---|---|---|
  | launch (`npx retouch`) | none | the app's usual origin; the user's own `npm run dev` does not run at the same time | Vite: programmatic embed of the project's config with the plugin appended (the Vitest/Storybook pattern). Other Node toolchains: loader-hook preloading via `NODE_OPTIONS --import`, the APM auto-instrumentation mechanism [UNVERIFIED for Turbopack]. |
  | config | one line | the app's usual origin; the mirror route is always available | None at run time. |

- Facts carried forward: cookies are not isolated by port (RFC 6265 §8.5); localStorage and Origin-checked requests are. Both MVP modes keep the application on its usual origin, so no continuity caveat applies.
- Residual open items: (a) per-toolchain launch injection outside plain Vite, including frameworks that wrap Vite with their own CLI (SvelteKit, Astro, Remix), each needing its own embed path; config mode is the fallback. (b) Port-busy policy for launch mode (the user's server already holds the port): fail with instructions, never take over. (c) Route collision, resolved rev 11: the prefix is configurable (default `rt`); at mount, launch mode sends a HEAD request for the prefix to the application and warns if the application answers it, since a two-letter prefix has a higher collision probability than a long one (DR-0008). (d) Fault isolation: every plugin hook MUST catch its own errors and serve the module unstamped with a warning, so a plugin defect degrades the mirror rather than the dev server.
- Provisional: both modes ship. Launch is the zero-configuration default; config mode is for teams and for toolchains without maintained launch injection.

**OQ-B2. Is the mirror the live application or a frozen scene?**
- Options: (1) live application; an edit-mode toggle routes pointer input to the overlay. (2) Live application with a freeze control suspending rAF and timers. (3) An inert DOM snapshot (rrweb-style) with edits replayed against source.
- Criteria: option 3 loses framework state and is overwritten on remount (PAS §4). Option 2's suspension is not implementable reliably across timer sources. Determining factor: whether option 1's motion under selection (carousels, animations) is tolerable in practice.
- Provisional: option 1. The HMR-during-drag sub-question is carried by OQ-E4 rule 3 (re-anchor by structural ID; provisional pending hands-on validation).

**OQ-B3. Single full-viewport mirror, or a pan/zoom canvas with multiple breakpoints?**
- Options: (1) single viewport at 1:1. (2) Pan/zoom canvas, one frame. (3) Canvas with multiple device-width frames (Onlook's model).
- Criteria: options 2–3 require zoom-aware geometry throughout (snap thresholds and drag deltas divide by zoom; PAS §4).
- Provisional: option 1 shipped first, with all geometry code written against a `(zoom, pan)` transform fixed at identity, so options 2–3 require no rework.

**OQ-B4. Does editing chrome render in the editor shell or inside the iframe?**
- Status: resolved (rev 5, amended rev 6). Editing chrome renders in the shell; the agent measures and mutates. Option 2 (chrome inside the iframe) is withdrawn: chrome in the app document perturbs the layout being measured (R-5). Rev 6 amendment: with a same-origin iframe the shell MAY read the iframe DOM directly for hit-testing and geometry, but all mutation and all reads that the hardened mode would need cross-origin go through the agent's RPC-shaped interface, so the two-process split can be added later without a rewrite.
- Options (retained for history): (1) chrome in the shell (parent document) above the iframe; the agent only measures and mutates. (2) Chrome injected into the iframe alongside the app.
- Consequences: continuous geometry sync is required (gBCR + ResizeObserver + MutationObserver + IntersectionObserver gating, batched per frame, per PAS §4); in the MVP it runs in the shell against the same-origin iframe. The RPC surface starts as a subset of Onlook's preload API.

**OQ-B5. Is the editor an iframe host under a reserved route, or injected into the application's own pages?**
- Status: resolved (rev 9): option A. The decision was implicit in revs 2–8 and is recorded here explicitly.
- Options:

  | | A. Reserved route, iframe (`/rt/…`) | B. In-page (no iframe) | C. Different origin |
  |---|---|---|---|
  | Origin continuity | exact | exact | partial: cookies yes; localStorage, CORS allowlists, OAuth redirects no |
  | Repository changes | none (launch) or one line | none or one line | none |
  | Panel space | app has its own viewport; panels beside it | panels cover the app, or shrink it and perturb the measured layout | own viewport |
  | App crash or full reload | shell and op log survive; the frame reloads | editor and op log die with the page | shell survives |
  | URL forwarding | required (OQ-B6) | not needed | required |
  | Multi-breakpoint canvas (OQ-B3, later) | possible | not possible | possible |
  | Precedent (PAS §1, §4) | Onlook, Plasmic, Builder, Puck, all CMS visual editors | VisBug, stagewise: toolbars, not full editors | Onlook cloud; rev 5 hardened mode |

- Criteria: C fell on origin continuity and MVP process count (revs 4–6; retained as hardened mode). B is viable for R-5 (chrome in a fixed-position shadow-DOM host outside the flow) but loses on panel space, isolation from application failures, and the breakpoint canvas. The survey's split confirms it: in-page suits toolbars; every full editor with panels uses an iframe.
- Note: B remains a candidate for a later lightweight "toolbar mode" (quick text and color edits in-page) sharing the same ops and writer.

**OQ-B6. How does the mirror URL map to the application URL?**
- Context: under OQ-B5 option A, `/rt/about` shows the editable `/about`. Three behaviors need rules: path forwarding, following in-app navigation, and reload/deep links.
- Proposed rules: (1) **Path forwarding.** The shell takes everything after `/rt` (path, query, hash) and loads it in the iframe unchanged. (2) **Following navigation.** In interact mode the shell observes the iframe's `location` (same origin) and rewrites its own URL to `/rt` + the new location; because `pushState`/`replaceState` fire no event across frames, the agent wraps both and reports them. (3) **Reload and deep links.** A reload of `/rt/x` rebuilds the shell and loads `/x`; application state survives (shared storage); editor selection is not persisted in v1. (4) **Frame busting.** If the application navigates the top window out of the frame, the shell detects the unload and shows a message; it does not fight it.
- Alternatives (full set in DR-0007):

  | Shell URL scheme | Example | Assessment |
  |---|---|---|
  | 1. Prefix path | `/rt/about?id=7#x` | App path, query, and hash pass through unencoded; prefix-match routing; one reserved prefix. Collision policy needed for app routes under `/rt`. |
  | 2. Query flag on the app's URL | `/about?id=7&rt` | Reads as "append the flag to any page". Reserves a query name across every route; must be stripped when forwarding; server inspects the query on every HTML request. |
  | 3. Query parameter carrying the app URL | `/rt?u=%2Fabout%3Fid%3D7` | No collision issue; the app URL and its own query and hash must be percent-encoded. |
  | 4. Hash carrying the app URL | `/rt#/about` | Client-only; collides with the app's own hash state, requiring a second encoding. |
  | 5. Fixed shell URL, no mapping | `/rt` | No reload, deep link, or bookmark to a page. |
  | 6. Subdomain | `mirror.localhost:3000/about` | A different host is a different origin: breaks cookies and storage; rejected as in OQ-B5 option C. |
  | 7. Extension / DevTools panel | no URL | A different product and distribution model; out of scope. |

  | Following navigation | Assessment |
  |---|---|
  | a. Observe the iframe's `location`; agent wraps `pushState`/`replaceState` | Cross-browser; a small deterministic dev-only patch. |
  | b. Navigation API (`navigate` event) | No patching; Chromium only as of 2026 [UNVERIFIED for other engines]. |
  | c. Do not follow | URL bar goes stale; reload lands on the wrong page. |

  | Selection persistence | Assessment |
  |---|---|
  | i. None in v1 | Simplest; reload loses the selection. |
  | ii. `sessionStorage` keyed by page | Survives reload; not shareable. |
  | iii. Selection ID in the shell URL (`?sel=<id>`) | Shareable deep link to one element; stable under attribute edits because IDs are structural (R-10); reserves a query name in the shell's namespace only. A natural later feature. |

- Status: resolved (rev 12): scheme 1 (prefix path) with mechanism (a) (observe the iframe location; the agent wraps `pushState`/`replaceState`) and option (i) (no selection persistence in v1), plus frame-bust detection without blocking. All four proposed rules above are normative. Scheme 2 was the closest competitor; it lost on reserving a query name across all routes and on stripping. Option (iii), a selection ID in the shell URL, is noted for later (DR-0007).

### 6.3 Identity and mapping

**OQ-C1. Where does the element ID live, and what invalidates it?** *(See Figure 3, HTML version.)*
- Status: resolved (rev 6) by R-10: structural IDs, `hash(relative file path, AST path)`, computed independently by the stamper and the writer. Nothing is written into source (unlike option 1); nothing is transported from the build (unlike options 2–3). An attribute or text edit does not change the ID. A structural edit changes the IDs of later siblings; the writer returns the old-to-new mapping for its own ops (§5.3). Costs accepted: an initial full-project parse at startup (order of one second for hundreds of files; incremental afterwards) and ~10-character hashed attributes in the DOM. Options 1–3 are retained below for history.
- Options (retained for history): (1) **Persistent**: IDs written into the user's JSX as attributes and committed (Onlook's `data-oid`). Stable across sessions, edits, refactors; visible in every diff; the library modifies files the user did not edit. (2) **Ephemeral**: IDs exist only in compiled output; the manifest maps ID → file/line/column. Repository untouched; every write-back invalidates all IDs in the written file. (3) **Ephemeral with byte-offset manifest**: as (2) with byte-range spans enabling offset-based rewriting (magic-string). Strictest determinism; invalidation identical to (2); unshipped by any surveyed system.
- Former criteria (superseded): Budget B was to decide between options 2/3 and option 1. Structural IDs remove the dependency: the ID does not change on the library's own attribute edits, so Budget B no longer gates identity. It still bounds the commit rate to one file (OQ-C3).

**OQ-C2. Which JSX nodes are stamped?**
- Status: resolved (rev 13): option 2, by a data prop. The stamper adds `data-rt-i="<instance ID>"` to every component usage site. React ignores unknown props on function components; if the component forwards props to its root DOM element, the element carries both the definition's ID and the instance ID. Fragments are never stamped. When the instance ID is absent from the DOM (props not forwarded), instance-level ops are refused (R-12 e). Later option: inject the instance ID through context at compile time so it reaches the DOM for every function component regardless of forwarding.
- Options (retained for history): (1) host elements only; component instances opaque. (2) Host elements and component usage sites, with instance resolution (a component instance's stamp does not appear in the rendered DOM; the mapping is recovered by relating the child's root element to the parent's call site, per Onlook's algorithm, PAS §1).
- Criteria (recorded): option 1 cannot express "edit this instance's props," which OQ-E3 requires. Constraint either way: never stamp Fragments or components that do not accept arbitrary props (LocatorJS defect, PAS §2). The data-prop mechanism is chosen over Onlook's DOM/AST walk because it is a pure function of source (consistent with R-10) and needs no runtime inference.

**OQ-C3. What is the authoritative state during the commit gap (steps 4–9)?**
- Options: (1) the op log: DOM shows optimistic state; disk is authoritative only after step 8; queued ops replay against each new manifest generation. (2) Synchronous commits: the overlay blocks further gestures until step 9 completes.
- Criteria: option 2 caps gesture rate at 1/Budget B, unusable for slider-like interactions (a padding drag emits many increments). Option 1 requires op composition rules (consecutive `setClasses` on one element coalesce into one write).
- Provisional: option 1 with op coalescing and a debounced commit (interval set empirically in P1; initial value 150 ms after last gesture). Under R-10 the replay is trivial for attribute and text ops (IDs unchanged); only structural ops need the writer's old-to-new mapping (§5.3).

### 6.4 Write-back mechanics

**OQ-D1. Which rewriting mechanism does the writer use?**
- Options: (1) recast: AST mutation, reprint limited to modified subtrees. (2) Full-file reparse and regenerate, normalized by the formatter (Onlook's method). (3) magic-string offset edits (requires OQ-C1 option 3).
- Criteria: diff minimality (a one-class edit produces a one-line diff), correctness on the Utopia round-trip corpus (PAS §1), dependency weight.
- Provisional: under R-10 the writer parses the target file at write time and so always holds fresh byte spans; options 1 and 3 are both viable and option 3 no longer needs a build-time offset manifest. P1 chooses between recast (structural ops) and magic-string (attribute and text ops), possibly both. Acceptance test either way: the writer run against the Utopia corpus produces zero changes on untouched constructs.

**OQ-D2. How is R-2's formatter-idempotence requirement met across formatter configurations?**
- Options: (1) detect and invoke the repository's configured formatter (Prettier or Biome) on written files. (2) Emit minimal diffs and invoke no formatter. (3) Refuse repositories without a detectable formatter.
- Provisional: option 1 when a formatter is configured, option 2 otherwise. The formatter is resolved from the project's own dependencies, never bundled.

**OQ-D3. When a gesture yields a continuous value, is it written as a theme token or an arbitrary value?**
- Context: a resize yields 137 px. Candidate writes: `w-[137px]` (exact) or `w-32` (nearest token, 128 px, error 9 px).
- Options: (1) always exact. (2) Snap to the project's resolved Tailwind scale within a tolerance; arbitrary beyond it; the overlay's snapping guides use the same tolerance so what the user sees is what is written. (3) Always snap.
- Status: resolved (rev 7): option 3, always snap. Drag gestures write only values on the project's resolved Tailwind scale; the overlay's snap guides show only those values, so what the user sees is what is written. Arbitrary values are never produced by a gesture. Consequence: the set of classes a gesture can produce is finite, which makes preview rendering solvable by a safelist (OQ-F1). Note on scale resolution: Tailwind v4 derives spacing from a single `--spacing` multiplier (any integer step is valid); v3 uses the configured steps only; the plugin resolves the scale from the project's version and configuration.
- Criteria (recorded): code idiomaticity over pixel fidelity; the target user prefers idiomatic code.

**OQ-D4. What happens on elements styled outside Tailwind (CSS Modules, styled-components, inherited stylesheets)?**
- Options: (1) selectable and inspectable; style edits refused with the reason and the defining file (R-6). (2) Style edits written as inline `style` attributes. (3) CSS-file write-back.
- Criteria: option 3 violates R-2 and is excluded. Option 2 is deterministic but changes the element's specificity structure and produces code the target user cannot maintain.
- Provisional: option 1. v1's editable style surface is exactly: Tailwind class attributes, pre-existing inline styles, literal props, and literal text children.

### 6.5 Editing semantics

**OQ-E1. What code mutation does each spatial gesture denote?**
- Status: resolved (rev 7): option 1, flow-respecting, with no "detach" action in v1. Reparenting (drop into a different parent) is refused in v1 with a reason. The mapping table under option 1 is the normative seed of the OQ-E1 design annex (P2). Priority order for implementation is fixed by OQ-E2.
- Context: a pointer drag is a screen-space delta; source code expresses layout as flow. This is the point at which every surveyed competitor abandons determinism and delegates to a model (PAS §1). A deterministic system must fix a total function from (gesture, target state) to (mutation | refusal).
- Options: (1) **Flow-respecting**: gestures denote flow mutations only. Initial mapping table (to be completed in the OQ-E1 design annex):

  | Gesture | Precondition (computed state) | Mutation |
  |---|---|---|
  | drag element, drop within same parent | parent `display` is `flex` or `grid` | `reorderChild(parent, from, to)` |
  | drag on inter-item gap | parent is flex/grid | `setClasses(parent, gap-*)` |
  | drag element edge | element sized by `w-*`/`h-*` or unsized | `setClasses(el, w-*/h-*)` |
  | drag inside element near edge | — | `setClasses(el, p*-*)` |
  | modifier + drag element | — | `setClasses(el, m*-*)` |
  | drag, drop in different parent | — | refused in v1 (reparenting) |

  (2) **Freeform**: any drag becomes absolute positioning or a transform. (3) **Hybrid**: flow-respecting default plus an explicit per-element "detach" action enabling absolute positioning.
- Criteria (recorded): option 2 produces the positioning-heavy code the target user is escaping and interacts badly with responsive layout; the survey records no deterministic system shipping it. Option 3 is deferred: revisit only if refusals in usability testing concentrate on gestures that "detach" would satisfy.

**OQ-E2. What is the v1 gesture set?**
- Status: resolved (rev 7): tiered as below. Tier 1 is the MVP. Tier 2 follows. Tier 3 is refused in v1 with a reason (R-6).
- Tier 1 (MVP): click select; literal text edit (copy); color and typography via the class-level style panel; padding, margin, and gap adjustment by drag or by panel; and the whole component model of OQ-E3 (instance highlight and co-highlight, instance text, lift to prop, edit main component, detach by duplicate and by inline). Rev 13: the component features were moved from tier 2 to tier 1 at the user's direction.
- Tier 2: edge resize (`w-*`/`h-*`); reorder within the same flex/grid parent; marquee select; delete; duplicate; radius and shadow in the panel.
- Tier 3 (refused in v1): reparenting; element insertion; rotation; multi-select group operations; image replacement.
- Recorded rationale: copy, color, and spacing are the "small detailed changes" of §2; moving elements is lower priority. Insertion remains the boundary between "adjust an existing page" and "page builder" and is not planned.

**OQ-E3. What is the edit unit when one source location renders many DOM nodes?**
- Context: (a) mapped lists: one callsite, N sibling instances; a per-instance style edit has no deterministic code expression. (b) Shared components: an edit may target the usage site or the definition.
- Position for (a): edit-all is the only deterministic option. On selection, the overlay MUST co-highlight all DOM nodes sharing the element ID before any edit is applied (v0's model, PAS §1).
- Resolved for (b) (rev 13, R-12, DR-0009): shared components follow the Figma component model.

  | Figma | Retouch |
  |---|---|
  | Main component | The definition file. Edits change every instance. Explicit action "Edit main component"; the overlay shows the count of files that use the component. |
  | Instance | A usage site. Distinct outline; all instances on the page co-highlight. Default click scope. |
  | Override | A prop at the usage site: `children` text, `className` when the definition applies it to its root (static check), any declared prop. |
  | Component property | A prop declared in the definition with a default. |
  | Expose property | Lift (R-12 b): e.g. `className="bg-blue-500 px-4"` becomes `({ bg = "bg-blue-500", … })` and `className={cn("px-4", bg)}`; the usage site gets `bg="bg-red-500"`. The prop name is suggested from the property and confirmed by the user. |
  | Detach instance | Duplicate module (always available: copy the definition file under a new component name, rewire this usage site's import) or inline (pure JSX-return definitions only). Two-file transaction (R-11 d exception). |
  | Reset overrides | Remove the usage site's props. |

  Edit targets by op type: text through `{children}` → usage site; classes → usage site by lift (or by `className` when forwarded), or the definition through "Edit main"; props → usage site. Any instance-level op without an instance ID in the DOM is refused with the reason. Components from `node_modules` have no editable definition; their usage sites remain editable through props.

**OQ-E4. How is application state reached and held while editing?**
- Status: **provisional, pending hands-on validation (rev 14, DR-0010).** The user declined to decide on paper: the right behavior must be felt in use. The rules below are the P1 defaults; P1 includes a hands-on pass whose findings amend this question. Until then no row here is normative.
- Position (settled): two modes. Interact mode: pointer events reach the application unmodified. Edit mode: the overlay consumes all pointer input; the application receives none. Mode switching MUST NOT remount the iframe. The shell has a route field: entering a path navigates the frame and keeps the current mode.
- Provisional rules: (1) **Transient state.** In edit mode the agent suppresses the events that dismiss transient UI: `pointerleave`, `pointerout`, `blur`, `focusout`, and document-level `click`/`pointerdown` (click-outside handlers). An open dropdown, modal, or tooltip therefore holds while it is edited. Alternatives: pin nothing (states that dismiss on blur are unreachable); or a full event freeze (breaks the app's own timers and animations). (2) **Hover styles.** Deferred from v1. Hover is not application state, so rule 1 cannot hold it, and page scripts cannot force `:hover` (only the DevTools protocol can). The later candidate is Tailwind-specific: compile `hover:` variants to a toggleable class for preview only. (3) **HMR during a drag (OQ-B2 sub-question).** Re-anchor the gesture to the element by structural ID and continue; abort only if the ID is gone. Under continuous commits (OQ-F1) a mid-drag HMR is normally the library's own previous write, and structural IDs are stable across it (R-10).
- What to observe in P1: whether suppressed dismissal makes edit mode feel stuck (a dropdown that will not close until the mode toggles); whether apps with unusual dismissal logic still close; whether re-anchoring produces visible jumps; how often hover-only styling is what the user wanted to edit.

### 6.6 Product and workflow

**OQ-F1. When do edits reach disk?**
- Status: resolved (rev 8): option 1, continuous. Coalesced ops commit on a debounce (initial value 150 ms after the last gesture, OQ-C3). A session-diff view shows the aggregate change since the session started. Options 2–3 are withdrawn: the mirror MUST NOT diverge from disk.
- Preview before commit (resolved rev 8): two mechanisms, both without any write. (1) Inline-style preview: during a gesture the agent applies the value as an inline style on the mirror DOM node; after HMR confirms the committed class, the agent removes it; on write failure the shell reverts the optimistic patch. (2) Safelist: because gestures produce only scale values (OQ-D3), the set of producible classes is finite; the plugin registers that set with Tailwind in development (`@source inline(...)` in v4, `safelist` in v3), so every producible class has CSS before it appears in any source file. Consequence: the virtual-module and client-side-compiler ideas of revs 3–6 are not needed.
- Reconciliation (resolved rev 8): after the HMR update, the agent checks that the target element's class list contains the written token (or that its text equals the written text). If so, it removes the inline preview. If not, it reports a mapping defect and reverts. No visual comparison is required.
- Options (retained for history): (1) continuous: coalesced ops commit on a debounce (per OQ-C3); undo inverts and re-commits. (2) Session buffer: ops accumulate; an explicit Save writes once; the mirror diverges from disk until saved. (3) Option 2 plus version-control integration: a save is a commit, or the session runs on a branch.
- Criteria: option 1 keeps mirror and disk convergent (small conflict window, simple OQ-C3) but emits many small writes and file-watcher events. Option 2 yields one reviewable diff but its conflict window grows with session length, and the divergent mirror cannot benefit from HMR confirmation until save. The virtual-module idea of revs 3–6 (serving unsaved ops as module overrides) is withdrawn with option 2; the safelist above covers preview rendering.
- Note: interacts with OQ-F2: a non-developer remote editor may require branch isolation, which would be a writer backend, not a change to this decision.

**OQ-F2. Is the v1 operator a developer on localhost, or does v1 include remote non-developer editing?**
- Context: the motivating user (§2) is often not the person running the dev server. Remote editing requires transport (tunnel or shared environment), authentication on the mirror route, and plausibly PR-mediated writes. Each is a significant security and product surface (R-7).
- Provisional: v1 is a developer on localhost. The op log and writer interfaces are designed so that a review-mediated remote mode is an additional writer backend, not a redesign.

**OQ-F3. Concurrent editors?**
- Position: out of scope for v1: single writer, file-watcher conflict detection (§5.3). Survey verdict: production multiplayer on source is text-level CRDT (Yjs; Zed's buffer design); AST-level CRDT has no production precedent (PAS §3). The op log is the natural unit of a future CRDT mapping; no v1 decision forecloses it.

### 6.7 Packaging and identity

**OQ-G1. Package decomposition and overlay implementation technology.**
- Proposed decomposition: `core` (op vocabulary, manifest format, writer), `vite-plugin` (stamper, manifest builder, middleware, editor mount), `agent` (in-frame runtime), `overlay` (editor UI), `snap` (guides/snapping engine, standalone: no maintained equivalent has existed since moveable's dormancy, PAS §4).
- Open: overlay technology (React versus framework-free web components); monorepo timing.

**OQ-G2. License.**
- Options: MIT or Apache-2.0 (adds an explicit patent grant; Onlook's choice). Constraint either way: no AGPL dependencies (stagewise, Scramjet, wombat, Webstudio are reference-only; PAS §4).

**OQ-G3. Name.**
- Status: resolved (rev 11): **Retouch**. CLI `npx retouch`; route prefix `/rt/`, configurable. Chosen for the metaphor (small, careful edits to a finished picture) and because the two-letter abbreviation is neither an ISO 639-1 language code (locale prefixes such as `/en/` are a common route class) nor a common route. Candidates and checks are in DR-0008. "Mirror" remains the name of the concept in this RFC.

## 7. Prototype plan

| ID | Scope | Exit criteria | Resolves |
|---|---|---|---|
| P0 | Single-process topology (§5.1) in launch mode on Vite: `npx retouch` boots the project's dev server with the plugin; stamper emits structural IDs; writer builds the index from disk; shell at `/rt`; same-origin iframe; click → co-highlight → display file and AST path. Writer accepts and validates ops but performs no write. | Mapping correct on a reference project of ≥200 components including mapped lists and shared components; stamper and writer IDs agree on every element. Budget B measured: scripted single-class write → HMR repaint → re-index, p50/p95 reported. Geometry sync sustains 60 Hz during a scripted drag. ID stability: a class edit leaves all IDs in the file unchanged; inserting a sibling changes exactly the later siblings' IDs. Security check (R-9): a page on another origin cannot POST an op (preflight rejected); a request with a non-loopback `Host` is rejected; an op without the token is rejected; the app retains its cookies and localStorage inside the iframe. | OQ-B1 launch viability; R-10 in practice; OQ-B4 geometry-sync cost; R-9 enforceability. |
| P1 | One gesture end to end: select, padding drag, Tailwind class write via recast, formatter pass, undo. Op coalescing and debounced commit. | Budget A ≤ 16.7 ms per frame during drag, with the inline-style preview and the safelist in place. One-line diff per coalesced edit. Undo restores byte-identical source. Zero diff on untouched constructs across the Utopia round-trip corpus. Write integrity (R-11): killing the process during a write leaves the file byte-identical to either the old or the new content; an op whose result fails to parse writes nothing; an op with a stale content hash is rejected. | OQ-D1, OQ-C3, OQ-F1 mechanics; OQ-D3 compiler sub-question. Hands-on validation of the OQ-E4 provisional rules (transient state, HMR re-anchoring), recorded as an amendment to OQ-E4 and DR-0010. |
| P2 | Design annex for OQ-E1: the complete normative gesture-to-mutation table, including every refusal case and its user-facing reason. | Table reviewed and ratified; each row has a test fixture. | OQ-E1, OQ-E2. |

Packaging (OQ-G1) is decided after P1; earlier decomposition would freeze interfaces that P0/P1 exist to inform.

## 8. Security considerations

### 8.1 Threat model (MVP)

In scope: remote attackers reaching the dev server's endpoints from other origins (CSRF from a visited web page, DNS rebinding), and non-targeted misuse. Out of scope for the MVP: malicious code already executing in the host application's page or dev-server process. Rationale: a malicious npm package already has full machine access at install time (lifecycle scripts) and in the dev-server process (config, plugins, SSR), so the mirror's endpoint adds no capability such code lacks; the narrower attackers that the endpoint would newly enable (remote scripts loaded into the dev page, dev-time XSS) are addressed by the hardened mode (§8.3). The developer's own machine and browser are trusted.

### 8.2 Controls (MVP, R-9)

1. **Op grammar validation.** Before applying an op, the writer checks: class tokens match the Tailwind class grammar resolved from the project's configuration; text values are written as JSX text with `{`, `}`, `<`, `>` escaped as entities; prop values are literals only and the prop name is not in the excluded set (`href`, `src`, `srcset`, `action`, `formaction`, `on*`, `dangerouslySetInnerHTML`); the element ID resolves in the writer's own index (R-10) to a file that parses as JSX/TSX; every resolved path is within the project root after symlink resolution (R-7). Consequence: no request, however crafted, can cause code execution or write outside JSX attribute and text positions.
2. **Host validation.** The plugin's middleware rejects requests whose `Host` header is not a loopback name, defeating DNS rebinding.
3. **Custom header and session token.** Ops require a custom request header (which forces a CORS preflight, so no other origin can send one) and the session token: ≥128 bits from a CSPRNG, generated at server start, delivered to the shell page and held in a closure, never in storage or URLs. Simple-request POSTs (form-encoded or `text/plain`) are rejected regardless of body.
4. **Agent never originates ops.** Only user gestures in the shell create ops. This costs nothing and keeps the hardened mode's contract intact.
5. **Baseline (R-7).** Production refusal, loopback bind, project-root confinement, no third-party origins. A token becomes mandatory on the shell route itself, in addition to the writer, under any OQ-F2 remote mode.

### 8.3 Hardened mode (deferred, R-8)

A separate mirror process on its own port serves the shell and hosts the token and writer; the application runs on its usual port in its own process; the iframe becomes cross-origin, same-site (cookies and the application's storage unaffected); all DOM access goes through the agent's RPC; the writer accepts requests from the shell origin only. This closes the in-page adversary: application code cannot read the token or reach the writer, and can only spoof agent replies during a live user gesture, an effect bounded by control 1. The MVP keeps the agent interface RPC-shaped and the writer endpoint origin-checked so that this mode is an addition, not a rewrite. Trigger for building it: any OQ-F2 remote mode, or a demonstrated in-page abuse.

### 8.4 Residual risk (MVP)

Malicious code already running on the dev origin (a compromised dependency or a dev-time XSS) can obtain the token by patching the shell page and can submit ops. Under control 1 the effect is limited to cosmetic JSX edits (class strings, escaped text, literal non-URL props) that appear in the developer's diff. No code execution and no writes outside JSX positions are possible. Accepted for the MVP.

## 9. Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-09-01 | Initial draft: settled constraints and open-question list, derived from the Prior-Art Survey. |
| 2 | 2026-09-01 | Reformatted as a normative RFC: added the AI editing note, terminology, requirement IDs (R-1…R-7), the §4.1 analysis of alternatives to build-time instrumentation, system overview with Figures 1–3, per-question decision criteria, measurable prototype exit criteria, and security considerations. No positions changed. |
| 3 | 2026-09-01 | Added OQ-B1 option 4 (parallel dev-server instance on its own port, same-origin, zero project-config changes, virtual-module capability); revised OQ-B1 criteria and provisional to a per-framework split; cross-referenced the virtual-module capability in OQ-F1. No other positions changed. |
| 4 | 2026-09-01 | Corrected OQ-B1: cookies are not port-isolated (RFC 6265 §8.5), narrowing option 4's origin cost to localStorage/IndexedDB, Origin-header checks, and pinned redirect URIs. Added OQ-B1 option 5 (same-port launcher: boots the project's dev server with the plugin on its usual port; zero repository changes, exact origin continuity) with a launch-mode comparison table; provisional updated to option 5 default, option 4 coexistence, option 1 committed/fallback. Noted in §4.1 that plugin registration can be performed by a launcher at boot time. |
| 5 | 2026-09-01 | Adopted the trust-split topology: added R-8 (the token, shell, and writer never share an origin, process, or port with application code; the agent holds no credential and never originates ops; the writer validates op grammar). Redrew Figure 1 for two processes and two origins (cross-origin, same-site iframe). Added terminology: mirror process, session token, launch mode, attach mode. Withdrew OQ-B1 options 1, 2, 4, 5 and reframed OQ-B1 as launch versus attach; resolved OQ-B4. Rewrote §8 with a threat model, controls, and residual risk. Extended P0 with security and cross-frame-latency exit criteria. |
| 6 | 2026-09-01 | Reverted the MVP to one process and one origin (shell at `/rt` on the dev server; launch mode `npx retouch` or config mode); deferred the rev 5 trust split to a hardened mode (R-8 marked deferred; attach mode and mirror process deferred with it). Added R-9 (cheap writer controls: op grammar with a prop exclusion list, Host check, custom header + token, JSX-only targets, agent never originates ops) and R-10 (structural IDs: `hash(file path, AST path)`; writer builds its index from disk; no transported manifest). Resolved OQ-C1 by R-10; amended OQ-B1, OQ-B4, OQ-C3, OQ-D1, OQ-F1 (Tailwind-JIT sub-question) accordingly. Redrew Figure 1; updated Figure 2 steps 4–9 and §5.3. Rewrote §8 with the MVP threat model, controls, deferred hardened mode, and residual risk. Updated P0 exit criteria. |
| 7 | 2026-09-01 | Resolved OQ-E1 (flow-respecting; no detach in v1; reparenting refused), OQ-E2 (tiered gesture set: tier 1 = text, color/typography, padding/margin/gap; tier 2 = resize, reorder, marquee, delete, duplicate; tier 3 refused), and OQ-D3 (always snap to the project's Tailwind scale; gestures never produce arbitrary values). |
| 8 | 2026-09-01 | Added R-11 (write integrity: preview never writes; parse and format before write; atomic rename; one op one file; content-hash precondition; no version-control operations; invertible ops). Resolved OQ-F1: continuous debounced commits with a session-diff view; preview by inline style plus a Tailwind safelist of producible classes; reconciliation by class-list check after HMR. Withdrew the virtual-module idea. Extended P1 exit criteria with write-integrity tests. |
| 9 | 2026-09-01 | Added OQ-B5 (iframe under a reserved route versus in-page injection versus different origin), resolved as the iframe route with the comparison recorded; in-page noted as a possible later toolbar mode. Added OQ-B6 (URL mapping: path forwarding, following navigation, reload, frame busting) as open with proposed rules. |
| 10 | 2026-09-01 | Moved the documents into the `editable-mirror` repository (`docs/`) and introduced decision records DR-0001 … DR-0007 under `docs/decisions/`, each recording the alternatives and arguments behind revs 2–9; added editing rule 8 requiring a decision record per trade-off. Expanded OQ-B6 with the full alternative set (seven URL schemes, three navigation-following mechanisms, three selection-persistence options) and a provisional recommendation. No positions changed. |
| 11 | 2026-09-01 | Resolved OQ-G3: the product is named Retouch; CLI `npx retouch`; the route prefix is `/rt/`, configurable, replacing `/__mirror` throughout. Added the "route prefix" term. Resolved OQ-B1 residual (c) with the configurable prefix and a HEAD-probe collision warning. DR-0008. |
| 12 | 2026-09-01 | Resolved OQ-B6: prefix-path scheme (`/rt/<app path>` with query and hash passed through), navigation followed by observing the iframe location with `pushState`/`replaceState` wrapped by the agent, no selection persistence in v1, frame busting detected but not blocked. DR-0007 accepted. |
| 13 | 2026-09-01 | Adopted the Figma component model for shared components: added R-12 (instance scope by default; explicit edit-main and detach; lift to prop with the generated `cn()` shape; detach as a two-file transaction; refusal without an instance ID) and the terms component definition, component instance, instance ID, lift, detach. Resolved OQ-C2 (usage sites stamped by the `data-rt-i` prop) and OQ-E3 (b). Amended R-11 (d) with the detach exception. Moved all component features into tier 1 (OQ-E2). DR-0009. |
| 14 | 2026-09-01 | OQ-E4 given provisional rules pending hands-on validation: suppress dismissal events in edit mode; hover styles deferred; HMR during a drag re-anchors by structural ID (absorbing the OQ-B2 sub-question). Added a route field to the settled position. P1 gains the hands-on validation pass. DR-0010 records that this decision point is to be felt out, not decided on paper. |

## 10. References

1. *The Editable Mirror — Prior-Art Survey*, 2026-09-01 (`docs/prior-art-survey.html`). PAS citations: §1 landscape, §2 mapping, §3 write-back, §4 mirror and editing.
2. Decision records DR-0001 … DR-0007, `docs/decisions/`. Each records the alternatives and arguments behind a revision.
2. React PR #28265 (removal of `_debugSource`); issues #31981, #32574.
3. Onlook, `packages/parser` (Apache-2.0): stamping, per-op writers, instance resolution.
4. Lovable, "Visual Edits" engineering post: compile-time IDs, client-side AST, deterministic fast path.
5. WordPress Gutenberg block serialization and validation documentation.
6. RFC 2119, RFC 8174 (key words).
