'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),stopAttributes=()=>app.locator('#paint > stop').evaluateAll(nodes=>nodes.map(node=>[...node.attributes].filter(a=>a.name!=='data-rt-revision').map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0]))));
 const cases=[['Gradient box','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','stroke']);
 for(const [label,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const layer=app.locator('[aria-label="'+label+'"]'),id=await layer.getAttribute('data-rt'),stops=await stopAttributes();
  const paintSection=page.locator('#panelBody > [data-section="'+paint+'"]');
  assert.equal(await paintSection.locator(':scope > [data-gradient-paint="'+paint+'"]').count(),1,'Gradient editor belongs to its paint section');
  assert.equal(await paintSection.getByLabel('SVG '+paint,{exact:true}).count(),0,'Gradient paint has no duplicate URL color field');
  assert.equal(await page.locator('#panelBody > [data-gradient-paint]').count(),0,'Gradient does not create a separate inspector section');
  if(paint==='stroke')assert.equal(await paintSection.getByLabel('SVG stroke width',{exact:true}).count(),1,'Stroke width remains available alongside the gradient');
  const heading=paint==='fill'?'Fill':'Stroke';
  await paintSection.getByRole('button',{name:'Collapse '+heading+' section',exact:true}).click();
  assert.equal(await paintSection.getByLabel('Gradient type',{exact:true}).isVisible(),false);
  await paintSection.getByRole('button',{name:'Expand '+heading+' section',exact:true}).click();
  assert.equal(await paintSection.getByLabel('Gradient type',{exact:true}).isVisible(),true);
  await page.getByLabel('Gradient type',{exact:true}).selectOption('radialGradient');await settled();await wait(async()=>await app.locator('#paint').evaluate(el=>el.localName)==='radialGradient');const radial=read();assert.notEqual(radial,original);assert.deepEqual(await stopAttributes(),stops);assert.equal(await layer.getAttribute('data-rt'),id);assert.equal(await layer.getAttribute(paint),'url(#paint)');assert.equal(await app.locator('[aria-label="Shared gradient"]').getAttribute('fill'),'url(#paint)');assert.equal(await page.getByLabel('Gradient cx',{exact:true}).count(),1);assert.equal(await page.getByLabel('Gradient x1',{exact:true}).count(),0);
  if(process.env.RT_E2E_GRADIENT_TYPE_SCREENSHOT){await paintSection.evaluate(el=>{el.scrollIntoView({block:'start'});document.getElementById('panel').scrollTop-=60;});await page.screenshot({path:process.env.RT_E2E_GRADIENT_TYPE_SCREENSHOT});}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await page.getByLabel('Gradient type',{exact:true}).inputValue()==='linearGradient');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===radial);await wait(async()=>await page.getByLabel('Gradient type',{exact:true}).inputValue()==='radialGradient');
  await page.getByLabel('Gradient type',{exact:true}).selectOption('linearGradient');await settled();await wait(()=>read()===original);assert.equal(await layer.getAttribute('data-rt'),id);
 }
 await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();console.log('PASS SVG gradient type: linear/radial, fill/stroke, shared stops, selected identity, coordinate fields and exact undo/redo');
};
