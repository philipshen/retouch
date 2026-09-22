'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait,sharp})=>{
 const initial=read(),group=app.locator('[data-rt-stroke-alignment]');
 const model=()=>page.evaluate(()=>sel.info.svgStrokeSource.model),id=await group.getAttribute('data-rt-stroke-id');
 const verify=async()=>{await page.evaluate(()=>RetouchSVGStrokeFidelity.check(matchingEls(sel.info.id)[0],sel.info.svgStrokeSource.model,sel.info.svgStrokeSource.definitionId));assert.equal(await group.getAttribute('data-rt-stroke-id'),id);assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');};
 const undo=async before=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);};
 const history=async(action,check=async()=>{})=>{const before=read();await action();await settled();await wait(()=>read()!==before);const after=read();await verify();await check();await undo(before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await verify();await check();await undo(before);};
 const create=()=>page.getByLabel('Fill type',{exact:true}).selectOption('linearGradient');
 await history(create,async()=>assert.equal((await model()).gradients.fill.type,'linearGradient'));
 await create();await settled();await wait(()=>read()!==initial);const filled=read();
 await page.screenshot({path:'/tmp/retouch-retained-gradient-'+(process.env.RT_E2E_RENDERER||'html')+'-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
 const {data,info:bitmap}=await sharp(await app.locator('svg[data-rt]').screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [x,expected]of [[35,64],[65,191]]){const offset=(Math.floor(bitmap.height*.5)*bitmap.width+Math.floor(bitmap.width*x/100))*3,actual=[...data.subarray(offset,offset+3)];assert.ok(Math.abs(actual[0]-255)<5&&Math.abs(actual[1]-expected)<8&&Math.abs(actual[2]-expected)<8,JSON.stringify({x,actual,expected}));}

 const panel=page.locator('[data-gradient-paint="fill"]'),field=async(label,value)=>{const input=panel.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');};
 await history(()=>field('Stop 1 color','#00ff00'),async()=>assert.equal((await model()).gradients.fill.stops[0].color,'#00ff00'));
 await history(()=>field('Stop 2 opacity','0.75'));
 await history(()=>field('Fill gradient opacity (%)','35'),async()=>assert.equal((await model()).fillOpacity,.35));
 await history(async()=>{const alpha=panel.getByLabel('Fill gradient opacity (%)',{exact:true});await alpha.focus();await page.keyboard.down('ArrowDown');await page.keyboard.down('ArrowDown');assert.equal(read(),filled);await page.keyboard.up('ArrowDown');},async()=>assert.equal((await model()).fillOpacity,.98));
 await history(()=>field('Gradient x2','75%'));
 await history(()=>panel.getByRole('button',{name:'Reverse fill gradient',exact:true}).click());
 await history(()=>panel.getByRole('button',{name:'Add gradient stop at position',exact:true}).click(),async()=>assert.equal((await model()).gradients.fill.stops.length,3));
 await history(()=>panel.getByLabel('Gradient type',{exact:true}).selectOption('radialGradient'));
 await history(async()=>{await panel.getByRole('button',{name:'Edit fill gradient on canvas',exact:true}).click();const handle=page.getByRole('button',{name:'Gradient end handle',exact:true});await handle.focus();await page.keyboard.press('ArrowLeft');assert.equal(read(),filled);await page.keyboard.press('Enter');});
 await history(async()=>{await panel.getByRole('button',{name:'Edit fill gradient on canvas',exact:true}).click();const handle=page.getByRole('button',{name:'Gradient end handle',exact:true}),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-12,box.y+box.height/2,{steps:4});assert.equal(read(),filled);await page.mouse.up();await settled();await wait(()=>read()!==filled);await handle.waitFor();await page.keyboard.press('Escape');});
 await panel.getByRole('button',{name:'Edit fill gradient on canvas',exact:true}).click();await page.getByRole('button',{name:'Gradient end handle',exact:true}).focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Escape');assert.equal(read(),filled);await verify();
 await history(()=>page.getByLabel('Stroke type',{exact:true}).selectOption('radialGradient'),async()=>{const m=await model();assert.equal(m.gradients.fill.type,'linearGradient');assert.equal(m.gradients.stroke.type,'radialGradient');});
 // Gradient stops and references must stay source-backed before any owner edit.
 const stop=group.locator('linearGradient stop').first();await stop.evaluate(el=>el.style.setProperty('stop-color','lime','important'));assert.equal(await page.evaluate(()=>setSVGGradient(sel.info,'fill',{'x1':'20%'})),false);assert.equal(read(),filled);await stop.evaluate(el=>el.style.removeProperty('stop-color'));await verify();
 await history(()=>panel.getByLabel('Gradient type',{exact:true}).selectOption('solid'),async()=>assert.equal((await model()).gradients,undefined));
 await undo(initial);assert.equal(read(),initial);console.log('PASS retained fill/stroke gradients: stops, type, coordinates, canvas edits/cancel, CSS refusal, exact history and retained document');
};
