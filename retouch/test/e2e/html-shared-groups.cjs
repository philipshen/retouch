'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled})=>{
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();const initial=read();
 const group=key=>page.locator('#panelBody > [data-shared-section="'+key+'"]');assert.deepEqual(await page.locator('#panelBody > [data-shared-section]').evaluateAll(els=>els.map(el=>el.dataset.sharedSection)),['size','layout','item','appearance','typography','fill','stroke','effects']);
 for(const [key,label]of [['size','Shared Width'],['layout','Shared Padding'],['item','Shared Margin'],['appearance','Shared Opacity (%)'],['typography','Shared Font size'],['fill','Shared Background color'],['stroke','Shared Border color']])assert.equal(await group(key).getByLabel(label,{exact:true}).count(),1);
 assert.equal(await group('size').locator('.property-pair').first().getByLabel('Shared Width',{exact:true}).count(),1);assert.equal(await group('size').locator('.property-pair').first().getByLabel('Shared Height',{exact:true}).count(),1);
 for(const label of ['Shared individual padding','Shared individual margins','Shared individual borders','Shared individual corners','Shared typography options','Shared size limits'])assert.equal(await page.getByLabel(label,{exact:true}).evaluate(el=>el.open),false);
 const type=group('typography');await type.locator(':scope > summary').click();assert.equal(await type.evaluate(el=>el.open),false);
 const padding=page.getByLabel('Shared individual padding',{exact:true});await padding.locator(':scope > summary').click();const top=page.getByLabel('Shared Padding top',{exact:true});await top.fill('12px');await top.press('Tab');await wait(()=>read()!==initial);await settled();const edited=read();assert.deepEqual(await app.locator('h1,p').evaluateAll(els=>els.slice(0,2).map(el=>getComputedStyle(el).paddingTop)),['12px','12px']);assert.equal(await padding.evaluate(el=>el.open),true);assert.equal(await type.evaluate(el=>el.open),false);assert.equal(await top.locator('xpath=ancestor::*[contains(@class,"property-row")][1]').getByRole('button',{name:'Reset shared padding top',exact:true}).count(),1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===initial);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===edited);await settled();
 await type.locator(':scope > summary').click();await padding.locator(':scope > summary').click();assert.equal(read(),edited,'organizing fields never writes source');
 if(process.env.RT_E2E_SHARED_GROUP_SCREENSHOT){await group('fill').getByLabel('Shared Background color',{exact:true}).focus();await page.screenshot({path:process.env.RT_E2E_SHARED_GROUP_SCREENSHOT});}
 console.log('html: PASS shared inspector sections, paired dimensions, advanced controls, retained collapse state and exact grouped undo/redo');
};
