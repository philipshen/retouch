'use strict';
const MagicString = require('magic-string');

// Next 16's App Router can receive an HMR refresh while decoding its initial
// Flight stream, before useActionQueue installs dispatch. Queue only that dev
// refresh; navigation and server actions retain Next's initialization checks.
function transform(source, filename) {
  if (source.includes('let __rtPendingHmrRefresh')) return null;
  const declaration = 'let dispatch = null;';
  const entry = 'function dispatchAppRouterAction(action) {';
  const mounted = 'dispatch = nextDispatch;';
  const transition = source.includes('const _react =') ? '_react.startTransition' : source.includes("import React,") ? 'React.startTransition' : null;
  if (!transition || !source.includes('function useActionQueue(') ||
      ![declaration, entry, mounted].every(text => source.split(text).length === 2)) return null;
  const code = new MagicString(source);
  code.appendLeft(source.indexOf(declaration), 'let __rtPendingHmrRefresh = null;\n');
  code.appendLeft(source.indexOf(entry) + entry.length, `
    if (typeof window !== 'undefined' && action.type === 'hmr-refresh') {
        if (dispatch === null) { __rtPendingHmrRefresh = action; return; }
        __rtPendingHmrRefresh = null;
    }`);
  code.appendLeft(source.indexOf(mounted) + mounted.length, `
        if (__rtPendingHmrRefresh !== null) queueMicrotask(() => {
            const pending = __rtPendingHmrRefresh;
            __rtPendingHmrRefresh = null;
            if (pending !== null) ${transition}(() => dispatch(pending));
        });`);
  return { code: code.toString(), map: code.generateMap({ hires: true, source: filename, includeContent: true }) };
}
module.exports = function nextHmrLoader(source, inputMap) {
  const callback = this.async();
  if (process.env.NODE_ENV === 'production') return callback(null, source, inputMap);
  try {
    const result = transform(source, this.resourcePath);
    if (!result) {
      if (!source.includes('let __rtPendingHmrRefresh')) this.emitWarning?.(new Error('[retouch] Next HMR startup guard skipped: unrecognized action queue implementation.'));
      return callback(null, source, inputMap);
    }
    callback(null, result.code, result.map);
  } catch (error) {
    this.emitWarning?.(error);
    callback(null, source, inputMap);
  }
};
module.exports.transform = transform;
