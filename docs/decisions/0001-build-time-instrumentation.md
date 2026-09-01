# DR-0001: Build-time instrumentation is unavoidable

- Status: Accepted (RFC rev 2)
- Date: 2026-09-01
- RFC: R-1, §4.1, OQ-A1, OQ-A2

## Context

The library must map a rendered DOM element to the source span that produced it, deterministically. The question raised: is a build-system hook truly required, or can the dependency be "React only"? A React-only requirement would be much easier to adopt.

## Options considered

1. **Fiber inspection (`_debugSource`).** How every click-to-source tool worked before 2024. Removed in React 19 (PR #28265, with `findFiberByHostInstance`). It only ever worked because dev presets already ran the `jsx-source` Babel transform: it was build-time instrumentation that happened to be pre-installed.
2. **`jsx-dev-runtime` interception.** Alias the dev runtime module and capture the source argument `jsxDEV` received. Worked through React 19.1; React 19.2 removed the parameter. A closed window; rejected as a foundation.
3. **Owner stacks (`captureOwnerStack`, `_debugStack`, React 19.1+).** No build hook: synthesize an error stack and symbolicate it against runtime-fetched source maps. Granularity is the component owner chain; frames resolve inside component bodies; multiple JSX elements from one component are indistinguishable. Good enough for "open the file", not for span-level write-back.
4. **Source maps alone.** Map generated-JS positions to source, but nothing maps a DOM node to a generated-JS position without a runtime hook, and after (1) no such hook exists for host elements.
5. **Static DOM–AST matching.** Parse source from disk and match the rendered DOM structurally (tag, literal classes, literal text). Deterministic where unique; ambiguous exactly where precision matters (mapped lists, conditionals, dynamic classes). No shipped precedent. Kept as a possible inspect-only fallback (OQ-A2), never as a write path.

## Decision

R-1 stands: mapping comes from a compile-time transform that stamps elements. The dependency is stated precisely: not "requires Vite", but "requires registering one transform (and one middleware) in a build the project already has". Every JSX project has a compile step by definition. Later (DR-0002) the registration itself became optional via a launcher, so zero repository changes are possible.

## Consequences

- "Any website" honestly means "any site whose build you can instrument". This bounds OQ-A1 to Vite + React + Tailwind for v1, with Vue (sourcemap tracing) and Svelte (`__svelte_meta`) as later additions.
- The mapping layer's interfaces (element ID, AST path, index) are framework-neutral so additions need no interface change.

## Discussion log

- The question was asked mid-turn while rev 2 was being written; §4.1 was added in response.
- The survey's evidence: React issues #31981 and #32574 remain open with no blessed replacement; every tool still working in 2026 (Onlook, Lovable's `lovable-tagger`, code-inspector-plugin, LocatorJS plugin mode) stamps at compile time.
