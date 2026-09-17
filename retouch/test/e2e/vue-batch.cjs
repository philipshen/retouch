'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
exports.run = async ({ page, app, live, file, source }) => {
  const settled = () => page.waitForFunction(() => !undoBusy && !sourceRequests && !panelTasks);
  const read = () => fs.readFileSync(file, 'utf8');
  const wait = async predicate => { for (let i = 0; i < 160; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw Error('Vue batch assertion did not settle'); };
  const row = name => page.getByRole('treeitem', { name: 'div · Batch ' + name, exact: true });
  const nodes = (frame, name) => frame.locator('[aria-label="Batch ' + name + '"]');
  const select = async () => { await row('A').first().click(); await row('B').first().click({ modifiers: ['Meta'] }); await settled(); };
  const action = async name => { const button = page.locator('[data-design-action=' + name + ']'); if (!await button.isVisible()) await page.getByText('Layer actions', { exact: true }).click(); await button.click(); await settled(); };
  const undo = async () => { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settled(); };
  await page.getByRole('button', { name: 'Lock div · Keep', exact: true }).click();
  for (const [name, value] of [['A', '11px'], ['B', '22px']]) {
    await row(name).click(); await settled(); const field = page.getByLabel('Padding (CSS)', { exact: true }); await field.fill(value); await field.press('Tab'); await settled();
  }
  const styled = read(); await select(); await action('duplicateElement');
  const duplicated = read(); assert.notEqual(duplicated, styled);
  await wait(async () => await nodes(app, 'A').count() === 2 && await nodes(app, 'B').count() === 2 && await nodes(live, 'A').count() === 2 && await nodes(live, 'B').count() === 2);
  assert.equal(await page.getByRole('treeitem', { selected: true }).count(), 2);
  for (const [name, expected] of [['A', '11px'], ['B', '22px']]) {
    assert.deepEqual(await nodes(app, name).evaluateAll(elements => elements.map(element => getComputedStyle(element).paddingTop)), [expected, expected]);
    assert.equal(new Set(await nodes(app, name).evaluateAll(elements => elements.map(element => element.getAttribute('data-rt-style')))).size, 2);
  }
  const font = page.getByLabel('Shared Font size', { exact: true }); await font.fill('30px'); await font.press('Tab'); await settled();
  for (const name of ['A', 'B']) {
    assert.equal(await nodes(app, name).last().evaluate(element => getComputedStyle(element).fontSize), '30px');
    assert.notEqual(await nodes(app, name).first().evaluate(element => getComputedStyle(element).fontSize), '30px');
  }
  const changedCopies = read(); await action('deleteElement');
  await wait(async () => await nodes(app, 'A').count() === 1 && await nodes(app, 'B').count() === 1);
  assert.equal(read(), styled);
  await undo(); assert.equal(read(), changedCopies);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settled(); assert.equal(read(), styled);
  await undo(); await undo(); assert.equal(read(), duplicated);
  await undo(); assert.equal(read(), styled);
  await undo(); await undo(); assert.equal(read(), source);
  await select(); await action('deleteElement');
  await wait(async () => await nodes(app, 'A').count() === 0 && await nodes(app, 'B').count() === 0);
  await page.getByRole('button', { name: 'Unlock div · Keep', exact: true }).waitFor();
  await undo(); assert.equal(read(), source);
  await page.getByRole('button', { name: 'Unlock div · Keep', exact: true }).waitFor();
  assert.equal(await app.locator('h1').evaluate(element => element.ownerDocument.defaultView.__viteDocument === element.ownerDocument), true);
  assert.equal(await live.evaluate(() => window.__viteDocument === document), true);
  await app.getByRole('button', { name: 'Count 2', exact: true }).waitFor(); await live.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Unlock div · Keep', exact: true }).click();
  await page.getByRole('treeitem', { name: 'h1 · Hello Vite', exact: true }).click(); await settled();
  console.log('VUE BATCH DUPLICATE/DELETE, INDEPENDENT STYLES, SELECTION AND EXACT HISTORY PASS');
};
