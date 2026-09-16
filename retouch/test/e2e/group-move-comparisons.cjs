'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),scoped=!!process.env.RT_E2E_GROUP_SCOPE,scaling=!!process.env.RT_E2E_GROUP_SCALE_COMPARISONS;
 if(scoped){const picker=page.getByLabel('Style screen scope',{exact:true}),scope=await picker.evaluate(el=>[...el.options].find(option=>option.textContent.includes('1100'))?.value);assert.ok(scope);await picker.selectOption(scope);await settled();}
 await page.getByRole('button',{name:'Compare screens',exact:true}).click();
 const frames=[app,...['Phone','Tablet','Desktop'].map(name=>page.frameLocator('iframe[title="'+name+' comparison preview"]'))];
 const measure=frame=>frame.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 const initial=[];for(const frame of frames){await frame.locator('[data-rt-group]').waitFor({state:'attached'});initial.push(await measure(frame));await frame.locator('body').evaluate(()=>window.__groupMoveDocument=document);}
 let failed=false;
 if(kind==='react'||kind==='html'&&scaling){
  const tablet=await (await page.locator('iframe[title="Tablet comparison preview"]').elementHandle()).contentFrame();
  await page.route(kind==='react'?/__rt_revision=/:/\/rt\/__group-scale-runtime\.js$/,async route=>{if(!failed&&route.request().frame()===tablet){failed=true;await route.abort();}else await route.continue();});
 }
 const x=page.getByLabel(scaling?'Scale selection (%)':'Group X (px)',{exact:true});await x.fill(scaling?'150':String(Number(await x.inputValue())+23));await x.press('Enter');await wait(()=>read()!==original);await settled();const moved=read();
 if(kind==='react'||kind==='html'&&scaling){const retry=page.getByRole('button',{name:kind==='react'?'Retry classes in Tablet comparison':'Retry scale in Tablet comparison',exact:true});await retry.waitFor();assert.ok(failed);await retry.click();await retry.waitFor({state:'hidden'});}
 const verify=async(delta,scaledFactor=1.5,translate=0)=>{for(let f=0;f<frames.length;f++){
  const active=!scoped||f===0||f===3,factor=scaling&&delta&&active?scaledFactor:1,visible=initial[f].slice(0,2).filter(r=>r[2]>0&&r[3]>0),left=Math.min(...visible.map(r=>r[0])),top=Math.min(...visible.map(r=>r[1]));
  const expected=initial[f].map((r,i)=>i>=2||!r[2]||!r[3]?r:scaling?[left+(r[0]-left)*factor+(active?translate:0),top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]:r.map((n,j)=>n+(j===0&&active?delta:0)));
  try{await wait(async()=>(await measure(frames[f])).every((box,i)=>box.every((n,j)=>Math.abs(n-expected[i][j])<.1)));}catch(error){console.error('GROUP TRANSFORM GEOMETRY',JSON.stringify({kind,scoped,scaling,frame:['Main','Phone','Tablet','Desktop'][f],before:initial[f],expected,actual:await measure(frames[f])}));await page.screenshot({path:'/tmp/retouch-group-transform-failure-'+kind+'.png',caret:'initial'});throw error;}assert.ok(await frames[f].locator('body').evaluate(()=>window.__groupMoveDocument===document),'Group movement retains documents');
 }};
 await verify(23);if(scaling)await page.screenshot({path:'/tmp/retouch-scaled-comparisons-'+kind+'.png',caret:'initial'});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await verify(0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===moved);await settled();await verify(23);
 if(scaling&&kind==='html'){
  const scale=page.getByLabel('Scale selection (%)',{exact:true});await scale.fill('50');await scale.press('Enter');await wait(()=>read()!==moved);await settled();await verify(23,.75);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===moved);await settled();await verify(23);
  const beforePreview=await measure(app);await page.getByRole('button',{name:'Scale selection on canvas',exact:true}).click();const handle=page.getByRole('button',{name:'Scale bottom right',exact:true});await handle.focus();await handle.press('ArrowRight');await wait(async()=>(await measure(app))[0][2]>beforePreview[0][2]);assert.equal(read(),moved);await handle.press('Escape');await verify(23);
  const position=page.getByLabel('Group X (px)',{exact:true});await position.fill(String(Number(await position.inputValue())+23));await position.press('Enter');await wait(()=>read()!==moved);await settled();await verify(23,1.5,23);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===moved);await settled();await verify(23);
 }
 if(scoped){
  const screen=page.getByLabel('Screen size',{exact:true});await screen.focus();await screen.selectOption('390x844');await settled();await wait(async()=>await page.getByLabel('Edit range status',{exact:true}).getAttribute('data-match')==='false');
  for(const name of ['Group X (px)','Group Y (px)','Scale selection (%)'])assert.ok(await page.getByLabel(name,{exact:true}).isDisabled(),name+' is disabled outside the edit range');
  assert.equal(await page.getByLabel('Group X (px)',{exact:true}).evaluate(el=>{try{el.retouchNumericPreview();return false;}catch{return true;}}),true,'Inactive range blocks scrub previews');
  assert.ok(await page.getByRole('button',{name:'Move group on canvas',exact:true}).isDisabled());
  assert.ok(await page.getByRole('button',{name:'Scale selection on canvas',exact:true}).isDisabled());
  await page.getByLabel('Group X (px)',{exact:true}).evaluate(el=>{el.value='999';el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),moved);
  await page.screenshot({path:'/tmp/retouch-group-range-'+kind+'.png',caret:'initial'});
  const width=page.getByLabel('Screen width',{exact:true});await width.fill('1100');await width.press('Enter');await wait(async()=>await page.getByLabel('Edit range status',{exact:true}).getAttribute('data-match')==='true');
  assert.equal(await page.getByLabel('Group X (px)',{exact:true}).isDisabled(),false);assert.equal(await page.getByRole('button',{name:'Move group on canvas',exact:true}).isDisabled(),false);assert.equal(read(),moved);

 }
 if(scaling&&kind==='html'&&process.env.RT_E2E_SCALED_UNGROUP){
  const beforeUngroup=read(),expected=[];for(const frame of frames)expected.push(await measure(frame));
  const check=async grouped=>{for(let f=0;f<frames.length;f++){await wait(async()=>await frames[f].locator('[data-rt-group]').count()===(grouped?1:0));await wait(async()=>{const boxes=await measure(frames[f]);return boxes.length===expected[f].length&&boxes.every((r,i)=>r.every((n,j)=>Math.abs(n-expected[f][i][j])<.1));});}};
  await page.getByRole('treeitem',{name:'div · Group',exact:true}).click({button:'right'});await page.getByRole('menu',{name:'Canvas actions',exact:true}).locator('[data-action-id="layer-removeFrame"]').click();await wait(()=>read()!==beforeUngroup);await settled();const released=read();await check(false);assert.equal(await page.getByRole('treeitem',{selected:true}).count(),2);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeUngroup);await settled();await check(true);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===released);await settled();await check(false);
  if(process.env.RT_E2E_RELEASED_MOVE){
   await page.getByRole('treeitem',{name:/^h1 ·/}).first().click();await settled();
   const checkMove=async moved=>{for(let f=0;f<frames.length;f++){const active=!scoped||f===0||f===3;await wait(async()=>{const boxes=await measure(frames[f]);return boxes.length===expected[f].length&&boxes.every((r,i)=>r.every((n,j)=>Math.abs(n-expected[f][i][j]-(moved&&active&&i===0&&j===0?23:0))<.1));});}};
   const position=page.getByLabel('Group X (px)',{exact:true});await position.fill(String(Number(await position.inputValue())+23));await position.press('Enter');await wait(()=>read()!==released);await settled();const independentlyMoved=read();await checkMove(true);
   assert.ok(independentlyMoved.includes('--rt-scale-move-x'));assert.equal(await page.getByRole('treeitem',{name:/^h1 ·/}).first().getAttribute('aria-selected'),'true');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===released);await settled();await checkMove(false);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===independentlyMoved);await settled();await checkMove(true);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===released);await settled();await checkMove(false);
   console.log('RELEASED LAYER INDEPENDENT MOVE PASS',kind,{scoped});
  }
  if(process.env.RT_E2E_RELEASED_SCALE){
   await page.getByRole('treeitem',{name:/^h1 ·/}).first().click();await settled();
   const checkScale=async factor=>{for(let f=0;f<frames.length;f++){const active=!scoped||f===0||f===3;await wait(async()=>{const boxes=await measure(frames[f]);return boxes.length===expected[f].length&&boxes.every((r,i)=>r.every((n,j)=>Math.abs(n-expected[f][i][j]*(active&&i===0&&j>=2?factor:1))<.1));});}};
   const scale=page.getByLabel('Scale selection (%)',{exact:true});await scale.fill('200');await scale.press('Enter');await wait(()=>read()!==released);await settled();const independentlyScaled=read();await checkScale(2);assert.ok(independentlyScaled.includes('--rt-scale-factor'));
   await scale.fill('50');await scale.press('Enter');await wait(()=>read()!==independentlyScaled);await settled();await checkScale(1);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===independentlyScaled);await settled();await checkScale(2);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===released);await settled();await checkScale(1);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===independentlyScaled);await settled();await checkScale(2);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===released);await settled();await checkScale(1);
   console.log('RELEASED LAYER INDEPENDENT SCALE PASS',kind,{scoped});
  }
  if(process.env.RT_E2E_RELEASED_GESTURES)await require('./group-scale-canvas.cjs').run({page,app,read,wait,settled,kind,released:true});
  if(process.env.RT_E2E_RELEASED_COPY){
   const heading=page.getByRole('treeitem',{name:/^h1 ·/}).first();await heading.click();await settled();await heading.click({button:'right'});
   await page.getByRole('menu',{name:'Canvas actions',exact:true}).getByRole('menuitem',{name:'Duplicate layer',exact:true}).click();await wait(()=>read()!==released);await settled();const copied=read(),copiedBoxes=[];
   for(let f=0;f<frames.length;f++){
    const factor=!scoped||f===0||f===3?1.5:1;
    await wait(async()=>await frames[f].locator('h1').count()===2);
    await wait(async()=>await frames[f].locator('h1').evaluateAll((nodes,factor)=>nodes.every(node=>{const scale=getComputedStyle(node).scale;return Math.abs((scale==='none'?1:parseFloat(scale))-factor)<.001;}),factor));
    copiedBoxes.push(await measure(frames[f]));
   }
   await wait(async()=>await page.getByRole('treeitem',{name:/^h1 ·/}).nth(1).getAttribute('aria-selected')==='true');
   const checkCopy=async()=>{for(let f=0;f<frames.length;f++)await wait(async()=>{const boxes=await measure(frames[f]);return boxes.length===copiedBoxes[f].length&&boxes.every((r,i)=>r.every((n,j)=>Math.abs(n-copiedBoxes[f][i][j])<.1));});await wait(async()=>await page.getByRole('treeitem',{name:/^h1 ·/}).nth(1).getAttribute('aria-selected')==='true');};
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===released);await settled();await check(false);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===copied);await settled();await checkCopy();
   await page.getByRole('treeitem',{selected:true}).press('Delete');await wait(()=>read()!==copied);await settled();const deleted=read();await check(false);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===copied);await settled();await checkCopy();
   await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===deleted);await settled();await check(false);
   console.log('RELEASED SCALE COPY DELETE HISTORY PASS',kind,{scoped});
  }
  console.log('SCALED UNGROUP SOURCE AND GEOMETRY PASS',kind);
 }
 console.log('GROUP MOVE COMPARISONS PASS',kind,{scoped,scaling});
};
