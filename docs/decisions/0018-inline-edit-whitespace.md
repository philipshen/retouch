# DR-0018: Preserve layout during inline text editing

- Status: Accepted (rev 22)
- Date: 2026-09-05
- RFC references: R-5

## Context

In the local Chromium Moses preview, focusing a heading with plaintext-only
editing changed computed white-space from normal to pre-wrap and its height
from 38.39 px to 191.95 px. Liquid indentation became visible. An inline
white-space: normal !important declaration did not prevent this behavior.

## Alternatives

1. Override white-space while retaining plaintext-only. Failed the browser check.
2. Trim DOM text on focus. Changes text merely by selecting it and loses intentional whitespace.
3. Use contenteditable=true and control paste and formatting. Preserves the existing layout without changing text on focus.

## Decision

Use option 3. Insert clipboard text with DOM Range operations; ignore clipboard
HTML, suppress native formatting input and rich drops, and retain the existing
explicit formatting commands. Do not use execCommand. Commit remains on blur,
Escape, or Enter. Verify normal, pre-line, and pre-wrap layouts, plain-text
paste, and zero source writes on unchanged focus/blur.
