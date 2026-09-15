'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),group=page.getByRole('treeitem',{name:'div · Group',exact:true});
 for(const size of [390,768,1100]){
  const width=page.getByLabel('Screen width',{exact:true});await width.fill(String(size));await width.press('Enter');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===size);await settled();
  for(const mixed of [false,true]){
   await group.click();if(mixed)await page.getByRole('treeitem',{name:'p · Named text',exact:true}).click({modifiers:['Meta']});await settled();
   if(mixed&&size===1100){const extent=await page.evaluate(()=>{const frame=document.querySelector('#app'),scale=frame.getBoundingClientRect().width/frame.contentWindow.innerWidth,bounds=RetouchComponentInstances.bounds(groupMovementRoots());return {selection:bounds.width*scale,canvas:document.querySelector('#frameWrap').clientWidth,zoom:Number(document.querySelector('#canvasZoom').value)};});assert.ok(extent.selection>extent.canvas,'adding the third layer makes the selection wider than the previous group-fit view');console.log(kind+': selection expansion at retained zoom',JSON.stringify(extent));}
   await page.locator('#frameWrap').evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=el.scrollHeight;});
   const result=await page.evaluate(()=>RetouchZoom.toSelection(groupMovementRoots()));assert.equal(result.ok,true);await settled();
   const canvas=await page.locator('#frameWrap').boundingBox(),frame=await page.locator('#app').boundingBox(),rects=await app.locator(mixed?'h1,p':'[data-rt-group] h1,[data-rt-group] p').all();
   for(const item of rects){const r=await item.boundingBox();assert.ok(r.x>=Math.max(canvas.x,frame.x)-1&&r.y>=Math.max(canvas.y,frame.y)-1&&r.x+r.width<=Math.min(canvas.x+canvas.width,frame.x+frame.width)+1&&r.y+r.height<=Math.min(canvas.y+canvas.height,frame.y+frame.height)+1,JSON.stringify({size,mixed,result,r,canvas,frame}));}
   assert.equal(result.clipped,false);assert.equal(read(),original);
  }
 }
 await page.screenshot({path:'/tmp/retouch-group-reveal-'+kind+'.png'});await group.click();await settled();console.log(kind+': PASS zoom to single and mixed transparent groups after extreme pan at 390/768/1100, full content inside canvas and iframe, unchanged source');
};
