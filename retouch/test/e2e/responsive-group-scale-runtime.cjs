'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
const scripts=['shell/translate-values.js','shell/flip.js','shell/group-move.js','runtime/group-scale.js'].map(file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8'));
(async()=>{
 const browser=await browserType.launch();try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent(`<style>main{display:flex;flex-direction:column;gap:16px}h1{font:700 32px Georgia}p{font:16px Arial}@media(min-width:700px){main{flex-direction:row;gap:24px}}@media(min-width:1000px){main{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}}[data-rt-group]{display:contents}</style><main><div data-rt-group><h1 data-rt="heading">Headline</h1><p data-rt="text">Other text</p></div><p data-rt="outside">Named text</p></main>`);
  for(const content of scripts)await page.addScriptTag({content});
  const measure=()=>page.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
  const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(20);}throw Error('Responsive scale did not settle');};
  const sizes=[390,768,1100,1440,523],baseline=[];
  for(const width of sizes){await page.setViewportSize({width,height:900});baseline.push(await measure());}
  await page.evaluate(()=>{window.scaleErrors=[];window.scaleReads=0;window.scaleFactor=1.5;window.controller=RetouchResponsiveGroupScale.mount({roots:()=>[document.querySelector('[data-rt-group]')],factor:()=>{scaleReads++;return window.scaleFactor;},onError:error=>scaleErrors.push(error.message)});});
  const expect=async(before,factor)=>{const left=Math.min(...before.slice(0,2).map(r=>r[0])),top=Math.min(...before.slice(0,2).map(r=>r[1])),expected=before.map((r,i)=>i===2?r:[left+(r[0]-left)*factor,top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]);await wait(async()=>(await measure()).every((r,i)=>r.every((n,j)=>Math.abs(n-expected[i][j])<.1)));};
  for(const factor of [1.5,.5,2,1])for(let i=0;i<sizes.length;i++){await page.evaluate(value=>{scaleFactor=value;controller.refresh();},factor);await page.setViewportSize({width:sizes[i],height:900});await expect(baseline[i],factor);}
  // A content change can move a sibling without changing the viewport.
  await page.evaluate(()=>{scaleFactor=1;controller.refresh();window.longHeading='A long heading that wraps across several lines in a narrow layout';document.querySelector('h1').textContent=longHeading;});const changed=await measure();
  await page.evaluate(()=>{document.querySelector('h1').textContent='Headline';scaleFactor=1.5;controller.refresh();});await expect(baseline.at(-1),1.5);
  await page.evaluate(()=>{document.querySelector('h1').textContent=longHeading;});await expect(changed,1.5);
  const reads=await page.evaluate(()=>scaleReads);await page.evaluate(()=>new Promise(resolve=>{let frames=0;function next(){if(++frames===8)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}));assert.ok(await page.evaluate(()=>scaleReads)<=reads+2,'The controller must not observe its own writes in a loop');
  // Responsive scope activates and restores baseline without replacing nodes.
  await page.evaluate(()=>{controller.dispose();window.heading=document.querySelector('h1');window.scoped=RetouchResponsiveGroupScale.mount({roots:()=>[document.querySelector('[data-rt-group]')],factor:()=>1.5,media:'(min-width: 1000px)',onError:error=>scaleErrors.push(error.message)});});
  await expect(changed,1);await page.setViewportSize({width:1100,height:900});
  await page.evaluate(()=>scoped.dispose());const desktop=await measure();await page.evaluate(()=>{scoped=RetouchResponsiveGroupScale.mount({roots:()=>[document.querySelector('[data-rt-group]')],factor:()=>1.5,media:'(min-width: 1000px)',onError:error=>scaleErrors.push(error.message)});});await expect(desktop,1.5);
  await page.setViewportSize({width:523,height:900});await expect(changed,1);
  await page.evaluate(()=>scoped.dispose());assert.ok(await page.evaluate(()=>heading===document.querySelector('h1')));assert.deepEqual(await page.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),[null,null,null]);assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  await page.setViewportSize({width:1100,height:900});await page.evaluate(()=>{controller=RetouchResponsiveGroupScale.mount({roots:()=>[document.querySelector('[data-rt-group]')],factor:()=>1.5,onError:error=>scaleErrors.push(error.message)});});await expect(desktop,1.5);
  await page.evaluate(()=>{document.querySelector('h1').style.translate='7px 9px';document.querySelector('h1').style.color='rgb(1, 2, 3)';});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  await page.evaluate(()=>controller.dispose());assert.deepEqual(await page.locator('h1').evaluate(el=>({translate:el.style.translate,color:el.style.color,scale:el.style.scale})),{translate:'7px 9px',color:'rgb(1, 2, 3)',scale:''});assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);assert.deepEqual(errors,[]);
  console.log('RESPONSIVE GROUP SCALE RUNTIME PASS',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
