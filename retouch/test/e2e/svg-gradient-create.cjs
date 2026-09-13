'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read();
 await page.getByRole('treeitem',{name:'rect · Solid box',exact:true}).click();await settled();const styled=app.locator('[aria-label="Solid box"]');assert.equal(await styled.getAttribute('class'),'layout-marker');
 const initialStyle=await styled.getAttribute('style');assert.ok(initialStyle.includes('opacity'));
 // Active opacity animation must not lock either paint; animated fill locks only fill.
 for(const paint of ['opacity','fill','stroke']){
  await styled.evaluate((el,property)=>{el.retouchTestAnimation=el.animate({[property]:property==='opacity'?['0.7','0.9']:['#112233','#445566']},{duration:100000,iterations:Infinity});},paint);
  await page.evaluate(()=>queueViewportPanelRefresh());await settled();
  for(const candidate of ['fill','stroke'])await wait(async()=>await page.getByLabel(candidate==='fill'?'Fill type':'Stroke type',{exact:true}).isDisabled()===(paint===candidate));
  assert.equal(read(),original);await styled.evaluate(el=>{el.retouchTestAnimation.cancel();delete el.retouchTestAnimation;});
 }
 await page.evaluate(()=>queueViewportPanelRefresh());await settled();
 const attributes=await styled.evaluate(el=>[el.getAttribute('fill'),el.getAttribute('stroke')]);
 await styled.evaluate(el=>{const style=el.ownerDocument.createElement('style');style.id='gradient-class-guard';style.textContent='.layout-marker{fill:rgb(1,2,3)!important}';el.ownerDocument.head.append(style);});
 await wait(async()=>await page.getByLabel('Fill type',{exact:true}).isDisabled());assert.equal(await page.getByLabel('Stroke type',{exact:true}).isEnabled(),true);assert.match(await page.getByLabel('Fill type',{exact:true}).getAttribute('title'),/Page styles/);assert.equal(read(),original);assert.deepEqual(await styled.evaluate(el=>[el.getAttribute('fill'),el.getAttribute('stroke')]),attributes);
 await styled.evaluate(el=>el.ownerDocument.getElementById('gradient-class-guard').remove());await wait(async()=>await page.getByLabel('Fill type',{exact:true}).isEnabled());assert.equal(read(),original);
 await page.getByRole('treeitem',{name:'rect · Inline fill box',exact:true}).click();await settled();assert.equal(await page.getByLabel('Fill type',{exact:true}).isDisabled(),true);assert.match(await page.getByLabel('Fill type',{exact:true}).getAttribute('title'),/Inline styles/);assert.equal(await page.getByLabel('Stroke type',{exact:true}).isEnabled(),true);assert.equal(read(),original);
 const mixed=app.locator('[aria-label="Inline fill box"]'),mixedStyle=await mixed.getAttribute('style'),mixedFill=await mixed.evaluate(el=>getComputedStyle(el).fill);await page.getByLabel('Stroke type',{exact:true}).selectOption('radialGradient');await settled();await wait(async()=>/^url\(#rt-gradient-/.test(await mixed.getAttribute('stroke')));assert.equal(await mixed.getAttribute('style'),mixedStyle);assert.equal(await mixed.evaluate(el=>getComputedStyle(el).fill),mixedFill);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 for(const paint of ['fill','stroke'])for(const type of ['linearGradient','radialGradient']){
  await page.getByRole('treeitem',{name:'rect · Solid box',exact:true}).click();await settled();const layer=app.locator('[aria-label="Solid box"]'),sourceId=await layer.getAttribute('data-rt'),prior=await layer.getAttribute(paint),computed=await layer.evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),paint);
  await layer.evaluate(el=>el.animate({opacity:['0.7','0.9']},{duration:100000,iterations:Infinity}));
  await page.getByLabel(paint==='fill'?'Fill type':'Stroke type',{exact:true}).selectOption(type);await settled();await wait(async()=>/^url\(#rt-gradient-/.test(await layer.getAttribute(paint)));const id=(await layer.getAttribute(paint)).slice(5,-1);await wait(async()=>await app.locator('#'+id).count()===1);assert.equal(await app.locator('#'+id).evaluate(el=>el.localName),type);assert.equal(await layer.getAttribute('data-rt'),sourceId);assert.equal(await layer.getAttribute('class'),'layout-marker');assert.equal(await layer.getAttribute('style'),initialStyle);assert.equal(await app.locator('#'+id+' > stop').first().evaluate(el=>getComputedStyle(el).stopColor),computed);assert.equal(await app.locator('#'+id+' > stop').last().getAttribute('stop-opacity'),'0');const created=read();
  const field=page.getByLabel('Stop 1 color',{exact:true});await field.fill('#ff0000');await field.press('Tab');await settled();await wait(async()=>await app.locator('#'+id+' > stop').first().getAttribute('stop-color')==='#ff0000');const edited=read();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===created);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator('#'+id).count()===0);assert.equal(await layer.getAttribute(paint),prior);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===created);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===edited);await wait(async()=>await app.locator('#'+id+' > stop').first().getAttribute('stop-color')==='#ff0000');
  if(process.env.RT_E2E_GRADIENT_CREATE_SCREENSHOT){await page.locator('[data-gradient-paint="'+paint+'"]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.RT_E2E_GRADIENT_CREATE_SCREENSHOT});}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===created);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();console.log('PASS create SVG gradients: linear/radial fill/stroke, computed color, editing, identity and exact undo/redo cleanup');
};
