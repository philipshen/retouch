'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-compare-edit-')),file=path.join(root,'index.html'),original='<html><head><style>body{margin:0}a{display:block;padding:20px}article{padding:20px;margin-top:20px}@media(min-width:600px){a{display:none}}@media(max-width:599px){article{visibility:hidden}}@media(min-width:1000px){article{margin-top:1200px}}</style></head><body><main><a href="/elsewhere.html">Open link</a><article>Card</article></main></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1800,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(e){if(!/Execution context was destroyed/.test(e.message))throw e;}await page.waitForTimeout(100);}throw Error('Timed out waiting for comparison edit');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true'),preview=name=>page.frameLocator('iframe[title="'+name+' comparison preview"]');
 const clickLayer=async(name,selector)=>{const viewport=page.getByRole('button',{name:'Edit from '+name+' comparison',exact:true});await viewport.scrollIntoViewIfNeeded();const bounds=await viewport.boundingBox(),node=await preview(name).locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};}),width=await preview(name).locator('body').evaluate(()=>innerWidth),scale=bounds.width/width;await page.mouse.click(bounds.x+node.x*scale,bounds.y+node.y*scale);};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.getByLabel('Screen size',{exact:true}).selectOption('1440x900');await page.getByRole('treeitem',{name:'main',exact:true}).click();await settled();await page.getByLabel('Style screen scope').selectOption('min-[1440px]:');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await preview('Phone').locator('a').waitFor();await preview('Tablet').locator('article').waitFor();
  await page.getByRole('button',{name:'Edit mode',exact:true}).click();await clickLayer('Phone','a');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===390&&await page.getByRole('treeitem',{name:'a · Open link',exact:true}).getAttribute('aria-selected')==='true');assert.equal(await page.getByRole('button',{name:'Edit mode',exact:true}).count(),1);assert.equal(await app.locator('body').evaluate(()=>location.pathname),'/');assert.equal(await page.getByLabel('Style screen scope').inputValue(),'min-[1440px]:');assert.equal(fs.readFileSync(file,'utf8'),original);
  await clickLayer('Tablet','article');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===768&&await page.getByRole('treeitem',{name:'article · Card',exact:true}).getAttribute('aria-selected')==='true');
  const card=name=>page.getByRole('region',{name:name+' comparison',exact:true});
  await wait(async()=>await card('Phone').locator('.compare-selection').count()===0&&await card('Phone').locator('p.hint').textContent()==='Selected layer is hidden');
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===0&&await card('Desktop').locator('p.hint').textContent()==='Selected layer is outside this viewport');
  const mainScrollBefore=await app.locator('body').evaluate(()=>[scrollX,scrollY]);
  assert.equal(await page.getByRole('button',{name:'Show selection in Phone comparison',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Show selection in Desktop comparison',exact:true}).click();
  assert.deepEqual(await app.locator('body').evaluate(()=>[scrollX,scrollY]),mainScrollBefore);assert.equal(fs.readFileSync(file,'utf8'),original);
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===1&&await card('Desktop').locator('p.hint').textContent()==='Selected layer · 1 instance');
  await preview('Desktop').locator('article').evaluate(el=>{
   const container=el.ownerDocument.createElement('div');container.id='reveal-scroll-fixture';container.style.cssText='position:fixed;top:10px;left:10px;width:200px;height:180px;overflow:auto';
   container.append(el.cloneNode(true));el.ownerDocument.body.append(container);
  });
  const showDesktop=page.getByRole('button',{name:'Show selection in Desktop comparison',exact:true});
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===1); // The unscrolled clone is clipped by its container.

  await showDesktop.focus();await page.waitForTimeout(150);assert.equal(await showDesktop.evaluate(el=>el===el.ownerDocument.activeElement),true);
  await showDesktop.press('Enter');await wait(()=>preview('Desktop').locator('#reveal-scroll-fixture').evaluate(el=>el.scrollTop>0));
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===2);
  assert.equal(await preview('Desktop').locator('#reveal-scroll-fixture article').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.bottom>p.top&&r.top<p.bottom;}),true);
  await preview('Desktop').locator('#reveal-scroll-fixture').evaluate(el=>{el.firstElementChild.style.width='500px';el.scrollTop=1050;});
  const desktopScale=(await page.getByRole('button',{name:'Edit from Desktop comparison',exact:true}).boundingBox()).width/1440;
  await wait(async()=>{const box=await card('Desktop').locator('.compare-selection').last().boundingBox();return box&&Math.abs(box.height-30*desktopScale)<1&&Math.abs(box.width-200*desktopScale)<1;});
  await preview('Desktop').locator('#reveal-scroll-fixture article').evaluate(el=>{el.style.cssText='position:fixed;top:250px;left:20px;margin:0';});
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===2); // Viewport-fixed descendants escape overflow.
  await preview('Desktop').locator('#reveal-scroll-fixture article').evaluate(el=>{el.parentElement.style.position='static';el.style.position='absolute';el.style.top=(el.ownerDocument.defaultView.scrollY+250)+'px';});
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===2); // Absolute positioning uses a containing block outside the overflow ancestor.

  await preview('Desktop').locator('#reveal-scroll-fixture').evaluate(el=>{
   el.style.position='fixed';el.style.transform='translateZ(0)';el.scrollTop=0;el.scrollLeft=0;
   el.firstElementChild.style.cssText='position:fixed;top:250px;left:0;margin:0;width:300px;height:100px;box-sizing:border-box';
  });
  await wait(async()=>await card('Desktop').locator('.compare-selection').count()===1); // Transformed containers clip their fixed descendants.
  await preview('Desktop').locator('#reveal-scroll-fixture').evaluate(el=>{el.style.transform='scale(2)';el.style.transformOrigin='0 0';el.firstElementChild.style.top='160px';el.scrollTop=0;});
  await wait(async()=>{const box=await card('Desktop').locator('.compare-selection').last().boundingBox();return await card('Desktop').locator('.compare-selection').count()===2&&box&&Math.abs(box.height-40*desktopScale)<1&&Math.abs(box.width-400*desktopScale)<1;});
  await preview('Desktop').locator('body').evaluate(()=>scrollTo(0,0));await showDesktop.click();await wait(()=>preview('Desktop').locator('body').evaluate(()=>scrollY>0));
  await preview('Desktop').locator('#reveal-scroll-fixture').evaluate(el=>el.remove());assert.deepEqual(await app.locator('body').evaluate(()=>[scrollX,scrollY]),mainScrollBefore);assert.equal(fs.readFileSync(file,'utf8'),original);
  await wait(async()=>await card('Phone').locator('[data-scope-applies]').getAttribute('data-scope-applies')==='false'&&await card('Tablet').locator('[data-scope-applies]').getAttribute('data-scope-applies')==='false'&&await card('Desktop').locator('[data-scope-applies]').getAttribute('data-scope-applies')==='true');
  await page.getByRole('button',{name:'Edit styles from 768 px',exact:true}).click();await wait(async()=>await page.getByLabel('Style screen scope').inputValue()==='min-[768px]:'&&await card('Tablet').locator('[data-scope-applies]').getAttribute('data-scope-applies')==='true');assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(await card('Phone').locator('[data-scope-applies]').getAttribute('data-scope-applies'),'false');assert.match(await page.getByLabel('Comparison style scope').textContent(),/768 px and larger/);const field=page.getByLabel('Background color (CSS)',{exact:true});await field.fill('#ff0000');await field.press('Tab');await settled();
  await wait(async()=>await preview('Tablet').locator('article').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(255, 0, 0)');assert.equal(await preview('Phone').locator('article').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>fs.readFileSync(file,'utf8')===original);
  await page.getByLabel('Style screen scope').selectOption('');await wait(async()=>await card('Phone').locator('[data-scope-applies]').getAttribute('data-scope-applies')==='true');assert.match(await card('Phone').locator('[data-scope-applies]').textContent(),/Base styles apply/);
  const desktop=page.getByRole('button',{name:'Edit from Desktop comparison',exact:true});await desktop.focus();await page.keyboard.press('Enter');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===1440);assert.equal(await page.getByRole('treeitem',{name:'article · Card',exact:true}).getAttribute('aria-selected'),'true');
  const mainSize=await app.locator('body').evaluate(()=>[innerWidth,innerHeight]),scopeBefore=await page.getByLabel('Style screen scope').inputValue();
  const resize=async(axis,value)=>{const input=page.getByLabel('Phone comparison '+axis,{exact:true});await input.fill(String(value));await input.press('Tab');};
  await resize('width',650);await wait(()=>preview('Phone').locator('body').evaluate(()=>innerWidth===650));
  assert.equal(await preview('Phone').locator('a').evaluate(el=>getComputedStyle(el).display),'none');assert.equal(await preview('Phone').locator('article').evaluate(el=>getComputedStyle(el).visibility),'visible');
  await resize('height',320);await wait(()=>preview('Phone').locator('body').evaluate(()=>innerHeight===320));
  assert.deepEqual(await app.locator('body').evaluate(()=>[innerWidth,innerHeight]),mainSize);assert.equal(await page.getByLabel('Style screen scope').inputValue(),scopeBefore);assert.equal(fs.readFileSync(file,'utf8'),original);
  for(const invalid of [239,7681,500.5]){await resize('width',invalid);assert.equal(await page.getByLabel('Phone comparison width',{exact:true}).evaluate(el=>el.checkValidity()),false);assert.equal(await preview('Phone').locator('body').evaluate(()=>innerWidth),650);}
  await page.getByLabel('Phone comparison width',{exact:true}).press('Escape');assert.equal(await page.getByLabel('Phone comparison width',{exact:true}).inputValue(),'650');
  await page.getByRole('button',{name:'Rotate Phone comparison',exact:true}).click();await wait(()=>preview('Phone').locator('body').evaluate(()=>innerWidth===320&&innerHeight===650));
  await page.getByRole('button',{name:'Edit styles from 320 px',exact:true}).click();await wait(async()=>await app.locator('body').evaluate(()=>innerWidth===320&&innerHeight===650)&&await page.getByLabel('Style screen scope').inputValue()==='min-[320px]:');assert.equal(fs.readFileSync(file,'utf8'),original);
  await page.reload();await page.getByRole('button',{name:'Compare screens',exact:true}).click();await wait(()=>preview('Phone').locator('body').evaluate(()=>innerWidth===320&&innerHeight===650));
  assert.equal(await page.getByLabel('Phone comparison width',{exact:true}).inputValue(),'320');assert.equal(await page.getByLabel('Phone comparison height',{exact:true}).inputValue(),'650');
  await resize('width',768);await resize('height',1024);
  assert.equal(await page.getByLabel('Phone comparison height',{exact:true}).inputValue(),'650');assert.equal(await card('Phone').getByRole('status').textContent(),'This size is already pinned.');
  await page.getByLabel('Screen width',{exact:true}).fill('800');await page.getByLabel('Screen width',{exact:true}).press('Tab');
  await page.getByLabel('Screen height',{exact:true}).fill('500');await page.getByLabel('Screen height',{exact:true}).press('Tab');
  await page.getByRole('button',{name:'Pin current size',exact:true}).click();await preview('Custom 800 × 500').locator('body').waitFor();
  const customWidth=page.getByLabel('Custom 800 × 500 comparison width',{exact:true});await customWidth.fill('810');await customWidth.press('Tab');
  await wait(()=>preview('Custom 810 × 500').locator('body').evaluate(()=>innerWidth===810));assert.equal(await page.getByLabel('Custom 810 × 500 comparison width',{exact:true}).inputValue(),'810');
  assert.equal(await page.getByRole('button',{name:'Edit styles from 810 px',exact:true}).count(),1);assert.equal(fs.readFileSync(file,'utf8'),original);
  await wait(async()=>await page.getByLabel('Custom 810 × 500 scope coverage').getAttribute('data-scope-applies')==='true');
  if(process.env.RT_E2E_COMPARE_EDIT_SCREENSHOT){await card('Custom 810 × 500').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RT_E2E_COMPARE_EDIT_SCREENSHOT});}
  await page.getByRole('button',{name:'Rename Custom 810 × 500 comparison',exact:true}).click();
  const nameInput=page.getByRole('textbox',{name:'Comparison name',exact:true});await nameInput.fill('  Checkout   narrow  ');await nameInput.press('Enter');
  await preview('Checkout narrow').locator('body').waitFor();assert.equal(await page.getByRole('button',{name:'Rename Checkout narrow comparison',exact:true}).textContent(),'Checkout narrow · 810 × 500');
  await page.getByLabel('Checkout narrow comparison width',{exact:true}).fill('820');await page.getByLabel('Checkout narrow comparison width',{exact:true}).press('Tab');await wait(()=>preview('Checkout narrow').locator('body').evaluate(()=>innerWidth===820));
  await page.getByRole('button',{name:'Rename Checkout narrow comparison',exact:true}).click();await nameInput.fill('Phone');await nameInput.press('Enter');assert.equal(await card('Checkout narrow').getByRole('status').textContent(),'Another comparison already has this name.');
  await nameInput.fill(' ');await nameInput.press('Enter');assert.equal(await card('Checkout narrow').getByRole('status').textContent(),'Enter a comparison name.');await nameInput.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Rename Checkout narrow comparison',exact:true}).count(),1);assert.equal(await page.getByLabel('Screen width',{exact:true}).inputValue(),'800');assert.equal(fs.readFileSync(file,'utf8'),original);
  await page.reload();await app.locator('body').waitFor();await page.getByRole('button',{name:'Compare screens',exact:true}).click();await preview('Checkout narrow').locator('body').waitFor();assert.equal(await page.getByLabel('Checkout narrow comparison width',{exact:true}).inputValue(),'820');assert.equal(fs.readFileSync(file,'utf8'),original);
  console.log(engine+': PASS comparison renaming, whitespace normalization, resize retention, blank/duplicate rejection, Escape cancellation, reload persistence and unchanged main/source');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await wait(async()=>await page.locator('#screenComparisons iframe').count()===0);assert.deepEqual(errors,[]);console.log(engine+': PASS comparison selection reveal and instance cycling through nested scrollers, layer picking, hidden/offscreen and partially clipped outlines, out-of-flow escape, transformed fixed clipping, responsive visibility, edit-mode entry, link interception, explicit scoped edits, live previews, keyboard, editable comparison dimensions, rotation, validation, reload persistence and undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
