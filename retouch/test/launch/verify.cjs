'use strict';
// Opt-in against a disposable, already-installed Next 16.2.5 fixture.
// RT_LAUNCH_FIXTURE and RT_PLAYWRIGHT_PATH are required; no app is modified
// outside the fixture. The package under test may live anywhere on disk.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require(process.env.RT_PLAYWRIGHT_PATH || 'playwright');
const root = fs.realpathSync(process.env.RT_LAUNCH_FIXTURE);
const cli = process.env.RT_RETOUCH_CLI || path.resolve(__dirname, '../../bin/retouch.cjs');
const source = path.join(root, 'app/page.jsx');
const original = fs.readFileSync(source, 'utf8');
const config = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const lock = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  for (const [i, bundler] of ['--turbopack', '--webpack'].entries()) {
    const port = 3488 + i;
    const url = `http://localhost:${port}`;
    // Exercise shell -> npm -> Next CLI -> dev worker inheritance.
    const child = spawn(process.execPath, [cli, '--', 'sh', '-c', 'exec npm run dev -- "$@"', 'sh', bundler, '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const exit = once(child, 'exit');
    let logs = '';
    child.stdout.on('data', b => { logs += b; });
    child.stderr.on('data', b => { logs += b; });
    let browser;
    try {
      let response;
      for (let n = 0; n < 120; n++) {
        if (child.exitCode !== null) throw new Error(logs);
        try { response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) break; } catch {}
        await sleep(250);
      }
      assert.equal(response?.status, 200, logs);
      assert.equal(response.headers.get('x-fixture'), 'preserved');
      assert.match(await response.text(), /data-rt="[0-9a-f]{10}"/);
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.goto(url + '/rt');
      const frame = page.frameLocator('#app');
      await frame.locator('h1').waitFor();
      // Use the real editor gesture, then commit the contenteditable text.
      await frame.locator('h1').click();
      await page.waitForFunction(() => document.querySelector('#app').contentDocument.querySelector('h1').isContentEditable);
      await frame.locator('h1').fill('Edited through launcher');
      await frame.locator('h1').press('Enter');
      for (let n = 0; n < 100 && !fs.readFileSync(source, 'utf8').includes('Edited through launcher'); n++) await sleep(100);
      assert.match(fs.readFileSync(source, 'utf8'), /Edited through launcher/);
      // External source change must arrive through the dev server's HMR path.
      const appPage = await browser.newPage();
      await appPage.goto(url);
      fs.writeFileSync(source, original.replace('Hello Retouch', 'External refresh'));
      await appPage.getByRole('heading', { name: 'External refresh', exact: true }).waitFor({ timeout: 15000 });
      assert.deepEqual(errors, []);
      assert.equal(fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8'), config);
      assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), manifest);
      assert.equal(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'), lock);
      console.log(`PASS ${bundler}: shell startup, stamping, original config, editor write-back, HMR, unchanged manifests/config`);
    } catch (err) { console.error(logs); throw err; }
    finally {
      if (browser) await browser.close();
      child.kill('SIGTERM');
      await exit;
      fs.writeFileSync(source, original);
    }
    await assert.rejects(fetch(url, { signal: AbortSignal.timeout(1000) }));
    console.log(`PASS ${bundler}: process tree stopped`);
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
