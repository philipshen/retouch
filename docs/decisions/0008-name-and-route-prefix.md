# DR-0008: Name and route prefix

- Status: Accepted (RFC rev 11)
- Date: 2026-09-01
- RFC: OQ-G3, OQ-B1 residual (c), OQ-B6, "route prefix" term

## Context

The reserved route was `/__mirror`. The user found it long and unwieldy: the pitch is that changing the URL is easy, so the prefix should be two characters. That made the product name and the prefix one decision: a name whose two-letter abbreviation works as a path.

## Constraints on a two-letter prefix

1. It must not be an ISO 639-1 language code. Localized apps commonly mount locales at `/en/`, `/de/`, `/fr/`; a prefix that is a language code collides with an entire route class.
2. It must not be a common route or slug convention.
3. A two-letter prefix has a higher collision probability than a long one, so the prefix must be configurable and collisions should be detected where possible.

## Candidates considered

| Name | Prefix | Metaphor | Check | Verdict |
|---|---|---|---|---|
| Retouch | `/rt/` | Small, careful edits to a finished picture; the mission in one word | Not a language code; no common route | **Accepted** |
| Loupe | `/lp/` | The magnifier a designer holds over detail work | Not a language code, but marketing sites use `/lp/` for landing pages, a real risk for this audience | Second |
| Facet | `/fc/` | Adjust one small face of the whole | Clean | Weaker metaphor |
| Mirror | `/mr/` | The concept's own name | `mr` = Marathi | Rejected |
| Reflect | `/rf/` | Keeps the mirror idea | `Reflect` is a JavaScript built-in; confusing for a JS library | Rejected |
| Tweak | `/tw/` | Obvious | `tw` = Twi | Rejected |
| Lens | `/ln/` | Inspect through it | `ln` = Lingala | Rejected |
| Pixel | `/px/` | Pixel-level edits | Clean, but a unit, not a product | Not chosen |
| Sketch, Trace, Glass, Stencil, Nudge | `/sk/`, `/tr/`, `/gl/`, `/st/`, `/nd/` | — | All ISO 639-1 codes (Slovak, Turkish, Galician, Southern Sotho, North Ndebele) | Rejected |

Also considered: symbol-led prefixes such as `/~m/` or `/_m/`, which never collide with app routes. Not chosen because the request was for a name that abbreviates, and `~` and `_` both need a modifier key to type.

## Decision

The product is **Retouch**. Launch command `npx retouch`. Route prefix `/rt/`, so `localhost:3000/rt/about` is the editable `/about`. The RFC keeps "mirror" as the name of the concept.

Collision policy (resolves OQ-B1 residual (c)): the prefix is configurable per project with default `rt`; at mount, launch mode sends a HEAD request for the prefix to the application and warns if the application answers it. This catches the obvious case; it cannot enumerate an SPA's client-side routes.

## Consequences

- `/__mirror` is replaced by `/rt` throughout the RFC, README, and decision records written after this one; earlier records keep the historical name.
- The repository directory is renamed from `editable-mirror` to `retouch`.
