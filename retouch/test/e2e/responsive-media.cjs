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
 @media (aspect-ratio:16/9){.cinema\\:opacity{opacity:.6}}
 @media (orientation:portrait){.portrait\\:opacity{opacity:.7}}
 @media (min-height:900px){.tall\\:opacity{opacity:.8}}
 </style><div class="tablet:opacity">Tablet</div><div class="edge:opacity">Edge</div><div class="nested:opacity">Nested</div><div class="cinema:opacity">Cinema</div><div class="portrait:opacity">Portrait</div><div class="tall:opacity">Tall</div>`);
 await page.addScriptTag({path:path.resolve(__dirname,'../../shell/responsive.js')});
 for(const [width,height] of [[390,844],[768,900],[768,1024],[1440,900],[1440,500]]){
  await page.setViewportSize({width,height});const state=await page.evaluate(()=>{const choices=RetouchResponsive.discover(document);return {choices,items:[...document.querySelectorAll('div')].map(el=>{const prefix=el.className.split(':')[0]+':',choice=choices.find(c=>c.prefix===prefix);return{prefix,applies:RetouchResponsive.matches(choice,window),opacity:getComputedStyle(el).opacity}}),atWidth:RetouchResponsive.atWidth(document,innerWidth,choices).prefix};});
  assert.equal(state.choices.length,6);for(const item of state.items)assert.equal(item.applies,item.opacity!=='1',JSON.stringify({width,height,item}));assert.ok(state.atWidth.startsWith('min-['));assert.equal(state.atWidth,`min-[${width/16}rem]:`);
 }
 const previews=await page.evaluate(()=>{
  const choices=RetouchResponsive.discover(document),before=document.querySelectorAll('iframe').length;
  const cases=[
   {choice:choices.find(c=>c.prefix==='tablet:'),current:{width:390,height:844},expected:{width:768,height:960}},
   {choice:{condition:'(600px < width < 800px) and (orientation: landscape)'},current:{width:390,height:844}},
   {choice:{condition:'(max-width: 399.5px)'},current:{width:768,height:844},expected:{width:399,height:844}},
   {choice:choices.find(c=>c.prefix==='cinema:'),current:{width:390,height:844},expected:{width:432,height:243}},
   {choice:{condition:'(aspect-ratio: 0.75)'},current:{width:390,height:844},expected:{width:633,height:844}},
   {choice:{condition:'(4/3 < aspect-ratio < 16/9) and (min-width: 700px) and (min-height: 500px)'},current:{width:390,height:844}},
   {choice:{condition:'(aspect-ratio: 3/4) and (600px <= width <= 620px)'},current:{width:390,height:844},expected:{width:618,height:824}},
   ...['8in','576pt','48pc','20.32cm','203.2mm','812.8q','8IN'].map(length=>({choice:{condition:`(min-width:${length})`},current:{width:390,height:844},expected:{width:768,height:844}})),
   {choice:{condition:'(max-height:450pt)'},current:{width:390,height:844},expected:{width:390,height:600}},
   {choice:{condition:'print and (min-width: 600px)'},current:{width:390,height:844},expected:null},
   {choice:{condition:'(min-width: 9000px)'},current:{width:390,height:844},expected:null}
  ];
  return {before,after:(()=>{for(const item of cases)item.actual=RetouchResponsive.previewSize(item.choice,document,item.current);return document.querySelectorAll('iframe').length;})(),cases};
 });
 assert.equal(previews.before,previews.after);
 for(const item of previews.cases){if(Object.hasOwn(item,'expected'))assert.deepEqual(item.actual,item.expected);if(!Object.hasOwn(item,'expected')||item.expected!==null)assert.ok(item.actual,JSON.stringify(item));if(item.actual){await page.setViewportSize(item.actual);assert.equal(await page.evaluate(choice=>RetouchResponsive.matches(choice,window),item.choice),true);}}
 const boundaries=await page.evaluate(()=>{
  const choices=RetouchResponsive.discover(document),current={width:390,height:844};
  return choices.map(choice=>{const match=RetouchResponsive.previewSize(choice,document,current),outside=match&&RetouchResponsive.previewSize(choice,document,match,false),inside=outside&&RetouchResponsive.previewSize(choice,document,outside);return {choice,outside,inside};});
 });
 for(const {choice,outside,inside}of boundaries){
  assert.ok(outside&&inside,JSON.stringify({choice,outside,inside}));
  for(const [size,expected]of [[outside,false],[inside,true]]){
   await page.setViewportSize(size);const actual=await page.evaluate(choice=>{const el=[...document.querySelectorAll('div')].find(el=>el.className.startsWith(choice.prefix));return {matches:RetouchResponsive.matches(choice,window),styled:getComputedStyle(el).opacity!=='1'};},choice);assert.deepEqual(actual,{matches:expected,styled:expected},JSON.stringify({choice,size}));
  }
 }
 assert.equal(await page.evaluate(()=>RetouchResponsive.previewSize({condition:'(min-width:240px)'},document,{width:390,height:844},false)),null);
 assert.equal(await page.locator('iframe').count(),0);console.log('COMPOUND BREAKPOINT BOUNDARY/CSS/UNIVERSAL SCOPE/PROBE CLEANUP PASS',engine);
 await page.addStyleTag({content:'@media(min-width:8in){.physical\\:opacity{opacity:.4}}'});await page.evaluate(()=>{const el=document.createElement('div');el.className='physical:opacity';el.textContent='Physical';document.body.append(el);});await page.setViewportSize({width:768,height:844});assert.deepEqual(await page.evaluate(()=>({scope:RetouchResponsive.atWidth(document,innerWidth).prefix,opacity:getComputedStyle(document.querySelector('.physical\\:opacity')).opacity})),{scope:'physical:',opacity:'0.4'});
 console.log(engine+': PASS nested and repeated media alternatives, query lists, CSS nesting, runtime CSS agreement, initial rem units and conditional-breakpoint non-reuse');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
