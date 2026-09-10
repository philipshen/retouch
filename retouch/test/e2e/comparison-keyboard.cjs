'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-comparison-keyboard-')),file=path.join(root,'index.html');
 const source=(process.env.RT_E2E_STANDARDS?'<!doctype html>':'')+'<html><head><style>body{margin:0}main{width:1800px;height:4200px;background:linear-gradient(white,lightblue)}</style></head><body><main><h1>Keyboard preview</h1></main></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.locator('h1').waitFor();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'h1 · Keyboard preview',exact:true}).click();await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();const preview=page.frameLocator('iframe[title="Phone comparison preview"]'),viewport=page.getByRole('button',{name:'Edit from Phone comparison',exact:true});await preview.locator('h1').waitFor();await viewport.focus();
  const position=()=>preview.locator('body').evaluate(()=>[scrollX,scrollY]);
  const wheel=()=>viewport.evaluate(el=>{const box=el.getBoundingClientRect();el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:box.left+20,clientY:box.top+20,deltaX:40,deltaY:100}));});
  const key=async value=>{await viewport.press(value);await preview.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  await key('ArrowDown');assert.deepEqual(await position(),[0,40],'Arrow Down scrolls the comparison');
  await key('ArrowRight');assert.deepEqual(await position(),[40,40]);await key('ArrowUp');await key('ArrowLeft');assert.deepEqual(await position(),[0,0]);
  await key('PageDown');const paged=(await position())[1];assert.ok(paged>=750&&paged<=844);await key('PageUp');assert.deepEqual(await position(),[0,0]);
  await key('End');assert.ok((await position())[1]>3000);await key('Home');assert.deepEqual(await position(),[0,0]);
  assert.equal(await viewport.evaluate(el=>el===document.activeElement),true);assert.deepEqual(await app.locator('body').evaluate(()=>[innerWidth,innerHeight,scrollX,scrollY]),[768,1024,0,0]);assert.equal(await page.getByLabel('Style screen scope').inputValue(),'min-[768px]:');
  const ignored=await viewport.evaluate(el=>['altKey','ctrlKey','metaKey','shiftKey','isComposing'].map(modifier=>{const event=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true,[modifier]:true});el.dispatchEvent(event);return event.defaultPrevented;}));assert.deepEqual(ignored,[false,false,false,false,false]);assert.deepEqual(await position(),[0,0]);
  await preview.locator('html').evaluate(el=>el.style.overflow='hidden');await key('PageDown');await key('ArrowRight');await wheel();assert.deepEqual(await position(),[0,0]);await preview.locator('html').evaluate(el=>el.style.removeProperty('overflow'));
  await preview.locator('body').evaluate(el=>el.style.overflow='hidden');await key('End');await key('ArrowRight');await wheel();assert.deepEqual(await position(),[0,0]);await preview.locator('body').evaluate(el=>el.style.removeProperty('overflow'));
  await wheel();const wheeled=await position();assert.ok(wheeled[0]>0&&wheeled[1]>0);
  await preview.locator('body').evaluate(()=>{
   scrollTo(0,0);const outer=document.createElement('section');outer.id='keyboardOuter';outer.style.cssText='position:fixed;left:20px;top:100px;width:340px;height:650px;overflow:auto;background:white';
   outer.innerHTML='<div style="height:1600px"><div id="keyboardPanel" style="margin-top:40px;width:300px;height:440px;overflow:auto"><div style="width:1000px;height:1800px">Nested panel</div></div></div>';document.body.append(outer);
  });
  const nested=()=>preview.locator('body').evaluate(()=>({panel:[document.getElementById('keyboardPanel').scrollLeft,document.getElementById('keyboardPanel').scrollTop],outer:document.getElementById('keyboardOuter').scrollTop,page:[scrollX,scrollY]}));
  await key('ArrowDown');assert.deepEqual(await nested(),{panel:[0,40],outer:0,page:[0,0]},'Keyboard scroll targets the nested panel at the preview center');
  await key('ArrowRight');assert.equal((await nested()).panel[0],40);await key('ArrowLeft');await key('Home');assert.equal((await nested()).panel[1],0);
  await key('PageDown');assert.equal((await nested()).panel[1],396);await key('PageUp');assert.equal((await nested()).panel[1],0);
  await key('End');assert.equal((await nested()).panel[1],1360);await key('ArrowDown');assert.equal((await nested()).outer,40);assert.deepEqual((await nested()).page,[0,0]);
  await preview.locator('#keyboardPanel').evaluate(el=>el.style.overscrollBehavior='contain');await key('ArrowDown');assert.equal((await nested()).outer,40,'Contained panel does not scroll its parent');
  await key('Home');assert.equal((await nested()).panel[1],0);await preview.locator('html').evaluate(el=>el.style.overflow='hidden');await key('ArrowDown');assert.equal((await nested()).panel[1],40,'Viewport overflow does not disable nested scrolling');
  await preview.locator('body').evaluate(()=>{document.documentElement.style.removeProperty('overflow');document.getElementById('keyboardOuter').remove();});
  await key('Enter');await page.waitForFunction(()=>doc().defaultView.innerWidth===390&&doc().defaultView.innerHeight===844);assert.equal(await page.getByLabel('Style screen scope').inputValue(),'min-[768px]:');assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);
  console.log('COMPARISON KEYBOARD SCROLL/FOCUS/MODIFIER/OVERFLOW/SCOPE/SOURCE PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
