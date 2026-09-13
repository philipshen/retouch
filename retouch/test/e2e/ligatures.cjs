'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const original=read(),states=[original],screen=page.getByLabel('Screen size',{exact:true}),scope=page.getByLabel('Style screen scope',{exact:true});
 const value=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontVariantLigatures),normalize=v=>v.split(/\s+/).sort().join(' '),preview=page.frameLocator('iframe[title="Typography preview"]').locator('body div');
 const open=async()=>{const opener=page.locator('summary[aria-label="Type settings"]');if(!await opener.evaluate(el=>el.parentElement.open))await opener.click();await page.getByRole('tab',{name:'Details',exact:true}).click();const summary=page.locator('.ligature-typography > summary');if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();};
 const initial=await value();await scope.selectOption('');await settled();await open();await page.getByLabel('Common ligatures',{exact:true}).focus();await wait(async()=>await preview.textContent()==='fi fl ffi ffl');assert.equal(read(),original);if(process.env.RT_E2E_LIGATURES_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIGATURES_SCREENSHOT});
 const write=async(label,next,expected)=>{await page.getByLabel(label,{exact:true}).selectOption(next);await wait(()=>read()!==states.at(-1));states.push(read());await settled();await wait(async()=>normalize(await value())===normalize(expected));await wait(async()=>normalize(await preview.evaluate(el=>getComputedStyle(el).fontVariantLigatures))===normalize(expected));assert.equal(await page.locator('.ligature-typography').evaluate(el=>el.open),true);};
 await write('Common ligatures','no-common-ligatures','no-common-ligatures');
 await write('Rare ligatures','discretionary-ligatures','no-common-ligatures discretionary-ligatures');
 await write('Contextual alternates','no-contextual','no-common-ligatures discretionary-ligatures no-contextual');
 await screen.selectOption('768x1024');await settled();await scope.selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 await write('Historical ligatures','historical-ligatures','no-common-ligatures discretionary-ligatures no-contextual historical-ligatures');
 await screen.selectOption('390x844');await settled();await wait(async()=>normalize(await value())===normalize('no-common-ligatures discretionary-ligatures no-contextual'));await screen.selectOption('768x1024');await settled();
 await page.getByRole('button',{name:'Reset ligatures',exact:true}).click();await wait(()=>read()!==states.at(-1));states.push(read());await settled();await wait(async()=>normalize(await value())===normalize('no-common-ligatures discretionary-ligatures no-contextual'));
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}assert.equal(await value(),initial);
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}assert.equal(read(),original);console.log('LIGATURES PASS '+kind+': independent groups, preview, responsive override/reset and exact undo/redo');
};
