'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,select,read,settled,original,kind,multiple=false})=>{
 for(const change of ['geometry','ancestor']){
  await select('circle','Circle');if(multiple){await page.getByRole('treeitem',{name:'g · Group',exact:true}).click({modifiers:['Shift']});await settled();}
  const nodes=app.locator('svg [aria-label]'),transforms=await nodes.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),target=change==='geometry'?app.locator('[aria-label="Circle"]'):app.locator('svg').first(),attr=change==='geometry'?'r':'viewBox',old=await target.getAttribute(attr),replacement=change==='geometry'?'45':'0 0 1200 840';
  const input=page.getByRole('textbox',{name:multiple?'Selection width':'Vector width',exact:true}),initial=await input.inputValue();await input.scrollIntoViewIfNeeded();const label=input.locator('xpath=..').locator('[data-numeric-scrub]'),r=await label.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  await page.mouse.move(x,y);await page.mouse.down();const hint=page.locator('[data-numeric-scrub-speed]');await hint.waitFor();await page.mouse.move(x+12,y);assert.notDeepEqual(await nodes.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),transforms);
  await target.evaluate((el,{attr,value})=>el.setAttribute(attr,value),{attr,value:replacement});await hint.waitFor({state:'detached'});await page.mouse.up();assert.equal(await target.getAttribute(attr),replacement,'external change preserved');assert.deepEqual(await nodes.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),transforms,'only preview transforms restored');assert.equal(await input.inputValue(),initial);assert.equal(read(),original);
  await target.evaluate((el,{attr,value})=>value===null?el.removeAttribute(attr):el.setAttribute(attr,value),{attr,value:old});
 }
 await select('rect','Box');console.log('SVG SCRUB INTERRUPTION: geometry and ancestor changes cancel '+(multiple?'nested selection':'single vector')+' PASS '+kind);
};
