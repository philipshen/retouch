'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read();
 await page.getByRole('button',{name:'Compare screens',exact:true}).click();
 const frames=[app,...['Phone','Tablet','Desktop'].map(name=>page.frameLocator('iframe[title="'+name+' comparison preview"]'))];
 const measure=frame=>frame.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 const initial=[];for(const frame of frames){await frame.locator('[data-rt-group]').waitFor({state:'attached'});initial.push(await measure(frame));await frame.locator('body').evaluate(()=>window.__groupMoveDocument=document);}
 let failed=false;
 if(kind==='react'){
  const tablet=await (await page.locator('iframe[title="Tablet comparison preview"]').elementHandle()).contentFrame();
  await page.route(/__rt_revision=/,async route=>{if(!failed&&route.request().frame()===tablet){failed=true;await route.abort();}else await route.continue();});
 }
 const x=page.getByLabel('Group X (px)',{exact:true});await x.fill(String(Number(await x.inputValue())+23));await x.press('Enter');await wait(()=>read()!==original);await settled();const moved=read();
 if(kind==='react'){const retry=page.getByRole('button',{name:'Retry classes in Tablet comparison',exact:true});await retry.waitFor();assert.ok(failed);await retry.click();await retry.waitFor({state:'hidden'});}
 const verify=async delta=>{for(let f=0;f<frames.length;f++){await wait(async()=>(await measure(frames[f])).every((box,i)=>box.every((n,j)=>Math.abs(n-initial[f][i][j]-(i<2&&j===0?delta:0))<.1)));assert.ok(await frames[f].locator('body').evaluate(()=>window.__groupMoveDocument===document),'Group movement retains documents');}};
 await verify(23);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await verify(0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===moved);await settled();await verify(23);
 console.log('GROUP MOVE COMPARISONS PASS',kind);
};
