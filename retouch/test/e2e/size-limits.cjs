'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8'),read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],snapshots=[];
 page.on('pageerror',e=>errors.push(e.message));
 const target=page.frameLocator('#app').locator('#anchor-target');
 const wait=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const css=prop=>target.evaluate((el,p)=>getComputedStyle(el)[p],prop);
 const number=async(name,value)=>{await page.getByLabel(name,{exact:true}).fill(value);await page.getByLabel(name,{exact:true}).press('Tab');};
 const action=async(fn,prop,value)=>{const before=read();snapshots.push(before);await fn();await wait(async()=>await css(prop)===value,prop);await wait(async()=>read()!==before&&await page.locator('#panelBody').getAttribute('aria-busy')==='false','committed');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await page.getByRole('treeitem',{name:'div · anchor-target',exact:true}).click();
  await page.getByText('Size limits',{exact:true}).click();
  await action(()=>number('Minimum width','240'),'width','240px');
  await action(()=>number('Maximum height','60px'),'height','60px');
  await action(()=>page.getByRole('button',{name:'Reset minimum width',exact:true}).click(),'width','180px');
  await action(()=>page.getByLabel('Width behavior',{exact:true}).selectOption('fill'),'width',await page.frameLocator('#app').locator('#anchor-parent').evaluate(el=>(el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight))+'px'));
  await action(()=>number('Maximum width','300'),'width','300px');
  await action(()=>number('Minimum width','320'),'width','320px');
  await action(()=>page.getByRole('button',{name:'Reset minimum width',exact:true}).click(),'width','300px');
  await action(()=>number('Maximum width','50%'),'maxWidth','50%');
  const parentWidth=await page.frameLocator('#app').locator('#anchor-parent').evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight));
  assert.ok(Math.abs(parseFloat(await css('width'))-parentWidth/2)<1);
  const beforeInvalid=read();await number('Maximum width','-20');assert.equal(await page.getByLabel('Maximum width',{exact:true}).evaluate(el=>el.checkValidity()),false);assert.equal(read(),beforeInvalid);
  await page.getByLabel('Maximum width',{exact:true}).fill('50%');await page.getByLabel('Maximum width',{exact:true}).press('Escape');
  await page.getByRole('treeitem',{name:'div · anchor-target',exact:true}).click();
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByLabel('Style screen scope').selectOption('md:');
  await action(()=>number('Maximum width','200'),'width','200px');
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await css('maxWidth')==='50%','base percentage limit');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await wait(async()=>await css('width')==='200px','tablet limit');
  await page.screenshot({path:'/tmp/retouch-size-limits.png'});
  for(const before of snapshots.reverse()){await wait(async()=>await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),'undo ready');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(async()=>read()===before&&await page.locator('#panelBody').getAttribute('aria-busy')==='false','exact undo');}
  assert.equal(read(),original);assert.deepEqual(errors,[]);
  console.log('PASS minimum/maximum geometry, fill sizing, percentage units, minimum precedence, reset, invalid input, responsive scope and exact undo');
 }finally{if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
