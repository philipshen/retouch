'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled,masked,pixel})=>{
 const artwork=app.locator('svg:has([aria-label="Content"])'),group=artwork.locator('[data-rt-mask-group]');
 const x=page.getByLabel('Vector X',{exact:true});await x.fill('20');await x.press('Tab');await settled();await wait(()=>read()!==masked);const moved=read(),transform=await group.getAttribute('transform');assert.equal(transform,'matrix(1 0 0 1 20 0)');
 await page.getByRole('button',{name:'Release mask',exact:true}).waitFor();await page.getByRole('button',{name:'Edit mask shape',exact:true}).waitFor();
 const type=page.getByLabel('Mask type',{exact:true}),mode=await type.inputValue();await type.selectOption(mode==='alpha'?'luminance':'alpha');await settled();await wait(()=>read()!==moved);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===moved);
 await artwork.evaluate(el=>{const style=el.ownerDocument.createElement('style');style.id='mask-group-style';style.textContent='[data-rt-mask-group]{transform:translateX(30px)}';el.ownerDocument.head.append(style);});
 await page.getByRole('button',{name:'Release mask',exact:true}).click();await settled();assert.equal(read(),moved);assert.ok(await page.getByRole('alert').filter({hasText:'CSS-controlled'}).isVisible());await app.locator('#mask-group-style').evaluate(el=>el.remove());
 assert.deepEqual(await pixel(110,40),[255,255,255]);
 await page.getByRole('button',{name:'Release mask',exact:true}).click();await settled();await wait(()=>!read().includes('<mask'));const released=read();assert.equal(await artwork.locator('mask').count(),0);assert.equal(await artwork.locator('g').getAttribute('transform'),transform);assert.deepEqual(await pixel(110,40),[0,0,255]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===moved);await page.getByRole('button',{name:'Release mask',exact:true}).waitFor();assert.deepEqual(await pixel(110,40),[255,255,255]);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===released);assert.deepEqual(await pixel(110,40),[0,0,255]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===moved);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===masked);
 assert.equal(await app.locator('input').inputValue(),'retained');assert.equal(await app.locator('input').evaluate(()=>window.maskDocument),'same');
 console.log('Transformed mask: editable type, retained transform on release, exact history and rendered pixels PASS');
};
