# Source-synchronized previews without editor-triggered page reloads

Retouch saves edits immediately. Preview synchronization must preserve the running document and must not hide an unsuccessful renderer update.

## React

Before inline editing, retain the actual child nodes and their attributes/text. Before submitting the source operation, restore those same objects. This gives React Fast Refresh the tree it owns instead of asking it to reconcile against contenteditable-created replacements. Never replace React-owned structure with fetched HTML.

After saving, wait for every matching rendered instance to satisfy the operation's expected result. If HMR fails to converge, report that source was saved but the preview is out of date; stop further editor writes until the preview is synchronized. Framework-originated full reloads (for example an HMR failure or incompatible module boundary) remain outside this guarantee.

## Shopify / Liquid

Mirror HTML requests are explicitly identified by `__rt_mirror=1`, or a same-origin editor/marked-page Referer. The proxy removes the marker before forwarding the URL and removes only Shopify's `hot-reload-client` script from those HTML responses. Normal storefront requests keep their original live reload behavior. The shell preserves the marker on mirror navigation so subsequent requests remain identifiable.

After an editor operation, fetch an authoritative renderer response, wait for the operation's expected result, and reconcile only the affected rendered elements. Preserve keyed DOM identity and listeners where possible. Local stylesheets are replaced only after the new stylesheet loads. Changed scripts cannot be safely reconciled this way and produce an explicit synchronization failure. Widgets that require initialization after structural changes can respond to `retouch:render`; arbitrary runtime reconstruction is not implied.

The source monitor includes Liquid, JSON, CSS and script files. Successful editor transactions acknowledge their exact output before filesystem events arrive. Other document/script source changes increment an authenticated revision endpoint. CSS/SCSS/SASS changes use a separate stylesheet revision so compiler outputs can refresh styles without pausing document editing. Uploaded image assets do not increment the document revision. The shell uses those revisions to flag external changes as an out-of-date preview and pauses further editing. It does not automatically reconcile arbitrary external changes: a stable source revision cannot prove the upstream renderer has caught up, and changed JavaScript cannot safely be reconstructed by copying HTML. Recovery from arbitrary external changes requires deliberately opening a fresh preview. A missing source watcher must be reported explicitly. This is a guarantee about supported editor-originated writes, not a promise to suppress every framework or application navigation.

## Verification

`retouch/test/render-sync.test.cjs` exercises original React node identity, all-instance HMR waiting, no-navigation failures and authoritative Liquid reconciliation. `retouch/test/mirror-sync.test.cjs` exercises request scoping, exact script removal, external-versus-editor revisions, and compressed HTTP proxy responses without changing normal storefront output.

`retouch/test/e2e/source-sync.cjs` runs an isolated local Liquid renderer through the real proxy and Chromium. It checks immediate file writes, actual preview updates, undo/redo, retained frame document and unrelated sibling identity, suppression of the upstream reload script, and visible editing pause after an external source change. This test does not establish live Shopify authentication, remote theme upload timing, or arbitrary theme-widget compatibility.
