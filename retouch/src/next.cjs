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

function withRetouch(nextConfig = {}, opts = {}) {
  // R-7: never active in production.
  if (process.env.NODE_ENV === 'production') return nextConfig;

  const port = opts.port || Number(process.env.RETOUCH_PORT) || DEFAULT_PORT;
  const appRoot = opts.appRoot || process.cwd();
  process.env.RETOUCH_APP_ROOT = appRoot;

  if (!globalThis[STARTED]) {
    globalThis[STARTED] = true;
    const { startServer } = require('./server.cjs');
    const adapter = require('./adapter.cjs').getAdapter('react');
    startServer({ appRoot, port, adapter });
  }

  const loaderPath = require.resolve('./loader.cjs');
  // No `as`: with `as` set to the same extension, Turbopack re-resolves
  // imports with a doubled extension (x.tsx.tsx). Omitting it keeps the
  // module's type and chains into the normal TSX pipeline.
  const loaderRule = { loaders: [loaderPath] };

  return {
    ...nextConfig,

    turbopack: {
      ...(nextConfig.turbopack || {}),
      rules: {
        ...((nextConfig.turbopack && nextConfig.turbopack.rules) || {}),
        '*.tsx': loaderRule,
        '*.jsx': loaderRule,
      },
    },

    webpack(cfg, ctx) {
      cfg.module.rules.push({
        test: /\.(tsx|jsx)$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader: loaderPath }],
      });
      return nextConfig.webpack ? nextConfig.webpack(cfg, ctx) : cfg;
    },

    async rewrites() {
      const mine = [
        { source: '/rt', destination: `http://127.0.0.1:${port}/rt` },
        { source: '/rt/:path*', destination: `http://127.0.0.1:${port}/rt/:path*` },
      ];
      const prev = nextConfig.rewrites ? await nextConfig.rewrites() : [];
      if (Array.isArray(prev)) return [...mine, ...prev];
      return { ...prev, beforeFiles: [...mine, ...(prev.beforeFiles || [])] };
    },
  };
}

module.exports = { withRetouch };
module.exports.default = withRetouch;
