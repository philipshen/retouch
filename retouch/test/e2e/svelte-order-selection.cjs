'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
exports.run = async ({ page, app, phone:live, file, original:source, state }) => {
  const settled = () => page.waitForFunction(() => !undoBusy && !sourceRequests && !panelTasks);
  const read = () => fs.readFileSync(file, 'utf8');
  const wait = async predicate => { for (let i = 0; i < 160; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw Error('Svelte selection ordering did not settle'); };
  const row = name => page.getByRole('treeitem', { name: 'div · Order ' + name, exact: true });
  const undo = async () => { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settled(); };
  const order = frame => frame.locator('#order-many > div').allTextContents();
  await page.getByRole('button', { name: 'Lock div · Order C', exact: true }).click();
  await row('B').click(); await row('D').click({ modifiers: ['Meta'] }); await settled();
  const font = page.getByLabel('Shared Font size', { exact: true }); await font.fill('26px'); await font.press('Tab'); await settled();
  const styled = read();
  for (const [direction, names] of Object.entries({ before: ['B', 'A', 'D', 'C', 'E'], after: ['A', 'C', 'B', 'E', 'D'], first: ['B', 'D', 'A', 'C', 'E'], last: ['A', 'C', 'E', 'B', 'D'] })) {
    const button = page.locator('[data-design-action=' + direction + ']');
    if (!await button.isVisible()) await page.getByText('Layer actions', { exact: true }).click();
    if(direction==='before'){await row('B').focus();await page.keyboard.press('Meta+[');}else await button.click(); await settled();
    const expected = names.map(name => 'Order ' + name);
    await wait(async () => JSON.stringify(await order(app)) === JSON.stringify(expected) && JSON.stringify(await order(live)) === JSON.stringify(expected));
    assert.deepEqual(await page.getByRole('treeitem', { selected: true }).allTextContents(), ['div · Order B', 'div · Order D']);
    for (const name of ['B', 'D']) assert.equal(await app.locator('#order-many > div').filter({ hasText: 'Order ' + name }).evaluate(element => getComputedStyle(element).fontSize), '26px');
    await page.getByRole('button', { name: 'Unlock div · Order C', exact: true }).waitFor();
    const changed = read(); await undo(); assert.equal(read(), styled);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settled(); assert.equal(read(), changed);
    await undo(); assert.equal(read(), styled);
  }
  await undo(); assert.equal(read(), source);
  assert.deepEqual(await order(app), ['Order A', 'Order B', 'Order C', 'Order D', 'Order E']);
  await state();
  await page.getByRole('button', { name: 'Unlock div · Order C', exact: true }).click();
  await page.getByRole('treeitem', { name: 'h1 · Hello Svelte', exact: true }).click(); await settled();
  console.log('SVELTE MULTI-LAYER ORDERING, RELATIVE ORDER, STYLES/LOCKS AND EXACT HISTORY PASS');
};
