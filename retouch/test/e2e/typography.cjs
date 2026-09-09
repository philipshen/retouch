'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8'),read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const css=prop=>page.frameLocator('#app').locator('h1').evaluate((el,p)=>getComputedStyle(el)[p],prop);
 const number=async(name,value)=>{await page.getByLabel(name,{exact:true}).fill(value);await page.getByLabel(name,{exact:true}).press('Tab');};
 const snapshots=[];
 const action=async(fn,prop,value)=>{const before=read();snapshots.push(before);await fn();await wait(async()=>await css(prop)===value,prop+' = '+value);await wait(async()=>read()!==before&&await page.locator('#panelBody').getAttribute('aria-busy')==='false','source committed');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await page.getByRole('treeitem',{name:'h1 · A place for good ideas',exact:true}).click();
  await action(()=>number('Font size (px)','42'),'fontSize','42px');
  await action(()=>number('Font size (px)','44'),'fontSize','44px');
  assert.ok(!read().includes('!!'),'important marker is never duplicated');
  assert.ok(read().includes('type-editorial'),'project style retained');
  assert.match(await css('fontFamily'),/Georgia/,'font family retained');
  await action(()=>number('Line height (px)','58'),'lineHeight','58px');
  await action(()=>number('Letter spacing (px)','2'),'letterSpacing','2px');
  await action(()=>page.getByLabel('Text alignment',{exact:true}).selectOption('center'),'textAlign','center');
  await action(()=>page.getByLabel('Font slant',{exact:true}).selectOption('italic'),'fontStyle','italic');
  await action(()=>page.getByLabel('Text decoration',{exact:true}).selectOption('underline'),'textDecorationLine','underline');
  await action(()=>page.getByLabel('Text case',{exact:true}).selectOption('uppercase'),'textTransform','uppercase');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await action(()=>number('Font size (px)','60'),'fontSize','60px');
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');
  await wait(async()=>await css('fontSize')==='44px','phone base text size');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await wait(async()=>await css('fontSize')==='60px','tablet text size');
  await action(()=>page.getByRole('button',{name:'Reset text overrides',exact:true}).click(),'fontSize','44px');
  assert.ok(read().includes('type-editorial'),'reset preserves named text style');
  await page.screenshot({path:'/tmp/retouch-typography.png'});
  for(const before of snapshots.reverse()) {await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before,'exact undo');}
  assert.equal(read(),original);assert.deepEqual(errors,[]);
  console.log('PASS custom text dimensions, tracking, alignment, slant, decoration, case, named-style preservation, repeated important edits, breakpoint isolation and exact undo');
 } finally {if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
