# DR-0016: Machine-wide installation and arbitrary startup commands

- Status: Accepted; Next.js 16.2.5 implementation verified
- Date: 2026-09-04
- RFC: rev 20; §5.1, OQ-B1, OQ-G1
- Supersedes: DR-0002's launcher-owned startup and single-process requirement
  for command-wrapper sessions; the same-origin browser decision remains.

## Context and discussion

The user requested installing Retouch once through a machine package manager,
then clarified that projects can start through Make, shell scripts, monorepo
orchestrators, containers, and other methods. A CLI that reconstructs only
`next dev` cannot preserve those workflows. The user approved wrapping the
existing command and separating startup orchestration from build integration.

## Alternatives

1. Project dependency plus config wrapper: reproducible team version, but
   repeats installation and repository changes for every project. Retained.
2. CLI owns framework startup: avoids config changes but must reproduce scripts
   and service orchestration. Rejected as the primary interface.
3. Temporarily patch config files: exposes watchers and crashes to transient
   repository mutations. Rejected.
4. Proxy any running website: does not establish deterministic source IDs.
   Rejected as an editing implementation.
5. Wrap the existing command with session-scoped instrumentation: preserves
   orchestration and moves compatibility work into build integrations. Accepted.
6. Universal environment penetration: cannot transparently cross containers,
   remote machines, environment filters, or unsupported compilers. Rejected as
   a support claim; explicit integration remains necessary.

## Decision

`retouch -- <command> [args...]` executes the existing command with inherited
session settings and a Node preload. A loopback session manager creates one
writer per canonical app root. Next's own config evaluator loads application
configuration; a version-gated module hook composes the result for development.
The project supplies Next; the machine installation supplies Retouch's loader.
`withRetouchSession` is the explicit registration alternative. Existing config
mode and Shopify's isolated-theme command remain available.

Homebrew uses the same versioned package under a private prefix. Release
assembly includes npm shrinkwrap; a formula generator takes a real release URL
and checksum. Tap publication is separate from implementing the CLI.

## Consequences and evidence

Framework integration is still required. Automatic support is initially gated
to Next 16.2.x and verified on 16.2.5. This hook uses a private API and must be
revalidated before extending the supported release line. Unsupported versions
and incompatible config shapes fail explicitly; individual stamping failures
continue to warn and serve unstamped source.

The actual Turbopack and webpack browser tests passed from a disposable project
without a Retouch dependency or config hook: stamping, editor write-back, HMR,
existing headers, unchanged manifests/config, and process shutdown. A wrapped
production build had no Retouch IDs or rewrites. Session tests cover isolated
roots/ports/tokens and process-tree cleanup. See `docs/cli.md` for reproduction.
