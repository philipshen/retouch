'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const entry=read(),card=page.getByRole('treeitem',{name:'rect · Card',exact:true}),circle=page.getByRole('treeitem',{name:'circle',exact:true}),setup=[];
 const undo=async before=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);};
 const select=async(gradient=true)=>{await card.click();await settled();await circle.click({modifiers:['Meta']});await settled();if(gradient)await page.getByLabel('Shared fill paint opacity (%)',{exact:true}).waitFor();};
 const models=()=>page.evaluate(()=>sel.multiple.map(info=>info.svgStrokeSource.model));
 const prepare=async(layer,fill,stroke)=>{await layer.click();await settled();for(const [paint,kind,alpha]of [['Fill','linearGradient',fill],['Stroke','radialGradient',stroke]]){setup.push(read());await page.getByLabel(paint+' type',{exact:true}).selectOption(kind);await settled();await wait(()=>read()!==setup.at(-1));setup.push(read());const input=page.getByLabel(paint+' gradient opacity (%)',{exact:true});await input.fill(String(alpha));await input.press('Enter');await settled();await wait(()=>read()!==setup.at(-1));}};
 await prepare(card,40,60);
 for(const allGradients of [false,true]){
  if(allGradients)await prepare(circle,80,90);await select();const before=read(),original=await models();if(allGradients)await page.screenshot({path:'/tmp/retouch-shared-gradient-opacity-'+(process.env.RT_E2E_RENDERER||'html')+'-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
  const check=async(property,values)=>{const current=await models();current.forEach((model,i)=>{assert.ok(Math.abs(model[property]-values[i])<1e-9);assert.deepEqual({...model,[property]:original[i][property]},original[i]);});await page.evaluate(()=>{for(const info of sel.multiple)RetouchSVGStrokeFidelity.check(matchingEls(info.id)[0],info.svgStrokeSource.model,info.svgStrokeSource.definitionId);});assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');};
  const history=async(action,property,values)=>{await action();await settled();await wait(()=>read()!==before);const after=read();await check(property,values);await undo(before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await check(property,values);await undo(before);};
  for(const paint of ['fill','stroke']){
   const property=paint+'Opacity',field=page.getByLabel('Shared '+paint+' paint opacity (%)',{exact:true});assert.equal(await field.inputValue(),'');assert.equal(await field.getAttribute('placeholder'),'Mixed');
   await history(async()=>{await field.fill('35');await field.press('Enter');},property,[.35,.35]);
   await history(async()=>{await field.focus();await page.keyboard.down('ArrowDown');await page.keyboard.down('ArrowDown');assert.equal(read(),before);await page.keyboard.up('ArrowDown');},property,original.map(model=>model[property]-.02));
   const markup=await app.locator('[data-rt-stroke-alignment]').evaluateAll(nodes=>nodes.map(node=>node.innerHTML));await field.focus();await page.keyboard.down('ArrowDown');assert.equal(read(),before);await page.keyboard.press('Escape');await page.keyboard.up('ArrowDown');assert.equal(read(),before);assert.deepEqual(await app.locator('[data-rt-stroke-alignment]').evaluateAll(nodes=>nodes.map(node=>node.innerHTML)),markup);
   await field.focus();await page.keyboard.down('ArrowDown');await page.keyboard.down('ArrowUp');await page.keyboard.up('ArrowDown');await page.keyboard.up('ArrowUp');await settled();assert.equal(read(),before);assert.deepEqual(await models(),original);
   if(!allGradients){await field.focus();await page.keyboard.press('Shift+ArrowUp');await settled();assert.equal(read(),before);assert.deepEqual(await models(),original);}
   await history(async()=>{const label=field.locator('xpath=..').locator('span').first(),box=await label.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-3,box.y+box.height/2,{steps:3});assert.equal(read(),before);await page.mouse.up();},property,original.map(model=>model[property]-.03));
  }
  await app.locator('head').evaluate(head=>{const style=head.ownerDocument.createElement('style');style.id='shared-gradient-override';style.textContent='[data-rt-stroke-alignment] stop{stop-color:lime!important}';head.append(style);});assert.equal(await page.evaluate(()=>writeSVGStrokeSelection(sel.multiple,'fillOpacity',[.2,.3])),false);assert.equal(read(),before);await app.locator('#shared-gradient-override').evaluate(el=>el.remove());
 }
 for(const before of setup.reverse())await undo(before);assert.equal(read(),entry);await select(false);
 console.log('PASS shared gradient opacity: mixed solid/gradient and gradient selections, stop preservation, absolute values, relative held keys/drags, Escape, atomic refusal and exact history');
};
