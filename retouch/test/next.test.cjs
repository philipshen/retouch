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

test('HMR guard targets only Next action queues and is absent from production webpack', () => {
  const config = composeNext({}, options);
  const rules = config.webpack({ module: { rules: [] } }, { dev: true }).module.rules;
  const guard = rules.find(rule => rule.use[0].loader.endsWith('next-hmr-loader.cjs'));
  assert.ok(guard.test.test('/repo/node_modules/next/dist/client/components/use-action-queue.js'));
  assert.ok(guard.test.test('/repo/node_modules/next/dist/esm/client/components/use-action-queue.js'));
  assert.equal(guard.test.test('/repo/app/use-action-queue.js'), false);
  assert.equal(config.webpack({ module: { rules: [] } }, { dev: false }).module.rules.some(rule => rule.use[0].loader.endsWith('next-hmr-loader.cjs')), false);
});

test('Turbopack HMR guard composes existing loaders without changing their options', () => {
  const pattern = '**/next/dist/client/components/use-action-queue.js';
  const previous = { loaders: ['existing-loader'], as: '*.js' };
  const config = composeNext({ turbopack: { rules: { [pattern]: previous } } }, options);
  assert.equal(config.turbopack.rules[pattern].as, '*.js');
  assert.equal(config.turbopack.rules[pattern].loaders[0], 'existing-loader');
  assert.ok(config.turbopack.rules[pattern].loaders[1].loader.endsWith('next-hmr-loader.cjs'));
  assert.deepEqual(previous.loaders, ['existing-loader']);
  assert.throws(() => composeNext({ turbopack: { rules: { [pattern]: [] } } }, options), /Cannot safely compose/);
});
