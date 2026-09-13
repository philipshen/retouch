'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,select,read,wait,settled,original,kind})=>{
 await select('rect','Box');const width=page.getByRole('textbox',{name:'Vector width',exact:true}),height=page.getByRole('textbox',{name:'Vector height',exact:true}),lock=page.getByRole('button',{name:'Lock vector proportions',exact:true});
 if(await lock.getAttribute('aria-pressed')!=='true')await lock.click();
 for(const [label,expression,value] of [['Vector width','60*1.5',90],['Vector X','(120 - 16) / 2',52],['Vector Y','-20 / 2',-10],['Vector rotation (°)','-10+45',35]]){
  const input=page.getByRole('textbox',{name:label,exact:true});await input.fill(expression);assert.equal(read(),original);await input.press('Enter');await settled();await wait(()=>read()!==original);assert.equal(Number(await input.inputValue()),value);if(label==='Vector width')assert.equal(Number(await height.inputValue()),60);const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 for(const expression of ['1/0','2^1024','alert(1)','-1','0','100001','(60+']){await width.fill(expression);await width.press('Enter');assert.equal(read(),original);assert.equal(await width.evaluate(el=>el.validity.valid),false);await width.press('Escape');assert.equal(Number(await width.inputValue()),60);assert.equal(read(),original);}
 await width.fill('60*1');await width.press('Enter');assert.equal(Number(await width.inputValue()),60);assert.equal(read(),original);await width.fill('60*3');await width.press('Escape');assert.equal(Number(await width.inputValue()),60);assert.equal(read(),original);await lock.click();assert.equal(await lock.getAttribute('aria-pressed'),'false');console.log('SVG EQUATIONS: position, rotation, locked dimensions, Enter/Escape, invalid input and exact history PASS '+kind);
};
