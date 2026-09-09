"use strict";
const assert=require('node:assert/strict'),path=require('node:path');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{const browser=await browserType.launch(),page=await browser.newPage();try{
 await page.setContent(`<style>
 html{font-size:32px}div{opacity:1}
 @media (min-width:48rem){@media (min-height:60rem){.tablet\\:opacity{opacity:.5}}}
 @media (min-width:90rem){.tablet\\:opacity{opacity:.5}}
 @media (max-width:400px), (min-width:1200px){@media (min-height:600px){.edge\\:opacity{opacity:.25}}}
 .nested\\:opacity{@media (min-width:700px){@media (max-height:950px){opacity:.75}}}
 </style><div class="tablet:opacity">Tablet</div><div class="edge:opacity">Edge</div><div class="nested:opacity">Nested</div>`);
 await page.addScriptTag({path:path.resolve(__dirname,'../../shell/responsive.js')});
 for(const [width,height] of [[390,844],[768,900],[768,1024],[1440,900],[1440,500]]){
  await page.setViewportSize({width,height});const state=await page.evaluate(()=>{const choices=RetouchResponsive.discover(document);return {choices,items:[...document.querySelectorAll('div')].map(el=>{const prefix=el.className.split(':')[0]+':',choice=choices.find(c=>c.prefix===prefix);return{prefix,applies:RetouchResponsive.matches(choice,window),opacity:getComputedStyle(el).opacity}}),atWidth:RetouchResponsive.atWidth(document,innerWidth,choices).prefix};});
  assert.equal(state.choices.length,3);for(const item of state.items)assert.equal(item.applies,item.opacity!=='1',JSON.stringify({width,height,item}));assert.ok(state.atWidth.startsWith('min-['));assert.equal(state.atWidth,`min-[${width/16}rem]:`);
 }
 console.log(engine+': PASS nested and repeated media alternatives, query lists, CSS nesting, runtime CSS agreement, initial rem units and conditional-breakpoint non-reuse');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
