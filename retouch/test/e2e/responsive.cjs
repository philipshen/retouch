'use strict';
// Run on a disposable inspector fixture served by this worktree's Retouch CLI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;
if(!root)throw Error('RT_INSPECTOR_FIXTURE must name a disposable inspector fixture');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8');
const read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const f=page.frameLocator('#app');
 const until=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const css=()=>f.locator('#anchor-target').evaluate(el=>getComputedStyle(el).opacity);
 const setSize=async size=>{await page.getByLabel('Screen size',{exact:true}).selectOption(size);await until(()=>page.locator('#app').evaluate((el,w)=>el.contentWindow.innerWidth===w,Number(size.split('x')[0])),'viewport');};
 const select=async()=>{await f.locator('#anchor-target').click();await page.getByLabel('Style screen scope').waitFor();if(await f.locator('#anchor-target').getAttribute('contenteditable')==='true')await f.locator('#anchor-target').press('Escape');};
 const opacity=async value=>{await page.getByLabel('Opacity (%)',{exact:true}).fill(value);await page.getByLabel('Opacity (%)',{exact:true}).press('Tab');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await setSize('768x1024');await select();
  await page.getByLabel('Style screen scope').selectOption('md:');
  await opacity('50');
  await until(()=>read().includes('md:opacity-[0.5]'),'scoped source');
  await until(async()=>await css()==='0.5','compiled tablet opacity');
  assert.ok(!read().includes('md:opacity-90'),'old override replaced');
  await setSize('390x844');await until(async()=>await css()==='1','phone inherits base');
  await page.getByLabel('Style screen scope').selectOption('');
  await opacity('75');
  await until(()=>read().includes(' opacity-[0.75]'),'base source');
  await until(async()=>await css()==='0.75','base phone opacity');
  assert.ok(read().includes('md:opacity-[0.5]'),'base edit preserves tablet');
  await setSize('768x1024');await until(async()=>await css()==='0.5','tablet override still wins');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await page.getByRole('button',{name:'Reset overrides at this size'}).click();
  await until(()=>!read().includes('md:opacity-'),'reset removes override');
  await until(async()=>await css()==='0.75','reset inherits base');
  // Undo uses exact server snapshots, independent of the currently selected scope.
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await until(()=>read().includes('md:opacity-[0.5]'),'undo reset');
  await page.getByLabel('Screen width',{exact:true}).fill('1000');
  await page.getByLabel('Screen width',{exact:true}).press('Tab');
  await until(()=>page.locator('#app').evaluate(el=>el.contentWindow.innerWidth===1000),'custom viewport');
  await page.getByLabel('Style screen scope').selectOption('min-[62.5rem]:');
  await opacity('25');
  await until(()=>read().includes('min-[62.5rem]:opacity-[0.25]'),'custom breakpoint source');
  await until(async()=>await css()==='0.25','custom breakpoint CSS');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await until(()=>!read().includes('min-[62.5rem]:opacity-'),'undo custom');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await until(()=>!read().includes('opacity-[0.75]'),'undo base');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await until(()=>read()===original,'exact original bytes after undo');
  await until(async()=>await page.getByLabel('Opacity (%)',{exact:true}).inputValue()==='90','inspector refresh after undo');
  assert.deepEqual(errors,[],'no browser runtime errors');
  await page.screenshot({path:'/tmp/retouch-responsive-inspector.png'});
  console.log('PASS scoped inspector writes, compiled media queries, base preservation, custom breakpoint, inheritance reset and exact undo');
 } finally {if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
