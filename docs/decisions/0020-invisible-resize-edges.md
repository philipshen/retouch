# DR-0020: Invisible max-width edge targets

- Status: Accepted (rev 24)
- Date: 2026-09-07
- Supersedes: DR-0019's visible right-edge button

The user requested Figma-like edge dragging with a cursor change instead of a
large button. Use transparent 8px hit areas along all four selection edges.
Keep the interior pointer-transparent. Horizontal dragging changes max width;
left-edge movement reverses the horizontal delta. All edges show an ew-resize
cursor. Show the Max width popup only while dragging. Tailwind snapping,
source writes, undo, and cancellation retain DR-0019's behavior.
