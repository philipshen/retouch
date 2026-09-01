# DR-0006: Iframe under a reserved route vs. in-page injection

- Status: Accepted (RFC rev 9)
- Date: 2026-09-01
- RFC: OQ-B5 (and OQ-B4, OQ-B3)

## Context

When OQ-B6 (URL mapping) came up, the user asked how the reserved-route iframe design had been chosen over the alternatives discussed earlier: a different path on the same origin, the same origin completely taken over, or a different origin. The iframe route had been inherited from the survey (every full editor uses one) without an explicit comparison. This record makes it explicit.

## Options considered

| | A. Reserved route, iframe (`/__mirror/…`) | B. In-page: editor injected into the app's own pages, no iframe | C. Different origin |
|---|---|---|---|
| Origin continuity | exact | exact | partial: cookies yes; localStorage, CORS allowlists, OAuth redirects no |
| Repository changes | none (launch) or one line | none or one line | none |
| Panel space | app keeps its own viewport; panels beside it | panels cover the app, or shrink it and perturb the measured layout | own viewport |
| App crash or full reload | shell and op log survive; the frame reloads | editor and op log die with the page | shell survives |
| URL forwarding | required (OQ-B6) | not needed | required |
| Multi-breakpoint canvas (later) | possible | not possible | possible |
| Precedent | Onlook, Plasmic, Builder, Puck, all CMS visual editors | VisBug, stagewise: toolbars, not full editors | Onlook cloud; rev 5 hardened mode |

Notes on B: it is attractive because the page itself becomes editable and the URL question disappears; R-5 can still hold by mounting chrome in a fixed-position shadow-DOM host outside the layout flow (as Sanity and VisBug do). It loses on panel space, isolation from application failures, and the breakpoint canvas. The survey's split confirms the pattern: in-page suits toolbars; every full editor with panels uses an iframe.

## Decision

A. C had already fallen in DR-0002 (origin continuity, process count). B is noted as a candidate for a later lightweight "toolbar mode" for quick text and color edits, sharing the same ops and writer.

## Consequences

- OQ-B6 (URL mapping) is required and is the next decision (DR-0007).
- The rare frame-busting app is handled by detection and a message, not by fighting it.
