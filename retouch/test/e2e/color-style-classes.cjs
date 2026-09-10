'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{compose}=require('../../src/color-style-classes.cjs');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],{compile}=require('node:module').createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
(async()=>{
 const original='text-lg/7 border-2 border-solid border-blue-500 bg-red-500 text-blue-500 bg-cover',values={'color':'#12345678','background-color':'#abcdef80','border-color':'#ff0000aa'};let className=original;for(const [property,value]of Object.entries(values))className=compose(className,property,value,'min-[768px]:');
 const compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}}),css=compiler.build(className.split(' ')),browser=await browserType.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setContent('<style>'+css+'</style><p id="actual">Paint</p><p id="expected">Paint</p>');
  await page.evaluate(({original,className,values})=>{document.getElementById('actual').className=className;const expected=document.getElementById('expected');expected.className=original;for(const [property,value]of Object.entries(values))expected.style.setProperty(property,value,'important');},{original,className,values});
  const read=id=>page.locator('#'+id).evaluate(el=>{const style=getComputedStyle(el);return Object.fromEntries(['color','background-color','border-top-color','font-size','line-height','border-top-width','background-size'].map(key=>[key,style.getPropertyValue(key)]));});
  const mobile=await read('actual');await page.setViewportSize({width:900,height:900});const desktop=await read('actual');assert.deepEqual(desktop,await read('expected'));for(const property of ['font-size','line-height','border-top-width','background-size'])assert.equal(desktop[property],mobile[property]);assert.notEqual(desktop.color,mobile.color);await page.setViewportSize({width:390,height:844});assert.deepEqual(await read('actual'),mobile);assert.deepEqual(errors,[]);console.log('COLOR STYLE CLASS RENDER PASS',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
