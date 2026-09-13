'use strict';
// Config mode for Next.js (RFC-0001 OQ-A1/OQ-B1): one line in next.config.
//
//   import { withRetouch } from 'retouch/next';
//   export default withRetouch(nextConfig);
//
// Adds the stamping loader (Turbopack rules + webpack fallback), starts the
// sidecar, and rewrites /rt/* to it so the mirror is same-origin.

const path = require('node:path');

const DEFAULT_PORT = 3901;
const STARTED = Symbol.for('retouch.sidecar.started');
const COMPOSED = Symbol.for('retouch.next.composed');

function withRetouch(nextConfig = {}, opts = {}) {
  // R-7: never active in production.
  if (process.env.NODE_ENV === 'production') return nextConfig;

  // The automatic hook composes after Next has evaluated this config.
  if (process.env.RETOUCH_SESSION_URL) return nextConfig;

  const port = opts.port || Number(process.env.RETOUCH_PORT) || DEFAULT_PORT;
  const appRoot = opts.appRoot || process.cwd();
  process.env.RETOUCH_APP_ROOT = appRoot;

  if (!globalThis[STARTED]) {
    globalThis[STARTED] = true;
    const { startServer } = require('./server.cjs');
    const adapter = require('./adapter.cjs').getAdapter('react');
    startServer({ appRoot, port, adapter });
  }

  return composeNext(nextConfig, { port, appRoot });
}

function composeNext(nextConfig = {}, { port, appRoot }) {
  if (nextConfig[COMPOSED]) return nextConfig;
  if (nextConfig.basePath || nextConfig.assetPrefix) throw new Error('[retouch] Launch integration currently requires an empty basePath and assetPrefix');
  assertRouteAvailable(appRoot);
  const loaderPath = require.resolve('./loader.cjs');
  // No `as`: with `as` set to the same extension, Turbopack re-resolves
  // imports with a doubled extension (x.tsx.tsx). Omitting it keeps the
  // module's type and chains into the normal TSX pipeline.
  const loader = { loader: loaderPath, options: { appRoot } };
  const loaderRule = { loaders: [loader] };
  const rules = { ...nextConfig.turbopack?.rules };
  for (const pattern of ['*.tsx', '*.jsx']) {
    const previous = rules[pattern];
    if (previous && (Array.isArray(previous) || !Array.isArray(previous.loaders))) {
      throw new Error(`[retouch] Cannot safely compose Turbopack rule ${pattern}; use a supported loader rule object`);
    }
    rules[pattern] = previous ? { ...previous, loaders: [...previous.loaders, loader] } : loaderRule;
  }

  for (const pattern of ['**/next/dist/client/components/use-action-queue.js', '**/next/dist/esm/client/components/use-action-queue.js']) {
    const previous = rules[pattern];
    if (previous && (Array.isArray(previous) || !Array.isArray(previous.loaders))) throw new Error(`[retouch] Cannot safely compose Turbopack rule ${pattern}; use a supported loader rule object`);
    const guard = { loader: require.resolve('./next-hmr-loader.cjs') };
    rules[pattern] = previous ? { ...previous, loaders: [...previous.loaders, guard] } : { loaders: [guard] };
  }

  return {
    ...nextConfig,
    [COMPOSED]: true,

    turbopack: {
      ...(nextConfig.turbopack || {}),
      rules,
    },

    webpack(cfg, ctx) {
      cfg.module.rules.push({
        test: /\.(tsx|jsx)$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [loader],
      });
      if (ctx.dev !== false) cfg.module.rules.push({
        test: /[\\/]next[\\/]dist[\\/](?:esm[\\/])?client[\\/]components[\\/]use-action-queue\.js$/,
        enforce: 'pre',
        use: [{ loader: require.resolve('./next-hmr-loader.cjs') }],
      });
      return nextConfig.webpack ? nextConfig.webpack(cfg, ctx) : cfg;
    },

    async rewrites() {
      const mine = [
        { source: '/rt', destination: `http://127.0.0.1:${port}/rt` },
        { source: '/rt/:path*', destination: `http://127.0.0.1:${port}/rt/:path*` },
      ];
      const prev = nextConfig.rewrites ? await nextConfig.rewrites() : [];
      const existing = Array.isArray(prev) ? prev : [...(prev.beforeFiles || []), ...(prev.afterFiles || []), ...(prev.fallback || [])];
      if (existing.some(rule => /^\/rt(?:\/|$|:)/.test(rule.source))) throw new Error('[retouch] Existing rewrite reserves /rt; remove the conflict before enabling Retouch');
      if (Array.isArray(prev)) return [...mine, ...prev];
      return { ...prev, beforeFiles: [...mine, ...(prev.beforeFiles || [])] };
    },
  };
}

function assertRouteAvailable(appRoot) {
  const fs = require('node:fs');
  for (const base of ['app', 'src/app', 'pages', 'src/pages']) {
    const dir = path.join(appRoot, base);
    if (!fs.existsSync(dir)) continue;
    const scan = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === 'rt' || /^rt\.(jsx?|tsx?)$/.test(entry.name)) throw new Error('[retouch] Application reserves /rt; remove the route conflict before enabling Retouch');
        if (entry.isDirectory() && /^\(.*\)$/.test(entry.name)) scan(path.join(current, entry.name));
      }
    };
    scan(dir);
  }
}

// Explicit opt-in for startup environments where preload inheritance is not
// available. Return the unchanged config when no session is enabled.
async function withRetouchSession(nextConfig = {}, opts = {}) {
  if (!process.env.RETOUCH_SESSION_URL || process.env.NODE_ENV === 'production') return nextConfig;
  return require('./session-client.cjs').connectNext(nextConfig, opts.appRoot || process.cwd());
}

module.exports = { withRetouch, composeNext, withRetouchSession };
module.exports.default = withRetouch;
