# DR-0022: Select standalone text before its shared renderer

- Status: Accepted
- Date: 2026-09-07
- Amends: DR-0021

A standalone text element must not receive component chrome merely because its
renderer is shared. Resolve editable host text before the component call site
for text elements containing only text and inline formatting. Apply the same
classification to hover and selection. Default to the text source and omit the
component badge and automatic component inspector section. The shared renderer
remains accessible by explicitly choosing component scope. Containers with block
children keep component classification. Single-use renderers retain inline-only
scope as decided in DR-0021.

Browser regression: the Moses homepage heading has no component badge when
selected or hovered; explicitly selecting its renderer still exposes component
controls with the correct detach target.
