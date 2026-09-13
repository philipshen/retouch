'use strict';
const assert=require('node:assert/strict'),A=require('../../shell/svg-affine.js');
module.exports=async({page,app,select,read,wait,settled,original,kind})=>{
 const hint=page.locator('[data-numeric-scrub-speed]');
 const measure=async()=>{const ids=await page.evaluate(()=>sel.multiple.map(info=>info.id));return app.locator('svg').first().evaluate((svg,ids)=>{const nodes=ids.map(id=>svg.ownerDocument.querySelector('[data-rt="'+id+'"]'));return nodes.map(el=>{const m=el.getScreenCTM(),r=el.getBoundingClientRect();return {id:el.getAttribute('data-rt'),covered:nodes.some(parent=>parent!==el&&parent.contains(el)),transform:el.getAttribute('transform'),m:[m.a,m.b,m.c,m.d,m.e,m.f],r:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};});},ids);};
 const history=async()=>{await settled();await wait(()=>read()!==original);const changed=read();for(const [action,expected]of [['Undo',original],['Redo',changed],['Undo',original]]){await page.getByRole('button',{name:action,exact:true}).click();await settled();await wait(()=>read()===expected);}};
 for(const nested of [false,true])for(const name of ['Selection X','Selection Y','Selection width','Selection height','Rotate selection (°)']){
  await select(nested?'circle':'g',nested?'Circle':'Group');await page.getByRole('treeitem',{name:nested?'g · Group':'circle · Circle',exact:true}).click({modifiers:[nested?'Shift':'Meta']});await settled();
  const geometry=await measure(),outer=geometry.filter(m=>!m.covered),left=Math.min(...outer.map(m=>m.r.left)),top=Math.min(...outer.map(m=>m.r.top)),right=Math.max(...outer.map(m=>m.r.right)),bottom=Math.max(...outer.map(m=>m.r.bottom));
  const members=app.locator('svg [aria-label]'),before=await members.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),input=page.getByRole('textbox',{name,exact:true}),initial=Number(await input.inputValue());await input.scrollIntoViewIfNeeded();const label=input.locator('xpath=..').locator('[data-numeric-scrub]'),r=await label.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await hint.waitFor();await page.mouse.move(x+10,y,{steps:3});assert.equal(Number(await input.inputValue()),initial+10);assert.equal(read(),original);assert.notDeepEqual(await members.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),before,'selection previews '+name);
  const sx=name==='Selection width'?(initial+10)/initial:1,sy=name==='Selection height'?(initial+10)/initial:1,global=name==='Rotate selection (°)'?A.parse('rotate(-10 '+((left+right)/2)+' '+((top+bottom)/2)+')'):[sx,0,0,sy,left*(1-sx)+(name==='Selection X'?10:0),top*(1-sy)+(name==='Selection Y'?10:0)],after=await measure();geometry.forEach((m,i)=>{A.multiply(global,m.m).forEach((v,j)=>assert.ok(Math.abs(v-after[i].m[j])<.002,'preview matrix '+name+' '+j));if(m.covered)assert.equal(after[i].transform,m.transform);});
  await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await members.evaluateAll(els=>els.map(el=>el.getAttribute('transform'))),before);assert.equal(read(),original);
  await page.mouse.move(x,y);await page.mouse.down();await hint.waitFor();await page.mouse.move(x+10,y,{steps:3});await page.mouse.up();await hint.waitFor({state:'detached'});await history();
 }
 await select('g','Group');await page.getByRole('treeitem',{name:'circle · Circle',exact:true}).click({modifiers:['Meta']});await settled();
 const width=page.getByRole('textbox',{name:'Selection width',exact:true}),height=page.getByRole('textbox',{name:'Selection height',exact:true}),lock=page.getByRole('button',{name:'Lock selection proportions',exact:true});await lock.click();
 const w=Number(await width.inputValue()),h=Number(await height.inputValue());await width.scrollIntoViewIfNeeded();const r=await width.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
 await page.mouse.move(x,y);await page.keyboard.down('Alt');await page.mouse.down();await hint.waitFor();
 for(const [dx,dy,delta,speed]of [[10,0,10,'1x'],[10,-60,10,'2x'],[20,-60,30,'2x'],[20,60,30,'1/2'],[30,60,35,'1/2'],[30,100,35,'1/4'],[40,100,37.5,'1/4']]){await page.mouse.move(x+dx,y+dy);assert.ok(Math.abs(Number(await width.inputValue())-w-delta)<.001);assert.equal(await hint.textContent(),speed);assert.ok(Math.abs(Number(await height.inputValue())-h*(w+delta)/w)<.001);}
 assert.equal(read(),original);await page.mouse.up();await page.keyboard.up('Alt');await history();await lock.click();
 const circle=app.locator('[aria-label="Circle"]'),circleOriginal=await circle.getAttribute('transform');await width.scrollIntoViewIfNeeded();const b=await width.boundingBox();await page.mouse.move(b.x+5,b.y+5);await page.keyboard.down('Alt');await page.mouse.down();await hint.waitFor();await page.mouse.move(b.x+15,b.y+5);
 await circle.evaluate(el=>el.setAttribute('transform','translate(777 888)'));await hint.waitFor({state:'detached'});assert.equal(await circle.getAttribute('transform'),'translate(777 888)');assert.equal(read(),original);await page.mouse.up();await page.keyboard.up('Alt');
 // Restore the external DOM-only fixture edit after verifying the scrubber preserves it.
 await circle.evaluate((el,value)=>value===null?el.removeAttribute('transform'):el.setAttribute('transform',value),circleOriginal);await select('rect','Box');
 await require('./svg-scrub-interruption.cjs')({page,app,select,read,settled,original,kind,multiple:true});
 console.log('SVG SELECTION SCRUB: five fields, ordinary and nested selection previews, Escape and exact history PASS '+kind);
};
