'use strict';
// Opt-in verification against the user's running development theme. A unique,
// unreferenced probe section is created and removed; user-authored files are
// never reset. Both application servers stay running.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.RT_SHOPIFY_THEME;
if(!root)throw new Error('RT_SHOPIFY_THEME must name the local development theme.');
const {chromium}=require(path.join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/playwright'));
const url=process.env.RT_E2E_URL||'http://localhost:9400';
const name='retouch-parity-probe',file=path.join(root,'sections',name+'.liquid');
const original=`<style>#rt-rich{font:24px sans-serif;margin:40px}#rt-image{display:block;max-width:200px;margin:40px}</style>
{% assign caption = '<p>Welcome <a href="/saved" class="brand"><span style="color:red">friend</span></a>.</p>' %}
<div id="rt-rich">{{ caption }}</div>
{% assign sample = collections.all.products.first.featured_image %}
{{ sample | image_url: width: 400 | image_tag: id: 'rt-image', widths: '200, 400', sizes: '200px', loading: 'lazy', class: 'image-probe' }}
{% schema %}{"name":"Retouch parity probe","settings":[]}{% endschema %}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<160;i++){if(await fn())return;await sleep(150);}throw new Error('Timed out: '+label);}
let browser,created=false;
const originalAssets=new Set(fs.readdirSync(path.join(root,'assets')));
(async()=>{
  fs.writeFileSync(file,original,{flag:'wx'});
  created=true;
  await until(async()=>{const r=await fetch(url+'/?section_id='+name);return(await r.text()).includes('id="rt-image"');},'Shopify probe upload');
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1320,height:900}}),frame=page.frameLocator('#app'),errors=[],ops=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().endsWith('/rt/__api/op'))ops.push(await r.json());});
  await page.goto(url+'/rt?section_id='+name);
  const rich=frame.locator('#rt-rich');await rich.click();
  await until(async()=>await rich.getAttribute('contenteditable')==='true','rich text editing');
  await rich.locator('span[style]').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
  await page.keyboard.press('Meta+b');await page.keyboard.press('Enter');
  await until(()=>fs.readFileSync(file,'utf8').includes('<strong>friend</strong>'),'Shopify rich source write');
  await until(async()=>await rich.locator('strong').count()===1,'Shopify rich render');
  assert.equal(await rich.locator('a').getAttribute('href'),'/saved');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await until(()=>fs.readFileSync(file,'utf8')===original,'rich source undo');
  await until(async()=>await rich.locator('strong').count()===0,'rich render undo');
  console.log('PASS Shopify inline rich formatting, preserved nested attributes, rendered reload and byte-exact undo');
  const image=frame.locator('#rt-image');
  const initial=await image.evaluate(el=>({sizes:el.sizes,alt:el.alt,width:el.getAttribute('width'),height:el.getAttribute('height'),loading:el.loading}));
  await image.click();await page.getByRole('button',{name:'Browse project images',exact:true}).click();
  await page.getByRole('button',{name:'favicon-512x512.png',exact:true}).click();
  await until(()=>fs.readFileSync(file,'utf8').includes('retouch-image-v1:'),'generated image source write');
  await until(async()=>await image.evaluate(el=>el.complete&&el.naturalWidth>0&&el.currentSrc.includes('favicon-512x512')),'Shopify image swap loaded');
  const swapped=await image.evaluate(el=>({sizes:el.sizes,alt:el.alt,width:el.getAttribute('width'),height:el.getAttribute('height'),loading:el.loading}));
  assert.deepEqual(swapped,initial);
  const srcset=await image.getAttribute('srcset');assert.match(srcset,/200w/);assert.match(srcset,/400w/);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>fs.readFileSync(file,'utf8')===original,'generated image undo');
  await until(async()=>!String(await image.getAttribute('src')).includes('favicon-512x512'),'generated image render undo');
  console.log('PASS Shopify generated image browser, loaded swap, preserved responsive widths and attributes, exact undo');
  await image.click();
  await page.locator('#panel input[type="file"]').setInputFiles({name:'parity-upload.png',mimeType:'image/png',buffer:fs.readFileSync(path.join(root,'assets/favicon-512x512.png'))});
  await until(async()=>await image.evaluate(el=>el.complete&&el.naturalWidth>0&&el.currentSrc.includes('parity-upload')),'Shopify uploaded image loaded');
  const uploaded=fs.readdirSync(path.join(root,'assets')).find(n=>n.includes('parity-upload')&&!originalAssets.has(n));
  assert.ok(uploaded);await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>fs.readFileSync(file,'utf8')===original,'upload swap undo');
  await until(async()=>await image.evaluate(el=>el.complete&&el.naturalWidth>0&&!el.currentSrc.includes('parity-upload')&&!el.currentSrc.includes('favicon-512x512')),'original Shopify image loaded after undo');
  assert.ok(ops.every(op=>op.ok),JSON.stringify(ops));assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/retouch-shopify-parity.png'});
  console.log('PASS Shopify image upload, actual image loaded, exact swap undo, no browser errors');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(created&&fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('Retouch parity probe'))fs.unlinkSync(file);
  for(const name of fs.readdirSync(path.join(root,'assets')))if(name.includes('parity-upload')&&!originalAssets.has(name))fs.unlinkSync(path.join(root,'assets',name));
});
