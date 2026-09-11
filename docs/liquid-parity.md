# Liquid parity work

Objective: Liquid support on par with React, with source-language differences
contained behind adapters. The goal remains in progress; the list below is a
completion checklist, not a reduction in scope.

## Implemented and checked

- Both adapters produce source-edit plans. Shared transactions handle source
  containment, stale-file checks, writes, rollback, and exact snapshot undo.
- The server routes component inspection, detachment, reference checks, and
  asset locations through adapter methods or data, without adapter-name branches.
- The shell transports renderer metadata without interpreting Liquid section,
  block, locale, or assignment fields. Adapters supply generic render scopes.
- Liquid class edits preserve expressions and apply token removals/additions to
  their rendered output. Conditional branches and existing breakpoint classes
  are covered by real Liquid rendering tests. Repeated edits update one patch.
- Literal mixed HTML supports the shared rich-text tree, including preserved
  styled descendants and the same formatting vocabulary as React.
- Dynamic heading tags can edit the executed backing assignment. Other branches
  remain intact; the backing-source hash is checked.
- Literal snippet render calls have instance IDs, source props/defaults,
  definition inspection, independent module detachment, and exact two-file undo.
- Settings, translations, and indirect string edits participate in shared undo.
- Renderer integrations declare reload and CSS revalidation requirements.
  The shell uses those capabilities without checking the source language.
- `image_tag` output maps to a synthetic host image with stable source IDs.
  Class edits and image swaps retain the original generator, alt text,
  dimensions, loading behavior, sizes, and generated responsive width choices.
  The adapter describes asset URL matching for the shared reload path.
- Backing HTML uses a language-independent descriptor and the common
  keep/text/wrap tree. Inline formatting preserves nested element attributes;
  opaque translation tokens retain their original interpolation. Source and
  backing-file hashes guard those writes, and snapshot undo restores exact bytes.

## Required before completion

- Map theme blocks and sections, including static/dynamic `content_for` usage,
  to the component contract. Verify instance scope and detachment semantics.
- Extend rich-text verification to renderer transformations and surrounding
  template whitespace. Unsupported DOM/source transformations currently retain
  the source-text editing path rather than applying an ambiguous inline edit.
- Cover source tracing through supported render forms, nested calls, loops,
  captures, branch assignments, defaults, and dynamic tags. Preserve behavior
  for expressions that cannot be inverted, with capability-specific reasons.
- Run the complete inspector and component flows against both adapters:
  position/anchors, measurements, typography, images, colors, shadows, opacity,
  components, save/reload, and exact undo. Check repeated instances and variants.
- Audit remaining language assumptions in the core and shell, parser failure
  behavior, stale writes, project containment, and dependency/reference checks.
- Verify both user sites remain available with the final code and document any
  boundary shared with React. A narrower passing fixture is insufficient proof.

## Evidence so far

`cd retouch && npm test` passes 142 tests, including
`test/liquid-parity.test.cjs`, `test/liquid-images.test.cjs`, and the shared
rich-text source and serialization suites. Live Moses verification exercised a dynamic class
save, observed computed opacity `0.61`, and restored the original snippet byte
for byte through undo. Both Moses and Unplastic load in the browser.

Both React browser suites pass after the renderer capability change, covering
all inspector style sections, images, measurements, component preview, shared
edits, detachment, reload, and exact undo. The resize test waits for the rendered
anchor before measuring its resize baseline. Component preview isolation uses
a constructed stylesheet, avoiding changes to framework-owned DOM attributes
during hydration; the component suite checks both exceptions and console errors.

`test/e2e/liquid-rich-text.cjs` passes in a real browser with Liquid rendering:
translations and section settings both support nested inline bold formatting,
backing JSON writes, and exact undo. The translation placeholder remains
dynamic, and the original markup file is unchanged.

`test/e2e/shopify-parity.cjs` passes against the actual Moses development
renderer: inline rich formatting, project image selection, generated-image
swaps, image uploads, loaded replacement images, retained responsive width
choices and attributes, and exact undo. The test creates an unreferenced probe
section and removes it and its uploaded asset afterward. It does not reset
any user-authored file.

Shopify's [image_tag documentation](https://shopify.dev/docs/api/liquid/filters/image_tag)
describes generated HTML attributes. Existing authored `picture`/`srcset`
choices retain the same explicit editing boundary as the React adapter.
