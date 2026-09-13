'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),solid=app.locator('[aria-label="Solid box"]'),dynamic=app.locator('[aria-label="Dynamic paint box"]');
 const history=async(name,text)=>{await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===text);};
 const interact=async source=>{
  await page.getByRole('button',{name:'Edit mode',exact:true}).click();await solid.click();await wait(async()=>await solid.getAttribute('width')==='60');await wait(async()=>await dynamic.getAttribute('fill')==='#00ff00');assert.equal(read(),source);
  await solid.click();await wait(async()=>await solid.getAttribute('width')==='50');await wait(async()=>await dynamic.getAttribute('fill')==='#0000ff');assert.equal(read(),source);await page.getByRole('button',{name:'Interact mode',exact:true}).click();
 };
 for(const [label,paint,layer]of [['Solid box','fill',solid],['Dynamic paint box','stroke',dynamic]]){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const id=await layer.getAttribute('data-rt');
  if(label==='Dynamic paint box'){assert.equal(await page.getByLabel('Fill type',{exact:true}).isDisabled(),true);assert.match(await page.getByLabel('Fill type',{exact:true}).getAttribute('title'),/dynamic expression/);}
  const control=page.getByLabel(paint==='fill'?'Fill type':'Stroke type',{exact:true});assert.equal(await control.isEnabled(),true);await control.selectOption(paint==='fill'?'linearGradient':'radialGradient');await settled();await wait(async()=>/^url\(#rt-gradient-/.test(await layer.getAttribute(paint)));const changed=read(),reference=await layer.getAttribute(paint);assert.equal(await layer.getAttribute('data-rt'),id);assert.ok(changed.includes('width={active?60:50} onClick={()=>setActive(!active)}'));assert.ok(changed.includes('fill={active?"#00ff00":"#0000ff"}'));
  await interact(changed);assert.equal(await layer.getAttribute(paint),reference);await history('Undo',original);await history('Redo',changed);await history('Undo',original);await interact(original);
 }
 console.log('PASS React SVG gradient creation preserves event handlers, stateful geometry, independently controlled paint, source identity and exact undo/redo');
};
