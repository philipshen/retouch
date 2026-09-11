'use strict';
// The sidecar: serves the editor shell and the writer API. The Next dev
// server proxies /rt/* here via a rewrite, so the browser sees one origin
// (RFC-0001 §5.1). Binds loopback only (R-7); validates Host, a custom
// token header, and op grammar (R-9).

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Index } = require('./indexer.cjs');
const { applyPlan } = require('./transactions.cjs');
const { SourceHistory } = require('./history.cjs');
const { MARKER, isMirrorRequest, stripReloadClient, watchSource } = require('./mirror-sync.cjs');

// Hop-by-hop headers must not be forwarded when proxying.
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade']);

const SHELL_DIR = path.join(__dirname, '..', 'shell');
const HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const TOKEN_HEADER = 'x-retouch-token';

function startServer({ appRoot, port, adapter, proxyTo, rendering = {}, quiet = false }) {
  adapter = adapter || require('./adapter.cjs').defaultAdapter();
  const token = crypto.randomBytes(16).toString('hex');
  const index = new Index(appRoot, adapter);
  const fileCount = index.scanAll();
  const history = new SourceHistory();
  const sourceMonitor = proxyTo && rendering.reloadAfterWrite ? watchSource(appRoot) : null;
  index.watch();
  if (!quiet) console.log(
    `[retouch] adapter=${adapter.name}; indexed ${fileCount} files under ${appRoot} (${index.idToFile.size} elements)`
  );

  const server = http.createServer((req, res) => {
    try {
      handle(req, res, { index, token, appRoot, adapter, proxyTo, rendering, history, sourceMonitor });
    } catch (err) {
      res.writeHead(err.statusCode || 500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });

  server.on('close', () => sourceMonitor?.close());
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      sourceMonitor?.close();
      // Another process (a config reload, a second worker) already runs the
      // sidecar; that instance serves everything.
      return;
    }
    console.warn(`[retouch] sidecar error: ${err.message}`);
  });

  server.listen(port, '127.0.0.1', () => {
    const appPort = proxyTo ? server.address().port : process.env.PORT || 3000;
    if (!quiet) console.log(`[retouch] mirror ready — open http://localhost:${appPort}/rt (sidecar :${server.address().port})`);
  });
  server.retouchIndex = index; // lets tests close the file watcher
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
  if (p === '/rt/__api/source-revision' && req.method === 'GET') {
    requireToken(req, ctx.token);
    return json(res, 200, { ok: true, ...(ctx.sourceMonitor?.state() || { revision: 0, styleRevision: 0, available: false }) });
  }
  if (p === '/rt/__api/health') return json(res, 200, { ok: true });
  if (p === '/rt/__api/images' && req.method === 'GET') {
    requireToken(req, ctx.token);
    const assets = ctx.adapter.assets;
    if (!assets) return json(res, 409, {ok:false,reason:'This adapter has no static asset directory.'});
    const dir = path.join(ctx.appRoot, assets.directory);
    const images = [];
    function scan(folder, prefix) {
      if (images.length >= 500 || !fs.existsSync(folder)) return;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const name = prefix + entry.name;
        if (entry.isDirectory()) scan(path.join(folder, entry.name), name + '/');
        else if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) images.push({ src: name, name: entry.name });
        if (images.length >= 500) break;
      }
    }
    if (fs.existsSync(dir) && fs.realpathSync(dir).startsWith(fs.realpathSync(ctx.appRoot) + path.sep)) scan(dir, assets.urlPrefix);
    return json(res, 200, { ok: true, images });
  }

  if (p === '/rt/__api/resolve' && req.method === 'GET') {
    requireToken(req, ctx.token);
    const id = url.searchParams.get('id') || '';
    if (!/^[0-9a-f]{10}$/.test(id)) return json(res, 400, { ok: false, error: 'bad id' });
    const resolved = ctx.index.resolve(id);
    if (!resolved) return json(res, 404, { ok: false, error: 'unknown id' });
    resolved.context = renderContext(url.searchParams.get('context'));
    return json(res, 200, { ok: true, element: require('./component-usage.cjs').describe(ctx.index,resolved) });
  }

  if (p === '/rt/__api/component' && req.method === 'GET') {
    requireToken(req, ctx.token);
    const id = url.searchParams.get('id') || '';
    if (!/^[0-9a-f]{10}$/.test(id)) return json(res, 400, { ok: false, error: 'bad id' });
    const resolved = ctx.index.resolve(id);
    if (!resolved || !ctx.adapter.describeComponent) return json(res, 409, { ok: false, reason: 'Select a local component instance.' });
    resolved.context = renderContext(url.searchParams.get('context'));
    const result = ctx.adapter.describeComponent(resolved);
    const usage=require('./component-usage.cjs').usage(ctx.index,id);
    if(result.ok && usage){Object.assign(result,usage);if(usage.inlineComponent)result.canDetach=false;}
    return json(res, result.ok ? 200 : 409, result);
  }

  if (p === '/rt/__api/op' && req.method === 'POST') {
    requireToken(req, ctx.token);
    return readBody(req, (body) => {
      try {
      let op;
      try {
        op = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false, error: 'bad json' });
      }
      if (!op || typeof op !== 'object' || Array.isArray(op)) return json(res, 400, { ok: false, error: 'bad op' });
      if (op.historyGroup !== undefined && (typeof op.historyGroup !== 'string' || op.historyGroup.length > 200)) return json(res, 400, {ok:false,error:'bad history group'});
      if (op.type === 'undo' || op.type === 'redo') {
        const result = ctx.history.apply(ctx.appRoot, op.type, op.undoId, ctx.adapter);
        if (!result.ok) return json(res,409,result);
        for (const edit of result.edits) if (ctx.adapter.matches(edit.file)) ctx.index.indexFile(edit.file);
        ctx.sourceMonitor?.acknowledge(result.edits);
        delete result.edits;
        return json(res,200,result);
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
      let result;
      try {
        resolved.context = renderContext(op.context);
        result = applyPlan(ctx.appRoot, ctx.adapter.planOp(resolved, op));
      } catch (err) {
        return json(res, err.statusCode || 500, { ok: false, error: err.message });
      }
      // Keep the index fresh immediately (the watcher would also catch it).
      if (result.ok) {
        for (const edit of result.edits) if (ctx.adapter.matches(edit.file)) ctx.index.indexFile(edit.file);
        if (result.edits.length) {
          result.undoId = ctx.history.record(result.edits, op.historyGroup);
        }
        ctx.sourceMonitor?.acknowledge(result.edits);
        delete result.edits; delete result.createdFile; delete result.createdHash;
        const fresh = ctx.index.resolve(op.id);
        if (fresh) { fresh.context = resolved.context; result.element = ctx.adapter.describe(fresh); }
      }
      return json(res, result.ok ? 200 : 409, result);
      } catch (err) {
        return json(res, 409, { ok: false, refused: true, reason: 'The source operation could not complete: ' + err.message });
      }
    });
  }

  if (p === '/rt/__api/upload' && req.method === 'POST') {
    requireToken(req, ctx.token);
    return readBinary(req, 10_000_000, (buf) => {
      if (!buf) return json(res, 413, { ok: false, error: 'file too large (max 10 MB)' });
      const assets = ctx.adapter.assets;
      if (!assets) return json(res, 409, {ok:false,reason:'This adapter has no static asset directory.'});
      const assetRoot = path.join(ctx.appRoot, assets.directory);
      if (!fs.existsSync(assetRoot)) {
        return json(res, 409, {
          ok: false,
          refused: true,
          reason: `This app has no ${assets.directory}/ directory for static assets.`,
        });
      }
      const rawName = url.searchParams.get('name') || 'image';
      const safe =
        rawName.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^[.-]+/, '').slice(-80) || 'image';
      const dir = path.join(assetRoot, assets.uploadDirectory);
      if (!fs.realpathSync(assetRoot).startsWith(fs.realpathSync(ctx.appRoot) + path.sep)) return json(res, 409, { ok: false, reason: 'Asset directory is outside the project.' });
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.realpathSync(dir).startsWith(fs.realpathSync(ctx.appRoot) + path.sep)) return json(res, 409, { ok: false, reason: 'Asset directory is outside the project.' });
      const name = 'rt-' + crypto.randomBytes(6).toString('hex') + '-' + safe;
      fs.writeFileSync(path.join(dir, name), buf);
      return json(res, 200, { ok: true, src: assets.urlPrefix + (assets.uploadDirectory ? assets.uploadDirectory + '/' : '') + name });
    });
  }

  if (req.method === 'GET' && (p === '/rt' || p.startsWith('/rt/'))) {
    const html = fs
      .readFileSync(path.join(SHELL_DIR, 'index.html'), 'utf8')
      .replace('__RETOUCH_TOKEN__', ctx.token)
      .replace('__RETOUCH_RENDERING__', JSON.stringify({reloadAfterWrite:ctx.rendering.reloadAfterWrite===true,revalidateStyles:ctx.rendering.revalidateStyles===true}));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  // Proxy mode (Liquid/Shopify): everything that is not a /rt path is forwarded
  // to the upstream renderer (shopify theme dev), so the mirror and the theme
  // share one origin. The stamped theme already carries data-rt in its render.
  if (ctx.proxyTo) return proxy(req, res, ctx.proxyTo, !!ctx.sourceMonitor);

  res.writeHead(404);
  res.end('not found');
}


