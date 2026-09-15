'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const fill=()=>page.locator('#panelBody input[data-paint-property="background-color"]'),stroke=()=>page.locator('#panelBody input[data-paint-property="border-color"]'),first=app.locator('h1'),second=app.locator('p').first(),state=target=>target.evaluate(el=>parent.RetouchBackgroundPaintUI.read({},el)),parse=raw=>page.evaluate(raw=>RetouchPaintPicker.parsePaint(raw),raw);
 const edit=async(input,value)=>{const before=read();await input.fill(value);await input.press('Enter');await wait(()=>read()!==before);await settled();};
 await edit(fill(),'#33669980');await edit(stroke(),'#ff000080');let before=read();await page.getByRole('button',{name:'Hide background color',exact:true}).click();await wait(()=>read()!==before);await settled();
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click();await settled();await edit(fill(),'color(display-p3 0.2 0.4 0.6 / 0.25)');await edit(stroke(),'color(display-p3 0.1 0.8 0.2 / 0.25)');
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();
 const states=[read()],alpha=page.getByLabel('Shared Fill opacity (%)',{exact:true}),strokeAlpha=page.getByLabel('Shared Stroke opacity (%)',{exact:true}),record=async()=>{await wait(()=>read()!==states.at(-1));await settled();states.push(read());};
 assert.equal(await alpha.getAttribute('placeholder'),'Mixed');assert.equal(await alpha.isEnabled(),true);assert.equal(await strokeAlpha.getAttribute('placeholder'),'Mixed');
 await fill().fill('ABCDEF');await fill().press('Enter');await record();assert.equal((await state(first)).hidden,true);const a=await parse((await state(first)).color),b=await parse((await state(second)).color);assert.deepEqual(a.channels.map(n=>Math.round(n*255)),[171,205,239]);assert.deepEqual(b.channels.map(n=>Math.round(n*255)),[171,205,239]);assert.ok(Math.abs(a.alpha-128/255)<1e-8);assert.equal(b.alpha,.25);
 await alpha.fill('40');await alpha.press('Enter');await record();assert.equal((await parse((await state(first)).color)).alpha,.4);assert.equal((await parse((await state(second)).color)).alpha,.4);assert.equal((await state(first)).hidden,true);
 const unchanged=read();await fill().focus();assert.equal(await fill().inputValue(),'ABCDEF');await fill().press('Tab');await settled();assert.equal(read(),unchanged);
 await alpha.fill('101');await alpha.press('Enter');assert.equal(await alpha.evaluate(el=>el.checkValidity()),false);assert.equal(read(),unchanged);await alpha.press('Escape');
 await strokeAlpha.fill('35');await strokeAlpha.press('Enter');await record();const borders=await app.locator('h1,p').evaluateAll(els=>els.slice(0,2).map(el=>parent.RetouchPaintPicker.parsePaint(getComputedStyle(el).borderTopColor)));assert.deepEqual(borders[0].channels,[1,0,0]);assert.equal(borders[1].space,'display-p3');assert.deepEqual(borders[1].channels,[.1,.8,.2]);assert.ok(borders.every(p=>Math.abs(p.alpha-.35)<1e-6));
 if(process.env.RT_E2E_SHARED_PAINT_SCREENSHOT){await fill().focus();await page.screenshot({path:process.env.RT_E2E_SHARED_PAINT_SCREENSHOT});await fill().press('Tab');}
 for(const expected of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 for(const expected of states.slice(1)){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 console.log(kind+': PASS shared hex with per-layer alpha, mixed opacity, hidden paint, P3 stroke colors, invalid drafts and exact undo/redo');
};
