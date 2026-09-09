'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-zoom-anchor-')),file=path.join(root,'index.html');
 const original='<html style="scroll-behavior:smooth"><body style="margin:0;height:3000px"><h1>Zoom anchor</h1></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.frameLocator('#app').getByRole('heading').waitFor();
  for(const screen of ['fluid','768x1024'])for(const surface of ['canvas','iframe'])for(const position of ['top','middle','bottom']){
   await page.getByLabel('Screen size',{exact:true}).selectOption(screen);
   const results=await page.evaluate(async({surface,position})=>{
    const c=document.querySelector('#frameWrap'),f=document.querySelector('#app'),w=f.contentWindow,z=document.querySelector('#canvasZoom');
    z.value='100';z.dispatchEvent(new Event('change'));c.scrollLeft=0;c.scrollTop=96;
    const max=w.document.scrollingElement.scrollHeight-w.innerHeight;w.scrollTo({top:position==='top'?0:position==='bottom'?max:max/2,behavior:'instant'});
    const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await tick();
    const px=300,py=200,output=[];
    const point=()=>{const scale=Number(z.value)/100;return {x:(c.scrollLeft+px-document.querySelector('#siteStage').offsetLeft)/scale+w.scrollX,y:(c.scrollTop+py-96)/scale+w.scrollY};};
    for(const next of [200,400,200]){
     const before=point(),scroll=w.scrollY,old=Number(z.value),bounds=c.getBoundingClientRect(),rect=f.getBoundingClientRect();
     const target=surface==='iframe'?w.document.body:c;
     const event=new WheelEvent('wheel',{ctrlKey:true,deltaY:-Math.log(next/old)/.005,bubbles:true,cancelable:true,clientX:surface==='iframe'?(bounds.left+px-rect.left)/(old/100):bounds.left+px,clientY:surface==='iframe'?(bounds.top+py-rect.top)/(old/100):bounds.top+py});
     target.dispatchEvent(event);await tick();output.push({next,before,after:point(),scrollBefore:scroll,scrollAfter:w.scrollY,prevented:event.defaultPrevented,scale:Number(z.value)});
    }
    return output;
   },{surface,position});
   for(const result of results){const context=JSON.stringify({screen,surface,position,...result});assert.ok(result.prevented,context);assert.equal(result.scale,result.next,context);assert.ok(Math.abs(result.before.x-result.after.x)<1&&Math.abs(result.before.y-result.after.y)<1,context);assert.equal(result.scrollAfter,result.scrollBefore,'zoom preserves page scroll when canvas can accommodate anchor: '+context);}
  }
  await page.getByLabel('Screen size',{exact:true}).selectOption('fluid');
  const residual=await page.evaluate(async()=>{
   const c=document.querySelector('#frameWrap'),w=document.querySelector('#app').contentWindow,z=document.querySelector('#canvasZoom');z.value='100';z.dispatchEvent(new Event('change'));c.scrollTop=96;w.scrollTo({top:500,behavior:'instant'});
   const y=()=>w.scrollY+(300+c.scrollTop-96)/(Number(z.value)/100),before=y(),bounds=c.getBoundingClientRect();
   c.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:Math.log(2)/.005,bubbles:true,cancelable:true,clientX:bounds.left+bounds.width/2,clientY:bounds.top+300}));
   const immediate=y(),scroll=w.scrollY;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {before,immediate,after:y(),scroll,pan:c.scrollTop};
  });
  assert.ok(Math.abs(residual.before-residual.immediate)<1&&Math.abs(residual.before-residual.after)<1,JSON.stringify(residual));assert.ok(residual.scroll<500,'residual page scroll compensates at the canvas limit');assert.equal(residual.pan,0);
  assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(errors,[]);console.log(engine+': PASS pointer-anchored workspace/fixed-screen zoom at page top, middle and bottom through canvas and iframe; authored smooth scrolling does not animate zoom; unchanged source');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
