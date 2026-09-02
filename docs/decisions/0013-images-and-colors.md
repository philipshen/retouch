# DR-0013: Image swap and Figma-style color pickers

- Status: Accepted (RFC rev 17)
- Date: 2026-09-02
- RFC: R-9 amendment, OQ-E2 tiers, OQ-D3 consistency

## Context

The user asked for three user-friendly, Figma-like capabilities: swapping images, background colors, and text colors. Colors fit the existing `setClasses` op; image swap conflicted with R-9, which excluded `src` from settable props for injection safety (a `javascript:` or external URL written into source would be an XSS or exfiltration vector authored by the tool).

## Decisions

1. **Colors are class edits.** Fill = `bg-*`, text color = `text-*`. The picker shows the Tailwind default palette as swatch grids (22 hues × 11 shades plus white/black/transparent) and writes the class token through the existing `setClasses` op; tailwind-merge resolves the conflict with the previous color token. This satisfies OQ-D3 (scale values). A hex input writes an arbitrary value (`bg-[#…]`) — allowed because it is an explicit typed entry, not a gesture-produced continuous value. Swatch previews use an embedded hex table of the default palette; the written token is what matters, so a project theme override changes the rendered result, not the correctness. Known gap: custom theme colors do not appear as swatches yet.
2. **Image swap amends R-9 instead of violating it.** `src` remains excluded from generic prop edits. A dedicated `setSrc` op is allowed with a strict value grammar — root-relative project path only: `^\/[A-Za-z0-9_\-./]+$`, no `//` prefix, no `..` segment, ≤500 chars — and a target restriction: image-shaped elements (`img`, `source`, `video`, `*Image`) whose `src` is a literal string. This preserves the exclusion's intent: no scheme, no external host, no traversal. Verified against `https://…`, `javascript:…`, `..` traversal, and `//host` forms — all refused.
3. **Uploads.** The sidecar accepts image bodies up to 10 MB at `/rt/__api/upload` (token required), sanitizes the filename, and stores under `public/rt-assets/<stamp>-<name>` — inside the project root, served statically by Next. Refused when the app has no `public/` directory. An upload is an asset addition, not a source edit; the subsequent `setSrc` is the one-file op.
4. **Dynamic `src` refuses.** Imported static images (`src={hero}`) and expressions refuse with the R-6 reason. Swapping those would require touching imports; a later op could add an import and rewrite the identifier, recorded here as future work.

## Known implementation deviation (R-11 g)

Discovered while testing: `setText` writes the new text as a single escaped line, so undoing a text edit on a multi-line JSX text block restores the rendered text exactly but collapses the source onto one line. JSX collapses that whitespace when rendering, so the page is identical, but undo is not byte-identical as R-11 (g) requires. Fix planned: `resolve` should carry the raw source slice of the text range, and undo should restore that slice verbatim instead of re-serializing.

## Consequences

- OQ-E2: image swap moves from tier 3 (refused) to tier 1; Fill and text-color pickers join tier 1.
- The clone's dogfood flow now covers classes, spacing, text, colors, and images.
- Future work recorded: project-theme swatches (resolve the app's palette), imported-image swap, raw-slice undo.
