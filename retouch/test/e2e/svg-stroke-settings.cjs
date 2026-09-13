'use strict';
const assert=require('node:assert/strict');
module.exports=async function strokeSettings({page,app,kind,read,wait,settled}){
 const initial=read(),states=[initial],rect=app.locator('main > svg > rect'),screen=page.getByLabel('Screen size',{exact:true}),scope=page.getByLabel('Style screen scope',{exact:true});
 await page.getByRole('treeitem',{name:'rect',exact:true}).click();await settled();
 const summary=page.locator('summary[aria-label="Advanced stroke settings"]');
 assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
 assert.ok(await page.getByLabel('SVG stroke',{exact:true}).isVisible());
 assert.ok(await page.getByLabel('SVG stroke width',{exact:true}).isVisible());
 assert.equal(await page.getByLabel('SVG dash offset',{exact:true}).isVisible(),false);
 await summary.click();const dialog=page.getByRole('dialog',{name:'Stroke settings',exact:true});await dialog.waitFor();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await summary.evaluate(el=>document.activeElement===el),true);await summary.click();
 const bounds=await dialog.boundingBox(),viewport=page.viewportSize();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height,'settings stay inside the viewport');
 await page.getByRole('button',{name:'Close stroke settings',exact:true}).click();assert.equal(await dialog.isVisible(),false);assert.equal(await summary.evaluate(el=>document.activeElement===el),true);await summary.click();await page.locator('.design-panel-tabs').click();assert.equal(await dialog.isVisible(),false);await summary.click();
 const values=[['dash pattern','stroke-dasharray','6 3','6px, 3px','12 4','12px, 4px'],['dash offset','stroke-dashoffset','-3','-3px','12%','12%'],['miter limit','stroke-miterlimit','2.5','2.5','6','6'],['stroke scaling','vector-effect','non-scaling-stroke','non-scaling-stroke','none','none']];
 const computed=property=>rect.evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),property);
 const edit=async(label,value)=>{if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();if(label==='dash pattern')await page.getByLabel('Stroke style',{exact:true}).selectOption('custom');const input=page.getByLabel('SVG '+label,{exact:true});if(await input.evaluate(el=>el.tagName)==='SELECT')await input.selectOption(value);else{await input.fill(value);await input.press('Tab');}await settled();};
 await edit('miter limit','0');assert.equal(read(),initial);assert.equal(await page.getByLabel('SVG miter limit',{exact:true}).evaluate(el=>el.checkValidity()),false);
 const record=async()=>{await wait(()=>read()!==states.at(-1));states.push(read());};
 const style=page.getByLabel('Stroke style',{exact:true});assert.equal(await style.inputValue(),'solid');assert.equal(await page.getByLabel('Dash length',{exact:true}).isVisible(),false);
 await style.selectOption('dashed');await settled();await wait(async()=>await computed('stroke-dasharray')==='4px, 4px');await record();
 for(const [label,value,expected]of [['Dash length','8','8px, 4px'],['Dash gap','3%','8px, 3%']]){const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');await settled();await wait(async()=>await computed('stroke-dasharray')===expected);await record();}
 if(process.env.RT_E2E_SVG_STROKE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_STROKE_SCREENSHOT.replace(/\.png$/,'-dashed.png')});
 const invalid=page.getByLabel('Dash gap',{exact:true}),beforeInvalid=read();await invalid.fill('-1');await invalid.press('Tab');await settled();assert.equal(read(),beforeInvalid);assert.equal(await invalid.evaluate(el=>el.checkValidity()),false);
 await style.selectOption('custom');assert.equal(read(),beforeInvalid,'opening Custom does not write source');assert.equal(await page.getByLabel('Dash length',{exact:true}).isVisible(),false);await edit('dash pattern','1 2 3 4');await wait(async()=>await computed('stroke-dasharray')==='1px, 2px, 3px, 4px');await record();
 await style.selectOption('dashed');await settled();await wait(async()=>await computed('stroke-dasharray')==='1px, 2px');assert.equal(await page.getByLabel('Dash gap',{exact:true}).evaluate(el=>el.checkValidity()),true);await record();
 await style.selectOption('solid');await settled();await wait(async()=>await computed('stroke-dasharray')==='none');await record();
 for(const [label,property,value,expected]of values){await edit(label,value);await wait(async()=>await computed(property)===expected);await record();}
 assert.equal(await page.locator('[data-section=fill] input[data-paint-property]').count(),1);assert.equal(await page.locator('[data-section=stroke] input[data-paint-property]').count(),1);assert.equal(await page.getByLabel(/^Border width/).count(),0);
 assert.equal(await rect.getAttribute('fill'),'red');assert.equal(await rect.getAttribute('stroke'),'blue');
 const layout=await summary.evaluate(el=>{const d=el.parentElement.querySelector('.stroke-settings-body'),rows=[...d.querySelectorAll(':scope > .property-pair')];return {pairs:rows.length,fits:d.scrollWidth<=d.clientWidth+1,fields:rows.map(row=>[...row.querySelectorAll('.inspector-field > span')].map(el=>el.textContent))};});
 assert.deepEqual(layout,{pairs:2,fits:true,fields:[['Caps','Join'],['Offset','Miter limit']]});
 await screen.focus();await screen.selectOption('768x1024');await settled();await scope.selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 for(const [label,property,,,value,expected]of values){await edit(label,value);await wait(async()=>await computed(property)===expected);await record();}
 if(process.env.RT_E2E_SVG_STROKE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_STROKE_SCREENSHOT});
 await screen.selectOption('390x844');await settled();for(const [,property,,expected]of values)await wait(async()=>await computed(property)===expected);
 await screen.focus();await screen.selectOption('768x1024');await settled();for(const [,property,,,,expected]of values)await wait(async()=>await computed(property)===expected);
 for(const [label,property,,expected]of values){if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();await page.getByRole('button',{name:'Reset svg '+label,exact:true}).click();await settled();await wait(async()=>await computed(property)===expected);await record();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 assert.equal(read(),initial);
 for(const name of ['svg','h1 · Headline']){await page.getByRole('treeitem',{name,exact:true}).click();await settled();assert.equal(await page.getByLabel(kind==='html'?'Background color (CSS)':'Background color with alpha',{exact:true}).count(),1);assert.ok(await page.getByLabel(/^Border width/).count()>0);}
 await page.getByRole('treeitem',{name:'rect',exact:true}).click();await settled();assert.equal(await page.getByLabel(/^Border width/).count(),0);assert.equal(read(),initial);
 console.log('SVG STROKE SETTINGS: compact layout, base/scoped values, screen fallback, reset, exact undo/redo PASS '+kind);
};
