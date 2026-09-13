# SVG gradients

For HTML, React and Liquid sites, select an SVG layer whose `fill` or `stroke` attribute references a local linear or radial gradient. The inspector exposes its gradient coordinates and color stops beside Fill or Stroke. A blank field removes the corresponding attribute, restoring SVG inheritance/defaults. Stop positions and opacity accept fractions or percentages.

Edits update the existing definition. Use Make unique to copy that definition and redirect only the selected layer’s fill or stroke to it. The copy stays beside the original, receives fresh resource IDs, and preserves internal ID references. It copies source attributes; CSS selectors tied to the original ID may produce a different appearance. Undo removes the copy and restores the original paint reference. Every referencing layer and every screen size uses that shared definition; the inspector displays this scope explicitly. React writes use JSX attribute names such as `stopColor`; Liquid edits preserve existing attribute quote styles. Dynamic expressions and spread attributes are preserved by refusing edits to definitions they control. Each committed field edit is one source transaction with exact undo/redo. Painted layer IDs and unrelated source remain unchanged.

Choose Linear or Radial in the Gradient type selector to change the existing definition. Stops, shared references, units, spread mode and transforms stay intact. Inactive coordinate attributes remain in source so switching back restores the previous geometry; a newly selected type uses SVG defaults for any coordinates not already present. The type change is one undo step.

Reverse gradient flips the stop order and reflects each effective position (25% becomes 75%), keeping each stop’s color and opacity together. Geometry and shared paint references stay unchanged. This creates one undo step.

The current controls cover gradient type, coordinates, coordinate units, spread mode, stop position, color and opacity. Click the gradient strip to insert a stop at that position, or use Add gradient stop to split the largest gap. New stops interpolate neighboring computed sRGB colors and opacity; this can differ from gradients using other interpolation spaces. Click a stop handle to focus its color field, or click the color swatch to open the visual picker. The picker previews the shared gradient and its inspector strip, supports color alpha, and restores the original paint when cancelled. A stop without an explicit color opens with its computed default. Applying a color creates one undo step. Drag a handle to move the stop with live preview. Moving past another stop reorders it in the preview and source; typing a new position follows the same ordering. Keyboard focus follows the moved stop. Dragging away and back to the starting position does not rewrite source or add an undo entry. Arrow keys move it by 1%, Shift by 10%, and Option/Alt by 0.1%. Each drag or held-key gesture creates one undo step; Escape cancels without writing source. An external gradient change or a resized inspector cancels the preview and preserves unrelated DOM edits. Remove stops with the minus button; at least two stops remain. These edits support up to 64 stops.

Select a solid SVG shape and choose Linear or Radial under Fill type or Stroke type to create a gradient from its current computed color to transparent. Creation appends a uniquely named definition inside the nearest SVG viewport, keeps existing layer identities, and supports subsequent stop editing. One undo removes the definition and restores the original paint attribute. Source styles, classes and dynamic paint attributes currently prevent creation; CSS-owned paint creation still needs its own source-writing path.

The controls do not yet follow inherited `href` chains or provide canvas gradient handles. CSS overrides can still control the rendered paint; the controls describe source attributes, not resolved CSS ownership. Dynamic, styled, animated and ambiguous definitions are refused.

Validation:

```sh
node --test retouch/test/html-svg-gradient.test.cjs retouch/test/source-svg-gradient.test.cjs retouch/test/svg-gradient-type.test.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture node retouch/test/e2e/html-svg-gradient.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture RT_E2E_RENDERER=react RT_E2E_SVG_GRADIENT=1 node retouch/test/e2e/page-fonts.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture RT_E2E_RENDERER=liquid RT_E2E_SVG_GRADIENT=1 node retouch/test/e2e/page-fonts.cjs
```

The browser workflow exercises shared linear paint, radial focus, stop colors/opacity/position, coordinates, invalid input, and exact source undo/redo. Set `RT_E2E_BROWSER=webkit` to run the same flow with WebKit and its installed browser path.
