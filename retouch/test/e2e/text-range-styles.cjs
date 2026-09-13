'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent();
 const edit=async()=>{const box=await target.boundingBox();await target.click({position:{x:box.width-20,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const select=async(locator,whole=false)=>locator.evaluate((el,whole)=>{const d=el.ownerDocument,r=d.createRange();if(whole)r.selectNodeContents(el);else{r.setStart(el.firstChild,1);r.setEnd(el.firstChild,4);}const s=d.getSelection();s.removeAllRanges();s.addRange(r);},whole);
 const commit=async()=>{await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
 await edit();await select(target);
 assert.ok(Number(await target.evaluate(el=>getComputedStyle(el).fontWeight))>=700);
 await page.getByLabel('Selected text weight',{exact:true}).selectOption('400');
 assert.equal(await target.locator('span').last().evaluate(el=>getComputedStyle(el).fontWeight),'400');
 await commit();await wait(async()=>await target.locator('span').count()===1);
 for(const [label,value,property]of [['Selected text style','italic','fontStyle'],['Selected text style','normal','fontStyle'],['Selected text weight','700','fontWeight']]){
  await edit();await select(target.locator('span').last(),true);
  await page.getByLabel(label,{exact:true}).selectOption(value);await commit();
  assert.equal(await target.locator('span').last().evaluate((el,property)=>getComputedStyle(el)[property],property),value);
 }
 // Named and variable weights preserve the selected run and its source value.
 const variableWidths={};
 for(const value of ['100','200','300','500','600','800','900']){
  await edit();await select(target.locator('span').last(),true);
  await page.getByLabel('Selected text weight',{exact:true}).selectOption(value);await commit();
  assert.equal(await target.locator('span').last().evaluate(el=>getComputedStyle(el).fontWeight),value);
  if(process.env.RT_E2E_VARIABLE_FONT&&['100','900'].includes(value))variableWidths[value]=await target.locator('span').last().evaluate(async el=>{const d=el.ownerDocument;await d.fonts.ready;const face=[...d.fonts].find(face=>face.family.replace(/["']/g,'')==='Variable Test');if(face?.status!=='loaded')throw Error('Variable font is not loaded');const range=d.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().width;});
 }
 if(process.env.RT_E2E_VARIABLE_FONT){assert.ok(Math.abs(variableWidths['100']-variableWidths['900'])>.01,JSON.stringify(variableWidths));console.log('SELECTED VARIABLE GLYPH WIDTHS',variableWidths);}

 const custom=()=>page.getByLabel('Selected text custom weight',{exact:true});
 await edit();await select(target.locator('span').last(),true);
 await page.getByLabel('Selected text weight',{exact:true}).selectOption('custom');
 await custom().fill('537.25');await custom().press('Escape');assert.equal(read(),states.at(-1));
 for(const value of ['0','1001']){
  await page.getByLabel('Selected text weight',{exact:true}).selectOption('custom');await custom().fill(value);await custom().press('Enter');
  assert.equal(await custom().getAttribute('aria-invalid'),'true');assert.equal(read(),states.at(-1));
 }
 await custom().fill('537.25');await custom().press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();
 assert.ok(read().includes('537.25'));assert.equal(await target.locator('span').last().evaluate(el=>getComputedStyle(el).fontWeight),'537.25');
 await edit();await select(target.locator('span').last(),true);
 await wait(async()=>await page.getByLabel('Selected text weight',{exact:true}).inputValue()==='custom');
 assert.equal(await custom().inputValue(),'537.25');
 if(process.env.RT_E2E_RANGE_WEIGHT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RANGE_WEIGHT_SCREENSHOT});
 // Reapply to a partial run while preserving the unselected custom weight.
 await target.locator('span').last().evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,2);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});await custom().fill('600');await custom().press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();
 assert.ok(read().includes('537.25'));assert.ok(read().includes('600'));
 // Selecting the whole mixed range must override existing child weight as well.
 await edit();await select(target,true);await page.getByLabel('Selected text weight',{exact:true}).selectOption('400');
 await commit();
 const weights=await target.evaluate(el=>{const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT),values=[];while(walker.nextNode())if(walker.currentNode.textContent)values.push(getComputedStyle(walker.currentNode.parentElement).fontWeight);return values;});
 assert.ok(weights.length>=3);assert.ok(weights.every(value=>value==='400'));assert.ok(Number(await target.evaluate(el=>getComputedStyle(el).fontWeight))>=700);
 await edit();await page.keyboard.press('Escape');await settled();assert.equal(read(),states.at(-1));
 if(process.env.RT_E2E_RANGE_STYLE_SCREENSHOT){await edit();await select(target,true);await page.screenshot({path:process.env.RT_E2E_RANGE_STYLE_SCREENSHOT});await page.keyboard.press('Escape');await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE STYLES PASS '+kind+': named weights, custom fractional weight, invalid/Cancel, partial split, inherited bold override, italic/upright, mixed ranges, reopen and exact undo/redo');
};
