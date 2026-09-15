'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled,kind})=>{
 const shared=!!process.env.RT_E2E_SHARED_ADAPTIVE,source=read(),targets=app.locator('h1,p.other-font'),styles=await targets.evaluateAll(els=>els.map(el=>el.getAttribute('style'))),screen=page.getByLabel('Screen size',{exact:true});
 await screen.focus();await screen.selectOption('768x1024');await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
 if(shared){await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();}
 const button=page.getByLabel(shared?'Shared Adaptive grid':'Adaptive grid',{exact:true}),minimum=page.getByLabel((shared?'Shared ':'')+'Minimum column size (px)',{exact:true});
 assert.equal(await button.isEnabled(),true);await button.click();await wait(()=>read()!==source);await settled();const adapted=read();assert.equal(await button.getAttribute('aria-pressed'),'true');
 await minimum.fill('180');await minimum.press('Tab');await wait(()=>read()!==adapted);await settled();const changed=read();assert.match(changed,/180px/);await wait(async()=>{const columns=await targets.evaluateAll(els=>els.map(el=>getComputedStyle(el).gridTemplateColumns));return columns[0]!=='30px 50px'&&(shared?columns[1]!=='30px 50px':columns[1]==='30px 50px');});assert.deepEqual(await targets.evaluateAll(els=>els.map(el=>el.getAttribute('style'))),styles);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await screen.focus();await screen.selectOption('390x844');await settled();await screen.focus();await wait(()=>button.isDisabled());assert.deepEqual(await targets.evaluateAll(els=>els.map(el=>getComputedStyle(el).gridTemplateColumns)),['30px 50px','30px 50px']);
 await screen.selectOption('768x1024');await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===adapted);await settled();assert.equal(await minimum.inputValue(),'240');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===source);await settled();
 await targets.first().evaluate(el=>el.style.setProperty('grid-template-columns','30px 50px','important'));await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click();await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click({modifiers:shared?['Shift']:[]});await settled();assert.equal(await button.isDisabled(),true);assert.equal(read(),source);
 console.log(kind+': PASS '+(shared?'shared':'single')+' adaptive inline grid, minimum, responsive isolation, exact undo and important guard');
};
