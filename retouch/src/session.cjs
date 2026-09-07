'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

async function startSession({ root = process.cwd() } = {}) {
  root = fs.realpathSync(root);
  const secret = crypto.randomBytes(32).toString('hex');
  const apps = new Map();
  let closed = false;
  const broker = http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.headers.authorization !== `Bearer ${secret}` || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) return reply(403, { error: 'forbidden' });
    if (req.method !== 'POST' || req.url !== '/register') return reply(404, { error: 'not found' });
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) return reply(413, { error: 'request too large' });
      }
      const input = JSON.parse(body);
      const appRoot = fs.realpathSync(input.root);
      const relative = path.relative(root, appRoot);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('application is outside the session root');
      if (closed) throw new Error('session is closing');
      if (!apps.has(appRoot)) {
        const pending = (async () => {
          const server = require('./server.cjs').startServer({ appRoot, port: 0, quiet: true });
          try { await once(server, 'listening'); }
          catch (err) { server.retouchIndex.close(); throw err; }
          console.log(`[retouch] connected ${appRoot}; open /rt on this app's dev URL`);
          return server;
        })();
        apps.set(appRoot, pending);
        pending.catch(() => apps.delete(appRoot));
      }
      const server = await apps.get(appRoot);
      reply(200, { port: server.address().port, root: appRoot });
    } catch (err) { reply(400, { error: err.message }); }
  });
  broker.listen(0, '127.0.0.1');
  await once(broker, 'listening');
  return {
    apps,
    env: { RETOUCH_SESSION_URL: `http://127.0.0.1:${broker.address().port}`, RETOUCH_SESSION_SECRET: secret },
    async close() {
      closed = true;
      broker.closeAllConnections();
      await new Promise(resolve => broker.close(resolve));
      for (const pending of apps.values()) {
        try {
          const server = await pending;
          server.retouchIndex.close();
          server.closeAllConnections();
          await new Promise(resolve => server.close(resolve));
        } catch {}
      }
    },
  };
}

function childEnvironment(sessionEnv, env = process.env) {
  // Node parses double-quoted NODE_OPTIONS paths, including spaces. Keep any
  // caller-supplied options and scope our preload to the launched process tree.
  const preload = require.resolve('./preload.cjs');
  if (/["\n\r]/.test(preload)) throw new Error('Retouch install path contains an unsupported quote or newline');
  return { ...env, ...sessionEnv, NODE_OPTIONS: `${env.NODE_OPTIONS || ''} --require "${preload}"`.trim() };
}

async function run(command, args, { root = process.cwd() } = {}) {
  if (!command) throw new Error('Usage: retouch -- <command> [args...]');
  if (process.env.RETOUCH_SESSION_URL) throw new Error('Already inside a Retouch session; do not nest wrappers');
  if (process.platform === 'win32') throw new Error('Command wrapping currently supports macOS and Linux');
  childEnvironment({}); // Validate the preload path before opening listeners.
  const session = await startSession({ root });
  const child = spawn(command, args, { cwd: root, env: childEnvironment(session.env), stdio: 'inherit', detached: true });
  let escalation;
  let signalReceived;
  const killGroup = signal => { if (child.pid) { try { process.kill(-child.pid, signal); } catch (err) { if (err.code !== 'ESRCH') throw err; } } };
  const stop = signal => {
    signalReceived = signal;
    killGroup(signal);
    if (!escalation) escalation = setTimeout(() => killGroup('SIGKILL'), 3000);
  };
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const notice = setTimeout(() => {
    if (!session.apps.size) console.warn('[retouch] No supported app has connected yet. Startup continues. Environment must reach the Node build process; Docker, sudo, remote commands and environment filters need explicit integration.');
  }, 10000);
  notice.unref();
  try {
    const [code, signal] = await once(child, 'exit');
    return code ?? (128 + (require('node:os').constants.signals[signal || signalReceived] || 1));
  } finally {
    clearTimeout(notice);
    clearTimeout(escalation);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    // The orchestrator may exit while its descendants still own listeners.
    killGroup('SIGTERM');
    await session.close();
    const reap = setTimeout(() => killGroup('SIGKILL'), 500);
    await new Promise(resolve => setTimeout(resolve, 510));
    clearTimeout(reap);
    if (!session.apps.size) console.warn('[retouch] Command exited without connecting a supported app.');
  }
}
module.exports = { startSession, childEnvironment, run };
