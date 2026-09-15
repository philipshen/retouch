'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),F=require('../../shell/filter-visibility.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],{compile}=require('node:module').createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
(async()=>{
 const model=[{raw:'blur(12px)',hidden:true},{raw:'brightness(60%)',hidden:false},{raw:'drop-shadow(2px 4px 8px currentColor)',hidden:true}],cases=[];
 for(const property of Object.keys(F.properties))for(const stack of [model,model.map(item=>({...item,hidden:true})),model.map(item=>({...item,hidden:false}))])cases.push({property,stack,values:F.write(property,stack),classes:F.classes('p-4','md:',property,F.write(property,stack))});
 const compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}}),css=compiler.build([...new Set(cases.flatMap(item=>item.classes.split(' ')))]),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:900,height:900}});await page.setContent('<style>'+css+'</style><div id="actual">Effects</div><div id="expected">Reference</div>');
  for(const item of cases){await page.evaluate(({classes,property,value})=>{const el=document.getElementById('actual'),expected=document.getElementById('expected');el.className=classes;expected.removeAttribute('style');expected.style.setProperty(property,value);const style=document.querySelector('style');style.textContent=style.textContent;},{classes:item.classes,property:item.property,value:item.values[item.property]});
   const result=await page.evaluate(({property,key})=>{const css=getComputedStyle(document.getElementById('actual'));return {rendered:css.getPropertyValue(property),metadata:css.getPropertyValue(key).trim(),expected:getComputedStyle(document.getElementById('expected')).getPropertyValue(property)};},{property:item.property,key:F.properties[item.property]});assert.equal(result.rendered,result.expected);
   if(item.stack.some(effect=>effect.hidden))assert.deepEqual(F.read(result.rendered,result.metadata),item.stack);else assert.equal(result.metadata,'none');if(item.stack.every(effect=>effect.hidden))assert.equal(result.rendered,'none');
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#actual').evaluate((el,property)=>getComputedStyle(el).getPropertyValue(property),item.property),'none');await page.setViewportSize({width:900,height:900});
  }
  console.log('PASS rendered filter/backdrop hidden values, all-hidden none, restored filter order and tablet-only scope',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
