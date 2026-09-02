'use strict';
// The sidecar: serves the editor shell and the writer API. The Next dev
// server proxies /rt/* here via a rewrite, so the browser sees one origin
// (RFC-0001 §5.1). Binds loopback only (R-7); validates Host, a custom
// token header, and op grammar (R-9).

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { Index } = require('./indexer.cjs');
const { applyOp, describeElement } = require('./writer.cjs');

const SHELL_DIR = path.join(__dirname, '..', 'shell');
const HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const TOKEN_HEADER = 'x-retouch-token';

function startServer({ appRoot, port }) {
  const token = crypto.randomBytes(16).toString('hex');
  const index = new Index(appRoot);
  const fileCount = index.scanAll();
  index.watch();
  console.log(
    `[retouch] indexed ${fileCount} JSX files under ${appRoot} (${index.idToFile.size} elements)`
  );

  const server = http.createServer((req, res) => {
    try {
      handle(req, res, { index, token, appRoot });
    } catch (err) {
      res.writeHead(err.statusCode || 500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // Another process (a config reload, a second worker) already runs the
      // sidecar; that instance serves everything.
      return;
    }
    console.warn(`[retouch] sidecar error: ${err.message}`);
  });

  server.listen(port, '127.0.0.1', () => {
    const appPort = process.env.PORT || 3000;
    console.log(`[retouch] mirror ready — open http://localhost:${appPort}/rt (sidecar :${port})`);
  });
  return server;
}

function handle(req, res, ctx) {
  const host = req.headers.host || '';
  if (!HOST_RE.test(host)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p.startsWith('/rt/__assets/')) return serveAsset(p.slice('/rt/__assets/'.length), res);
  if (p === '/rt/__api/health') return json(res, 200, { ok: true });

  if (p === '/rt/__api/resolve' && req.method === 'GET') {
    requireToken(req, ctx.token);
    const id = url.searchParams.get('id') || '';
    if (!/^[0-9a-f]{10}$/.test(id)) return json(res, 400, { ok: false, error: 'bad id' });
    const resolved = ctx.index.resolve(id);
    if (!resolved) return json(res, 404, { ok: false, error: 'unknown id' });
    return json(res, 200, { ok: true, element: describeElement(resolved) });
  }

  if (p === '/rt/__api/op' && req.method === 'POST') {
    requireToken(req, ctx.token);
    return readBody(req, (body) => {
      let op;
      try {
        op = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false, error: 'bad json' });
      }
      if (!/^[0-9a-f]{10}$/.test(op.id || '')) return json(res, 400, { ok: false, error: 'bad id' });
      const resolved = ctx.index.resolve(op.id);
      if (!resolved)
        return json(res, 404, {
          ok: false,
          refused: true,
          reason: 'This element could not be resolved to source. It may come from node_modules or a file that failed to parse.',
        });
      if (!resolved.file.startsWith(ctx.appRoot + path.sep)) {
        return json(res, 400, { ok: false, error: 'path outside project root' });
      }
      const result = applyOp(resolved, op);
      // Keep the index fresh immediately (the watcher would also catch it).
      if (result.ok) ctx.index.indexFile(resolved.file);
      return json(res, result.ok ? 200 : 409, result);
    });
  }

  if (p === '/rt/__api/upload' && req.method === 'POST') {
    requireToken(req, ctx.token);
    return readBinary(req, 10_000_000, (buf) => {
      if (!buf) return json(res, 413, { ok: false, error: 'file too large (max 10 MB)' });
      if (!fs.existsSync(path.join(ctx.appRoot, 'public'))) {
        return json(res, 409, {
          ok: false,
          refused: true,
          reason: 'This app has no public/ directory for static assets.',
        });
      }
      const rawName = url.searchParams.get('name') || 'image';
      const safe =
        rawName.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^[.-]+/, '').slice(-80) || 'image';
      const dir = path.join(ctx.appRoot, 'public', 'rt-assets');
      fs.mkdirSync(dir, { recursive: true });
      const name = Date.now().toString(36) + '-' + safe;
      fs.writeFileSync(path.join(dir, name), buf);
      return json(res, 200, { ok: true, src: '/rt-assets/' + name });
    });
  }

  if (req.method === 'GET' && (p === '/rt' || p.startsWith('/rt/'))) {
    const html = fs
      .readFileSync(path.join(SHELL_DIR, 'index.html'), 'utf8')
      .replace('__RETOUCH_TOKEN__', ctx.token);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  res.writeHead(404);
  res.end('not found');
}

function requireToken(req, token) {
  if (req.headers[TOKEN_HEADER] !== token) {
    const err = new Error('missing or wrong token');
    err.statusCode = 401;
    throw err;
  }
}

function serveAsset(name, res) {
  if (!/^[a-z0-9._-]+$/i.test(name)) {
    res.writeHead(400);
    return res.end();
  }
  const file = path.join(SHELL_DIR, name);
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  res.writeHead(200, {
    'content-type': types[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(fs.readFileSync(file));
}

function readBinary(req, maxBytes, cb) {
  const chunks = [];
  let size = 0;
  let over = false;
  req.on('data', (c) => {
    size += c.length;
    if (size > maxBytes) { over = true; req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => cb(over ? null : Buffer.concat(chunks)));
  req.on('close', () => { if (over) cb(null); });
}

function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on('end', () => cb(body));
}

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

module.exports = { startServer };
