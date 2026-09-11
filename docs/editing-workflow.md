# Editing workflow

Retouch applies completed edits directly to source. There is no staging area, confirmation dialog, or source-diff approval step.

## Undo and redo

Undo follows user actions, not every intermediate value. Pointer gestures, held keys and focused controls provide deterministic grouping boundaries. A resize or repeated nudge is one action; subsequent gestures remain separate. Undo restores exact transaction bytes, including multi-file changes. Redo reapplies the saved result. New edits after undo discard the redo branch. Source conflicts are refused rather than overwriting another change.

While typing inside a text field or inline editor, ordinary typing shortcuts retain their native behavior. Editor history shortcuts apply outside those text controls.

## Keyboard and context menu

`Mod` means Command on macOS or Control elsewhere.

| Action | Shortcut |
| --- | --- |
| Undo | Mod+Z |
| Redo | Mod+Shift+Z or Mod+Y |
| Duplicate selection | Mod+D |
| Copy / paste a supported source sibling | Mod+C / Mod+V |
| Delete selection | Delete or Backspace |
| Move backward / forward among source siblings | Mod+[ / Mod+] |
| Select child / parent | Enter / Shift+Enter |
| Select next / previous sibling on the canvas | Tab / Shift+Tab |
| Clear selection | Escape |
| Open selection context menu | Right-click, context-menu key, or Shift+F10 |
| Nudge a supported positioned element | Arrow keys; Shift increases the step |

The right-click menu selects the clicked element and exposes applicable selection, text, structure and component commands. Unsupported operations are disabled. Menu navigation supports arrow keys, Home/End and Escape. Browser-native text menus and input shortcuts remain available while editing text.

Structural edits are limited to source relationships the adapters can establish safely. Copy/paste operates on supported siblings in the current source container; it is not a general clipboard importer. Nudging requires a supported positioned element with editable literal classes.

## Preview synchronization

Supported editor writes do not reload the page. React keeps ownership of its DOM and updates through HMR. Inline edits restore the original node objects before the source write, preventing contenteditable replacements from corrupting React's reconciliation.

Liquid previews fetch authoritative renderer output and reconcile affected elements without replacing the frame document. The mirror removes Shopify's reload client only from its own preview; normal storefront views keep their usual behavior. Stylesheets swap after the fresh stylesheet loads. Compiler-generated CSS changes refresh styles without pausing source editing.

A failed renderer update shows an explicit out-of-date status and pauses further editing. Retrying a supported edit checks the renderer again. External Liquid, JSON or script changes pause the preview because arbitrary application runtime changes cannot safely be reconstructed by copying HTML. Open a fresh preview to recover from those external changes. Active speculative edits are canceled when the preview becomes stale.

This does not promise to suppress framework-originated refreshes caused by dev-server/HMR failures, application navigation, or intentionally opening a fresh preview. Arbitrary theme widget initialization and live Shopify upload timing require separate compatibility checks.

## Verification

Focused tests cover gesture grouping, exact history transactions, keyboard/context-menu behavior, safe structural operations, original DOM node identity, source revision monitoring, script-change refusal and scoped server reconciliation. The local Liquid browser fixture in `retouch/test/e2e/source-sync.cjs` exercises real source writes, undo/redo, preserved document identity, stylesheet updates and external-change editing guards without using a Shopify account or remote theme.
