'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const select=async name=>{await page.getByRole('treeitem',{name,exact:true}).click();await settled();};
 const edit=async(input,value)=>{const before=read();await input.fill(value);await input.press('Enter');await wait(()=>read()!==before);await settled();};
 await select('rect');await edit(page.getByLabel('SVG fill',{exact:true}),'color(srgb 1 0 0 / 0.5)');await edit(page.getByLabel('SVG stroke',{exact:true}),'color(srgb 0 0 1 / 0.5)');
 await select('circle');await edit(page.getByLabel('SVG fill',{exact:true}),'color(display-p3 0.2 0.4 0.6 / 0.25)');await edit(page.getByLabel('SVG stroke',{exact:true}),'color(display-p3 0.1 0.8 0.2 / 0.25)');
 await select('rect');await page.getByRole('treeitem',{name:'circle',exact:true}).click({modifiers:['Shift']});await settled();

 const states=[read()],record=async()=>{await wait(()=>read()!==states.at(-1));await settled();states.push(read());},paints=property=>app.locator('main > svg > *').evaluateAll((els,p)=>els.map(el=>parent.RetouchPaintPicker.parsePaint(getComputedStyle(el).getPropertyValue(p))),property);
 const untouched={fill:(await paints('fill'))[2],stroke:(await paints('stroke'))[2]};
 for(const property of ['fill','stroke']){
  const alpha=page.getByLabel('Shared SVG '+property+' opacity (%)',{exact:true});assert.equal(await alpha.isEnabled(),true);assert.equal(await alpha.getAttribute('placeholder'),'Mixed');
  await alpha.fill('35');await alpha.press('Enter');await record();const colors=await paints(property);assert.ok(colors.slice(0,2).every(p=>Math.abs(p.alpha-.35)<1e-6));assert.equal(colors[1].space,'display-p3');assert.deepEqual(colors[1].channels,property==='fill'?[.2,.4,.6]:[.1,.8,.2]);assert.deepEqual(colors[0].channels,property==='fill'?[1,0,0]:[0,0,1]);
  const input=page.getByLabel('Shared SVG '+property+(kind==='html'?'':' with alpha'),{exact:true});await input.fill('ABCDEF');await input.press('Enter');await record();const changed=await paints(property);assert.ok(changed.slice(0,2).every(p=>Math.abs(p.alpha-.35)<1e-6));assert.ok(changed.slice(0,2).every(p=>p.channels.map(n=>Math.round(n*255)).join(',')==='171,205,239'));assert.deepEqual(changed[2],untouched[property]);
  const unchanged=read();await input.focus();assert.equal(await input.inputValue(),'ABCDEF');await input.press('Tab');await settled();assert.equal(read(),unchanged);
 }
 if(process.env.RT_E2E_SHARED_SVG_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SHARED_SVG_SCREENSHOT});
 for(const expected of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 for(const expected of states.slice(1)){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 console.log(kind+': PASS compact shared SVG fill/stroke, mixed alpha, P3 channels, hex, untouched sibling and exact undo/redo');
};
