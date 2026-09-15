'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),measure=()=>app.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})),matches=async expected=>(await measure()).every((r,i)=>r.every((n,j)=>Math.abs(n-expected[i][j])<.1));
 for(const size of [390,1100]){
  const widthControl=page.getByLabel('Screen width',{exact:true});await widthControl.fill(String(size));await widthControl.press('Enter');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===size);await settled();
  for(const multiple of [false,true]){
   await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();if(multiple)await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Meta']});await settled();await page.evaluate(()=>RetouchZoom.toSelection(groupMovementRoots(true)));await settled();
   if(multiple)assert.equal(await page.locator('[data-section=scale]').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('[data-shared-section=appearance]'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'Scale precedes appearance controls');
   const before=await measure(),selected=before.slice(0,multiple?2:1),left=Math.min(...selected.map(r=>r[0])),top=Math.min(...selected.map(r=>r[1])),width=Math.max(...selected.map(r=>r[0]+r[2]))-left,expectedFor=factor=>before.map((r,i)=>i<(multiple?2:1)?[left+(r[0]-left)*factor,top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]:r);
   const expected=expectedFor(.75),input=page.getByLabel('Scale selection (%)',{exact:true});await input.fill('75');await input.press('Enter');await wait(()=>read()!==original);await settled();await wait(()=>matches(expected));assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multiple?2:1);const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(()=>matches(before));await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await wait(()=>matches(expected));await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(()=>matches(before));
   for(const cancel of [true,false]){
    await page.getByRole('button',{name:'Scale selection on canvas',exact:true}).click();const handle=page.getByRole('button',{name:'Scale bottom right',exact:true});await handle.press('ArrowRight');const expected=expectedFor((width+1)/width);await wait(()=>matches(expected));assert.equal(read(),original);await page.screenshot({path:'/tmp/retouch-layer-scale-'+kind+'.png'});
    if(cancel){await handle.press('Escape');await wait(()=>matches(before));assert.equal(read(),original);}else{await handle.press('Enter');await wait(()=>read()!==original);await settled();await wait(()=>matches(expected));await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(()=>matches(before));}
    assert.equal(await app.locator('h1,p').evaluateAll(nodes=>nodes.some(el=>el.style.scale||el.style.translate)),false,'temporary properties restored');
   }
  }
 }
 await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click({modifiers:['Meta']});await settled();await page.evaluate(()=>RetouchZoom.toSelection(groupMovementRoots(true)));await settled();
 const before=await measure(),parent=await app.locator('main').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y};}),expected=before.map(r=>[parent.x+(r[0]-parent.x)*.8,parent.y+(r[1]-parent.y)*.8,r[2]*.8,r[3]*.8]),input=page.getByLabel('Scale selection (%)',{exact:true});await input.fill('80');await input.press('Enter');await wait(()=>read()!==original);await settled();await wait(()=>matches(expected));assert.equal(await page.getByRole('treeitem',{selected:true}).count(),2);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(()=>matches(before));
 console.log(kind+': PASS selected parent and child scale once with exact undo');
 console.log(kind+': PASS ordinary single/multiple layer scaling at 390/1100, numeric and live canvas edits, fixed sibling geometry, Escape, selection retention and exact undo/redo');
};
