'use strict';
// Opt-in browser end-to-end suite. Slow (real browser + real dev server), so
// it is NOT part of `npm test`; run it deliberately with `npm run test:e2e`.
//
// It drives the actual editor shell in a headless browser against a running
// dev server, then asserts the resulting source on disk. It needs:
//   1. a Retouch-instrumented dev server running (default http://localhost:3400,
//      override with RT_E2E_URL), serving a page with a rich <h1> at
//      /rt-test (the fixture this repo's dogfood clone carries), and
//   2. Playwright resolvable (from this package, the parent repo, or global).
//
// Each assertion checks a real interaction end to end: gesture -> op -> write.

const path = require('node:path');

function loadPlaywright() {
  const tries = [
    'playwright',
    path.join(process.cwd(), 'node_modules/playwright'),
    '/Users/philipshen/Developer/unplastic/backbone/node_modules/playwright',
  ];
  for (const t of tries) {
    try { return require(t); } catch {}
  }
  console.error('[e2e] Playwright not found. Install it (npm i -D playwright) or run from a repo that has it.');
  process.exit(2);
}

const URL = process.env.RT_E2E_URL || 'http://localhost:3400';
let passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); failed++; }
}

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL + '/rt/rt-test', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const frame = () => page.frames().find((f) => f.url().includes('/rt-test') && !f.url().includes('/rt/'));

  await check('shell loads with the app framed and serialize module present', async () => {
    const ok = await page.evaluate(() => typeof window.RetouchSerialize === 'object' && !!document.getElementById('app'));
    if (!ok) throw new Error('shell not ready');
  });

  await check('clicking rich text enters in-place editing', async () => {
    const editable = await page.evaluate(() => new Promise((res) => {
      const d = document.getElementById('app').contentDocument;
      const h1 = d.querySelector('h1');
      h1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(() => res(h1.getAttribute('contenteditable')), 400);
    }));
    if (editable !== 'plaintext-only') throw new Error('not editable: ' + editable);
    await page.keyboard.press('Escape');
  });

  await check('bold-on-selection writes a <strong> wrap to source', async () => {
    await page.evaluate(() => new Promise((res) => {
      const d = document.getElementById('app').contentDocument;
      const h1 = d.querySelector('h1');
      h1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(() => {
        const tn = [...h1.childNodes].find((n) => n.nodeType === 3 && /start/.test(n.textContent));
        const i = tn.textContent.indexOf('start');
        const r = d.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 5);
        const s = d.getSelection(); s.removeAllRanges(); s.addRange(r);
        h1.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true, cancelable: true }));
        h1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        setTimeout(res, 2500);
      }, 400);
    }));
    const src = await fetchSource(page);
    if (!/<strong>start<\/strong>/.test(src)) throw new Error('no <strong> in source');
  });

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

async function fetchSource(page) {
  return page.evaluate(async () => {
    const shell = await (await fetch('/rt')).text();
    return shell; // placeholder; real assertions read disk in CI — see README
  }).then(() => require('node:fs').readFileSync(
    '/Users/philipshen/Developer/retouch/unplastic-backbone/apps/website/src/app/rt-test/page.tsx', 'utf8'
  ));
}
