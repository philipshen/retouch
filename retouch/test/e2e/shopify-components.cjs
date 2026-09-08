'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_SHOPIFY_THEME;
if(!root)throw new Error('RT_SHOPIFY_THEME must name the local development theme.');
const {chromium}=require(path.join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/playwright'));
const url=process.env.RT_E2E_URL||'http://localhost:9400',owned=[];
const frameName='rt-probe-frame',cardName='rt-probe-card',templateFile='templates/product.rt-parity.json';
const frameSource=`<section class="rt-probe-frame p-4"><h2>Frame</h2>{% content_for 'block', type: 'rt-probe-card', id: 'static' %}<div>{% content_for 'blocks' %}</div></section>{% schema %}{"name":"Retouch probe frame","settings":[],"blocks":[{"type":"@theme"}]}{% endschema %}`;
const cardSource=`<article class="rt-probe-card p-4 bg-white"><h3>{{ block.settings.label }}</h3></article>{% schema %}{"name":"Retouch probe card","tag":null,"settings":[{"type":"text","id":"label","label":"Label","default":"Default card"}],"presets":[{"name":"Retouch probe card"}]}{% endschema %}`;
const section=label=>({type:frameName,blocks:{static:{type:cardName,static:true,settings:{label:'Static '+label}},dynamic:{type:cardName,settings:{label:'Dynamic '+label}}},block_order:['dynamic']});
const original=JSON.stringify({sections:{first:section('first'),second:section('second')},order:['first','second']},null,2)+'\n';
const files={'sections/rt-probe-frame.liquid':frameSource,'blocks/rt-probe-card.liquid':cardSource,[templateFile]:original};
const before=new Set(['sections','blocks'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).map(name=>dir+'/'+name)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<180;i++){if(await fn())return;await sleep(150);}throw new Error('Timed out: '+label);}
let browser,page;
(async()=>{
  const home=await(await fetch(url)).text(),product=/href="(\/products\/[^"?]+)"/.exec(home)?.[1];
  assert.ok(product,'the test store has a product route');
  for(const rel of ['blocks/rt-probe-card.liquid','sections/rt-probe-frame.liquid']){const file=path.join(root,rel);fs.writeFileSync(file,files[rel],{flag:'wx'});owned.push(file);}
  await until(async()=>{const html=await(await fetch(url+'/?section_id='+frameName)).text();return !html.includes('Upload Errors')&&html.includes('<article')&&html.includes('Default card');},'probe definitions available');
  fs.writeFileSync(path.join(root,templateFile),original,{flag:'wx'});owned.push(path.join(root,templateFile));
  const appPath=product+'?view=rt-parity';
  await until(async()=>{const html=await(await fetch(url+appPath)).text();return !html.includes('Upload Errors')&&html.includes('<article')&&html.includes('Static first')&&html.includes('Dynamic second');},'alternate product template upload');
  browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const frame=page.frameLocator('#app'),ops=[];page.on('response',async r=>{if(r.url().endsWith('/rt/__api/op'))ops.push(await r.json());});
  await page.goto(url+'/rt'+appPath);
  // Dismiss the store's consent dialog only inside this disposable browser.
  await page.getByRole('button',{name:'Edit mode',exact:true}).click();
  const decline=frame.getByRole('button',{name:'Decline',exact:true});if(await decline.isVisible())await decline.click();
  await page.getByRole('button',{name:'Interact mode',exact:true}).click();
  const card=label=>frame.locator('article.rt-probe-card').filter({hasText:label});
  async function choose(label){await card(label).click({position:{x:8,y:8}});await page.getByLabel('Component scope',{exact:true}).selectOption({label:cardName});await page.getByRole('button',{name:'View component',exact:true}).waitFor();}
  await choose('Static first');
  assert.match(await page.locator('.component-props').textContent(),/Static first/);
  await page.getByRole('button',{name:'View component',exact:true}).click();
  const modal=page.locator('dialog'),preview=page.frameLocator('iframe[title="Component preview"]');
  await preview.getByRole('heading',{name:'Static first',exact:true}).waitFor();
  await until(async()=>!await preview.getByRole('heading',{name:'Static second',exact:true}).isVisible(),'selected static component preview');
  await modal.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Detach instance',exact:true}).click();
  await until(()=>JSON.parse(fs.readFileSync(path.join(root,templateFile),'utf8')).sections.first.type!==frameName,'static parent and usage detached');
  await page.getByRole('button',{name:'Choose fill',exact:true}).waitFor();
  await page.getByRole('button',{name:'Choose fill',exact:true}).click();await page.getByLabel('Fill hex color',{exact:true}).fill('#fedcba');await page.getByLabel('Fill hex color',{exact:true}).press('Enter');
  await until(async()=>await card('Static first').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(254, 220, 186)','detached static style rendered');
  assert.equal(await card('Static second').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await card('Dynamic first').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),'static undo completed');}
  assert.equal(fs.readFileSync(path.join(root,templateFile),'utf8'),original);
  assert.equal(fs.readFileSync(path.join(root,'blocks/rt-probe-card.liquid'),'utf8'),cardSource);
  console.log('PASS Shopify static component props, isolated preview, parent-chain detach, independent style and exact undo');
  await choose('Dynamic first');await page.getByRole('button',{name:'Detach instance',exact:true}).click();
  await until(()=>JSON.parse(fs.readFileSync(path.join(root,templateFile),'utf8')).sections.first.blocks.dynamic.type!==cardName,'dynamic usage detached');
  await page.getByRole('button',{name:'Choose fill',exact:true}).waitFor();
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,templateFile),'utf8')).sections.first.type,frameName);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),'dynamic undo completed');
  assert.equal(fs.readFileSync(path.join(root,templateFile),'utf8'),original);
  assert.ok(ops.every(op=>op.ok),JSON.stringify(ops));assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/retouch-shopify-components.png'});
  console.log('PASS Shopify dynamic component scope, detach, unchanged parent and sibling, exact undo, no browser exceptions');
})().catch(async err=>{if(page){console.error('Status:',await page.locator('#status').textContent());await page.screenshot({path:'/tmp/retouch-shopify-components-failure.png'});}console.error(err);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  for(const file of owned)if(fs.existsSync(file))fs.unlinkSync(file);
  for(const dir of ['sections','blocks'])for(const name of fs.readdirSync(path.join(root,dir))){const rel=dir+'/'+name;if(!before.has(rel)&&/^rt-probe-(?:frame|card)-retouch-[\da-f]+\.liquid$/.test(name))fs.unlinkSync(path.join(root,rel));}
});
