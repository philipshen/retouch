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
  assert.doesNotThrow(() => assertSafe(['--port', '9292']));
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
    res.writeHead(200, { 'content-type': 'text/html' });
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
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
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