function proxy(req, res, upstream, managedMirror = false) {
  const mirror = managedMirror && isMirrorRequest(req);
  const target = new URL(upstream);
  // Treat even a //host/path request as a path on the fixed renderer.
  const requested = new URL(req.url, 'http://localhost');
  target.pathname = req.url.startsWith('//') ? req.url.split('?')[0] : requested.pathname;
  requested.searchParams.delete(MARKER);
  target.search = requested.search;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP.has(k.toLowerCase())) headers[k] = v;
  }
  headers.host = target.host;
  if (mirror) headers['accept-encoding'] = 'identity';
  const up = http.request(
    { hostname: target.hostname, port: target.port || 80, path: target.pathname + target.search, method: req.method, headers },
    (ur) => {
      const out = {};
      for (const [k, v] of Object.entries(ur.headers)) {
        if (!HOP.has(k.toLowerCase())) out[k] = v;
      }
      // The hosted storefront denies framing. This loopback-only mirror must
      // permit its own same-origin editor, while still denying other origins.
      out['x-frame-options'] = 'SAMEORIGIN';
      if (out['content-security-policy']) {
        out['content-security-policy'] = String(out['content-security-policy'])
          .replace(/frame-ancestors\s+[^;]*/gi, "frame-ancestors 'self'");
      }
      if (out.location) {
        const redirect = new URL(out.location, target);
        if (redirect.origin === target.origin) out.location = redirect.pathname + redirect.search + redirect.hash;
      }
      if (mirror && String(out['content-type'] || '').includes('text/html')) {
        const chunks = [];
        ur.on('data', chunk => chunks.push(chunk));
        ur.on('end', () => {
          let body = Buffer.concat(chunks);
          try {
            const encoding = out['content-encoding'];
            if (encoding === 'gzip') body = zlib.gunzipSync(body);
            else if (encoding === 'br') body = zlib.brotliDecompressSync(body);
            else if (encoding === 'deflate') body = zlib.inflateSync(body);
            else if (encoding && encoding !== 'identity') throw new Error('Unsupported renderer encoding');
          } catch { res.writeHead(502); res.end('Retouch could not decode the renderer preview safely.'); return; }
          const html = stripReloadClient(body.toString('utf8'));
          delete out['content-encoding'];
          delete out['content-length']; delete out.etag; delete out['last-modified'];
          out['cache-control'] = 'no-store';
          res.writeHead(ur.statusCode || 502, out); res.end(html);
        });
        ur.on('error', () => res.destroy());
      } else {
        res.writeHead(ur.statusCode || 502, out);
        ur.pipe(res);
      }
    }
  );
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('retouch: upstream renderer not reachable. Is `shopify theme dev` running?');
  });
  req.pipe(up);
}

function renderContext(input) {
  if (!input) return null;
  const serialized = typeof input==='string' ? input : JSON.stringify(input);
  if (serialized.length>32768) throw Object.assign(new Error('Context too large'),{statusCode:400});
  try {
    const value=JSON.parse(serialized);
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error('Bad context'),{statusCode:400}); }
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
