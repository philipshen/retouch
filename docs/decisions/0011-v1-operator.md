# DR-0011: The v1 operator

- Status: Accepted (RFC rev 15)
- Date: 2026-09-01
- RFC: OQ-F2, §8.3

## Context

The motivating user (§2) — someone who cannot comfortably edit the generated source — is often not the person running the dev server. Two shapes were on the table.

## Options considered

1. **Solo developer on localhost.** The person who runs `npx retouch` is the person who edits. Writes go straight to the local working tree under R-9/R-11. No auth beyond R-9. Every decision in revs 2–14 assumes this shape.
2. **Remote non-developer.** A designer or founder edits a mirror served from a developer's machine or a shared environment. Requires: a tunnel or hosted dev server; a token on the shell route (R-7); branch isolation with review-mediated writes (direct writes to someone else's working tree are unwelcome); and the hardened mode (§8.3), since a remote surface is exactly its trigger.

## Decision

Shape 1 for v1, by the user's direction. Shape 2 is the first post-MVP milestone, not discarded: it is closest to the original pitch. The op log and writer interfaces stay shaped so that shape 2 is an additional writer backend (review-mediated), not a redesign.

## Consequences

- v1 ships with no auth surface beyond R-9 and no transport work.
- The hardened mode and the remote milestone arrive together.
