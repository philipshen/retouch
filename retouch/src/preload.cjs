'use strict';
// Deliberately narrow private-API bridge. It changes only the development
// config result from a supported Next installation, after Next evaluates it.
if (process.env.RETOUCH_AUTO_NEXT !== '0' && process.env.RETOUCH_SESSION_URL && process.env.RETOUCH_SESSION_SECRET) {
  const Module = require('node:module');
  const path = require('node:path');
  const original = Module._load;
  const wrapped = new WeakMap();
  Module._load = function(request, parent, isMain) {
    const exports = original.apply(this, arguments);
    // Avoid resolving every module in the application.
    if (typeof request !== 'string' || !/(?:^|[/\\])config(?:\.js)?$/.test(request)) return exports;
    const filename = Module._resolveFilename(request, parent, isMain);
    if (!filename.endsWith(path.join('next', 'dist', 'server', 'config.js'))) return exports;
    if (wrapped.has(exports)) return wrapped.get(exports);
    const version = require(path.join(path.dirname(filename), '../../package.json')).version;
    const replacement = { ...exports, __esModule: true, default: async function(phase, dir, options) {
      const config = await exports.default.apply(this, arguments);
      if (phase !== 'phase-development-server' || options?.rawConfig) return config;
      if (!/^16\.2\.\d+$/.test(version)) throw new Error(`[retouch] Automatic Next hook supports 16.2.x (tested 16.2.5); found ${version}. Run without the wrapper and use config mode.`);
      return require('./session-client.cjs').connectNext(config, path.resolve(dir));
    } };
    wrapped.set(exports, replacement);
    return replacement;
  };
}
