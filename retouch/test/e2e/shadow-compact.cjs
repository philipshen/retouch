'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,read,wait,settled,open,stack})=>{
 const input=page.getByLabel('Shadow 1 color',{exact:true}),alpha=page.getByLabel('Shadow 1 opacity (%)',{exact:true}),states=[read()],original=await stack(),geometry=({color,...rest})=>rest;
 const edit=async(field,value)=>{await field.fill(value);await field.press('Enter');await wait(()=>read()!==states.at(-1));await settled();await open();states.push(read());},paint=async()=>page.evaluate(value=>RetouchPaintPicker.parsePaint(value),(await stack())[0].color);
 await edit(input,'color(display-p3 0.2 0.4 0.6 / 0.25)');await edit(alpha,'35');let color=await paint();assert.equal(color.space,'display-p3');assert.deepEqual(color.channels,[.2,.4,.6]);assert.equal(color.alpha,.35);
 await edit(input,'ABCDEF');color=await paint();assert.deepEqual(color.channels.map(n=>Math.round(n*255)),[171,205,239]);assert.equal(color.alpha,.35);const after=await stack();assert.deepEqual(after.slice(1),original.slice(1));assert.deepEqual(geometry(after[0]),geometry(original[0]));
 const unchanged=read();await input.focus();await input.press('Tab');await settled();assert.equal(read(),unchanged);await alpha.fill('101');await alpha.press('Enter');assert.equal(await alpha.evaluate(el=>el.checkValidity()),false);assert.equal(read(),unchanged);await alpha.press('Escape');
 if(process.env.RT_E2E_SHADOW_COMPACT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SHADOW_COMPACT_SCREENSHOT});
 for(const expected of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();await open();}
 for(const expected of states.slice(1)){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===expected);await settled();await open();}
 for(const expected of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();await open();}
 console.log('PASS compact shadow opacity, P3, hex alpha, geometry and sibling preservation, invalid/no-op drafts and exact undo/redo');
};
