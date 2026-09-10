'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),V=require('../../shell/html-css-values.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const browser=await browserType.launch();try{
  const page=await browser.newPage({viewport:{width:400,height:400},deviceScaleFactor:1});await page.setContent('<div id="paint" style="width:300px;height:240px"></div>');const paint=page.locator('#paint');
  for(const value of [
   'linear-gradient(90deg, red, green, blue)',
   'linear-gradient(45deg, red 10%, orange, yellow, green 70%, blue)',
   'radial-gradient(ellipse at 25% 60%, red 0% 25%, blue 25% 100%)',
   'conic-gradient(from 90deg at 25% 60%, red 0deg 90deg, blue, green .5turn, black)',
   'linear-gradient(red 80%, green, blue 20%, black)',
   'linear-gradient(red, green 70% 30%, blue)',
   'linear-gradient(rgba(255,0,0,.5), transparent, blue), radial-gradient(red 0% 30%, green 30% 100%)'
  ]){
   await paint.evaluate((el,value)=>el.style.backgroundImage=value,value);const original=await paint.screenshot();
   const normalized=V.serializeGradients(V.parseGradients(value));await paint.evaluate((el,value)=>el.style.backgroundImage=value,normalized);
   assert.deepEqual(await paint.screenshot(),original,'same rendered pixels: '+value);
  }
  console.log('GRADIENT NORMALIZATION PIXEL PASS',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
