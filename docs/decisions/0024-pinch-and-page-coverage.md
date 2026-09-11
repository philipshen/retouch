# DR-0024: Pinch zoom reveals more vertical content

- Status: Accepted (rev 28)
- Date: 2026-09-07
- Supersedes: DR-0023 toolbar controls and fixed-height preview

The user requested trackpad pinch instead of manual zoom controls, and more of
the page visible vertically when zoomed out. Remove the zoom toolbar buttons.
Handle cancellable ctrl-wheel pinch events and Safari gesture events on both
the canvas and the framed site. Ordinary wheel scrolling within the page remains native.

Keep the site's layout width fixed. Set the iframe height to canvas height
divided by zoom so the visible page area grows when zooming out. Maintain gray
side margins and scale-aware selection, text editing, and resize interactions.
Rebase accessible viewport-height CSS lengths to the unzoomed canvas height in
the preview, so full-height heroes do not grow to consume the additional area.
Restore their original declarations at 100%; never alter project source files.
Keep the document point beneath the pinch anchored where scroll limits permit.

Browser checks dispatch both gesture event formats, verify restored CSS values,
additional vertical coverage, stable Moses hero height, ordinary wheel behavior,
text focus, and resize snapping at 50%. Hardware trackpad input is not automated.

## Bounded end padding (2026-09-08)

Allow up to 96 screen pixels of neutral gray above the page start and below its
end, independent of zoom. Begin with the page flush to the canvas. Wheel input
at either document boundary transfers into this finite canvas padding; reversing
direction consumes the padding before returning to the page. Scrolling over the
gray canvas also advances the page. Preserve native scrolling within the page
and within independently scrollable elements. Browser checks cover both limits,
repeated scrolling against each limit, and returning from the padding.
