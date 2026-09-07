# DR-0017: Trace Liquid strings to their stored source

- Status: Accepted (rev 21)
- Date: 2026-09-05
- RFC references: R-1, R-6, R-10, R-11; DR-0015

## Context

The user reported excessive dynamic-text refusals and requested tracing through
variables and localization. Moses stores headings in nested JSON template block
settings and passes them through a shared snippet. That snippet uses a Liquid
tag-name expression, which the initial tokenizer did not stamp. Header labels
use locale keys. These values have deterministic local origins.

## Options considered

1. Keep refusing every Liquid expression. Simple, but excludes ordinary stored
   content and does not satisfy the requested editing behavior.
2. Match the displayed string against JSON values. Duplicate strings and
   repeated blocks make this ambiguous; it violates the build-time mapping rule.
3. Instrument executed assignments and re-derive their possible origins from
   local source. This preserves expressions and identifies the backing value.

## Decision

Use option 3. The stamped copy carries branch-selected origin markers and
rendered section, block, template, and locale context. Render arguments carry
origin markers across snippet scopes. The writer re-parses local definitions,
validates reachability, and selects a unique JSON setting, locale value, or
Liquid literal. Runtime metadata is a selector, never a writable file path.

Dynamic tag-name elements are stamped but their tag expression is preserved.
Text-source files and keys are visible in the inspector, including the shared
scope of translations. Richtext and placeholder-bearing strings expose their
stored source in the inspector instead of pretending to be plain inline text.

## Consequences

Indirect writes require both the markup hash and the backing-source identity
and hash. JSON writes replace one string span, preserving comments, formatting,
and other settings. Undo retains instance context and verifies source identity.
Shopify's native hot reload handles propagation after source synchronization.

Computed transformations, missing local values, pluralization objects,
unresolved branches, and ambiguous block paths remain refusals. This does not
infer source locations from DOM text or extend React's expression resolver.

## Discussion log

2026-09-05: User requested tracing variable/localization strings to source and
investigation of Moses-specific false dynamic classifications. Live inspection
identified unstamped dynamic tag names and JSON-backed heading instances.
