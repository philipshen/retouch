'use strict';
// A real browser exercises the shared inline editor against Liquid rendering,
// including backing JSON writes and exact transaction undo.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {Liquid}=require('liquidjs');
const liquid=require('../../src/adapters/liquid.cjs');
const {startServer}=require('../../src/server.cjs');
const {chromium}=require(path.join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/playwright'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-rich-browser-'));
const source='<div id="rich">{{ "copy_html" | t: name: "Ada" }}</div><div id="setting">{{ section.settings.copy }}</div>';
const copy='<p>Welcome <a href="/saved" class="brand"><span style="color:red">friend</span></a> {{ name }}.</p>';
const files={'sections/main.liquid':source,'locales/en.default.json':JSON.stringify({copy_html:copy}),'templates/index.json':JSON.stringify({sections:{main:{type:'main',settings:{copy:'<p>A <span class="kept">setting</span>.</p>'}}}})};
for(const [rel,content]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),content);}
const engine=new Liquid();
engine.registerFilter('t',(key,...args)=>{
  let value=JSON.parse(fs.readFileSync(path.join(root,'locales/en.default.json'),'utf8'))[key];
  for(const [name,text]of args)value=value.replace('{{ '+name+' }}',text);
  return value;
});
const upstream=http.createServer(async(req,res)=>{
  try {
    const source=fs.readFileSync(path.join(root,'sections/main.liquid'),'utf8');
    const data=JSON.parse(fs.readFileSync(path.join(root,'templates/index.json'),'utf8'));
    const html=await engine.parseAndRender(liquid.stamp(source,path.join(root,'sections/main.liquid'),root).code,{section:{id:'test__main',settings:data.sections.main.settings},template:{name:'index'},request:{locale:{iso_code:'en'}}});
    res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><style>body{font:24px sans-serif;padding:40px}</style></head><body>'+html+'</body></html>');
  }catch(err){res.statusCode=500;res.end(err.message);}
});
let server,browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await sleep(100);}throw new Error('Timed out: '+label);}
(async()=>{
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  server=startServer({appRoot:root,adapter:liquid,port:0,proxyTo:'http://127.0.0.1:'+upstream.address().port,rendering:{reloadAfterWrite:true},quiet:true});await once(server,'listening');
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1320,height:900}}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const ops=[];page.on('response',async r=>{if(r.url().endsWith('/rt/__api/op'))ops.push(await r.json());});
  const frame=page.frameLocator('#app');
  await page.goto('http://127.0.0.1:'+server.address().port+'/rt');
  for(const [selector,file,word]of [['#rich','locales/en.default.json','friend'],['#setting','templates/index.json','setting']]) {
    const target=frame.locator(selector);await target.click();
    await until(async()=>await target.getAttribute('contenteditable')==='true','inline editing '+selector);
    if(selector==='#rich')assert.equal(await target.locator('[contenteditable="false"]').textContent(),'Ada');
    await target.locator('span[style],span.kept').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
    await page.keyboard.press('Meta+b');await page.keyboard.press('Enter');
    await until(()=>fs.readFileSync(path.join(root,file),'utf8').includes('<strong>'+word+'</strong>'),'nested formatting saved');
    await until(async()=>await target.locator('strong').count()===1,'formatted renderer reload');
    if(selector==='#rich'){
      assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\{\{ name \}\}/);
      assert.equal(await target.locator('a').getAttribute('href'),'/saved');
      assert.equal(await target.locator('a').getAttribute('class'),'brand');
    }
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    await until(()=>fs.readFileSync(path.join(root,file),'utf8')===files[file],'byte-exact undo');
    await until(async()=>await target.locator('strong').count()===0,'undo renderer reload');
    console.log('PASS inline formatting, nested attributes, backing JSON and exact undo: '+selector);
  }
  assert.ok(ops.every(op=>op.ok),JSON.stringify(ops));assert.deepEqual(errors,[]);
  assert.equal(fs.readFileSync(path.join(root,'sections/main.liquid'),'utf8'),source);
  await page.screenshot({path:'/tmp/retouch-liquid-rich-text.png'});
  console.log('PASS translation placeholder remains dynamic; shared editor has no browser errors');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server){server.retouchIndex.close();server.close();}upstream.close();fs.rmSync(root,{recursive:true,force:true});
});
