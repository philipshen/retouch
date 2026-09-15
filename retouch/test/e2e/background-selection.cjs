'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const first=app.locator('h1'),second=app.locator('p').first(),color=page.locator('#panelBody input[data-paint-property="background-color"]'),state=target=>target.evaluate(el=>parent.RetouchBackgroundPaintUI.read({},el)),rendered=target=>target.evaluate(el=>parent.RetouchPaintPicker.parsePaint(getComputedStyle(el).backgroundColor));
 const change=async action=>{const before=read();await action();await wait(()=>read()!==before);await settled();};
 await change(async()=>{await color.fill('#33669980');await color.press('Enter');});await change(()=>page.getByRole('button',{name:'Hide background color',exact:true}).click());
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click();await settled();await change(async()=>{await color.fill('#abcdef80');await color.press('Enter');});
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();
 assert.equal(await color.inputValue(),'');assert.deepEqual(await color.evaluate(el=>el.retouchSelectionColors()),['#33669980','#abcdef80']);
 const before=read();await color.locator('..').locator('.gradient-stop-swatch').click();let picker=page.locator('dialog.paint-picker[open]');await picker.getByLabel('Color value',{exact:true}).fill('#ff000080');assert.equal((await rendered(first)).alpha,0);assert.ok((await rendered(second)).alpha>.49);assert.equal(read(),before);await picker.getByLabel('Color value',{exact:true}).fill('red');assert.equal((await rendered(first)).alpha,0);assert.deepEqual((await rendered(second)).channels,[1,0,0]);assert.equal(read(),before);await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal((await state(first)).color,'#33669980');assert.equal((await state(second)).color,'#abcdef80');
 await color.locator('..').locator('.gradient-stop-swatch').click();picker=page.locator('dialog.paint-picker[open]');await picker.getByLabel('Color value',{exact:true}).fill('color(display-p3 0.2 0.4 0.6 / 0.375)');await change(()=>picker.getByRole('button',{name:'Apply color',exact:true}).click());const after=read();
 assert.equal((await state(first)).hidden,true);assert.equal((await state(second)).hidden,false);assert.equal((await state(first)).color,'color(display-p3 0.2 0.4 0.6 / 0.375)');assert.equal((await state(second)).color,'color(display-p3 0.2 0.4 0.6 / 0.375)');assert.equal((await rendered(first)).alpha,0);assert.equal((await rendered(second)).alpha,.375);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before);await settled();assert.equal((await state(first)).color,'#33669980');assert.equal((await state(second)).color,'#abcdef80');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===after);await settled();assert.equal((await state(first)).hidden,true);assert.equal((await state(second)).hidden,false);
 console.log(kind+': PASS mixed hidden/visible selection colors, picker preview/cancel/apply, P3 and atomic undo/redo');
};
