'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8'),read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1800,height:1200}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 const wait=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const preview=name=>page.frameLocator('iframe[title="'+name+' comparison preview"]');
 try{
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await page.getByRole('treeitem',{name:'div · anchor-target',exact:true}).click();
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  for(const [name,w,h] of [['Phone',390,844],['Tablet',768,1024],['Desktop',1440,900]]){
   await preview(name).locator('#anchor-target').waitFor();
   assert.deepEqual(await preview(name).locator('body').evaluate(el=>[el.ownerDocument.defaultView.innerWidth,el.ownerDocument.defaultView.innerHeight]),[w,h]);
   await wait(async()=>await page.getByRole('region',{name:name+' comparison',exact:true}).locator('.compare-selection').count()>0,'linked selection '+name);
  }
  assert.equal(await preview('Phone').locator('#anchor-target').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await preview('Tablet').locator('#anchor-target').evaluate(el=>getComputedStyle(el).opacity),'0.9');
  await page.getByRole('button',{name:'Edit tablet size',exact:true}).click();
  assert.equal(await page.getByLabel('Screen size',{exact:true}).inputValue(),'768x1024');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await page.getByLabel('Width (px)',{exact:true}).fill('260');await page.getByLabel('Width (px)',{exact:true}).press('Tab');
  await wait(async()=>await preview('Tablet').locator('#anchor-target').evaluate(el=>getComputedStyle(el).width)==='260px','tablet write live');
  await wait(async()=>await preview('Desktop').locator('#anchor-target').evaluate(el=>getComputedStyle(el).width)==='260px','desktop write live');
  assert.equal(await preview('Phone').locator('#anchor-target').evaluate(el=>getComputedStyle(el).width),'180px');
  await wait(async()=>await page.frameLocator('#app').locator('#anchor-target').evaluate(el=>getComputedStyle(el).width)==='260px','main write live');
  await page.screenshot({path:'/tmp/retouch-compare-screens.png'});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original,'undo source');
  await wait(async()=>await preview('Tablet').locator('#anchor-target').evaluate(el=>getComputedStyle(el).width)==='180px','preview undo');
  await page.locator('#routeInput').fill('/?compare=1');await page.locator('#routeInput').press('Enter');
  for(const name of ['Phone','Tablet','Desktop'])await wait(async()=>await preview(name).locator('body').evaluate(el=>el.ownerDocument.defaultView.location.search)==='?compare=1','route '+name);
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await wait(async()=>await page.locator('#screenComparisons iframe').count()===0,'frames unloaded');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await preview('Phone').locator('#anchor-target').waitFor();
  await page.getByRole('button',{name:'Edit phone size',exact:true}).click();assert.equal(await page.getByLabel('Screen size',{exact:true}).inputValue(),'390x844');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();assert.equal(read(),original);
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Compare screens',exact:true}).click();await preview('Phone').locator('#anchor-target').waitFor();await page.getByRole('button',{name:'Compare screens',exact:true}).click();}
  await page.getByLabel('Screen width',{exact:true}).fill('1120');await page.getByLabel('Screen width',{exact:true}).press('Tab');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  await page.getByRole('button',{name:'Pin current size',exact:true}).click();
  const custom='Custom 1120 × 844';
  await preview(custom).locator('#anchor-target').waitFor();
  assert.deepEqual(await preview(custom).locator('body').evaluate(el=>[el.ownerDocument.defaultView.innerWidth,el.ownerDocument.defaultView.innerHeight]),[1120,844]);
  assert.equal(await page.getByRole('button',{name:'Pin current size',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Remove Tablet comparison',exact:true}).click();
  await wait(async()=>await page.locator('iframe[title="Tablet comparison preview"]').count()===0,'removed tablet');
  await page.reload();await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  await preview(custom).locator('#anchor-target').waitFor();assert.equal(await page.locator('iframe[title="Tablet comparison preview"]').count(),0);
  await page.getByRole('button',{name:'Edit phone size',exact:true}).click();
  await page.getByRole('button',{name:'Edit custom 1120 × 844 size',exact:true}).click();
  assert.equal(await page.getByLabel('Screen width',{exact:true}).inputValue(),'1120');
  await page.getByRole('button',{name:'Remove '+custom+' comparison',exact:true}).click();
  await wait(async()=>await page.locator('iframe[title="'+custom+' comparison preview"]').count()===0,'custom removed');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  await page.waitForTimeout(300);assert.deepEqual(errors,[]);
  console.log('PASS independent phone/tablet/desktop viewport sizes, linked layer highlights, responsive CSS, active-size switching, live source edit/undo and preview disposal/reopen, custom pin/remove and persistence');
 }finally{if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
