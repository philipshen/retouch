# DR-0021: Right inspector

- Status: Accepted (rev 25)
- Date: 2026-09-07
- Supersedes: DR-0020 panel placement only

## Decision

Place the inspector to the right of the live page, following the user's corrected
placement preference. Keep the 320 px panel width and put its divider on the left.

## Alternatives

1. Keep the panel on the left as specified in DR-0020. Rejected by the user's
   follow-up request.
2. Move the panel to the right. Selected.

## Verification

The existing inspector browser check asserts that the canvas ends at or before
the panel's left edge.
