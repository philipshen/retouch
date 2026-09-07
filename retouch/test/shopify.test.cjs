'use strict';
// The Shopify integration: proxy passthrough, stamp-copy, and the safety guard.
// A fake upstream stands in for `shopify theme dev`, so no store is needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { makeApp, cleanup } = require('./helpers.cjs');
const { startServer } = require('../src/server.cjs');
const liquid = require('../src/adapters/liquid.cjs');
const { syncStamp, assertSafe } = require('../src/shopify.cjs');

test('assertSafe refuses flags that could touch an existing theme', () => {
  for (const bad of ['--live', 'push', '--theme', '--allow-live']) {
    assert.throws(() => assertSafe([bad]), new RegExp('refused'));
  }
  assert.doesNotThrow(() => assertSafe(['--store', 'example.myshopify.com']));
});

test('syncStamp copies the theme and stamps only .liquid files', () => {
  const src = makeApp({
    'layout/theme.liquid': '<html><body><h1 class="t">Hi</h1></body></html>',
    'assets/app.js': 'console.log(1)',
    'sections/hero.liquid': '<div class="a">x</div>',
  });
  const dest = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rt-stamp-'));
  const n = syncStamp(src, dest);
  assert.strictEqual(n, 2); // two liquid files
  assert.match(fs.readFileSync(path.join(dest, 'sections/hero.liquid'), 'utf8'), /data-rt="/);
  assert.strictEqual(fs.readFileSync(path.join(dest, 'assets/app.js'), 'utf8'), 'console.log(1)');
  // the ORIGINAL is untouched (stamping never modifies source)
  assert.ok(!/data-rt/.test(fs.readFileSync(path.join(src, 'sections/hero.liquid'), 'utf8')));
  cleanup(src);
  fs.rmSync(dest, { recursive: true, force: true });
});

// Proxy passthrough against a fake upstream renderer.
let upstream, upstreamPort, server, proxyPort, themeRoot;
before(async () => {
  upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" });
    res.end(`<html><body>UPSTREAM ${req.url}</body></html>`);
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  upstreamPort = upstream.address().port;
  themeRoot = makeApp({ 'sections/x.liquid': '<div class="a">x</div>' });
  proxyPort = 9500 + Math.floor(Math.random() * 90);
  const origLog = console.log; console.log = () => {};
  server = startServer({ appRoot: themeRoot, port: proxyPort, adapter: liquid, proxyTo: `http://127.0.0.1:${upstreamPort}` });
  console.log = origLog;
  await waitReady(proxyPort);
});
after(() => {
  if (server.retouchIndex) server.retouchIndex.close();
  server.close();
  upstream.close();
  cleanup(themeRoot);
});

function req(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    }).on('error', reject);
  });
}
async function waitReady(port) {
  for (let i = 0; i < 50; i++) {
    try { const r = await req(port, '/rt/__api/health'); if (r.status === 200) return; } catch {}
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('server not ready');
}

test('the mirror serves /rt itself', async () => {
  const r = await req(proxyPort, '/rt');
  assert.strictEqual(r.status, 200);
  assert.match(r.body, /Retouch/);
});

test('non-/rt requests proxy to the upstream renderer', async () => {
  const r = await req(proxyPort, '/collections/all');
  assert.strictEqual(r.status, 200);
  assert.match(r.body, /UPSTREAM \/collections\/all/);
});

test('the theme homepage proxies through', async () => {
  const r = await req(proxyPort, '/');
  assert.match(r.body, /UPSTREAM \//);
});

test('isolation rejects equals and short flags and strips inherited CLI overrides', () => {
  for (const bad of ['--theme=123', '-t123', '-nt123', '-na', '-a', '--allow-live=true', '--environment=production', '-eprod', '--path=/tmp/theme', '--port=1234', '--host=0.0.0.0']) {
    assert.throws(() => assertSafe([bad]), /refused/);
  }
  const { themeDevEnv } = require('../src/shopify.cjs');
  assert.deepStrictEqual(themeDevEnv({ PATH: '/bin', SHOPIFY_FLAG_THEME_ID: '123', SHOPIFY_FLAG_ALLOW_LIVE: '1', SHOPIFY_FLAG_STORE: 'example', SHOPIFY_FLAG_ENVIRONMENT: 'production' }), { PATH: '/bin', SHOPIFY_FLAG_STORE: 'example' });
});

test('theme watcher syncs assets, JSON, new directories and deletions; close cancels pending work', async () => {
  const { watchAndRestamp } = require('../src/shopify.cjs');
  const src = makeApp({ 'sections/a.liquid': '<p>Before</p>', 'assets/style.css': 'old', 'shopify.theme.toml': '[environments.default]\ntheme="123"' });
  const dest = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rt-watch-'));
  syncStamp(src, dest);
  assert.ok(!fs.existsSync(path.join(dest, 'shopify.theme.toml')));
  const close = watchAndRestamp(src, dest);
  const waitFor = async (fn) => {
    for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 30)); }
    assert.fail('theme copy did not synchronize');
  };
  try {
    await new Promise(r => setTimeout(r, 150)); // let the platform watcher attach
    fs.writeFileSync(path.join(src, 'assets/style.css'), 'new');
    fs.mkdirSync(path.join(src, 'templates'));
    fs.writeFileSync(path.join(src, 'templates/index.json'), '{}');
    fs.writeFileSync(path.join(src, 'sections/a.liquid'), '<p>After</p>');
    await waitFor(() => fs.readFileSync(path.join(dest, 'assets/style.css'), 'utf8') === 'new' && fs.existsSync(path.join(dest, 'templates/index.json')) && fs.readFileSync(path.join(dest, 'sections/a.liquid'), 'utf8').includes('After'));
    assert.strictEqual(fs.readFileSync(path.join(dest, 'sections/a.liquid'), 'utf8'), liquid.stamp('<p>After</p>', path.join(src, 'sections/a.liquid'), src).code);
    fs.rmSync(path.join(src, 'sections/a.liquid'));
    await waitFor(() => !fs.existsSync(path.join(dest, 'sections/a.liquid')));
    close();
    fs.writeFileSync(path.join(src, 'assets/style.css'), 'stopped');
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(fs.readFileSync(path.join(dest, 'assets/style.css'), 'utf8'), 'new');
  } finally { close(); cleanup(src); cleanup(dest); }
});

test('preview permits same-origin framing without dropping other CSP directives', async () => {
  const r = await req(proxyPort, '/');
  assert.strictEqual(r.headers['x-frame-options'], 'SAMEORIGIN');
  assert.strictEqual(r.headers['content-security-policy'], "default-src 'self'; frame-ancestors 'self'");
});

test('protocol-relative paths cannot change the proxy upstream', async () => {
  const r = await req(proxyPort, '//example.invalid/path');
  assert.strictEqual(r.status, 200);
  assert.match(r.body, /UPSTREAM \/\/example.invalid\/path/);
});
