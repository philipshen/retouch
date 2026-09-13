'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 await page.getByLabel('Style screen scope').selectOption('');await settled();
 const initial=read(),states=[initial],styles=page.getByLabel('Font weight style',{exact:true}),raw=page.getByLabel(kind==='html'?'Font weight (CSS)':'Font weight (1–1000)',{exact:true});
 const metrics=()=>app.locator('h1').evaluate(el=>{const s=getComputedStyle(el);return {weight:s.fontWeight,family:s.fontFamily,size:s.fontSize,slant:s.fontStyle};});
 const beforeMetrics=await metrics();assert.equal(await styles.inputValue(),beforeMetrics.weight);assert.equal(await styles.locator('option:checked').textContent(),'Bold');
 assert.equal(await styles.evaluate(el=>Boolean(el.closest('.typography-primary'))),true);
 const edit=async(action,expected)=>{const before=read();await action();await wait(()=>read()!==before);await settled();await wait(async()=>(await metrics()).weight===expected);states.push(read());assert.deepEqual({...await metrics(),weight:beforeMetrics.weight},beforeMetrics);};
 await styles.selectOption('custom');assert.equal(await raw.evaluate(el=>el===el.ownerDocument.activeElement),true);assert.equal(read(),initial);
 await raw.fill('900');await raw.press('Escape');await settled();assert.equal(read(),initial);
 await edit(()=>styles.selectOption('400'),'400');assert.equal(await styles.locator('option:checked').textContent(),'Regular');
 await styles.selectOption('custom');await raw.fill('1001');await raw.press('Enter');assert.equal(await raw.evaluate(el=>el.validity.valid),false);assert.equal(read(),states.at(-1));await raw.press('Escape');
 await edit(async()=>{await styles.selectOption('custom');await raw.fill('(500 + 75)');await raw.press('Enter');},'575');assert.equal(await styles.locator('option:checked').textContent(),'575');
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 await edit(()=>styles.selectOption('600'),'600');assert.equal(await styles.locator('option:checked').textContent(),'Semi Bold');
 const screen=page.getByLabel('Screen size',{exact:true});await screen.focus();await screen.selectOption('390x844');await settled();await wait(async()=>(await metrics()).weight==='575');
 await screen.focus();await screen.selectOption('768x1024');await settled();await wait(async()=>(await metrics()).weight==='600');
 if(process.env.RT_E2E_WEIGHT_STYLE_SCREENSHOT){const settings=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Type settings$/})}).last();if(await settings.evaluate(el=>el.open))await settings.locator(':scope > summary').click();await styles.scrollIntoViewIfNeeded();await page.locator('#panel').screenshot({path:process.env.RT_E2E_WEIGHT_STYLE_SCREENSHOT});}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 await page.getByLabel('Style screen scope').selectOption('');await settled();assert.deepEqual(await metrics(),beforeMetrics);
 console.log(kind+': PASS primary named weights, custom calculations/cancel, range refusal, other typography preserved, responsive weights and exact undo/redo');
};
