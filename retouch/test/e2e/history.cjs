'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE to a disposable inspector fixture');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8');
const read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,name)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+name);};
 const undo=page.getByRole('button',{name:'Undo',exact:true}),redo=page.getByRole('button',{name:'Redo',exact:true});
 const ready=()=>wait(async()=>await undo.getAttribute('aria-busy')==='false','history ready');
 const opacity=async value=>{const field=page.getByLabel('Opacity (%)',{exact:true});await field.fill(value);await field.press('Tab');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  assert.ok(await undo.isDisabled());assert.ok(await redo.isDisabled());
  await page.getByRole('treeitem',{name:'div · anchor-target',exact:true}).click();
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await opacity('50');await wait(()=>read().includes('md:opacity-[0.5]'),'edit');await ready();const edited=read();
  await undo.click();await wait(()=>read()===original,'undo');await ready();
  assert.ok(await undo.isDisabled());assert.ok(await redo.isEnabled());
  // Refusal must retain the redo entry and never overwrite external changes.
  const external=original+'\n// external edit\n';fs.writeFileSync(file,external);
  await redo.click();await ready();assert.equal(read(),external);assert.ok(await redo.isEnabled());
  fs.writeFileSync(file,original);
  await page.locator('#logo').click();await page.keyboard.press('Meta+Shift+z');
  await wait(()=>read()===edited,'keyboard redo');await ready();
  await wait(async()=>await page.frameLocator('#app').locator('#anchor-target').evaluate(el=>getComputedStyle(el).opacity)==='0.5','redo renderer');
  assert.ok(await redo.isDisabled());assert.ok(await undo.isEnabled());
  await undo.click();await wait(()=>read()===original,'undo again');await ready();
  await opacity('75');await wait(()=>read().includes('md:opacity-[0.75]'),'branch edit');await ready();
  assert.ok(await redo.isDisabled(),'new edit clears redo');
  await undo.click();await wait(()=>read()===original,'final exact undo');await ready();
  await page.getByRole('treeitem',{name:'h1 · A place for good ideas',exact:true}).click();
  await page.locator('#textEdit').fill('Retouched heading');await page.locator('#textApply').click();
  await wait(()=>read().includes('Retouched heading'),'text edit');await ready();const textEdited=read();
  await undo.click();await wait(()=>read()===original,'text undo');await ready();
  await redo.click();await wait(()=>read()===textEdited,'text redo');await ready();
  await page.frameLocator('#app').getByRole('heading',{name:'Retouched heading',exact:true}).waitFor();
  await undo.click();await wait(()=>read()===original,'text final undo');await ready();
  assert.deepEqual(errors,[]);
  console.log('PASS history button state, keyboard redo, rendered restoration, refusal without data loss, retry and redo invalidation');
 } finally {if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
