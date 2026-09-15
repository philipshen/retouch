'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled})=>{
 const source=read(),box=app.locator('h1'),style=await box.getAttribute('style'),gaps=()=>box.evaluate(el=>[getComputedStyle(el).columnGap,getComputedStyle(el).rowGap]),input=page.getByLabel('Horizontal gap',{exact:true});
 const label=input.locator('..').locator(':scope > span');await label.evaluate(el=>el.scrollIntoView({block:'nearest'}));await settled();await wait(()=>label.evaluate(el=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(el.isConnected))))));
 const drag=async()=>{const b=await label.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+8,b.y+b.height/2,{steps:4});await wait(async()=>JSON.stringify(await gaps())==='["12px","4px"]');assert.equal(read(),source);};
 await drag();await page.keyboard.press('Escape');await page.mouse.up();await settled();assert.deepEqual(await gaps(),['4px','4px']);assert.equal(await box.getAttribute('style'),style);
 await drag();await page.mouse.up();await settled();await wait(()=>read()!==source);const saved=read();assert.deepEqual(await gaps(),['12px','4px']);assert.equal(await box.getAttribute('style'),style);
 await page.getByRole('button',{name:'Reset horizontal gap',exact:true}).click();await settled();await wait(()=>read()!==saved);assert.deepEqual(await gaps(),['4px','4px']);assert.equal(await box.getAttribute('style'),style);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===saved);assert.deepEqual(await gaps(),['12px','4px']);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);assert.deepEqual(await gaps(),['4px','4px']);
 console.log('PASS single inline gap scrub, preview, cancellation, reset and exact undo');
};
