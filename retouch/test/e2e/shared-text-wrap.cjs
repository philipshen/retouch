'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const show=control=>wait(()=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(el.isConnected&&!el.matches(':disabled')&&el.getClientRects().length>0))));}));
 const group=async()=>{await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();};
 const nodes=app.locator('h1,p.other-font'),measure=()=>nodes.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).getPropertyValue('text-wrap'))),initial=await measure(),screen=page.getByLabel('Screen size',{exact:true}),original=read();
 const lineCount=()=>app.locator('p.other-font').evaluate(el=>{const range=el.ownerDocument.createRange();range.selectNodeContents(el);return new Set([...range.getClientRects()].map(rect=>Math.round(rect.top*100)/100)).size;});assert.ok(await lineCount()>1,'fixture must wrap before editing');
 await screen.selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await group();const input=page.getByLabel('Shared Wrap style',{exact:true});
 for(const value of ['balance','pretty','nowrap','wrap']){
  await show(input);await input.selectOption(value);await wait(()=>read()!==original);await settled();await wait(async()=>(await measure()).every(item=>item===value));const changed=read();await wait(async()=>value==='nowrap'?await lineCount()===1:await lineCount()>1);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await screen.focus();await screen.selectOption('390x844');await settled();await screen.focus();await wait(()=>input.isDisabled());assert.deepEqual(await measure(),initial);assert.ok(await lineCount()>1,'outside the edit range the paragraph wraps again');await input.evaluate(el=>{el.value='balance';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(read(),changed);await screen.selectOption('768x1024');await settled();
  const reset=page.getByRole('button',{name:'Reset shared wrap style',exact:true,includeHidden:true});await show(reset);await reset.click();await wait(()=>read()!==changed);await settled();assert.deepEqual(await measure(),initial);assert.ok(await lineCount()>1,'reset restores wrapped geometry');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 }
 await nodes.first().evaluate(el=>el.style.setProperty('text-wrap-mode','nowrap','important'));await group();await wait(()=>input.isDisabled());await input.evaluate(el=>{el.value='wrap';el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),original);
 console.log(kind+': PASS shared Auto/Balance/Pretty/No wrap, rendered line counts, scope/reset/undo and important inline longhand refusal');
};
