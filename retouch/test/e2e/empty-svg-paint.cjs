'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,shape,read,wait,settled,screenshot})=>{
 const original=read();
 for(const paint of ['fill','stroke']){
  const appearance=()=>shape.evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),paint),initial=await appearance();
  if(initial!=='none'){await page.getByRole('button',{name:'Remove '+paint,exact:true}).click();await wait(()=>read()!==original);await settled();}
  await wait(async()=>await appearance()==='none');const empty=read(),section=page.locator('#panelBody > [data-section="'+paint+'"]'),add=page.getByRole('button',{name:'Add '+paint,exact:true});
  await add.waitFor();assert.equal(await page.getByLabel('SVG '+paint,{exact:true}).isVisible(),false);assert.ok(await section.evaluate(el=>el.getBoundingClientRect().height)<75);
  if(paint==='fill'&&screenshot)await page.screenshot({path:screenshot});
  await add.click();await page.getByRole('menu',{name:'Add '+paint,exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(read(),empty);assert.equal(await add.evaluate(el=>el===document.activeElement),true);
  const open=async()=>{await add.click();await page.getByRole('menuitem',{name:'Solid',exact:true}).click();};
  await open();const picker=page.getByRole('dialog',{name:'Edit SVG '+paint,exact:true}),color=picker.getByLabel('Color value',{exact:true});await color.fill('#224466');assert.notEqual(await appearance(),'none');assert.equal(read(),empty);
  await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});assert.equal(await appearance(),'none');assert.equal(read(),empty);
  await open();await color.fill('#224466');await picker.getByRole('button',{name:'Apply color',exact:true}).click();await wait(()=>read()!==empty);await settled();assert.notEqual(await appearance(),'none');await page.getByRole('button',{name:'Remove '+paint,exact:true}).waitFor();assert.equal(await page.getByLabel('SVG '+paint,{exact:true}).isVisible(),true);
  const painted=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===empty);await settled();await add.waitFor();
  await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===painted);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===empty);await settled();
  if(initial==='none'){
   await add.click();const gradient=page.getByRole('menuitem',{name:'Linear gradient',exact:true});assert.equal(await gradient.isEnabled(),true,'original empty paint can create a gradient');{await gradient.click();await wait(()=>read()!==empty);await settled();await wait(async()=>/^url\(/.test(await appearance()));await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===empty);await settled();}
  }else{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();}
  assert.equal(read(),original);
 }
};
