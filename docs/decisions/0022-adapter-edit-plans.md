# DR-0022: Adapter edit plans and renderer capabilities

- Status: Accepted (rev 26); Liquid parity implementation in progress
- Date: 2026-09-07
- Supersedes: DR-0015 write ownership; extends DR-0020 component mapping

## Decision

Adapters translate source syntax into common element/component descriptors and
typed edit plans. They do not write files from the server path. Shared
transactions own containment, version checks, atomic replacement, rollback, and
exact undo across all changed files, including backing data and new modules.

The core delegates component resolution, detachment, reference discovery, and
asset location mapping through the adapter contract. The shell transports
renderer context and consumes generic selection scopes without interpreting
source-language metadata.

Build/render integrations declare reload and stylesheet revalidation behavior.
This is separate from the language adapter: refresh requirements belong to the
renderer, while source rewriting belongs to the adapter.

## Alternatives

1. Add Liquid branches to the React component endpoints and inspector.
   Rejected: this contradicts the requested abstraction boundary.
2. Keep writes inside adapters and add special undo paths for backing files.
   Rejected: stale-file, rollback, and undo behavior would diverge by language.
3. Use common edit plans and renderer capabilities. Selected.
4. Flatten computed classes into the currently rendered class string.
   Rejected: this would discard conditional behavior. The Liquid adapter retains
   the expression and applies a token patch to its output on each render.

## Completion

Backing HTML sources supply a generic rich-text descriptor, including opaque
tokens for preserved interpolations. The shell maps this descriptor to the
rendered DOM and produces the same keep/text/wrap tree used for markup edits.
It does not parse the source language. Adapters can also describe a rendered
image URL suffix for refresh matching; the shell does not assume theme asset
paths.

The contract is implemented, but full Liquid parity remains unproven. See the
[completion checklist](../liquid-parity.md) for required work and current evidence.
