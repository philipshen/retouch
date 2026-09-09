'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8'),read=()=>fs.readFileSync(file,'utf8');
const asset=path.join(root,'public/first.svg'),assetBytes=fs.readFileSync(asset);
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const image=page.frameLocator('#app').locator('#swap-image');
 const wait=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const css=prop=>image.evaluate((el,p)=>getComputedStyle(el)[p],prop);
 const number=async(name,value)=>{await page.getByLabel(name,{exact:true}).fill(value);await page.getByLabel(name,{exact:true}).press('Tab');};
 const snapshots=[];
 const action=async(fn,prop,value)=>{const before=read();snapshots.push(before);await fn();await wait(async()=>await css(prop)===value,prop);await wait(async()=>read()!==before&&await page.locator('#panelBody').getAttribute('aria-busy')==='false','source committed');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await page.getByRole('treeitem',{name:'img · Color study',exact:true}).click();
  await action(()=>number('Width (px)','120'),'width','120px');
  await action(()=>page.getByLabel('Image fit',{exact:true}).selectOption('contain'),'objectFit','contain');
  await action(()=>page.getByLabel('Image fit',{exact:true}).selectOption('cover'),'objectFit','cover');
  await action(()=>page.getByRole('button',{name:'Image position middle left',exact:true}).click(),'objectPosition','0% 50%');
  const left=await image.screenshot({path:'/tmp/retouch-image-left.png'});
  await action(()=>page.getByRole('button',{name:'Image position middle right',exact:true}).click(),'objectPosition','100% 50%');
  const right=await image.screenshot({path:'/tmp/retouch-image-right.png'});
  assert.notDeepEqual(left,right,'the visible crop changes, not only the class string');
  assert.equal(await css('width'),'120px');assert.equal(await css('height'),'120px');
  await action(()=>number('Image horizontal position (%)','25'),'objectPosition','25% 50%');
  await action(()=>number('Image vertical position (%)','75'),'objectPosition','25% 75%');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await action(()=>page.getByRole('button',{name:'Image position top right',exact:true}).click(),'objectPosition','100% 0%');
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');
  await wait(async()=>await css('objectPosition')==='25% 75%','phone framing retained');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await wait(async()=>await css('objectPosition')==='100% 0%','tablet framing');
  assert.equal(await image.getAttribute('src'),'/first.svg');assert.deepEqual(fs.readFileSync(asset),assetBytes);
  for(const before of snapshots.reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before,'exact undo');}
  assert.equal(read(),original);assert.deepEqual(errors,[]);
  console.log('PASS fit/cover modes, visibly different left/right crops, numeric positioning, stable frame/source asset, responsive framing and exact undo');
 } finally {if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
