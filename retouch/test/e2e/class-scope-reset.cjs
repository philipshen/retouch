'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,original,retain=false,liveLiquid=false})=>{
 const settled=()=>wait(()=>page.evaluate(()=>!panelTasks&&!sourceRequests&&!undoBusy)),size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(()=>app.locator('body').evaluate((el,width)=>innerWidth===width,Number(value.split('x')[0])));await settled();};
 await app.locator('input').evaluate(el=>{el.value='retained';window.classResetDocument=document;});await size('768x1024');for(const [i,name]of ['A','B'].entries()){await page.getByRole('treeitem',{name:'div · '+name,exact:true}).click(i?{modifiers:['Meta']}:{});await settled();}await wait(()=>page.evaluate(()=>sel?.multiple?.length===2));
 const comparisons=[];if(liveLiquid){await page.getByRole('button',{name:'Compare screens',exact:true}).click();for(const name of ['Phone','Tablet','Desktop']){const frame=page.frameLocator('iframe[title="'+name+' comparison preview"]');await frame.locator('input').waitFor();await frame.locator('input').evaluate((el,name)=>{el.value=name;window.literalClassDocument=document;document.querySelector('[aria-label="A"]').classList.add('runtime-open');},name);comparisons.push({name,frame});}await app.locator('[aria-label="A"]').evaluate(el=>el.classList.add('runtime-open'));}
 const verifyComparisons=async reset=>{for(const {name,frame}of comparisons){const expected=name==='Phone'?[.8,.6]:name==='Tablet'?(reset?[.8,.6]:[.9,.7]):[.5,reset?.6:.7];await wait(async()=>JSON.stringify(await frame.locator('[aria-label="A"],[aria-label="B"]').evaluateAll(els=>els.map(el=>Number(getComputedStyle(el).opacity))))===JSON.stringify(expected));assert.equal(await frame.locator('input').inputValue(),name);assert.equal(await frame.locator('input').evaluate(()=>document===window.literalClassDocument),true);assert.equal(await frame.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);}};
 await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();const disclosure=page.getByText('Breakpoint options',{exact:true});if(!await disclosure.evaluate(el=>el.parentElement.open))await disclosure.click();await page.getByRole('button',{name:'Reset overrides at this size',exact:true}).click();await wait(()=>read()!==original);await settled();const reset=read();await verifyComparisons(true);assert.ok(!reset.includes('md:opacity-90'));assert.ok(!reset.includes('md:opacity-70'));assert.ok(reset.includes('hover:opacity-95'));assert.ok(reset.includes('md:hover:opacity-95'));assert.ok(reset.includes('lg:opacity-50'));assert.ok(reset.includes('opacity-80'));assert.ok(reset.includes('opacity-60'));assert.equal(await page.evaluate(()=>sel.multiple.length),2);
 const opacity=async values=>{await page.mouse.move(0,0);await wait(async()=>JSON.stringify(await app.locator('[aria-label="A"],[aria-label="B"]').evaluateAll(els=>els.map(el=>Number(getComputedStyle(el).opacity))))===JSON.stringify(values));};await opacity([.8,.6]);await size('390x844');await opacity([.8,.6]);await size('1440x900');await opacity([.5,.6]);await size('768x1024');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await opacity([.9,.7]);await verifyComparisons(false);assert.equal(await page.evaluate(()=>sel.multiple.length),2);await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===reset);await settled();await opacity([.8,.6]);await verifyComparisons(true);if(liveLiquid){const atomic=await page.evaluate(async()=>{const entries=sel.multiple.map(info=>({id:info.id,before:info.className,classes:info.className})),nodes=entries.map(item=>[...iframe.contentDocument.querySelectorAll('[data-rt]')].find(el=>el.getAttribute('data-rt')===item.id));nodes[0].classList.add('runtime-probe');entries[0].before+=' runtime-probe';entries[1].classes+=' never-saved';const before=nodes.map(el=>el.getAttribute('class'));try{await RetouchRenderSync.syncClasses({frame:iframe,entries});return {refused:false};}catch(error){return {refused:true,unchanged:JSON.stringify(before)===JSON.stringify(nodes.map(el=>el.getAttribute('class')))};}finally{nodes[0].classList.remove('runtime-probe');}});assert.deepEqual(atomic,{refused:true,unchanged:true});} if(liveLiquid){assert.ok(!read().includes('runtime-open'));assert.equal(await app.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);}
 if(liveLiquid){
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
  await page.getByRole('treeitem',{name:'div · A',exact:true}).click();await settled();
  await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  const options=page.getByText('Breakpoint options',{exact:true});if(!await options.evaluate(el=>el.parentElement.open))await options.click();
  await page.getByRole('button',{name:'Reset overrides at this size',exact:true}).click();await wait(()=>read()!==original);await settled();
  const single=read();assert.ok(!single.includes('md:opacity-90'));assert.ok(single.includes('md:opacity-70'));assert.ok(!single.includes('runtime-open'));await opacity([.8,.7]);
  const verifySingle=async reset=>{for(const {name,frame}of comparisons){const expected=name==='Phone'?[.8,.6]:name==='Tablet'?[reset?.8:.9,.7]:[.5,.7];await wait(async()=>JSON.stringify(await frame.locator('[aria-label="A"],[aria-label="B"]').evaluateAll(els=>els.map(el=>Number(getComputedStyle(el).opacity))))===JSON.stringify(expected));assert.equal(await frame.locator('input').inputValue(),name);assert.equal(await frame.locator('input').evaluate(()=>document===window.literalClassDocument),true);assert.equal(await frame.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);}assert.equal(await app.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);};
  await verifySingle(true);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await opacity([.9,.7]);await verifySingle(false);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===single);await settled();await opacity([.8,.7]);await verifySingle(true);
  const versions=[single];
  for(const value of [40,30]){
   const input=page.getByLabel('Opacity (%)',{exact:true});
   await input.fill(String(value));await input.press('Tab');
   await wait(()=>read()!==versions.at(-1));await settled();versions.push(read());
   await opacity([value/100,.7]);
   assert.equal(await app.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);
  }
  for(const [direction,indices]of [['Undo',[1,0]],['Redo',[1,2]]])for(const index of indices){
   await page.getByRole('button',{name:direction,exact:true}).click();
   await wait(()=>read()===versions[index]);await settled();
   const value=[.8,.4,.3][index];await opacity([value,.7]);
   for(const {name,frame}of comparisons){
    const expected=name==='Tablet'?value:name==='Phone'?.8:.5;
    await wait(async()=>Number(await frame.locator('[aria-label="A"]').evaluate(el=>getComputedStyle(el).opacity))===expected);
    assert.equal(await frame.locator('input').inputValue(),name);
    assert.equal(await frame.locator('input').evaluate(()=>document===window.literalClassDocument),true);
    assert.equal(await frame.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('runtime-open')),true);
   }
  }
  const beforeFailure=read(),liveBefore=await app.locator('[aria-label="A"]').getAttribute('class');
  const siteURL=new URL('/',page.url()).href;
  await page.route(siteURL,route=>route.fulfill({status:503,body:'Preview unavailable'}));
  try{
   const input=page.getByLabel('Opacity (%)',{exact:true});await input.fill('40');await input.press('Tab');
   await wait(()=>read()!==beforeFailure);await settled();
   await page.locator('#toasts').getByText('Classes saved; preview refresh failed: The saved classes could not be loaded.',{exact:true}).waitFor();
   assert.equal(await app.locator('[aria-label="A"]').getAttribute('class'),liveBefore);
  }finally{await page.unroute(siteURL);}
  const failedPreviewSource=read();
  const nextInput=page.getByLabel('Opacity (%)',{exact:true});await nextInput.fill('20');await nextInput.press('Tab');
  await wait(()=>read()!==failedPreviewSource);await settled();await opacity([.2,.7]);
  assert.equal(await app.locator('[aria-label="A"]').evaluate(el=>el.classList.contains('md:opacity-[0.3]')),false);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===failedPreviewSource);await settled();await opacity([.4,.7]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeFailure);await settled();await opacity([.3,.7]);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===failedPreviewSource);await settled();await opacity([.4,.7]);
  for(const {name,frame}of comparisons){
   await wait(async()=>Number(await frame.locator('[aria-label="A"]').evaluate(el=>getComputedStyle(el).opacity))===(name==='Tablet'?.4:name==='Phone'?.8:.5));
   assert.equal(await frame.locator('input').inputValue(),name);
   assert.equal(await frame.locator('input').evaluate(()=>document===window.literalClassDocument),true);
  }

  await page.route(siteURL,route=>route.fulfill({status:503,body:'Preview unavailable'}));
  try{
   const input=page.getByLabel('Opacity (%)',{exact:true});await input.fill('20');await input.press('Tab');
   await wait(()=>read()!==failedPreviewSource);await settled();
   const retry=page.getByRole('button',{name:'Retry preview refresh',exact:true});await retry.waitFor();
   await retry.click();await settled();await retry.waitFor();await opacity([.4,.7]);
  }finally{await page.unroute(siteURL);}
  const retrySource=read(),writes=[];
  const recordWrite=request=>{if(request.method()==='POST'&&request.url().includes('/rt/__api/op'))writes.push(request.url());};
  page.on('request',recordWrite);
  try{await page.getByRole('button',{name:'Retry preview refresh',exact:true}).click();await settled();await opacity([.2,.7]);}
  finally{page.off('request',recordWrite);}
  assert.deepEqual(writes,[]);assert.equal(read(),retrySource);
  assert.equal(await page.getByRole('button',{name:'Retry preview refresh',exact:true}).count(),0);
  for(const {name,frame}of comparisons){
   await wait(async()=>Number(await frame.locator('[aria-label="A"]').evaluate(el=>getComputedStyle(el).opacity))===(name==='Tablet'?.2:name==='Phone'?.8:.5));
   assert.equal(await frame.locator('input').inputValue(),name);
   assert.equal(await frame.locator('input').evaluate(()=>document===window.literalClassDocument),true);
  }
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===failedPreviewSource);await settled();await opacity([.4,.7]);

 }
 if(retain){assert.equal(await app.locator('input').inputValue(),'retained');assert.equal(await app.locator('input').evaluate(()=>document===window.classResetDocument),true);}
};
