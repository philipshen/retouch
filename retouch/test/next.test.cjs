'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { composeNext } = require('../src/next.cjs');
const options = { appRoot: '/example/app', port: 12345 };

test('composition preserves config, webpack hooks, rewrites and existing turbo loaders', async () => {
  const original = {
    images: { formats: ['image/avif'] },
    turbopack: { rules: { '*.tsx': { loaders: ['existing-loader'], as: '*.js' } } },
    webpack(config) { config.fixture = true; return config; },
    async rewrites() { return { beforeFiles: [{ source: '/old', destination: '/new' }], afterFiles: [], fallback: [] }; },
  };
  const result = composeNext(original, options);
  assert.deepEqual(result.images, original.images);
  assert.equal(result.turbopack.rules['*.tsx'].as, '*.js');
  assert.equal(result.turbopack.rules['*.tsx'].loaders[0], 'existing-loader');
  assert.deepEqual(original.turbopack.rules['*.tsx'].loaders, ['existing-loader']);
  const webpack = result.webpack({ module: { rules: [] } }, {});
  assert.equal(webpack.fixture, true);
  assert.equal(webpack.module.rules[0].use[0].options.appRoot, options.appRoot);
  assert.equal((await result.rewrites()).beforeFiles[2].source, '/old');
  assert.equal(composeNext(result, options), result);
});

test('ambiguous Turbopack rule shapes fail explicitly instead of overwriting configuration', () => {
  assert.throws(() => composeNext({ turbopack: { rules: { '*.tsx': [] } } }, options), /Cannot safely compose/);
});

test('route conflicts and base paths are explicit failures', async () => {
  assert.throws(() => composeNext({ basePath: '/site' }, options), /basePath/);
  const config = composeNext({ rewrites: async () => [{ source: '/rt/:path*', destination: '/other' }] }, options);
  await assert.rejects(config.rewrites(), /reserves \/rt/);
});

test('explicit session hook is inert outside a session', async () => {
  const original = { fixture: true };
  assert.equal(await require('../src/next.cjs').withRetouchSession(original), original);
});
