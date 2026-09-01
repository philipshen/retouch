# DR-0012: v1 scope confirmation, Next.js inclusion, and license

- Status: Accepted (RFC rev 16)
- Date: 2026-09-01
- RFC: OQ-A1, OQ-A2, OQ-A3, OQ-D2, OQ-D4, OQ-G2, §7 (P0b, P3)

## Context

Six near-decided questions were put to the user as a confirmation list. Five were confirmed as provisionally stated. The sixth, OQ-A1 (v1 stack), changed: the user wants to test on his own project's two frontends first, so their stack was checked.

## The dogfood targets

Both of the user's production frontends run the same stack: Next.js 16, React 19, Tailwind v4, `next dev` (Turbopack is Next 16's default dev bundler). Neither configures Prettier or Biome. One configures Tailwind v4 in CSS (`@theme`); the other also has a `tailwind.config.ts`. Dogfood order: the internal tool first (lower stakes), then the public site; dev servers only in both cases (OQ-A3, R-7).

## Decisions

1. **OQ-A1, amended.** Vite-only would exclude the dogfood targets. v1 therefore supports Vite (launch and config modes) and Next.js (config mode: the stamper attaches as a loader through `next.config` `turbopack.rules`, webpack-plugin fallback). code-inspector-plugin demonstrates Turbopack loader support (PAS §2); our own loader is unproven until the P0b spike. Launch mode for Next stays deferred. The Tailwind scale resolver must handle both v4 configuration styles.
2. **OQ-A2 confirmed:** no support for uninstrumentable builds; the inspect-only proxy stays a possible later fallback.
3. **OQ-A3 confirmed:** dev server only.
4. **OQ-D2 confirmed:** delegate to the project's formatter when configured; minimal diffs otherwise. The dogfood apps have no formatter, so the minimal-diff path is exercised first.
5. **OQ-D4 confirmed:** non-Tailwind styles are inspectable, not editable; refusals per R-6.
6. **OQ-G2:** MIT. Maximizes adoption for a library; none of the planned reuse needs Apache-2.0's patent grant. No AGPL dependencies, unchanged.

## Consequences

- §7 gains P0b (Turbopack stamping spike) and P3 (dogfood on the two applications, including the OQ-E4 hands-on pass).
- With rev 16 the RFC has no open questions. OQ-E4 remains provisional by design (DR-0010); OQ-G1 (packaging) is deferred until after P1 by design.
