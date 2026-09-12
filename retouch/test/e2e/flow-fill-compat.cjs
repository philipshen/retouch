'use strict';
// Isolate engine sizing behavior without compiling a site or weakening the editor regression.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const browser=await require(process.env.RT_E2E_PLAYWRIGHT_ROOT||path.join(fixture,'node_modules/playwright'))[engine].launch();
 try{
  const page=await browser.newPage(),results=[];
  await page.setContent(fs.readFileSync(path.join(__dirname,'../fixtures/flow-fill/index.html'),'utf8'));
  const support=await page.evaluate(()=>({stretch:CSS.supports('height','stretch'),legacy:CSS.supports('height','-webkit-fill-available'),calcSize:CSS.supports('height','calc-size(stretch,size)')}));
  for(const state of [{width:220,height:180,margin:'5px'},{width:320,height:280,margin:'7px'},{width:320,height:280,margin:'5%'}]){
   results.push(...await page.evaluate(state=>[...document.querySelectorAll('[data-box]')].map(section=>{
    const parent=section.querySelector('.parent'),child=section.querySelector('.child');parent.style.width=state.width+'px';parent.style.height=state.height+'px';child.style.setProperty('--margin',state.margin);
    const r=child.getBoundingClientRect(),s=getComputedStyle(child),expected={width:parent.clientWidth-parseFloat(s.marginLeft)-parseFloat(s.marginRight),height:parent.clientHeight-parseFloat(s.marginTop)-parseFloat(s.marginBottom)},actual={width:r.width,height:r.height};
    return {boxSizing:section.dataset.box,...state,expected,actual,passed:['width','height'].every(axis=>Math.abs(expected[axis]-actual[axis])<1/32)};
   }),state));
  }
  const report={engine,version:browser.version(),support,results};console.log(JSON.stringify(report,null,2));
  assert.ok(results.every(result=>result.passed),'Flow Fill must fit the margin box at each container size and margin value.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
