'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const target=app.locator('h1'),color=page.locator('#panelBody input[data-paint-property="background-color"]'),alpha=page.getByLabel('Fill opacity (%)',{exact:true}),states=[read()];
 const record=async()=>{await wait(()=>read()!==states.at(-1));await settled();states.push(read());};
 const rendered=()=>target.evaluate(el=>parent.RetouchPaintPicker.parsePaint(getComputedStyle(el).backgroundColor));
 await color.fill('#33669980');await color.press('Enter');await record();await wait(async()=>Math.abs((await rendered()).alpha-128/255)<.003);
 const images=await target.evaluate(el=>[getComputedStyle(el).backgroundImage,getComputedStyle(el).backgroundSize]);
 await page.getByRole('button',{name:'Hide background color',exact:true}).click();await record();await page.getByRole('button',{name:'Show background color',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Show background color',exact:true}).evaluate(el=>el===document.activeElement),true);assert.equal((await rendered()).alpha,0);assert.equal(await target.evaluate(el=>parent.RetouchBackgroundPaintUI.read({},el).color),'#33669980');
 assert.ok(Math.abs(Number(await alpha.inputValue())-128/255*100)<.3);
 await color.fill('ABCDEF');await color.press('Enter');await record();assert.equal((await rendered()).alpha,0);
 await alpha.fill('37.5');await alpha.press('Enter');await record();assert.equal((await rendered()).alpha,0);assert.equal(await alpha.inputValue(),'37.5');
 // Picker preview and cancellation must keep the canvas hidden and source unchanged.
 const stable=read();await color.locator('..').locator('.gradient-stop-swatch').click();const picker=page.locator('dialog.paint-picker[open]');await picker.getByLabel('Color value',{exact:true}).fill('#ff000080');assert.equal((await rendered()).alpha,0);assert.equal(read(),stable);await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal((await rendered()).alpha,0);assert.equal(read(),stable);
 await color.locator('..').locator('.gradient-stop-swatch').click();await page.locator('dialog.paint-picker[open]').getByLabel('Color value',{exact:true}).fill('color(display-p3 0.2 0.4 0.6 / 0.25)');await page.getByRole('button',{name:'Apply color',exact:true}).click();await record();assert.equal((await rendered()).alpha,0);assert.equal(await alpha.inputValue(),'25');
 await color.fill('ABCDEF');await color.press('Enter');await record();await alpha.fill('37.5');await alpha.press('Enter');await record();
 await page.getByRole('button',{name:'Show background color',exact:true}).click();await record();const shown=await rendered();assert.deepEqual(shown.channels.map(n=>Math.round(n*255)),[171,205,239]);assert.equal(shown.alpha,.375);
 assert.deepEqual(await target.evaluate(el=>[getComputedStyle(el).backgroundImage,getComputedStyle(el).backgroundSize]),images);
 await color.scrollIntoViewIfNeeded();const geometry=await color.evaluate(el=>{const row=el.closest('.compact-paint-row'),eye=row.querySelector('.background-visibility').getBoundingClientRect(),field=el.getBoundingClientRect(),alpha=row.querySelector('.compact-paint-alpha').getBoundingClientRect();return {fieldWidth:field.width,ordered:field.right<=alpha.left+1&&alpha.right<=eye.left+1,height:row.getBoundingClientRect().height};});assert.ok(geometry.ordered&&geometry.fieldWidth>=45&&geometry.height<=36,JSON.stringify(geometry));
 if(process.env.RT_E2E_BACKGROUND_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_BACKGROUND_SCREENSHOT});
 for(const expected of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 for(const expected of states.slice(1)){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===expected);await settled();}
 assert.equal((await rendered()).alpha,.375);
 const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(()=>app.locator('body').evaluate((el,w)=>innerWidth===w,Number(value.split('x')[0])));await settled();};
 await size('768x1024');await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 const beforeScope=read();await page.getByRole('button',{name:'Hide background color',exact:true}).click();await wait(()=>read()!==beforeScope);await settled();assert.equal((await rendered()).alpha,0);
 await size('390x844');assert.equal((await rendered()).alpha,.375);
 const eye=page.locator('.background-visibility');await wait(async()=>await eye.isDisabled()&&await eye.getAttribute('aria-label')==='Hide background color');const outside=read();await eye.evaluate(el=>el.onclick());await settled();assert.equal(read(),outside,'out-of-range eye cannot write the phone paint into the tablet scope');
 await size('768x1024');assert.equal((await rendered()).alpha,0);await wait(async()=>!await eye.isDisabled()&&await eye.getAttribute('aria-label')==='Show background color');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeScope);await settled();assert.equal((await rendered()).alpha,.375);
 console.log(kind+': PASS background eye, hidden hex/opacity edits, preview cancellation, framing and exact undo/redo');
};
