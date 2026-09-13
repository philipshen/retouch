'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),text=await target.textContent(),states=[read()],family=await target.evaluate(el=>getComputedStyle(el).fontFamily);
 const picker=page.getByRole('dialog',{name:'Selected text font',exact:true});
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const edit=async(locator,from,to)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(locator,from,to);};
 const open=async()=>{await page.getByRole('button',{name:'Choose selected text font',exact:true}).click();await picker.waitFor();};
 const choose=async query=>{await picker.getByLabel('Search page fonts',{exact:true}).fill(query);};
 const apply=async(action=()=>picker.getByRole('button',{name:'Apply font',exact:true}).click())=>{await action();await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);assert.equal(await target.evaluate(el=>getComputedStyle(el).fontFamily),family);};
 await edit(target,1,4);const markup=await target.innerHTML();await open();await choose('monospace');
 await picker.getByRole('button',{name:'Use font Monospace',exact:true}).click();
 assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontFamily),'monospace');assert.equal(read(),states[0]);
 await choose('mono');assert.equal(await picker.getByRole('button',{name:'Use font Monospace',exact:true}).getAttribute('aria-pressed'),'true');
 await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'detached'});assert.equal(await target.innerHTML(),markup);assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),text.slice(1,4));
 await open();await choose('zzzznotafont');await wait(async()=>await picker.getByRole('group',{name:'Matching fonts'}).getByRole('button').count()===0);assert.equal(await picker.getByRole('button',{name:'Apply font',exact:true}).isDisabled(),true);await picker.getByLabel('Search page fonts',{exact:true}).press('Enter');assert.equal(read(),states[0]);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal(await target.innerHTML(),markup);assert.equal(read(),states[0]);
 await open();await choose('monospace');await apply(()=>picker.getByLabel('Search page fonts',{exact:true}).press('Enter'));assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'),0,3);await open();
 const quick=picker.getByLabel('Selected text font family',{exact:true}),quoted=(await quick.locator('option').evaluateAll(options=>options.map(option=>option.value))).find(value=>value.includes('Page Face')&&value.includes(','));assert.ok(quoted);
 await quick.selectOption(quoted);
 if(process.env.RT_E2E_RANGE_FAMILY_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RANGE_FAMILY_SCREENSHOT});
 await apply();assert.ok(read().includes('Page Face'));assert.equal(await target.locator('span').count(),1);if(kind!=='react')assert.ok(read().includes('&quot;Page Face&quot;'));
 await edit(target.locator('span'),1,2);await open();await choose('monospace');await picker.getByRole('button',{name:'Use font Monospace',exact:true}).click();await apply();assert.equal(await target.locator('span').count(),3);assert.equal(await target.locator('span span').count(),0);
 await edit(target.locator('span').nth(1),0,1);await open();await picker.getByLabel('Selected text font family',{exact:true}).selectOption(quoted);await apply();assert.equal(await target.locator('span').count(),1);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE FAMILY PASS '+kind+': search, preview, Cancel/Escape, no match, quoted font lists, reopen, split/merge and exact source undo/redo');
};
