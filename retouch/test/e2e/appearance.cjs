'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;if(!root)throw Error('Set RT_INSPECTOR_FIXTURE');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const file=path.join(root,'app/page.jsx'),original=fs.readFileSync(file,'utf8'),read=()=>fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<120;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const css=prop=>page.frameLocator('#app').locator('#anchor-target').evaluate((el,p)=>getComputedStyle(el)[p],prop);
 const number=async(name,value)=>{await page.getByLabel(name,{exact:true}).fill(value);await page.getByLabel(name,{exact:true}).press('Tab');};
 const snapshots=[];
 const action=async(fn,prop,value)=>{const before=read();snapshots.push(before);await fn();await wait(async()=>await css(prop)===value,prop);await wait(async()=>read()!==before&&await page.locator('#panelBody').getAttribute('aria-busy')==='false','source committed');};
 try {
  await page.goto((process.env.RT_E2E_URL||'http://localhost:3496')+'/rt');
  await page.getByRole('treeitem',{name:'div · anchor-target',exact:true}).click();
  await action(()=>number('Border width (px)','4'),'borderTopWidth','4px');
  await action(()=>page.getByLabel('Border style',{exact:true}).selectOption('dashed'),'borderTopStyle','dashed');
  await action(()=>page.getByLabel('Border color',{exact:true}).evaluate(el=>{el.value='#ff0000';el.dispatchEvent(new Event('change',{bubbles:true}));}),'borderTopColor','rgb(255, 0, 0)');
  assert.equal(await css('borderTopWidth'),'4px','color preserves width');
  assert.equal(await css('borderTopStyle'),'dashed','color preserves style');
  await action(()=>number('Corner radius (px)','24'),'borderTopLeftRadius','24px');
  await page.getByText('Individual corners',{exact:true}).click();
  await action(()=>number('Top left radius (px)','8'),'borderTopLeftRadius','8px');
  assert.equal(await css('borderTopRightRadius'),'24px','one corner preserves others');
  await wait(async()=>await page.getByLabel('Corner radius (px)',{exact:true}).getAttribute('placeholder')==='Mixed','mixed radius display');
  assert.ok(await page.getByLabel('Top right radius (px)',{exact:true}).isVisible(),'corner controls remain open after edits');
  await action(()=>page.getByLabel('Border style',{exact:true}).selectOption('none'),'borderTopStyle','none');
  await action(()=>number('Border width (px)','6'),'borderTopWidth','6px');
  assert.equal(await css('borderTopStyle'),'solid','positive width restores visible stroke');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await page.getByLabel('Style screen scope').selectOption('md:');
  await action(()=>number('Corner radius (px)','40'),'borderTopLeftRadius','40px');
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');
  await wait(async()=>await css('borderTopLeftRadius')==='8px','phone corner retained');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');
  await wait(async()=>await css('borderTopLeftRadius')==='40px','tablet corner');
  await page.screenshot({path:'/tmp/retouch-appearance.png'});
  for(const before of snapshots.reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before,'exact undo');}
  assert.equal(read(),original);assert.deepEqual(errors,[]);
  console.log('PASS border width/style/color isolation, visible stroke restoration, uniform/individual corners, mixed indicator, breakpoint isolation and exact undo');
 } finally {if(read()!==original)fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
