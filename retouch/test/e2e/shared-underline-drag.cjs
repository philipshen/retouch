'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const show=control=>wait(()=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(el.isConnected&&!el.matches(':disabled')&&el.getClientRects().length>0))));}));
 await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 for(const [name,thickness,offset]of [['h1 · Headline','3px','2px'],['p · Other text','7px','8px']]){
  await page.getByRole('treeitem',{name,exact:true}).click();await settled();for(const [label,value]of [['Underline thickness',thickness],['Underline offset',offset]]){const before=read(),input=page.getByLabel(label,{exact:true});await show(input);await input.fill(value);await input.press('Enter');await wait(()=>read()!==before);await settled();}
 }
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();const original=read(),nodes=app.locator('h1,p.other-font'),styles=await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style')));
 for(const [label,property,initial,expected]of [['Underline thickness','text-decoration-thickness',['3px','7px'],['9px','13px']],['Underline offset','text-underline-offset',['2px','8px'],['8px','14px']]]){
  const input=page.getByLabel('Shared '+label,{exact:true}),measure=()=>nodes.evaluateAll((nodes,p)=>nodes.map(el=>getComputedStyle(el).getPropertyValue(p)),property);
  const drag=async()=>{await show(input);const label=input.locator('..').locator(':scope > span');let box;await wait(async()=>!!(box=await label.boundingBox()));await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+6,box.y+box.height/2,{steps:3});};
  assert.equal(await input.inputValue(),'');await drag();await wait(async()=>JSON.stringify(await measure())===JSON.stringify(expected));assert.equal(read(),original);await page.keyboard.press('Escape');await page.mouse.up();await settled();assert.deepEqual(await measure(),initial);assert.deepEqual(await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),styles);
  await drag();await page.mouse.up();await wait(()=>read()!==original);await settled();await wait(async()=>JSON.stringify(await measure())===JSON.stringify(expected));const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(async()=>JSON.stringify(await measure())===JSON.stringify(initial));await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
  await show(input);await input.fill('auto');await input.press('Enter');await wait(()=>read()!==original);await settled();const automatic=read();await drag();assert.equal(await page.locator('[data-numeric-scrub-speed]').count(),0);await page.mouse.up();assert.equal(read(),automatic);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 }
 console.log(kind+': PASS shared mixed underline length dragging, live preview/cancel, exact styles, grouped undo/redo and automatic-value refusal');
};
