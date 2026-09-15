'use strict';
const assert=require('node:assert/strict');
const layout=require('../../shell/selection-layout.js');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),group=page.getByRole('treeitem',{name:'div · Group',exact:true});
 const measure=()=>app.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.x,top:r.y,width:r.width,height:r.height};}));
 const bounds=boxes=>[{left:Math.min(boxes[0].left,boxes[1].left),top:Math.min(boxes[0].top,boxes[1].top),width:Math.max(boxes[0].left+boxes[0].width,boxes[1].left+boxes[1].width)-Math.min(boxes[0].left,boxes[1].left),height:Math.max(boxes[0].top+boxes[0].height,boxes[1].top+boxes[1].height)-Math.min(boxes[0].top,boxes[1].top)},...boxes.slice(2)];
 await group.click();await page.getByRole('treeitem',{name:'p · Named text',exact:true}).click({modifiers:['Meta']});await page.getByRole('treeitem',{name:'p · Extra text',exact:true}).click({modifiers:['Meta']});await settled();assert.equal(await page.getByRole('treeitem',{selected:true}).count(),3);
 const choices=await page.getByLabel('Align to',{exact:true}).locator('option').evaluateAll(options=>options.map(option=>option.value));assert.equal(choices.length,4);
 for(const axis of ['x','y'])for(const operation of ['distribute',24,-4,'reference']){
  const start=await measure(),initial=bounds(start),anchor=operation==='reference'?1:null,gap=typeof operation==='number'?operation:18;
  await page.getByLabel('Align to',{exact:true}).selectOption(anchor===null?'selection':choices[anchor+1]);assert.equal(await page.locator('[data-distribution]:disabled').count(),anchor===null?0:2);
  const deltas=operation==='distribute'?layout.arrange(initial,'gap-'+axis):layout.setSpacing(initial,axis,gap,{anchor});
  if(operation==='distribute')await page.locator('[data-align="gap-'+axis+'"]').click();else{const input=page.getByLabel((axis==='x'?'Horizontal':'Vertical')+' gap (px)',{exact:true});await input.fill(String(gap));await input.press('Tab');}
  await wait(()=>read()!==original);await settled();const expected=(current)=>current.every((box,i)=>Object.entries(box).every(([key,n])=>Math.abs(n-start[i][key]-(key==='left'?deltas[i<2?0:i-1].x:key==='top'?deltas[i<2?0:i-1].y:0))<.1));await wait(async()=>expected(await measure()));
  const current=bounds(await measure()),gaps=layout.gaps(current,axis).values;assert.ok(Math.abs(gaps[0]-gaps[1])<.1,'equal rendered spacing');if(operation!=='distribute')assert.ok(gaps.every(value=>Math.abs(value-gap)<.1),'exact rendered gap');
  assert.equal(await page.getByRole('treeitem',{selected:true}).count(),3);if(anchor!==null)assert.deepEqual(current[anchor],initial[anchor]);
  const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await wait(async()=>expected(await measure()));await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 }
 await page.getByLabel('Align to',{exact:true}).selectOption('selection');await page.screenshot({path:'/tmp/retouch-group-spacing-'+kind+'.png'});await group.click();await settled();
 console.log(kind+': PASS three-root group distribution, positive/negative exact gaps on both axes, pinned reference, unchanged child dimensions and exact undo/redo');
};
