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
 if(kind==='react'){
  const tablet=await (await page.locator('iframe[title="Tablet comparison preview"]').elementHandle()).contentFrame();
  await page.route(/__rt_revision=/,async route=>{if(!failed&&route.request().frame()===tablet){failed=true;await route.abort();}else await route.continue();});
 }
 const x=page.getByLabel(scaling?'Scale selection (%)':'Group X (px)',{exact:true});await x.fill(scaling?'150':String(Number(await x.inputValue())+23));await x.press('Enter');await wait(()=>read()!==original);await settled();const moved=read();
 if(kind==='react'){const retry=page.getByRole('button',{name:'Retry classes in Tablet comparison',exact:true});await retry.waitFor();assert.ok(failed);await retry.click();await retry.waitFor({state:'hidden'});}
 const verify=async delta=>{for(let f=0;f<frames.length;f++){
  const active=!scoped||f===0||f===3,factor=scaling&&delta&&active?1.5:1,left=Math.min(...initial[f].slice(0,2).map(r=>r[0])),top=Math.min(...initial[f].slice(0,2).map(r=>r[1]));
  const expected=initial[f].map((r,i)=>i>=2?r:scaling?[left+(r[0]-left)*factor,top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]:r.map((n,j)=>n+(j===0&&active?delta:0)));
  try{await wait(async()=>(await measure(frames[f])).every((box,i)=>box.every((n,j)=>Math.abs(n-expected[i][j])<.1)));}catch(error){console.error('GROUP TRANSFORM GEOMETRY',JSON.stringify({kind,scoped,scaling,frame:['Main','Phone','Tablet','Desktop'][f],before:initial[f],expected,actual:await measure(frames[f])}));await page.screenshot({path:'/tmp/retouch-group-transform-failure-'+kind+'.png',caret:'initial'});throw error;}assert.ok(await frames[f].locator('body').evaluate(()=>window.__groupMoveDocument===document),'Group movement retains documents');
 }};
 await verify(23);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await verify(0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===moved);await settled();await verify(23);
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
 console.log('GROUP MOVE COMPARISONS PASS',kind,{scoped,scaling});
};
