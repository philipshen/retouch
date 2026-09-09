'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const {chromium}=require(path.join(fixture,'node_modules/playwright'));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-browser-')),file=path.join(root,'index.html');
 const original='<!doctype html><html><head><link rel="stylesheet" href="site.css"></head><body><main><h1 class="title">Hello HTML</h1><img src="first.svg" alt="Study"></main></body></html>';
 fs.writeFileSync(file,original);fs.writeFileSync(path.join(root,'site.css'),'.title{color:rgb(120,30,60);font-size:36px}body{padding:32px}img{width:100px;height:100px}');
 for(const [name,color]of [['first','red'],['second','blue']])fs.writeFileSync(path.join(root,name+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="'+color+'"/></svg>');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
 const app=page.frameLocator('#app');
 try{
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.getByRole('treeitem',{name:'h1 · Hello HTML',exact:true}).click();
  assert.equal(await app.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(120, 30, 60)');
  await page.locator('#panelBody textarea').fill('Saved & clear');await page.getByRole('button',{name:'Apply text',exact:true}).click();
  await wait(async()=>await app.locator('h1').textContent()==='Saved & clear','text rendered');assert.ok(fs.readFileSync(file,'utf8').includes('Saved &amp; clear'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original,'text undo');
  await page.getByRole('treeitem',{name:'img · Study',exact:true}).click();await page.getByLabel('Image path',{exact:true}).fill('/second.svg');await page.getByRole('button',{name:'Apply image path',exact:true}).click();
  await wait(async()=>await app.locator('img').evaluate(el=>el.complete&&el.currentSrc.endsWith('/second.svg')),'image loaded');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original,'image undo');
  assert.deepEqual(errors,[]);console.log('PASS HTML browser selection, original CSS preservation, text and image edits, rendered reloads and exact undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
