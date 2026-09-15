'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),C=require('../../src/effect-style-classes.cjs'),S=require('../../shell/shadow-visibility.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],{compile}=require('node:module').createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
(async()=>{
 const hidden=S.write([{x:2,y:4,blur:8,spread:0,color:'#33669980',inset:false,hidden:true}]),base=S.classes('','',hidden),scoped=S.classes(base,'md:',S.write([{x:12,y:4,blur:8,spread:0,color:'#abcdef80',inset:true,hidden:true}])),values={'box-shadow':'0px 3px 6px #12345680'},inherited=C.compose(base,values,'md:'),replaced=C.compose(scoped,values,'md:'),reset=C.compose(scoped,{},'md:',['box-shadow']);
 const compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}}),css=compiler.build([...new Set([base,scoped,inherited,replaced,reset].flatMap(value=>value.split(' ')))]),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<style>'+css+'</style><div id="actual">Shadow</div><div id="expected" style="box-shadow:0px 3px 6px #12345680">Visible</div>');
  // Mirror render-sync's owned stylesheet refresh; WebKit otherwise retains stale nested-media rules.
  const actual=page.locator('#actual'),read=()=>actual.evaluate(el=>({css:getComputedStyle(el).boxShadow,metadata:getComputedStyle(el).getPropertyValue('--rt-hidden-shadows').trim()})),set=async classes=>{await actual.evaluate((el,value)=>{el.className=value;const style=el.ownerDocument.querySelector('style');style.textContent=style.textContent;},classes);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  for(const classes of [inherited,replaced]){
   await page.setViewportSize({width:390,height:844});await set(classes);let value=await read();assert.equal(S.read(value.css,value.metadata)[0].hidden,true);
   await page.setViewportSize({width:900,height:900});value=await read();assert.equal(value.metadata,'none');assert.equal(value.css,await page.locator('#expected').evaluate(el=>getComputedStyle(el).boxShadow));assert.equal(S.read(value.css,value.metadata)[0].hidden,false);
  }
  await set(reset);await page.waitForFunction(expected=>getComputedStyle(document.getElementById('actual')).getPropertyValue('--rt-hidden-shadows').trim()===expected,hidden[S.property],{timeout:5000});let value=await read();assert.equal(S.read(value.css,value.metadata)[0].hidden,true);assert.equal(S.read(value.css,value.metadata)[0].x,2);
  console.log('PASS saved effect replacement masks hidden metadata, preserves phone visibility, and reset restores inherited hidden shadow',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
