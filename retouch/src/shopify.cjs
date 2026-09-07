'use strict';
// Shopify/Liquid build integration (RFC-0001 DR-0015). Orchestrates:
//   1. a stamped working COPY of the theme (the original source is never
//      modified by stamping — RFC "stamp"),
//   2. `shopify theme dev` serving that copy through an isolated DEVELOPMENT
//      theme (unpublished; it never touches the live or any named theme),
//   3. the retouch sidecar in proxy mode, so the mirror at /rt and the theme
//      share one origin.
//
// The writer's index is built over the ORIGINAL theme, so edits land in the
// real source; the IDs match because stamping is computed from that same
// original source.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { startServer } = require('./server.cjs');
const liquid = require('./adapters/liquid.cjs');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.shopify']);

// Safety (user requirement): only ever run an isolated development theme.
// Refuse any argument that could write to the live or a named theme.
const FORBIDDEN = ['--live', '--allow-live', 'push', '--theme', '-t', '-a', '--development-theme-id', '--environment', '-e', '--path', '--host', '--port'];

function assertSafe(extraArgs) {
  for (const a of extraArgs || []) {
    if (FORBIDDEN.includes(a.split('=')[0]) || /^-[^-].+/.test(a)) {
      throw new Error(`[retouch] refused: "${a}" could affect an existing theme. Retouch only runs an isolated development theme.`);
    }
  }
}

function start({
  themeDir,
  proxyPort = Number(process.env.RETOUCH_PROXY_PORT) || 9400,
  themePort = Number(process.env.RETOUCH_THEME_PORT) || 9292,
  spawnThemeDev = true,
  extraArgs = [],
} = {}) {
  themeDir = path.resolve(themeDir);
  assertSafe(extraArgs);
  if (!fs.existsSync(path.join(themeDir, 'layout')) && !fs.existsSync(path.join(themeDir, 'sections'))) {
    throw new Error(`[retouch] ${themeDir} does not look like a Shopify theme (no layout/ or sections/).`);
  }

  const stampedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-theme-'));
  const n = syncStamp(themeDir, stampedDir);
  console.log(`[retouch] stamped a working copy of the theme (${n} liquid files) at ${stampedDir}`);

  const closeWatcher = watchAndRestamp(themeDir, stampedDir);

  let child = null;
  if (spawnThemeDev) child = launchThemeDev(stampedDir, themePort, extraArgs);

  const server = startServer({
    appRoot: themeDir,
    port: proxyPort,
    adapter: liquid,
    proxyTo: `http://127.0.0.1:${themePort}`,
  });
  console.log(`[retouch] proxy + mirror on :${proxyPort} → theme dev :${themePort}`);
  console.log(`[retouch] open  http://localhost:${proxyPort}/rt`);

  let stopped = false;
  const onSignal = () => { stop(); process.exit(0); };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    closeWatcher();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    try { server.retouchIndex && server.retouchIndex.close(); } catch {}
    try { server.close(); } catch {}
    if (child) try { child.kill('SIGINT'); } catch {}
    try { fs.rmSync(stampedDir, { recursive: true, force: true }); } catch {}
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  return { server, child, stampedDir, stop };
}

// Copy the theme into `dest`, stamping every .liquid file. Returns the count
// of liquid files stamped.
function syncStamp(src, dest, appRoot = src) {
  let count = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name) || e.name === 'shopify.theme.toml' || e.isSymbolicLink()) continue;
      const from = path.join(dir, e.name);
      const rel = path.relative(src, from);
      const to = path.join(dest, rel);
      if (e.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        walk(from);
      } else if (e.name.endsWith('.liquid')) {
        count += 1;
        stampFileTo(from, to, appRoot);
      } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
    }
  };
  fs.mkdirSync(dest, { recursive: true });
  walk(src);
  return count;
}

// Stamp one original .liquid file into the copy. Stamping always runs on the
// clean original, so IDs are stable and match the writer's index.
function stampFileTo(from, to, appRoot) {
  const source = fs.readFileSync(from, 'utf8');
  let out = source;
  try {
    const stamped = liquid.stamp(source, from, appRoot);
    if (stamped) out = stamped.code;
  } catch (err) {
    console.warn(`[retouch] stamping skipped for ${from}: ${err.message}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, out, 'utf8');
}

function watchAndRestamp(themeDir, stampedDir) {
  const pending = new Map();
  let watcher;
  try {
    watcher = fs.watch(themeDir, { recursive: true }, (_evt, rel) => {
      if (!rel || rel.split(path.sep).some((p) => SKIP_DIRS.has(p)) ||
          path.basename(rel) === 'shopify.theme.toml') return;
      clearTimeout(pending.get(rel));
      pending.set(rel, setTimeout(() => {
        pending.delete(rel);
        const from = path.join(themeDir, rel);
        const to = path.join(stampedDir, rel);
        try {
          const stat = fs.lstatSync(from);
          if (stat.isSymbolicLink()) return;
          if (stat.isDirectory()) syncStamp(from, to, themeDir);
          else if (rel.endsWith('.liquid')) stampFileTo(from, to, themeDir);
          else {
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.copyFileSync(from, to);
          }
        } catch (err) {
          if (err.code === 'ENOENT') fs.rmSync(to, { recursive: true, force: true });
          else console.warn(`[retouch] theme sync failed for ${rel}: ${err.message}`);
        }
      }, 80));
    });
  } catch (err) {
    console.warn(`[retouch] theme watching unavailable: ${err.message}`);
  }
  return () => {
    if (watcher) watcher.close();
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  };
}

// CLI environment/config must not override the isolated copy or select a theme.
function themeDevEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    !key.startsWith('SHOPIFY_FLAG_') ||
    ['SHOPIFY_FLAG_STORE', 'SHOPIFY_FLAG_AUTH_ALIAS', 'SHOPIFY_FLAG_STORE_PASSWORD'].includes(key)));
}

function launchThemeDev(stampedDir, themePort, extraArgs) {
  const shopify = whichShopify();
  if (!shopify) {
    console.warn('[retouch] the Shopify CLI was not found. Install it, then either re-run, or');
    console.warn(`[retouch] start it yourself:  shopify theme dev --path "${stampedDir}" --port ${themePort}`);
    return null;
  }
  const args = ['theme', 'dev', '--path', stampedDir, '--port', String(themePort), ...extraArgs];
  console.log(`[retouch] launching an isolated development theme:  shopify ${args.join(' ')}`);
  const child = spawn(shopify, args, { stdio: 'inherit', cwd: stampedDir, env: themeDevEnv() });
  child.on('exit', (code) => console.log(`[retouch] shopify theme dev exited (${code})`));
  return child;
}

function whichShopify() {
  for (const bin of ['shopify']) {
    const r = spawnSync(bin, ['version'], { stdio: 'ignore' });
    if (r.status === 0) return bin;
  }
  return null;
}

module.exports = { start, syncStamp, stampFileTo, assertSafe, watchAndRestamp, themeDevEnv };
