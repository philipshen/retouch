'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-browser-')),file=path.join(root,'index.html');
 const original='<!doctype html><html><head><link rel="stylesheet" href="site.css"></head><body><main><h1 class="title">Hello HTML</h1><p class="title">Unedited sibling</p><img src="first.svg" alt="Study"></main></body></html>';
 fs.writeFileSync(file,original);fs.writeFileSync(path.join(root,'site.css'),'.title{color:rgb(120,30,60);font-size:36px}body{padding:32px}img{width:100px;height:100px}');
 for(const [name,color]of [['first','red'],['second','blue'],['Écran #1','green']])fs.writeFileSync(path.join(root,name+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="'+color+'"/></svg>');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out: '+label+'; '+await page.locator('#toasts').textContent());};
 const app=page.frameLocator('#app');
 try{
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();
  assert.equal(await app.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(120, 30, 60)');
  const read=()=>fs.readFileSync(file,'utf8');
  const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true','panel settled');
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(()=>page.locator('#app').evaluate((el,w)=>el.contentWindow.innerWidth===w,Number(value.split('x')[0])),'screen width');};
  const width=async value=>{await page.getByLabel('Width (CSS)',{exact:true}).fill(value);await page.getByLabel('Width (CSS)',{exact:true}).press('Tab');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).width)===value,'CSS width '+value);await settled();};
  // Author larger-screen rules first; a later base edit must not override them.
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await width('320px');
  await size('390x844');await page.getByLabel('Style screen scope').selectOption('');await width('240px');
  assert.notEqual(await app.locator('p').evaluate(el=>getComputedStyle(el).width),'240px');
  await size('768x1024');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).width)==='320px','larger rule wins');
  // Raw exported markup keeps its styles without the Retouch renderer or injected IDs.
  const exported=await browser.newPage({viewport:{width:800,height:1000}});await exported.setContent(read());
  assert.equal(await exported.locator('[data-rt]').count(),0);assert.equal(await exported.locator('h1').evaluate(el=>getComputedStyle(el).width),'320px');await exported.close();
  await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await page.getByRole('button',{name:'Reset width',exact:true}).click();
  await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).width)==='240px','reset inherits base');await settled();
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'CSS exact undo');
  await page.getByLabel('Style screen scope').selectOption('');
  const setCSS=async(label,value,property,expected)=>{
   const field=page.getByLabel(label+' (CSS)',{exact:true});await field.fill(value);await field.press('Tab');
   await wait(async()=>await app.locator('h1').evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),property)===expected,'spacing '+property);await settled();
  };
  await setCSS('Padding','8px 12px','padding-left','12px');
  await setCSS('Padding left','20px','padding-left','20px');
  await setCSS('Padding','4px','padding-left','4px');
  await page.getByRole('button',{name:'Reset padding',exact:true}).click();
  await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).paddingLeft)==='0px','padding reset');await settled();
  for(let i=0;i<4;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'spacing exact undo');
  await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  for(const [label,value,property,expected]of [['Opacity (%)','50','opacity','0.5'],['Rotation (°)','45','rotate','45deg']]){
   const control=page.getByLabel(label,{exact:true});await control.fill(value);await control.press('Tab');
   await wait(async()=>await app.locator('h1').evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),property)===expected,'appearance '+property);await settled();
  }
  await size('390x844');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).opacity)==='1','appearance base inheritance');
  await size('768x1024');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).rotate)==='45deg','rotation tablet override');
  await page.getByRole('button',{name:'Reset rotate',exact:true}).click();await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).rotate)==='none','rotation reset');await settled();
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'appearance exact undo');
  const family=page.getByLabel('Font family (CSS)',{exact:true});await family.fill('monospace');await family.press('Tab');
  await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily)==='monospace','font family');await settled();
  const weight=page.getByLabel('Font weight (CSS)',{exact:true});await weight.fill('600');await weight.press('Tab');
  await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight)==='600','font weight');await settled();
  await page.getByLabel('Font style (CSS)',{exact:true}).selectOption('italic');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).fontStyle)==='italic','font italic');await settled();
  await page.getByLabel('Text decoration (CSS)',{exact:true}).selectOption('underline');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).textDecorationLine)==='underline','text decoration');await settled();
  await size('390x844');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).fontStyle)==='normal','phone typography inheritance');
  await size('768x1024');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).fontStyle)==='italic','tablet typography');
  for(let i=0;i<4;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'typography exact undo');


  await page.locator('#panelBody textarea').fill('Saved & clear');await page.getByRole('button',{name:'Apply text',exact:true}).click();
  await wait(async()=>await app.locator('h1').textContent()==='Saved & clear','text rendered');assert.ok(fs.readFileSync(file,'utf8').includes('Saved &amp; clear'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original,'text undo');
  await page.getByRole('treeitem',{name:'img · Study',exact:true}).click();
  await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  await page.getByLabel('Image fit',{exact:true}).selectOption('cover');
  await wait(async()=>await app.locator('img').evaluate(el=>getComputedStyle(el).objectFit)==='cover','HTML image fit');await settled();
  await page.getByRole('button',{name:'Image position bottom right',exact:true}).click();
  await wait(async()=>await app.locator('img').evaluate(el=>getComputedStyle(el).objectPosition)==='100% 100%','HTML image focal point');await settled();
  await size('390x844');await wait(async()=>await app.locator('img').evaluate(el=>getComputedStyle(el).objectFit)==='fill','image phone inheritance');
  await size('768x1024');await wait(async()=>await app.locator('img').evaluate(el=>getComputedStyle(el).objectFit)==='cover','image tablet override');
  await page.getByRole('button',{name:'Reset image position',exact:true}).click();await wait(async()=>await app.locator('img').evaluate(el=>getComputedStyle(el).objectPosition)==='50% 50%','image position reset');await settled();
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'image framing exact undo');
await page.getByLabel('Image path',{exact:true}).fill('/second.svg');await page.getByRole('button',{name:'Apply image path',exact:true}).click();
  await wait(async()=>await app.locator('img').evaluate(el=>el.complete&&el.currentSrc.endsWith('/second.svg')),'image loaded');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original,'image undo');
  await settled();await page.getByRole('button',{name:'Browse project images',exact:true}).click();
  await page.getByLabel('Find a project image',{exact:true}).fill('écran');
  const accented=page.getByRole('button',{name:'Écran #1.svg',exact:true});await accented.waitFor();
  await wait(async()=>await accented.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0),'encoded image preview');
  await page.getByLabel('Find a project image',{exact:true}).fill('second');
  const choice=page.getByRole('button',{name:'second.svg',exact:true});await choice.waitFor();
  assert.equal(await page.getByRole('button',{name:'first.svg',exact:true}).count(),0);
  await wait(async()=>await choice.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0),'asset preview');
  await choice.click();await wait(async()=>await app.locator('img').evaluate(el=>el.complete&&el.currentSrc.endsWith('/second.svg')),'asset browser replacement');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'asset browser undo');
  const upload='<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="green"/></svg>';
  await page.locator('#panelBody input[type=file]').setInputFiles({name:'uploaded.svg',mimeType:'image/svg+xml',buffer:Buffer.from(upload)});
  await wait(async()=>await app.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0&&el.currentSrc.includes('/rt-assets/')),'uploaded image loaded').catch(async error=>{console.error('Upload state',await app.locator('img').evaluate(el=>({src:el.getAttribute('src'),currentSrc:el.currentSrc,complete:el.complete,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight})));throw error;});await settled();
  const saved=fs.readdirSync(path.join(root,'rt-assets'));assert.equal(saved.length,1);assert.equal(fs.readFileSync(path.join(root,'rt-assets',saved[0]),'utf8'),upload);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'uploaded source undo');
  assert.equal(fs.readdirSync(path.join(root,'rt-assets')).length,1,'uploaded asset retained for reuse');
  const secondFile=path.join(root,'about us.html'),secondOriginal='<html><body><h1>About this site</h1></body></html>';
  fs.writeFileSync(secondFile,secondOriginal);await page.getByRole('button',{name:'Refresh page list',exact:true}).click();
  await wait(async()=>await page.locator('#pagePicker option[value="/about%20us.html"]').count()===1,'new page catalog');
  await page.getByLabel('Project page',{exact:true}).selectOption('/about%20us.html');
  await wait(async()=>await app.locator('h1').textContent()==='About this site','page navigation');
  await page.getByRole('treeitem',{name:'h1 · About this site',exact:true}).click();
  await page.locator('#panelBody textarea').fill('Edited about page');await page.getByRole('button',{name:'Apply text',exact:true}).click();
  await wait(()=>fs.readFileSync(secondFile,'utf8').includes('Edited about page'),'second page edit');await settled();
  assert.equal(read(),original,'first page unchanged');
  await page.getByLabel('Project page',{exact:true}).selectOption('/');await wait(async()=>await app.locator('h1').textContent()==='Hello HTML','navigate away before undo');

  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>fs.readFileSync(secondFile,'utf8')===secondOriginal,'second page undo');
  await wait(async()=>await page.getByLabel('Project page',{exact:true}).inputValue()==='/about%20us.html','undo returns to edited page');
  await page.getByLabel('Project page',{exact:true}).selectOption('/');await wait(async()=>await app.locator('h1').textContent()==='Hello HTML','navigate away before redo');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(async()=>await app.locator('h1').textContent()==='Edited about page','redo returns to edited page');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>fs.readFileSync(secondFile,'utf8')===secondOriginal,'redo undone exactly');

  await page.getByLabel('Project page',{exact:true}).selectOption('/');await wait(async()=>await app.locator('h1').textContent()==='Hello HTML','return to home');

  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByRole('button',{name:'Duplicate layer',exact:true}).click();
  await wait(async()=>await app.locator('h1').count()===2,'duplicate HTML layer');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'duplicate undo');
  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByRole('button',{name:'Move layer down',exact:true}).click();
  await wait(async()=>await app.locator('main > :first-child').evaluate(el=>el.tagName)==='P','move HTML layer');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'move undo');
  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByRole('button',{name:'Delete layer',exact:true}).click();
  await wait(async()=>await app.locator('h1').count()===0,'delete HTML layer');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'delete undo');

  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('');
  await width('240px');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await width('320px');
  await page.getByRole('button',{name:'Duplicate layer',exact:true}).click();await wait(async()=>await app.locator('h1').count()===2,'styled duplication');await settled();
  assert.deepEqual(await app.locator('h1').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).width)),['320px','320px']);
  const ids=await app.locator('h1').evaluateAll(elements=>elements.map(el=>el.getAttribute('data-rt-style')));assert.notEqual(ids[0],ids[1]);
  await size('390x844');await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).nth(1).click();await page.getByLabel('Style screen scope').selectOption('');
  const copyWidth=page.getByLabel('Width (CSS)',{exact:true});await copyWidth.fill('160px');await copyWidth.press('Tab');
  await wait(async()=>await app.locator('h1').nth(1).evaluate(el=>getComputedStyle(el).width)==='160px','copy independent edit');await settled();
  assert.equal(await app.locator('h1').first().evaluate(el=>getComputedStyle(el).width),'240px');
  for(let i=0;i<4;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'styled clone exact undo');

  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByRole('button',{name:'Copy layer',exact:true}).click();
  await page.getByRole('treeitem',{name:'p · Unedited sibling',exact:true}).click();await page.getByRole('button',{name:'Paste layer',exact:true}).click();
  await wait(async()=>await app.locator('main > :nth-child(3)').evaluate(el=>el.tagName)==='H1','paste after selected sibling');await settled();
  assert.equal(await app.locator('h1').count(),2);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'paste exact undo');
  const copiedRow=page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true});await copiedRow.click();await wait(async()=>await page.getByRole('button',{name:'Copy layer',exact:true}).isEnabled(),'copy ready');await wait(async()=>await copiedRow.getAttribute('aria-selected')==='true'&&await page.locator('#layersPanel').getAttribute('aria-busy')!=='true','copy selection settled');await copiedRow.press('Control+c');
  const targetRow=page.getByRole('treeitem',{name:'p · Unedited sibling',exact:true});await targetRow.click();await wait(async()=>await page.getByRole('button',{name:'Paste layer',exact:true}).isEnabled(),'paste ready');await wait(async()=>await targetRow.getAttribute('aria-selected')==='true'&&await page.locator('#layersPanel').getAttribute('aria-busy')!=='true','paste selection settled');await targetRow.press('Control+v');
  await wait(async()=>await app.locator('h1').count()===2,'keyboard layer paste');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'keyboard paste undo');

  await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByRole('button',{name:'Add text',exact:true}).click();
  await wait(async()=>await app.locator('main > p').last().textContent()==='New text','create text');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'create text undo');
  await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByRole('button',{name:'Add frame',exact:true}).click();
  await wait(async()=>await app.locator('main > div[aria-label="Frame"]').count()===1,'create frame');await settled();
  assert.ok(await app.locator('div[aria-label="Frame"]').evaluate(el=>el.getBoundingClientRect().height)>=100);
  await page.getByRole('button',{name:'Add text',exact:true}).click();await wait(async()=>await app.locator('div[aria-label="Frame"] > p').textContent()==='New text','create text inside frame');await settled();
  await page.locator('#panelBody textarea').fill('Inside my frame');await page.getByRole('button',{name:'Apply text',exact:true}).click();
  await wait(async()=>await app.locator('div[aria-label="Frame"] > p').textContent()==='Inside my frame','edit new text');await settled();
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'new frame and text exact undo');

  await size('768x1024');await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  await page.getByLabel('Display (CSS)',{exact:true}).selectOption('grid');await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).display)==='grid','grid display');await settled();
  const columns=page.getByLabel('Grid columns',{exact:true});await columns.fill('2');await columns.press('Tab');
  await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)===2,'grid columns');await settled();
  const lefts=await app.locator('main > *').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().left));assert.ok(lefts[1]>lefts[0]);assert.equal(lefts[2],lefts[0]);
  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();const span=page.getByLabel('Column span',{exact:true});await span.fill('2');await span.press('Tab');
  await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).gridColumnStart)==='span 2','grid child span');await settled();
  await size('390x844');await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).display)==='block','grid phone inheritance');
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'grid exact undo');

  await size('768x1024');await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('');
  const frameWidth=page.getByLabel('Width (CSS)',{exact:true});await frameWidth.fill('900px');await frameWidth.press('Tab');await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).width)==='900px','flex frame width');await settled();
  await page.getByLabel('Display (CSS)',{exact:true}).selectOption('flex');await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).display)==='flex','flex parent');await settled();
  const beforeFill=read();await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  await page.getByRole('button',{name:'Fill available space',exact:true}).click();await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).flexGrow)==='1','fill flex item');await settled();
  const fillSource=read(),fillWidth=await app.locator('h1').evaluate(el=>el.getBoundingClientRect().width);
  await page.getByRole('button',{name:'Hug contents',exact:true}).click();await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).flexGrow)==='0','hug flex item');await settled();
  assert.ok(await app.locator('h1').evaluate(el=>el.getBoundingClientRect().width)<fillWidth,'hug follows content width');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===fillSource,'hug is one undo step');
  await size('390x844');await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).flexGrow)==='0','flex phone inheritance');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===beforeFill,'fill is one undo step');
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'flex setup exact undo');

  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();const name=page.getByLabel('Layer name',{exact:true});await name.fill('Hero & title');await name.press('Tab');
  await wait(async()=>await page.getByRole('treeitem',{name:'h1 · Hero & title',exact:true}).count()===1,'layer renamed');await settled();
  assert.equal(await app.locator('h1').textContent(),'Hello HTML');assert.equal(await app.locator('h1').getAttribute('aria-label'),null);
  const namedSource=read();await page.getByLabel('Find a layer',{exact:true}).fill('Hero');assert.equal(await page.getByRole('treeitem',{name:'h1 · Hero & title',exact:true}).count(),1);await page.getByLabel('Find a layer',{exact:true}).fill('');
  const namedRow=page.getByRole('treeitem',{name:'h1 · Hero & title',exact:true});await namedRow.click();await settled();await wait(async()=>await namedRow.getAttribute('aria-selected')==='true'&&await page.locator('#layersPanel').getAttribute('aria-busy')!=='true','rename selection ready');await namedRow.press('F2');
  await wait(()=>page.evaluate(()=>document.activeElement?.id==='layerNameInput'),'F2 naming focus');
  await name.fill('');await name.press('Tab');await wait(async()=>await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).count()===1,'clear layer name');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===namedSource,'clear name undo');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'rename exact undo');

  await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByRole('button',{name:'Add frame',exact:true}).click();await wait(async()=>await app.locator('main > div[aria-label="Frame"]').count()===1,'reparent destination frame');await settled();
  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('');await width('240px');const beforeMove=read();
  await page.getByRole('button',{name:'Move into…',exact:true}).click();await page.getByLabel('Destination container',{exact:true}).selectOption({label:'div · Frame'});await page.getByRole('button',{name:'Move layer',exact:true}).click();
  await wait(async()=>await app.locator('main > div[aria-label="Frame"] > h1').count()===1,'move into frame');await settled();
  assert.equal(await app.locator('h1').evaluate(el=>getComputedStyle(el).width),'240px');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===beforeMove,'reparent exact undo');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(async()=>await app.locator('main > div[aria-label="Frame"] > h1').count()===1,'reparent redo');
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'reparent setup exact undo');

  await page.getByRole('treeitem',{name:'main',exact:true}).click();await page.getByRole('button',{name:'Add frame',exact:true}).click();await wait(async()=>await app.locator('main > div[aria-label="Frame"]').count()===1,'drag destination frame');await settled();
  const dragSource=page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}),dropTarget=page.getByRole('treeitem',{name:'div · Frame',exact:true});
  await wait(async()=>await page.locator('#layersPanel').getAttribute('aria-busy')!=='true','drag ready');await dragSource.dragTo(dropTarget);
  await wait(async()=>await app.locator('main > div[aria-label="Frame"] > h1').count()===1,'drag into frame');await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(async()=>await app.locator('main > h1').count()===1,'drag undo');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original,'drag setup undo');
  const headingRow=page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}),paragraphRow=page.getByRole('treeitem',{name:'p · Unedited sibling',exact:true});
  for(const position of ['after','before']){
   await wait(async()=>await page.locator('#layersPanel').getAttribute('aria-busy')!=='true','reorder ready');
   const box=await paragraphRow.boundingBox();await headingRow.dragTo(paragraphRow,{targetPosition:{x:box.width/2,y:position==='before'?2:box.height-2}});
   await wait(async()=>await app.locator(position==='after'?'main > p + h1':'main > h1 + p').count()===1,'drag '+position+' sibling');await settled();
  }
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'sibling drag exact undo');
  await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();await settled();
  await size('390x844');await page.getByLabel('Style screen scope').selectOption('');
  const shadowValue=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).boxShadow);
  await page.getByRole('button',{name:'Add shadow',exact:true}).click();await wait(async()=>(await shadowValue()).includes('4px 8px'),'base shadow');await settled();
  await page.getByLabel('Shadow 1 Blur (px)',{exact:true}).fill('12');await page.getByLabel('Shadow 1 Blur (px)',{exact:true}).press('Tab');await wait(async()=>(await shadowValue()).includes('4px 12px'),'shadow blur');await settled();
  const baseShadow=await shadowValue();
  const shadowGroup=page.locator('.shadow-controls').first();await shadowGroup.scrollIntoViewIfNeeded();assert.equal(await shadowGroup.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'shadow controls fit panel');
  if(process.env.RT_E2E_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SCREENSHOT});
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  await page.getByRole('button',{name:'Add shadow',exact:true}).click();await wait(async()=>await page.getByLabel('Shadow 2 type',{exact:true}).count()===1,'second shadow');await settled();
  await page.getByLabel('Shadow 2 type',{exact:true}).selectOption('inner');await wait(async()=>(await shadowValue()).includes('inset'),'inner shadow');await settled();
  await page.getByRole('button',{name:'Move shadow 2 up',exact:true}).click();await wait(async()=>await page.getByLabel('Shadow 1 type',{exact:true}).inputValue()==='inner','shadow reorder');await settled();
  await size('390x844');await wait(async()=>await shadowValue()===baseShadow,'base shadow unchanged');
  await size('768x1024');await wait(async()=>(await shadowValue()).includes('inset'),'tablet shadow retained');
  await page.getByRole('button',{name:'Reset shadows',exact:true}).click();await wait(async()=>await shadowValue()===baseShadow,'shadow reset inheritance');await settled();
  await size('390x844');await page.getByLabel('Style screen scope').selectOption('');await page.getByRole('button',{name:'Clear shadows',exact:true}).click();await wait(async()=>await shadowValue()==='none','clear shadows');await settled();
  for(let i=0;i<7;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}
  await wait(()=>read()===original,'shadows exact undo');
  assert.deepEqual(errors,[]);console.log(engine+': PASS HTML browser responsive CSS, shorthand and edge spacing, isolated styling, standalone export, reset, text/image edits, asset search/upload, page navigation and exact undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
