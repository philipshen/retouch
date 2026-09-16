'use strict';
// Real installed-package path: Retouch CLI -> npm script -> Vite config import.
// Requires disposable dependency fixtures; never changes their source files.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {setTimeout: delay} = require('node:timers/promises');
const fixture = process.env.RT_VITE_FIXTURE;
const browserFixture = process.env.RT_INSPECTOR_FIXTURE;
const packageRoot = process.env.RT_PACKAGE_ROOT;
const base = process.env.RT_VITE_BASE || '/';
const healthURL = editor => new URL('/rt/__api/health', editor);
if (!fixture || !browserFixture || !packageRoot) throw Error('Set RT_VITE_FIXTURE, RT_INSPECTOR_FIXTURE, and RT_PACKAGE_ROOT to an installed package');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-vite-launch-'));
const cli = path.join(packageRoot, 'bin/retouch.cjs');
let child, exited, logs = '', browser;
async function stop() {
  if (!child) return;
  const active = child;
  if (active.exitCode === null && active.signalCode === null) active.kill('SIGTERM');
  await Promise.race([exited, delay(15000, null, {ref: false}).then(() => { throw Error('Retouch launch process did not stop\n' + logs); })]);
  child = null;
  assert.doesNotMatch(logs, /No supported app has connected|Command exited without connecting/, 'A working Vite editor must be recognized by the wrapper');
}
async function start() {
  logs = '';
  child = spawn(process.execPath, [cli, '--', 'npm', 'run', 'dev'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, NO_COLOR: '1'},
  });
  exited = once(child, 'exit');
  child.stdout.on('data', b => { logs += b; });
  child.stderr.on('data', b => { logs += b; });
  for (let n = 0; n < 150; n++) {
    if (child.exitCode !== null || child.signalCode !== null) throw Error('Startup exited\n' + logs);
    const editor = logs.match(/\[retouch\] Open (http:\/\/localhost:\d+\/rt(?:\/[^\s]*)?)/)?.[1];
    if (editor) {
      const health = await fetch(healthURL(editor), {signal: AbortSignal.timeout(2000)}).catch(() => null);
      if (health?.ok && (await health.json()).service === 'retouch') return editor;
    }
    await delay(100);
  }
  throw Error('No healthy editor was announced\n' + logs);
}
(async () => {
  try {
    const modules = path.join(root, 'node_modules');
    fs.mkdirSync(modules);
    for (const name of fs.readdirSync(path.join(fixture, 'node_modules'))) {
      if (name.startsWith('.') || name === 'retouch') continue;
      fs.symlinkSync(path.join(fixture, 'node_modules', name), path.join(modules, name));
    }
    fs.symlinkSync(fs.realpathSync(packageRoot), path.join(modules, 'retouch'));
    fs.mkdirSync(path.join(modules, '.bin'));
    fs.symlinkSync(path.join(fixture, 'node_modules/vite/bin/vite.js'), path.join(modules, '.bin/vite'));
    const manifest = JSON.stringify({type: 'module', scripts: {dev: 'vite --host 127.0.0.1 --port 0'}});
    const config = "import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import {retouch} from 'retouch/vite';export default defineConfig({base:"+JSON.stringify(base)+",plugins:[retouch(),react()]});\n";
    fs.writeFileSync(path.join(root, 'package.json'), manifest);
    fs.writeFileSync(path.join(root, 'vite.config.ts'), config);
    fs.writeFileSync(path.join(root, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>');
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/main.tsx'), "import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';createRoot(document.getElementById('root')!).render(<App/>);");
    const file = path.join(root, 'src/App.tsx');
    const source = "import React,{useState} from 'react';export default function App(){const [count,setCount]=useState<number>(0);return <main><h1>Installed Vite</h1><button onClick={()=>setCount(count+1)}>Count {count}</button></main>}";
    fs.writeFileSync(file, source);
    const playwright = require(path.join(browserFixture, 'node_modules/playwright'));
    const engine = process.env.RT_E2E_BROWSER || 'chromium';
    let editor = await start();
    browser = await playwright[engine].launch();
    let page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(editor);
    let app = page.frameLocator('#app');
    await app.locator('h1').waitFor();
    assert.match(await app.locator('h1').getAttribute('data-rt'), /^[a-f0-9]{10}$/);
    const live = await browser.newPage();
    await live.goto(new URL(base, editor).href);
    await live.getByRole('button', {name: 'Count 0'}).click();
    await live.evaluate(() => window.__originalDocument = document);
    await app.locator('h1').click();
    await page.waitForFunction(() => document.querySelector('#app').contentDocument.querySelector('h1').isContentEditable);
    await app.locator('h1').fill('Saved across startup');
    await app.locator('h1').press('Control+Enter');
    await live.getByRole('heading', {name: 'Saved across startup'}).waitFor();
    assert.match(fs.readFileSync(file, 'utf8'), /Saved across startup/);
    await live.getByRole('button', {name: 'Count 1'}).waitFor();
    assert.equal(await live.evaluate(() => window.__originalDocument === document), true);
    assert.deepEqual(errors, []);
    if (process.env.RT_VITE_CONFIG_RESTART) {
      const oldToken = await page.evaluate(() => window.__RT_TOKEN);
      const announcements = (logs.match(/\[retouch\] Open /g) || []).length;
      fs.writeFileSync(path.join(root, 'vite.config.ts'), config + '// trigger a normal Vite configuration restart\n');
      for (let n = 0; n < 150 && (logs.match(/\[retouch\] Open /g) || []).length === announcements; n++) await delay(100);
      assert.ok((logs.match(/\[retouch\] Open /g) || []).length > announcements, 'Vite did not restart after its configuration changed');
      await page.waitForFunction(token => typeof window.__RT_TOKEN === 'string' && window.__RT_TOKEN !== token, oldToken);
      await app.getByRole('heading', {name: 'Saved across startup'}).waitFor();
      await page.getByRole('button', {name: 'Undo', exact: true}).click();
      await app.getByRole('heading', {name: 'Installed Vite', exact: true}).waitFor();
      assert.equal(fs.readFileSync(file, 'utf8'), source);
      await page.getByRole('button', {name: 'Redo', exact: true}).click();
      await app.getByRole('heading', {name: 'Saved across startup'}).waitFor();
    }
    await browser.close(); browser = null;
    await stop();
    await assert.rejects(fetch(healthURL(editor), {signal: AbortSignal.timeout(1000)}));
    if (process.env.RT_VITE_CONFIG_RESTART) fs.writeFileSync(path.join(root, 'vite.config.ts'), config);
    editor = await start();
    browser = await playwright[engine].launch();
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(editor);
    app = page.frameLocator('#app');
    await app.getByRole('heading', {name: 'Saved across startup'}).waitFor();
    await page.getByRole('button', {name: 'Undo', exact: true}).click();
    await app.getByRole('heading', {name: 'Installed Vite', exact: true}).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.layer-item')].some(el => el.textContent.includes('Installed Vite')) && ![...document.querySelectorAll('.layer-item')].some(el => el.textContent.includes('Saved across startup')));
    assert.equal(fs.readFileSync(file, 'utf8'), source);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), manifest);
    assert.equal(fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8'), config);
    assert.deepEqual(errors, []);
    await page.screenshot({path: '/tmp/retouch-vite-launch-' + engine + '.png', caret: 'initial'});
    await browser.close(); browser = null;
    await stop();
    await assert.rejects(fetch(healthURL(editor), {signal: AbortSignal.timeout(1000)}));
    if (process.env.RT_VITE_CONFIG_RESTART) console.log('PASS automatic editor session recovery, source undo and redo after Vite configuration restart:', engine);
    console.log('PASS installed Vite config, TSX edit, HMR state, restart source undo, unchanged config, and process shutdown:', engine);
  } catch (error) { console.error(logs); throw error; }
  finally { await browser?.close(); await stop(); fs.rmSync(root, {recursive: true, force: true}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
