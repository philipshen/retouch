'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),text=await target.textContent(),states=[read()],field=property=>page.getByLabel('Selected text '+property,{exact:true});
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const edit=async(locator,from=0,to=3)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(locator,from,to);};
 const save=async(property,value)=>{await field(property).fill(value);await field(property).press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
 const initialHeight=(await target.boundingBox()).height;
 await edit(target,1,4);await field('line height').fill('150%');await field('line height').press('Escape');assert.equal(read(),states[0]);assert.equal(await target.locator('span').count(),0);
 await field('line height').fill('-1px');await field('line height').press('Enter');assert.equal(await field('line height').getAttribute('aria-invalid'),'true');assert.equal(read(),states[0]);
 await save('line height','150%');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).lineHeight),'48px');
 // Tailwind fixtures already inherit 1.5 line height; increasing a run need not grow the line.
 assert.ok((await target.boundingBox()).height>=initialHeight);const beforeTracking=(await target.locator('span').boundingBox()).width;
 await edit(target.locator('span'));await wait(async()=>await field('line height').inputValue()==='150%');await save('letter spacing','10%');assert.equal(await target.locator('span').count(),1);assert.ok(read().includes('0.1em'));assert.ok((await target.locator('span').boundingBox()).width>beforeTracking+1);
 await edit(target.locator('span'));await wait(async()=>await field('letter spacing').inputValue()==='10%');await save('size (px)','20');
 const style=await target.locator('span').evaluate(el=>({height:getComputedStyle(el).lineHeight,spacing:getComputedStyle(el).letterSpacing}));assert.deepEqual(style,{height:'30px',spacing:'2px'});
 await edit(target.locator('span'),1,2);await save('letter spacing','-2px');assert.equal(await target.locator('span').count(),3);for(const span of await target.locator('span').all())assert.equal(await span.evaluate(el=>getComputedStyle(el).lineHeight),'30px');
 await edit(target.locator('span').nth(1),0,1);await save('letter spacing','10%');assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'));await save('line height','2x');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).lineHeight),'40px');
 await edit(target.locator('span'));await wait(async()=>await field('line height').inputValue()==='2x');await save('line height','32px');
 await edit(target.locator('span'));await save('letter spacing','Auto');assert.equal(await target.locator('span').evaluate(el=>el.style.letterSpacing),'normal');
 if(process.env.RT_E2E_RANGE_SPACING_SCREENSHOT){await edit(target.locator('span'));await page.screenshot({path:process.env.RT_E2E_RANGE_SPACING_SCREENSHOT});await page.keyboard.press('Escape');await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE SPACING PASS '+kind+': cancel/invalid preservation, relative height/tracking, font-size scaling, negative tracking, split/merge, multipliers, Auto, pixels and exact undo/redo');
};
