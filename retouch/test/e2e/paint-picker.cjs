'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<input aria-label="Test color" value="#ff000080" style="position:absolute;right:20px;top:300px">');
  await page.addStyleTag({path:path.join(__dirname,'../../shell/shell.css')});
  for(const file of ['inspector.js','palette-values.js','color-styles.js','html-css-values.js','paint-picker.js'])await page.addScriptTag({path:path.join(__dirname,'../../shell',file)});
  await page.evaluate(()=>{window.writes=[];document.querySelector('input').onchange=event=>writes.push(event.target.value);});
  const open=()=>page.evaluate(()=>RetouchPaintPicker.open(document.querySelector('input'))),picker=page.getByRole('dialog'),value=picker.getByLabel('Color value',{exact:true});
  await open();const plane=picker.getByRole('slider',{name:'Saturation and brightness',exact:true}),box=await plane.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);assert.equal(await value.inputValue(),'#80404080');assert.deepEqual(await page.evaluate(()=>writes),[]);
  await plane.press('Shift+ArrowRight');assert.equal(await value.inputValue(),'#80333380');await picker.getByRole('button',{name:'Apply color',exact:true}).click();await picker.waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>writes),['#80333380']);
  await open();await picker.getByRole('button',{name:'Apply color',exact:true}).click();await picker.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>writes.length),1);
  await open();await value.fill('color(display-p3 1 0.2 0.3 / 0.4)');assert.equal(await plane.isVisible(),false);await picker.getByLabel('Display P3 green',{exact:true}).fill('0.6');await picker.getByRole('button',{name:'Apply color',exact:true}).click();await picker.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>writes.at(-1)),'color(display-p3 1 0.6 0.3 / 0.4)');
  await page.setViewportSize({width:360,height:600});await open();const rect=await picker.boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=360&&rect.y+rect.height<=600);await value.fill('#000');await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>writes.length),2);
  assert.deepEqual(errors,[]);console.log(engine+': PASS visual color pointer and keyboard HSV, alpha, draft cancellation, no-op apply, Display P3 channels and narrow-window bounds');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
