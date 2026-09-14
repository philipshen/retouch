'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled,original})=>{
 await page.getByRole('treeitem',{name:'div · Other',exact:true}).click({modifiers:['Meta']});await wait(()=>page.evaluate(()=>sel?.multiple?.length===2));await settled();const scope=page.getByLabel('Style screen scope',{exact:true});assert.equal(await scope.locator('option[value="min-[960px]:"]').count(),1);
 await page.getByRole('button',{name:'Compare screens',exact:true}).click();const preview=name=>page.frameLocator('iframe[title="'+name+' comparison preview"]');for(const name of ['Phone','Tablet','Desktop']){await preview(name).locator('input').waitFor();await preview(name).locator('input').evaluate((el,name)=>{el.value=name;window.multiCSSDocument=document;},name);}
 const check=async(tablet,desktop)=>{for(const [name,widths]of [['Phone',[240,100]],['Tablet',tablet],['Desktop',desktop]]){assert.deepEqual(await preview(name).locator('body').evaluate(el=>['.box','.other'].map(selector=>el.querySelector(selector).getBoundingClientRect().width)),widths);assert.equal(await preview(name).locator('input').inputValue(),name);assert.equal(await preview(name).locator('input').evaluate(()=>document===window.multiCSSDocument),true);}};
 await scope.selectOption('min-[768px]:');await settled();await check([320,280],[480,420]);
 const reset=async()=>{const disclosure=page.getByText('Breakpoint options',{exact:true});if(!await disclosure.evaluate(el=>el.parentElement.open))await disclosure.click();await page.getByRole('button',{name:'Reset overrides at this size',exact:true}).click();await settled();};
 await reset();await wait(()=>read()!==original);await settled();const first=read();await check([240,100],[480,420]);assert.equal(await page.evaluate(()=>sel.multiple.length),2);
 await scope.selectOption('min-[960px]:');await settled();await reset();await wait(()=>read()!==first);await settled();const second=read();await check([240,100],[480,100]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===first);await settled();await check([240,100],[480,420]);assert.equal(await page.evaluate(()=>sel.multiple.length),2);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await check([320,280],[480,420]);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===first);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===second);await settled();await check([240,100],[480,100]);assert.equal(await app.locator('input').inputValue(),'retained');assert.equal(await app.locator('input').evaluate(()=>window.scopeResetToken),'same document');
};
