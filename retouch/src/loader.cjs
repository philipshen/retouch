'use strict';
// Webpack-compatible loader, also registered under Turbopack via
// next.config `turbopack.rules` (RFC-0001 OQ-A1 / P0b). Fault isolation:
// any error serves the module unstamped and warns; the loader must never
// break the dev server (OQ-B1 residual d).

const { stamp } = require('./stamp.cjs');

module.exports = function retouchLoader(source, inputMap) {
  const callback = this.async();
  try {
    if (process.env.NODE_ENV === 'production') {
      return callback(null, source, inputMap);
    }
    const appRoot = process.env.RETOUCH_APP_ROOT || this.rootContext || process.cwd();
    const result = stamp(source, this.resourcePath, appRoot);
    if (!result) return callback(null, source, inputMap);
    return callback(null, result.code, result.map);
  } catch (err) {
    try {
      console.warn(`[retouch] stamping skipped for ${this.resourcePath}: ${err.message}`);
    } catch {}
    return callback(null, source, inputMap);
  }
};
