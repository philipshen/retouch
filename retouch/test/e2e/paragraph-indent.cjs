'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),states=[initial],input=()=>page.getByLabel(kind==='html'?'Paragraph indent (CSS)':'Paragraph indent (px)',{exact:true});
 const openControls=async()=>{const groups=input().locator('xpath=ancestor::details');for(let i=0;i<await groups.count();i++){const group=groups.nth(i);if(!await group.evaluate(el=>el.open))await group.locator(':scope > summary').click();}const tab=page.getByRole('tab',{name:'Details',exact:true});if(await tab.getAttribute('aria-selected')!=='true')await tab.click();};
 const geometry=()=>target.evaluate(el=>{const d=el.ownerDocument,box=el.getBoundingClientRect(),texts=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()),position=node=>{const range=d.createRange();range.setStart(node,0);range.setEnd(node,1);return range.getBoundingClientRect().x-box.x;};return {first:position(texts[0]),second:position(texts[1]),indent:parseFloat(getComputedStyle(el).textIndent),width:box.width};});
 await page.getByLabel('Style screen scope').selectOption('');await settled();const baseline=await geometry();
 const check=async value=>{await wait(async()=>Math.abs((await geometry()).indent-value)<.05);const g=await geometry();assert.ok(Math.abs(g.first-g.second-value)<1,JSON.stringify(g));};
 const edit=async value=>{await openControls();await input().fill(String(value)+(kind==='html'?'px':''));await input().press('Tab');await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(value);};
 await edit(24);if(process.env.RT_E2E_PARAGRAPH_INDENT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_PARAGRAPH_INDENT_SCREENSHOT});assert.equal((await geometry()).width,baseline.width);
 // A held drag previews the first line; Escape restores it without a source write.
 await input().scrollIntoViewIfNeeded();const label=input().locator('xpath=..').locator('[data-numeric-scrub]'),box=await label.boundingBox();assert.ok(box);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:3});await wait(async()=>Math.abs((await geometry()).indent-24)>.5);assert.equal(read(),states.at(-1));await page.keyboard.press('Escape');await page.mouse.up();await check(24);assert.equal(read(),states.at(-1));
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit(-12);
 await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await check(24);
 await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await check(-12);
 await openControls();await page.getByRole('button',{name:'Reset paragraph indent',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(24);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 await check(baseline.indent);console.log('PARAGRAPH INDENT PASS '+kind+': first-line geometry, second-line preservation, signed screen override, phone isolation, scrub preview/cancel, reset, exact source undo/redo');
};
