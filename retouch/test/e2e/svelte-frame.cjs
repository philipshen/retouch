'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
exports.run = async ({ page, app, phone:live, file, original:source, state }) => {
  const settled = () => page.waitForFunction(() => !undoBusy && !sourceRequests && !panelTasks);
  const read = () => fs.readFileSync(file, 'utf8');
  const row = name => page.getByRole('treeitem', { name, exact: true });
  const undo = async () => { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settled(); };
  const action = async name => { const button = page.locator('[data-design-action='+name+']'); if (!await button.isVisible()) await page.getByText('Layer actions', { exact: true }).click(); await button.click(); await settled(); };
  await page.getByRole('button', { name: 'Lock div · Third', exact: true }).click();
  await row('div · First').click(); await row('div · Second').click({ modifiers: ['Meta'] }); await settled();
  const font = page.getByLabel('Shared Font size', { exact: true }); await font.fill('26px'); await font.press('Tab'); await settled();
  const styled = read();
  const rectangles = () => app.locator('#order > div').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  const geometry = await rectangles();
  for (const type of ['frameSelection', 'groupSelection']) {
    await action(type); const framed = read();
    await app.locator('#order > [data-rt-frame]').waitFor(); await live.locator('#order > [data-rt-frame]').waitFor();
    assert.equal(await app.locator('[data-rt-frame] > div').count(), 2);
    assert.equal(await page.getByRole('treeitem', { selected: true }).count(), 1);
    if (type === 'groupSelection') {
      assert.equal(await app.locator('[data-rt-group]').evaluate(el => getComputedStyle(el).display), 'contents');
      assert.deepEqual(await app.locator('#order > [data-rt-group] > div, #order > div:not([data-rt-group])').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })), geometry);
    }
    await state(); await page.screenshot({path:'/tmp/retouch-svelte-frame-'+type+'-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
    const padding = page.getByLabel('Padding (CSS)', { exact: true }); await padding.fill('21px'); await padding.press('Tab'); await settled();
    const styledFrame = read();
    await action('removeFrame');
    assert.equal(read(), styled); assert.equal(await app.locator('[data-rt-frame]').count(), 0);
    assert.deepEqual(await page.getByRole('treeitem', { selected: true }).allTextContents(), ['div · First', 'div · Second']);
    assert.equal(await app.locator('#order > div').first().evaluate(el => getComputedStyle(el).fontSize), '26px');
    await page.getByRole('button', { name: 'Unlock div · Third', exact: true }).waitFor();
    await undo(); assert.equal(read(), styledFrame);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settled(); assert.equal(read(), styled);
    await undo(); await undo(); assert.equal(read(), framed); await undo(); assert.equal(read(), styled);
  }
  await undo(); assert.equal(read(), source);
  await state();
  await page.getByRole('button', { name: 'Unlock div · Third', exact: true }).click(); await row('h1 · Hello Svelte').click(); await settled();
  console.log('SVELTE FRAME/GROUP, GROUP LAYOUT, STYLE CLEANUP, LOCKS AND EXACT HISTORY PASS');
};
