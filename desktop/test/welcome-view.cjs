const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../Sources/Retouch.swift'),'utf8');
 const match=/web\.loadHTMLString\("""([\s\S]*?)""", baseURL: nil\)/.exec(source);assert.ok(match);
 const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();
 try{
  const page=await browser.newPage({colorScheme:'dark'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const viewport of [{width:1440,height:900},{width:800,height:500}]){
   await page.setViewportSize(viewport);await page.setContent(match[1]);
   assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(245, 245, 245)');
   assert.equal(await page.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
   for(const name of ['Open your design canvas','Open a project','Connect to an editor'])assert.equal(await page.getByRole('heading',{name,exact:true}).isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'Welcome fits the available web view');
  }
  if(process.env.RT_E2E_WELCOME_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_WELCOME_SCREENSHOT});
  assert.deepEqual(errors,[]);console.log('WELCOME HTML LIGHT THEME/OPEN PATHS/BOUNDS PASS',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
