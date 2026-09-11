'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RT_INSPECTOR_FIXTURE;
if(!root)throw new Error('RT_INSPECTOR_FIXTURE must name a disposable inspector fixture.');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const pageFile=path.join(root,'app/page.jsx'),componentFile=path.join(root,'components/Card.jsx');
const original=fs.readFileSync(pageFile,'utf8'),shared=fs.readFileSync(componentFile,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<120;i++){if(await fn())return;await sleep(100);}throw new Error('Timed out: '+label);}
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const frame=page.frameLocator('#app');
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 let createdFile;
 try{
   await page.goto((process.env.RT_E2E_URL||'http://localhost:3491')+'/rt');
   await frame.locator('article').first().click({position:{x:8,y:8}});
   await page.getByRole('button',{name:'View component',exact:true}).waitFor();
   assert.equal(await page.locator('.kindbadge').textContent(),'Card');
   assert.match(await page.locator('.component-props').textContent(),/First card/);
   await page.getByRole('button',{name:'View component',exact:true}).click();
   const modal=page.locator('dialog');await modal.waitFor();
   const preview=page.frameLocator('iframe[title="Component preview"]');
   await preview.getByRole('heading',{name:'First card',exact:true}).waitFor();
   await until(async()=>!await preview.getByRole('heading',{name:'Second card',exact:true}).isVisible(),'preview isolation');
   assert.match(await modal.locator('.component-props').textContent(),/quiet/);
   await modal.locator('summary').click();assert.match(await modal.locator('pre').textContent(),/function Card/);
   assert.equal(fs.readFileSync(pageFile,'utf8'),original);assert.equal(fs.readFileSync(componentFile,'utf8'),shared);
   assert.ok(await frame.getByRole('heading',{name:'Second card',exact:true}).isVisible(),'main app stays intact');
   await page.screenshot({path:'/tmp/retouch-component-modal.png'});
   await modal.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('button',{name:'Edit definition',exact:true}).click();
   await page.getByRole('button',{name:'Choose fill',exact:true}).click();
   await page.getByLabel('Fill hex color',{exact:true}).fill('#ddeeff');await page.getByLabel('Fill hex color',{exact:true}).press('Enter');
   await until(async()=>{const colors=await frame.locator('article').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));return colors.every(c=>c==='rgb(221, 238, 255)');},'shared style on both instances');
   assert.match(fs.readFileSync(componentFile,'utf8'),/bg-\[#ddeeff\]/);assert.equal(fs.readFileSync(pageFile,'utf8'),original);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>fs.readFileSync(componentFile,'utf8')===shared,'shared undo');
   await until(async()=>(await page.getByRole('button',{name:'Undo',exact:true}).getAttribute('aria-busy'))==='false','undo refreshed');
   console.log('PASS instance classification, props/defaults, live isolated preview, definition source, shared edit, exact undo');

   await frame.locator('article').first().click({position:{x:8,y:8}});
   await page.getByRole('button',{name:'Detach instance',exact:true}).click();
   await until(()=>fs.readdirSync(path.join(root,'components')).some(n=>n.startsWith('Card.retouch-')),'copied module');
   createdFile=path.join(root,'components',fs.readdirSync(path.join(root,'components')).find(n=>n.startsWith('Card.retouch-')));
   await page.getByRole('button',{name:'Choose fill',exact:true}).waitFor();
   await page.getByRole('button',{name:'Choose fill',exact:true}).click();
   await page.getByLabel('Fill hex color',{exact:true}).fill('#ffeedd');await page.getByLabel('Fill hex color',{exact:true}).press('Enter');
   await until(async()=>await frame.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(255, 238, 221)','detached style');
   assert.equal(await frame.locator('article').nth(1).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
   assert.equal(fs.readFileSync(componentFile,'utf8'),shared);
   assert.match(fs.readFileSync(createdFile,'utf8'),/bg-\[#ffeedd\]/);
   assert.match(fs.readFileSync(pageFile,'utf8'),/<Card title="Second card"/);
   await page.screenshot({path:'/tmp/retouch-component-detached.png'});
   await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>fs.readFileSync(createdFile,'utf8')===shared,'detached style undo');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>!fs.existsSync(createdFile),'detach undo removes copied module');
   assert.equal(fs.readFileSync(pageFile,'utf8'),original);assert.equal(fs.readFileSync(componentFile,'utf8'),shared);
   await until(async()=>(await page.getByRole('button',{name:'Undo',exact:true}).getAttribute('aria-busy'))==='false','detach undo refreshed');
   await frame.getByRole('heading',{name:'First card',exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   console.log('PASS detach changes one usage, preserves sibling, independent styling, two-file exact undo, no browser errors');
 }catch(e){console.error('Status:',await page.locator('#status').textContent(),'Browser errors:',errors);await page.screenshot({path:'/tmp/retouch-component-failure.png'});throw e;}
 finally{fs.writeFileSync(pageFile,original);fs.writeFileSync(componentFile,shared);if(createdFile&&fs.existsSync(createdFile))fs.unlinkSync(createdFile);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
