'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),original=await target.textContent(),states=[read()],toggle=()=>page.getByLabel('Truncate text',{exact:true}),maximum=()=>page.getByLabel('Max lines',{exact:true});
 const geometry=()=>target.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return {clamp:c.getPropertyValue('-webkit-line-clamp'),height:r.height,width:r.width,lineHeight:parseFloat(c.lineHeight),display:c.display,overflow:c.overflow};});
 const open=async()=>{const groups=toggle().locator('xpath=ancestor::details');for(let i=0;i<await groups.count();i++){const group=groups.nth(i);if(!await group.evaluate(el=>el.open))await group.locator(':scope > summary').click();}const tab=page.getByRole('tab',{name:'Basics',exact:true});if(await tab.getAttribute('aria-selected')!=='true')await tab.click();};
 const record=async()=>{await settled();await wait(()=>read()!==states.at(-1));states.push(read());assert.equal(await target.textContent(),original);};
 const check=async lines=>{await wait(async()=>{const g=await geometry();return g.clamp===String(lines)&&Math.abs(g.height-g.lineHeight*lines)<1;});};
 await page.getByLabel('Style screen scope').selectOption('');await settled();const baseline=await geometry();assert.ok(baseline.height>baseline.lineHeight*3);
 await open();assert.equal(await maximum().isDisabled(),true);await toggle().check();await record();await check(3);
 await open();await maximum().fill('2');await maximum().press('Enter');await record();await check(2);assert.equal((await geometry()).width,baseline.width);
 await wait(async()=>page.frameLocator('iframe.type-preview').locator('body > div').evaluate(el=>{const c=getComputedStyle(el);return c.getPropertyValue('-webkit-line-clamp')==='2'&&Math.abs(el.offsetHeight-parseFloat(c.lineHeight)*2)<1;}));
 await open();const unchanged=read();await maximum().fill('1.5');await maximum().press('Enter');assert.equal(await maximum().evaluate(el=>el.validity.stepMismatch),true);assert.equal(read(),unchanged);await maximum().press('Escape');assert.equal(await maximum().inputValue(),'2');
 if(process.env.RT_E2E_TEXT_TRUNCATION_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TEXT_TRUNCATION_SCREENSHOT});
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await open();await maximum().fill('1');await maximum().press('Enter');await record();await check(1);
 await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await check(2);
 await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await check(1);
 await open();await toggle().uncheck();await record();await wait(async()=>(await geometry()).height===baseline.height);
 await open();await page.getByRole('button',{name:'Reset text truncation',exact:true}).click();await record();await check(2);
 await page.getByLabel('Style screen scope').selectOption('');await settled();await open();await page.getByRole('button',{name:'Reset text truncation',exact:true}).click();await record();assert.deepEqual(await geometry(),baseline);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 assert.deepEqual(await geometry(),baseline);console.log('TEXT TRUNCATION PASS '+kind+': three/two/one-line geometry, unchanged content and width, screen isolation, off/reset and exact source undo/redo');
};
