'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { startSession, childEnvironment } = require('../src/session.cjs');
const cli = path.resolve(__dirname, '../bin/retouch.cjs');

test('session authenticates, contains roots, deduplicates workers and isolates apps', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-session-'));
  for (const name of ['one', 'two']) {
    fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, name, 'page.jsx'), `export default () => <p>${name}</p>`);
  }
  const session = await startSession({ root });
  const post = (app, secret = session.env.RETOUCH_SESSION_SECRET) => fetch(session.env.RETOUCH_SESSION_URL + '/register', {
    method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify({ root: app }),
  });
  let ports;
  try {
    assert.equal((await post(root, 'wrong')).status, 403);
    assert.equal((await post(os.tmpdir())).status, 400);
    const replies = await Promise.all([post(path.join(root, 'one')), post(path.join(root, 'one')), post(path.join(root, 'two'))]);
    ports = await Promise.all(replies.map(async r => (await r.json()).port));
    assert.equal(ports[0], ports[1]);
    assert.notEqual(ports[0], ports[2]);
    const shells = await Promise.all([ports[0], ports[2]].map(async p => (await fetch(`http://127.0.0.1:${p}/rt`)).text()));
    assert.notEqual(shells[0].match(/__RT_TOKEN = "(.*?)"/)[1], shells[1].match(/__RT_TOKEN = "(.*?)"/)[1]);
  } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  await assert.rejects(fetch(`http://127.0.0.1:${ports[0]}/rt`));
});

test('wrapper preserves argv, working directory, environment and child exit status through a shell', async () => {
  const script = `const a=require('node:assert/strict');a.equal(process.argv[1],'hello world');a.ok(process.env.NODE_OPTIONS.includes('--trace-warnings'));a.ok(process.env.RETOUCH_SESSION_URL);process.exit(23)`;
  const child = spawn(process.execPath, [cli, '--', 'sh', '-c', 'exec "$@"', 'sh', process.execPath, '-e', script, 'hello world'], {
    env: { ...process.env, NODE_OPTIONS: '--trace-warnings' }, stdio: 'pipe',
  });
  const [code] = await once(child, 'exit');
  assert.equal(code, 23);
});

test('failed spawn closes session and exits instead of hanging', async () => {
  const child = spawn(process.execPath, [cli, '--', '/no-such-retouch-command'], { stdio: 'pipe' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
});

test('preload is scoped to children and preserves existing NODE_OPTIONS', () => {
  const env = childEnvironment({ RETOUCH_SESSION_URL: 'test' }, { NODE_OPTIONS: '--trace-warnings', CUSTOM: 'yes' });
  assert.match(env.NODE_OPTIONS, /^--trace-warnings --require ".*preload.cjs"$/);
  assert.equal(env.CUSTOM, 'yes');
});

test('termination reaps descendants even when they ignore SIGTERM', async () => {
  const script = `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log(process.pid);setInterval(()=>{},1000)"],{stdio:'inherit'});setInterval(()=>{},1000)`;
  const child = spawn(process.execPath, [cli, '--', process.execPath, '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let pid;
  try {
    pid = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('grandchild did not start')), 5000);
      child.stdout.once('data', b => { clearTimeout(timeout); resolve(Number(String(b).trim())); });
    });
    assert.ok(pid > 0);
    child.kill('SIGTERM');
    assert.equal((await exited)[0], 143);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    child.kill('SIGKILL');
    if (pid) { try { process.kill(pid, 'SIGKILL'); } catch {} }
  }
});

test('explicit Next session hook registers without automatic interception', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-explicit-'));
  const session = await startSession({ root });
  try {
    const nextModule = path.resolve(__dirname, '../src/next.cjs');
    const script = `require(process.argv[1]).withRetouchSession({}).then(async c=>{require('node:assert/strict').equal((await c.rewrites())[0].source,'/rt')}).catch(e=>{console.error(e);process.exitCode=1})`;
    const child = spawn(process.execPath, ['-e', script, nextModule], { cwd: root, env: { ...process.env, ...session.env, RETOUCH_AUTO_NEXT: '0' }, stdio: 'pipe' });
    assert.equal((await once(child, 'exit'))[0], 0);
    assert.equal(session.apps.size, 1);
  } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('signal termination preserves the conventional shell exit status', async () => {
  const child = spawn(process.execPath, [cli, '--', process.execPath, '-e', "process.kill(process.pid, 'SIGKILL')"], { stdio: 'pipe' });
  assert.equal((await once(child, 'exit'))[0], 137);
});
