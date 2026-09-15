'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),row=name=>page.getByRole('treeitem',{name,exact:true}),selected=async name=>{await settled();assert.equal(await row(name).getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('treeitem',{selected:true}).count(),1);assert.equal(read(),original);};
 await page.evaluate(()=>clearSelection());await app.locator('h1').click();await selected('div · Outer group');assert.equal(await app.locator('[data-rt-group][contenteditable]').count(),0);
 await app.locator('h1').dblclick();await selected('div · Inner group');assert.equal(await app.locator('h1').getAttribute('contenteditable'),null);assert.equal(await app.locator('[data-rt-group][contenteditable]').count(),0);
 await app.locator('h1').dblclick();await wait(async()=>await app.locator('h1').getAttribute('contenteditable')==='true');await selected('h1 · Headline');await app.locator('h1').press('Escape');await settled();
 async function key(value){await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus();});await app.locator('body').press(value);}
 await key('Shift+Enter');await selected('div · Inner group');await key('Shift+Enter');await selected('div · Outer group');await key('Enter');await selected('div · Inner group');await key('Tab');await selected('p · Named text');
 await app.locator('h1').click();await selected('div · Inner group');await row('main').click();await settled();await app.locator('h1').click();await selected('div · Outer group');console.log(kind+': PASS nested groups enter one level per double-click, keyboard parent/child/sibling navigation, closed group restoration and unchanged source');
};
