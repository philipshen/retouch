'use strict';
const assert=require('node:assert/strict'),layout=require('../../shell/selection-layout.js');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),group=page.getByRole('treeitem',{name:'div · Group',exact:true}),named=page.getByRole('treeitem',{name:'p · Named text',exact:true});
 const measure=()=>app.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.x,top:r.y,width:r.width,height:r.height};})),parent=()=>app.locator('main').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.x,top:r.y,width:r.width,height:r.height};});
 for(const size of [390,768,1100]){
  const width=page.getByLabel('Screen width',{exact:true});await width.fill(String(size));await width.press('Enter');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===size);await settled();
  for(const multiple of [false,true]){
   await group.click();if(multiple)await named.click({modifiers:['Meta']});await settled();await page.getByLabel('Align to',{exact:true}).selectOption('parent');
   for(const mode of ['left','center','right','top','middle','bottom']){
    const start=await measure(),left=Math.min(start[0].left,start[1].left),top=Math.min(start[0].top,start[1].top),bounds=[{left,top,width:Math.max(start[0].left+start[0].width,start[1].left+start[1].width)-left,height:Math.max(start[0].top+start[0].height,start[1].top+start[1].height)-top},...(multiple?[start[2]]:[])],deltas=layout.arrange(bounds,mode,await parent());
    if(deltas.every(d=>Math.abs(d.x)+Math.abs(d.y)<1/32))continue;
    await page.locator('[data-align="'+mode+'"]').click();await wait(()=>read()!==original);await settled();await wait(async()=>{const actual=await measure();return actual.every((box,i)=>Object.entries(box).every(([key,n])=>Math.abs(n-start[i][key]-(i<2||multiple?key==='left'?deltas[i<2?0:1].x:key==='top'?deltas[i<2?0:1].y:0:0))<.1));});assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multiple?2:1);
    const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByLabel('Align to',{exact:true}).selectOption('parent');
   }

   for(const [mode,key]of [['left','a'],['center','h'],['right','d'],['top','w'],['middle','v'],['bottom','s']]){
    if(multiple){const reference=await page.getByLabel('Align to',{exact:true}).locator('option').evaluateAll(options=>options.find(option=>option.textContent.includes('Named text')).value);await page.getByLabel('Align to',{exact:true}).selectOption(reference);}
    const start=await measure(),selected=multiple?start:start.slice(0,2),left=Math.min(...selected.map(box=>box.left)),top=Math.min(...selected.map(box=>box.top)),union={left,top,width:Math.max(...selected.map(box=>box.left+box.width))-left,height:Math.max(...selected.map(box=>box.top+box.height))-top},delta=layout.arrange([union],mode,await parent())[0];
    assert.ok(Math.abs(delta.x)+Math.abs(delta.y)>1/32,'asymmetric parent padding exercises each unit alignment');
    if(mode==='center'){await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});await page.keyboard.press('Alt+Shift+'+key);}else await page.locator('[data-align="'+mode+'"]').click({modifiers:['Shift']});
    await wait(()=>read()!==original);await settled();await wait(async()=>{const actual=await measure();return actual.every((box,i)=>Object.entries(box).every(([key,n])=>Math.abs(n-start[i][key]-(i<2||multiple?key==='left'?delta.x:key==='top'?delta.y:0:0))<.1));});assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multiple?2:1);
    const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
   }
  }
 }
 await group.click();await settled();await page.screenshot({path:'/tmp/retouch-group-parent-'+kind+'.png'});
 console.log(kind+': PASS single and mixed group alignment to parent bounds at 390/768/1100, whole-selection Shift alignment, keyboard shortcut, preserved sizes/spacing, selection and exact undo/redo');
};
