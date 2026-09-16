'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
exports.run = async ({ page, app, live, file, source }) => {
  const settled = () => page.waitForFunction(() => !undoBusy && !sourceRequests && !panelTasks);
  const order = frame => frame.locator('#order > div').allTextContents();
  const waitOrder = async expected => {
    for (let i = 0; i < 160; i++) {
      if (JSON.stringify(await order(app)) === JSON.stringify(expected) && JSON.stringify(await order(live)) === JSON.stringify(expected)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Vue ordering did not settle: ' + JSON.stringify(await order(app)));
  };
  await page.getByRole('button', { name: 'Lock div · Second', exact: true }).click();
  await page.getByRole('treeitem', { name: 'div · First', exact: true }).click(); await settled();
  const padding = page.getByLabel('Padding (CSS)', { exact: true });
  await padding.fill('13px'); await padding.press('Tab'); await settled();
  const styled = fs.readFileSync(file, 'utf8');
  const first = app.locator('#order > div').filter({ hasText: 'First' });
  const originalId = await first.getAttribute('data-rt');
  await page.getByText('Layer actions', { exact: true }).click();
  await page.locator('[data-design-action=last]').click(); await settled(); await waitOrder(['Second', 'Third', 'First']);
  await page.getByRole('button', { name: 'Unlock div · Second', exact: true }).waitFor();
  assert.notEqual(await first.getAttribute('data-rt'), originalId);
  assert.equal(await first.evaluate(element => getComputedStyle(element).paddingTop), '13px');
  const moved = fs.readFileSync(file, 'utf8');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settled(); await waitOrder(['First', 'Second', 'Third']);
  assert.equal(fs.readFileSync(file, 'utf8'), styled);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settled(); await waitOrder(['Second', 'Third', 'First']);
  assert.equal(fs.readFileSync(file, 'utf8'), moved);
  await page.locator('[data-design-action=before]').click(); await settled(); await waitOrder(['Second', 'First', 'Third']);
  await page.locator('[data-design-action=first]').click(); await settled(); await waitOrder(['First', 'Second', 'Third']);
  await page.locator('[data-design-action=after]').click(); await settled(); await waitOrder(['Second', 'First', 'Third']);
  for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settled(); }
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  await waitOrder(['First', 'Second', 'Third']);
  assert.equal(await app.locator('h1').evaluate(element => element.ownerDocument.defaultView.__viteDocument === element.ownerDocument), true);
  assert.equal(await live.evaluate(() => window.__viteDocument === document), true);
  await app.getByRole('button', { name: 'Count 2', exact: true }).waitFor();
  await live.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Unlock div · Second', exact: true }).click();
  await page.getByRole('treeitem', { name: 'h1 · Hello Vite', exact: true }).click(); await settled();
  console.log('VUE LAYER ORDER, STYLE OWNERSHIP, EXACT HISTORY AND HMR STATE PASS');
};
