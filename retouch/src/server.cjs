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
const { applyPlan } = require('./transactions.cjs');
const { SourceHistory } = require('./history.cjs');
const { MARKER, isMirrorRequest, stripReloadClient, watchSource } = require('./mirror-sync.cjs');

// Hop-by-hop headers must not be forwarded when proxying.
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade']);

const SHELL_DIR = path.join(__dirname, '..', 'shell');
const HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const TOKEN_HEADER = 'x-retouch-token';

function historyRoute(req){try{const value=req.headers['x-retouch-route'];return typeof value==='string'?decodeURIComponent(value):undefined;}catch{return undefined;}}

function startServer({ appRoot, port, adapter, proxyTo, serveSite, rendering = {}, quiet = false }) {
  adapter = adapter || require('./adapter.cjs').defaultAdapter();
  const token = crypto.randomBytes(16).toString('hex');
  const stateScope={project:crypto.createHash('sha256').update(fs.realpathSync(appRoot)).digest('hex'),session:crypto.createHash('sha256').update(token).digest('hex')};
  const index = new Index(appRoot, adapter);
  const fileCount = index.scanAll();
  let history;
  try{const directory=process.env.RETOUCH_STATE_DIR||path.join(fs.realpathSync(require('node:os').homedir()),'.retouch','history');history=new SourceHistory(100,{store:require('./history-store.cjs').createHistoryStore(appRoot,directory)});}
  catch(error){history=new SourceHistory(100,{store:{save(){throw error;}}});history.persistenceError=error.message;}
  const sourceMonitor = (proxyTo || serveSite) && rendering.reloadAfterWrite ? watchSource(appRoot) : null;
  index.watch();
  if (!quiet) console.log(
    `[retouch] adapter=${adapter.name}; indexed ${fileCount} files under ${appRoot} (${index.idToFile.size} elements)`
  );

  const server = http.createServer((req, res) => {
    try {
      handle(req, res, { index, token, stateScope, appRoot, adapter, proxyTo, serveSite, rendering, history, sourceMonitor });
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
    const appPort = (proxyTo || serveSite) ? server.address().port : process.env.PORT || 3000;
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
    return json(res, 200, { ok: true, ...(ctx.sourceMonitor?.state() || { revision: 0, available: false }) });
  }
  if (p === '/rt/__api/health') return json(res, 200, { ok: true, service: 'retouch' });
  if (p === '/rt/__api/text-styles' || p === '/rt/__api/color-styles' || p === '/rt/__api/effect-styles') {
    requireToken(req,ctx.token);
    const kind=p==='/rt/__api/color-styles'?'color':p==='/rt/__api/effect-styles'?'effect':'text',library=require('./'+kind+'-styles.cjs');
    if(req.method==='GET')return json(res,200,{ok:true,...library.read(ctx.appRoot)});
    if(req.method!=='POST')return json(res,405,{ok:false,reason:'Use GET or POST for '+kind+' styles.'});
    return readBinary(req,library.LIMIT,bytes=>{
      if(!bytes)return json(res,413,{ok:false,reason:kind+' style requests must be 512 KB or smaller.'});
      let operation;try{operation=JSON.parse(bytes.toString('utf8'));}catch{return json(res,400,{ok:false,reason:'Invalid '+kind+' style JSON.'});}
      try{
        const renderer=['react','liquid'].includes(ctx.adapter.name)?ctx.adapter.name:'html',linked=ctx.adapter.capabilities?.ops?.includes('setCSS')||['react','liquid'].includes(ctx.adapter.name);
        const plan=operation?.type==='update'&&linked?require('./text-style-update.cjs').plan(ctx.appRoot,operation,renderer,kind):library.planChange(ctx.appRoot,operation);
        if(!plan.ok)return json(res,409,plan);
        const applied=library.commitPlan(ctx.appRoot,plan);
        for(const edit of applied.edits)if(ctx.adapter.matches(edit.file))ctx.index.indexFile(edit.file);
        const undoId=ctx.history.record(applied.edits,undefined,historyRoute(req));ctx.sourceMonitor?.acknowledge(applied.edits);
        return json(res,200,{ok:true,...applied.result,undoId,historyPersistenceError:ctx.history.persistenceError,updated:applied.updated||0});
      }catch(error){return json(res,error.statusCode||500,{ok:false,reason:error.message});}
    });
  }
  if (p === '/rt/__api/font-axes') {
    requireToken(req, ctx.token);
    if(req.method!=='POST')return json(res,405,{ok:false,reason:'Send font bytes with POST.'});
    return readBinary(req,16*1024*1024,bytes=>{
      if(!bytes)return json(res,413,{ok:false,reason:'Font files must be 16 MB or smaller.'});
      try{return json(res,200,{ok:true,...require('./font-axes.cjs').readFontMetadata(bytes)});}
      catch(error){return json(res,422,{ok:false,reason:error.message});}
    });
  }
  if (p === '/rt/__api/pages' && req.method === 'GET') {
    requireToken(req, ctx.token);
    return json(res, 200, {ok:true,available:!!ctx.adapter.pages,...(ctx.adapter.pages?.()||{pages:[]})});
  }
  if (p === '/rt/__api/images' && req.method === 'GET') {
    requireToken(req, ctx.token);
    const assets = ctx.adapter.assets;
    if (!assets) return json(res, 409, {ok:false,reason:'This adapter has no static asset directory.'});
    const dir = path.join(ctx.appRoot, assets.directory);
    const images = [];
    function scan(folder, prefix) {
      if (images.length >= 500 || !fs.existsSync(folder)) return;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink() || assets.excludeDirectories?.includes(entry.name)) continue;
        const name = prefix + encodeURIComponent(entry.name);
        if (entry.isDirectory()) scan(path.join(folder, entry.name), name + '/');
        else if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(name)) images.push({ src: name, name: entry.name });
        if (images.length >= 500) break;
      }
    }
    if (fs.existsSync(dir)) {
      const root = fs.realpathSync(ctx.appRoot), actual = fs.realpathSync(dir);
      if (actual === root || actual.startsWith(root + path.sep)) scan(dir, assets.urlPrefix);
    }
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
    return json(res, result.ok ? 200 : 409, {...result,historyPersistenceError:ctx.history.persistenceError});
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
        return json(res,200,{...result,historyPersistenceError:ctx.history.persistenceError});
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
        if(['applyEffectStyle','resetEffectStyle','detachEffectStyle','updateEffectStyle','applyEffectStyleSelection','resetEffectStyleSelection','detachEffectStyleSelection'].includes(op.type)){
          const reactEffects=ctx.adapter.name==='react',liquidEffects=ctx.adapter.name==='liquid';
          if(!ctx.adapter.capabilities?.ops?.includes('setCSS')&&!reactEffects&&!liquidEffects)return json(res,409,{ok:false,reason:'Linked effect styles need an HTML, React or Liquid project.'});
          if(op.fileHash!==resolved.hash)return json(res,409,{ok:false,reason:'The source changed. Re-select the layer.'});
          if(op.type==='updateEffectStyle')result=applyPlan(ctx.appRoot,require('./text-style-update.cjs').plan(ctx.appRoot,{type:'update',revision:op.libraryRevision,id:op.styleId,name:op.name,properties:op.properties},reactEffects?'react':liquidEffects?'liquid':'html','effect'));
          else {let style;if(!op.type.startsWith('detachEffectStyle')){const library=require('./effect-styles.cjs').read(ctx.appRoot);if(library.revision!==op.libraryRevision)return json(res,409,{ok:false,reason:'Effect styles changed. Reload the library.'});style=op.type==='resetEffectStyleSelection'?library:library.styles.find(item=>item.id===op.styleId);if(!style)return json(res,409,{ok:false,reason:'That effect style no longer exists.'});}result=applyPlan(ctx.appRoot,op.type.endsWith('Selection')?require('./text-style-selection.cjs').plan(resolved,op,style,ctx.adapter,'effect'):require(reactEffects?'./jsx-effect-styles.cjs':liquidEffects?'./liquid-effect-styles.cjs':'./html-effect-styles.cjs').plan(resolved,op,style));}
        }else if(op.type==='setColorOverrideSelection'){
          if(ctx.adapter.name!=='react')return json(res,409,{ok:false,reason:'Shared class color editing needs a React selection.'});
          result=applyPlan(ctx.appRoot,require('./color-override-selection.cjs').plan(resolved,op));
        }else if(op.type==='setColorOverride'){
          if(!['react','liquid'].includes(ctx.adapter.name))return json(res,409,{ok:false,reason:'Class color editing is not available for this renderer.'});
          const info=ctx.adapter.describe(resolved);if(info.classNameDynamic)return json(res,409,{ok:false,reason:'Color editing needs literal classes.'});
          if(op.fileHash!==resolved.hash)return json(res,409,{ok:false,reason:'The source changed. Re-select the layer.'});
          let classes;try{classes=require('./color-style-classes.cjs').compose(info.className||'',op.property,op.value,op.scope||'');}catch(error){return json(res,409,{ok:false,reason:error.message});}
          result=applyPlan(ctx.appRoot,ctx.adapter.planOp(resolved,{type:'setClasses',classes,fileHash:op.fileHash}));
        } else if (['applyColorStyle','resetColorStyle','detachColorStyle','applyColorStyleSelection','resetColorStyleSelection','detachColorStyleSelection'].includes(op.type)) {
          if(!ctx.adapter.capabilities?.ops?.includes('setCSS')&&!['react','liquid'].includes(ctx.adapter.name))return json(res,409,{ok:false,reason:'Linked color styles are not available for this renderer yet.'});
          let style;if(!op.type.startsWith('detachColorStyle')){const library=require('./color-styles.cjs').read(ctx.appRoot);if(library.revision!==op.libraryRevision)return json(res,409,{ok:false,reason:'Color styles changed. Reload the palette.'});style=op.type==='resetColorStyleSelection'?library:library.styles.find(item=>item.id===op.styleId);if(!style)return json(res,409,{ok:false,reason:'That color style no longer exists.'});}
          result=applyPlan(ctx.appRoot,op.type.endsWith('Selection')?require('./text-style-selection.cjs').plan(resolved,op,style,ctx.adapter,'color'):require(ctx.adapter.name==='react'?'./jsx-color-styles.cjs':ctx.adapter.name==='liquid'?'./liquid-color-styles.cjs':'./html-color-styles.cjs').plan(resolved,op,style));
        } else if (op.type === 'updateTextStyle') {
          if(op.fileHash!==resolved.hash)return json(res,409,{ok:false,reason:'The source layer changed. Re-select it before updating the style.'});
          if (!ctx.adapter.capabilities?.ops?.includes('setCSS')&&!['react','liquid'].includes(ctx.adapter.name)) return json(res,409,{ok:false,reason:'Linked text style updates are not available for this renderer yet.'});
          result=applyPlan(ctx.appRoot,require('./text-style-update.cjs').plan(ctx.appRoot,{type:'update',revision:op.libraryRevision,id:op.styleId,name:op.name,properties:op.properties},['react','liquid'].includes(ctx.adapter.name)?ctx.adapter.name:'html'));
        } else if (op.type === 'resetTextStyleSelection' || op.type === 'detachTextStyleSelection' || op.type === 'applyTextStyleSelection' || op.type === 'applyTextStyle' || op.type === 'detachTextStyle' || op.type === 'resetTextStyle') {
          const reactStyles=ctx.adapter.name==='react',liquidStyles=ctx.adapter.name==='liquid';
          if (!ctx.adapter.capabilities?.ops?.includes('setCSS')&&!reactStyles&&!liquidStyles) return json(res,409,{ok:false,reason:'Linked text style application is not available for this renderer yet.'});
          let style;
          if (op.type === 'resetTextStyleSelection' || op.type === 'applyTextStyleSelection' || op.type === 'applyTextStyle' || op.type === 'resetTextStyle') {
            const library=require('./text-styles.cjs').read(ctx.appRoot);
            if(op.libraryRevision!==library.revision)return json(res,409,{ok:false,reason:'Text styles changed. Reload the library before applying.'});
            style=op.type==='resetTextStyleSelection'?library:library.styles.find(item=>item.id===op.styleId);
            if(!style)return json(res,409,{ok:false,reason:'That text style no longer exists.'});
          }
          result=applyPlan(ctx.appRoot,op.type.endsWith('Selection')?require('./text-style-selection.cjs').plan(resolved,op,style,ctx.adapter):require(reactStyles?'./jsx-text-styles.cjs':liquidStyles?'./liquid-text-styles.cjs':'./html-text-styles.cjs').plan(resolved,op,style));
        } else result = applyPlan(ctx.appRoot, ctx.adapter.planOp(resolved, op));
      } catch (err) {
        return json(res, err.statusCode || 500, { ok: false, error: err.message });
      }
      // Keep the index fresh immediately (the watcher would also catch it).
      if (result.ok) {
        for (const edit of result.edits) if (ctx.adapter.matches(edit.file)) ctx.index.indexFile(edit.file);
        if (result.edits.length) {
          result.undoId = ctx.history.record(result.edits, op.historyGroup,historyRoute(req));
        }
        ctx.sourceMonitor?.acknowledge(result.edits);
        delete result.edits; delete result.createdFile; delete result.createdHash;
        const fresh = ctx.index.resolve(op.id);
        if (fresh) { fresh.context = resolved.context; result.element = ctx.adapter.describe(fresh); }
      }
      return json(res, result.ok ? 200 : 409, {...result,historyPersistenceError:ctx.history.persistenceError});
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
      if (assets.imageOnly && !/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(rawName)) return json(res, 409, {ok:false,reason:'Choose a PNG, JPEG, GIF, WebP, AVIF, SVG or ICO image.'});
      const safe =
        rawName.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^[.-]+/, '').slice(-80) || 'image';
      const dir = path.join(assetRoot, assets.uploadDirectory);
      const projectRoot = fs.realpathSync(ctx.appRoot), actualAssetRoot = fs.realpathSync(assetRoot);
      if (actualAssetRoot !== projectRoot && !actualAssetRoot.startsWith(projectRoot + path.sep)) return json(res, 409, { ok: false, reason: 'Asset directory is outside the project.' });
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
      .replace('__RETOUCH_RENDERING__', JSON.stringify({history:ctx.history.snapshot(),historyPersistenceError:ctx.history.persistenceError,stateScope:ctx.stateScope,selectionStyling:ctx.adapter.capabilities?.ops?.some(op=>['setClassesSelection','setCSSSelection'].includes(op))===true,layerReparenting:ctx.adapter.capabilities?.ops?.includes('reparentElement')===true,reloadAfterWrite:ctx.rendering.reloadAfterWrite===true,revalidateStyles:ctx.rendering.revalidateStyles===true}).replace(/</g,'\\u003c'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  // Proxy mode (Liquid/Shopify): everything that is not a /rt path is forwarded
  // to the upstream renderer (shopify theme dev), so the mirror and the theme
  // share one origin. The stamped theme already carries data-rt in its render.
  if (ctx.proxyTo) return proxy(req, res, ctx.proxyTo, !!ctx.sourceMonitor);

  if (ctx.serveSite) return ctx.serveSite(req,res);
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
      if (mirror && String(out['content-type'] || '').includes('text/html') && !out['content-encoding']) {
        const chunks = [];
        ur.on('data', chunk => chunks.push(chunk));
        ur.on('end', () => {
          const html = stripReloadClient(Buffer.concat(chunks).toString('utf8'));
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
    if(over)return;
    size += c.length;
    // Drain excess input without retaining it so the client can receive 413.
    if (size > maxBytes) { over = true; chunks.length=0; cb(null); return; }
    chunks.push(c);
  });
  req.on('end', () => { if(!over)cb(Buffer.concat(chunks)); });
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
