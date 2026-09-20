'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
exports.run = async ({ page, app, phone:live, file, original:source, state }) => {
  const settled = () => page.waitForFunction(() => !undoBusy && !sourceRequests && !panelTasks);
  const order = frame => frame.locator('#order > div').allTextContents();
  const waitOrder = async expected => {
    for (let i = 0; i < 160; i++) {
      if (JSON.stringify(await order(app)) === JSON.stringify(expected) && JSON.stringify(await order(live)) === JSON.stringify(expected)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Svelte ordering did not settle: ' + JSON.stringify(await order(app)));
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
  await state();
  await page.getByRole('button', { name: 'Unlock div · Second', exact: true }).click();
  await page.getByRole('treeitem',{name:'div · First',exact:true}).click();await settled();await padding.fill('13px');await padding.press('Tab');await settled();const styledCopy=fs.readFileSync(file,'utf8');
  const action=async name=>{await page.locator('[data-design-action='+name+']').click();await settled();await state();};
  const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await state();};
  await action('duplicateElement');await waitOrder(['First','First','Second','Third']);const duplicated=fs.readFileSync(file,'utf8');
  await padding.fill('17px');await padding.press('Tab');await settled();assert.equal(await app.locator('#order > div').nth(0).evaluate(el=>getComputedStyle(el).paddingTop),'13px');assert.equal(await app.locator('#order > div').nth(1).evaluate(el=>getComputedStyle(el).paddingTop),'17px');
  await undo();assert.equal(fs.readFileSync(file,'utf8'),duplicated);await action('deleteElement');await waitOrder(['First','Second','Third']);assert.equal(fs.readFileSync(file,'utf8'),styledCopy);
  await undo();assert.equal(fs.readFileSync(file,'utf8'),duplicated);await undo();assert.equal(fs.readFileSync(file,'utf8'),styledCopy);
  await page.getByRole('treeitem',{name:'div · First',exact:true}).click();await settled();await action('copyElement');await page.getByRole('treeitem',{name:'div · Third',exact:true}).click();await settled();await action('pasteElement');await waitOrder(['First','Second','Third','First']);assert.equal(await app.locator('#order > div').last().evaluate(el=>getComputedStyle(el).paddingTop),'13px');
  await page.screenshot({path:'/tmp/retouch-svelte-structure-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});await undo();assert.equal(fs.readFileSync(file,'utf8'),styledCopy);await undo();assert.equal(fs.readFileSync(file,'utf8'),source);await waitOrder(['First','Second','Third']);
  await page.getByRole('treeitem', { name: 'h1 · Hello Svelte', exact: true }).click(); await settled();
  console.log('SVELTE LAYER ORDER, DUPLICATE, PASTE, DELETE, STYLE OWNERSHIP, EXACT HISTORY AND HMR STATE PASS');
};
