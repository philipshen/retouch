# SVG gradients

For HTML, React and Liquid sites, select an SVG layer whose `fill` or `stroke` attribute references a local linear or radial gradient. The inspector exposes its gradient coordinates and color stops beside Fill or Stroke. A blank field removes the corresponding attribute, restoring SVG inheritance/defaults. Stop positions and opacity accept fractions or percentages.

Edits update the existing definition. Every referencing layer and every screen size uses that shared definition; the inspector displays this scope explicitly. React writes use JSX attribute names such as `stopColor`; Liquid edits preserve existing attribute quote styles. Dynamic expressions and spread attributes are preserved by refusing edits to definitions they control. Each committed field edit is one source transaction with exact undo/redo. Layer IDs and unrelated source remain unchanged.

The current controls cover coordinates, coordinate units, spread mode, stop position, color and opacity. They do not yet create gradients, insert/delete/reorder stops, detach shared definitions, follow inherited `href` chains, or provide canvas gradient handles. CSS overrides can still control the rendered paint; the controls describe source attributes, not resolved CSS ownership. Dynamic, styled, animated and ambiguous definitions are refused.

Validation:

```sh
node --test retouch/test/html-svg-gradient.test.cjs retouch/test/source-svg-gradient.test.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture node retouch/test/e2e/html-svg-gradient.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture RT_E2E_RENDERER=react RT_E2E_SVG_GRADIENT=1 node retouch/test/e2e/page-fonts.cjs
RT_INSPECTOR_FIXTURE=/path/to/playwright-fixture RT_E2E_RENDERER=liquid RT_E2E_SVG_GRADIENT=1 node retouch/test/e2e/page-fonts.cjs
```

The browser workflow exercises shared linear paint, radial focus, stop colors/opacity/position, coordinates, invalid input, and exact source undo/redo. Set `RT_E2E_BROWSER=webkit` to run the same flow with WebKit and its installed browser path.
