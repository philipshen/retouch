# Retouch

Install once, run your existing dev command, and edit your app at `/rt`.
Edits are written to local source deterministically.

```sh
retouch -- npm run dev
retouch -- make everything
retouch -- pnpm turbo dev
retouch -- ./scripts/start-local.sh
```

Everything after `--` is an executable and its arguments. Retouch preserves
working directory, environment, stdio, and exit status. To use shell syntax:

```sh
retouch -- sh -c 'prepare-assets && npm run dev'
```

## Install from this checkout

```sh
cd retouch
node scripts/release.cjs /tmp/retouch-release
npm install --global /tmp/retouch-release/retouch-0.1.0.tgz
retouch --version
```

No Retouch dependency or config change is required in the target application.
The target still needs its normal dependencies, runtime, environment, and
services. Node 22 or later is required for Retouch. macOS and Linux command
wrapping are supported; Windows process-tree management is not implemented.

Homebrew distribution is prepared through `scripts/homebrew-formula.cjs`.
An owned, published tap is not yet available. See `docs/cli.md` in the source
repository for release and integration details.

## What connects automatically

Local **Next.js 16.2.x**, verified on **16.2.5** with both Turbopack and webpack,
using the existing React adapter for `.jsx` and `.tsx` source.
The preload wraps Next's evaluated development configuration; the project's
installed Next version and its normal startup command remain in charge.
Existing loaders and configuration are composed, not replaced. Unsupported
rule shapes, base paths, asset prefixes, and explicit `/rt` conflicts fail
with a diagnostic. Other Next versions require config mode until verified.

The startup wrapper can run any executable. Automatic instrumentation is
limited to supported build integrations. Vite, Vue, Svelte, and arbitrary
already-running websites are not automatically instrumented.

```sh
retouch doctor ./apps/website
```

In a monorepo, each Next app under the wrapper's working directory registers
its own writer, token, and dynamically allocated sidecar port. Unrelated
services continue normally. Stop the wrapper to stop its process group and
release its writers. Commands that deliberately daemonize or remove inherited
environment variables are outside that process-tree contract.

`NODE_OPTIONS` and `RETOUCH_SESSION_*` must reach the Node build processes.
Turbo environment filtering may require `globalPassThroughEnv` entries for
`NODE_OPTIONS` and `RETOUCH_SESSION_*` (or an appropriate local loose-env
invocation). Do not put the per-session values into committed configuration.

For Docker, sudo, remote hosts, or dev containers, install and run Retouch
**inside the environment that owns the source and dev server**. The host's
loopback session URL and absolute preload path do not automatically work there.
Do not expose the writer or registration service on a public interface.

## Explicit config mode

The existing `withRetouch` export remains available for locally installed,
project-pinned use. When running through the automatic wrapper, that existing
wrapper defers to session registration, avoiding a second sidecar.

An explicit session hook is also available for environments that load their
own configuration bridge:

```js
import { withRetouchSession } from 'retouch/next';
export default async () => withRetouchSession(nextConfig, { appRoot: process.cwd() });
```

Run that configuration with `RETOUCH_AUTO_NEXT=0 retouch -- <startup command>`
to disable private-API interception. This mode requires that the hook import be
resolvable (a project dependency or an explicit installation path). It returns
the original config when no session is active or in production. It still needs
the session environment and network reachability; it is not a container bridge.

## Shopify

```sh
retouch shopify /path/to/theme
```

This existing integration uses Shopify CLI and an isolated development theme,
with a stamped temporary copy and writes to the original local source. It
requires authenticated Shopify CLI access. The generic command wrapper does
not automatically intercept arbitrary Shopify startup scripts.

Liquid text edits can follow locale keys, block/section/theme settings, literal
assignments and aliases, captures, and snippet arguments to their stored source.
The inspector shows the destination file/key and identifies shared translations.
Nested block instances keep separate text sources even when they use one snippet.
Stored richtext HTML and translation templates are editable in the inspector;
plain stored strings can also be edited inline. Expressions without a unique local
source remain read-only. Run the theme's CSS watcher for new Tailwind classes.

## Design inspector

The right inspector includes explicit positioning and anchors, Alt/Option-hover
padding and spacing measurements, image browsing/uploads, typography classes and
font previews, fill/text colors, shadows, and opacity. Local React components
have a live preview and props panel, shared-definition editing, and module
detachment with exact undo. New style controls preserve existing breakpoint
classes; media-query editing remains deferred. See the
[inspector guide](https://github.com/philipshen/retouch/blob/main/docs/inspector.md)
for supported source patterns and browser verification.
