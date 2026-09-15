'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),group=page.getByRole('treeitem',{name:'div · Group',exact:true}),measure=()=>app.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 for(const multiple of [false,true]){
  await group.click();if(multiple)await page.getByRole('treeitem',{name:'p · Named text',exact:true}).click({modifiers:['Meta']});await settled();
  for(const factor of [.5,1.5,2]){
   const before=await measure(),selected=before.slice(0,multiple?3:2),left=Math.min(...selected.map(r=>r[0])),top=Math.min(...selected.map(r=>r[1])),expected=before.map((r,i)=>i<2||multiple?[left+(r[0]-left)*factor,top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]:r);
   const input=page.getByLabel('Scale selection (%)',{exact:true});await input.fill(String(factor*100));await input.press('Enter');await wait(()=>read()!==original);await settled();const matches=async()=>{const actual=await measure();return actual.every((r,i)=>r.every((n,j)=>Math.abs(n-expected[i][j])<.1));};await wait(matches);assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multiple?2:1);assert.equal(await app.locator('h1,p').evaluateAll(nodes=>nodes.some(el=>el.style.getPropertyValue('scale'))),false,'measurement scale styles restored');const changed=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(async()=>{const actual=await measure();return actual.every((r,i)=>r.every((n,j)=>Math.abs(n-before[i][j])<.1));});await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await wait(matches);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
  }
 }
 await group.click();await settled();await page.screenshot({path:'/tmp/retouch-group-scale-'+kind+'.png'});console.log(kind+': PASS proportional group scaling at 50/150/200 percent, single and mixed selections, preserved sibling layout, removed measurement styles and exact undo/redo');
};
