'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',requireFixture=require('node:module').createRequire(path.join(fixture,'package.json'));
(async()=>{
 const {compile}=requireFixture('@tailwindcss/node'),compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}}),classes=require('../../src/variable-classes.cjs');
 let name='';for(const [property,value]of [['padding','24px'],['color','#123456ff'],['visibility','hidden'],['font-family','"Font_Name", serif']])name=classes.compose(name,property,value,'md:');
 const css=compiler.build(name.split(' ')),browser=await requireFixture('playwright')[engine].launch();
 try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<style>'+css+'</style><h1>Variable classes</h1>');await page.locator('h1').evaluate((el,name)=>el.className=name,name);const style=()=>page.locator('h1').evaluate(el=>{const css=getComputedStyle(el);return {padding:css.padding,color:css.color,visibility:css.visibility,font:css.fontFamily};});assert.equal((await style()).padding,'0px');assert.equal((await style()).visibility,'visible');await page.setViewportSize({width:768,height:1024});const result=await style();assert.equal(result.padding,'24px');assert.equal(result.color,'rgb(18, 52, 86)');assert.equal(result.visibility,'hidden');assert.match(result.font,/Font_Name/);assert.ok(!result.font.includes('Font Name'));console.log('VARIABLE CLASS COMPILATION PASS',engine);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
