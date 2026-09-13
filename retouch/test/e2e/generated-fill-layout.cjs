'use strict';
// Exercise actual sizing classes through Tailwind and a browser, including
// logical axes. Keep the raw engine probe separate for diagnosing failures.
const path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const layout=require('../../shell/layout.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const cases=[];
 for(const writingMode of ['horizontal-tb','vertical-rl','vertical-lr','sideways-rl','sideways-lr'])
 for(const textDirection of ['ltr','rtl'])
 for(const [display,direction]of [['flow-root','row'],['grid','row'],...['row','row-reverse','column','column-reverse'].map(value=>['flex',value])])
 for(const boxSizing of ['content-box','border-box'])
 for(const axis of ['width','height'])
 for(const size of [180,260])
 for(const margin of ['5px','5%','-5px']){
  const classes=layout.sizeClasses('w-[60px] h-[60px]',axis,'fill',0,{display,direction,writingMode});
  cases.push({writingMode,textDirection,display,direction,boxSizing,axis,size,margin,classes});
 }
 const {compile}=createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
 const compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}});
 const css=compiler.build([...new Set(cases.flatMap(item=>item.classes.split(/\s+/)))]);
 const browser=await require(process.env.RT_E2E_PLAYWRIGHT_ROOT||path.join(fixture,'node_modules/playwright'))[engine].launch();
 try{
  const page=await browser.newPage();await page.setContent('<div id="parent"><div id="child">Text</div></div>');await page.addStyleTag({content:css});
  const results=await page.evaluate(cases=>{
   const parent=document.querySelector('#parent'),child=document.querySelector('#child');
   return cases.map(item=>{
    const {writingMode,textDirection,display,direction,boxSizing,axis,size,margin,classes}=item;
    parent.style.cssText=`display:${display};flex-direction:${direction};writing-mode:${writingMode};direction:${textDirection};width:${size}px;height:${size}px;padding:11px;border:3px solid;box-sizing:content-box`;
    child.className=classes;child.style.cssText=`box-sizing:${boxSizing};min-width:0;min-height:0;margin:${margin};padding:10px;border:2px solid`;
    const style=getComputedStyle(child),rect=child.getBoundingClientRect(),other=axis==='width'?'height':'width';
    const margins=axis==='width'?parseFloat(style.marginLeft)+parseFloat(style.marginRight):parseFloat(style.marginTop)+parseFloat(style.marginBottom);
    return {...item,expected:size-margins,actual:rect[axis],otherExpected:boxSizing==='content-box'?84:60,otherActual:rect[other]};
   });
  },cases);
  const failures=results.filter(item=>Math.abs(item.expected-item.actual)>.1||Math.abs(item.otherExpected-item.otherActual)>.1);
  console.log(JSON.stringify({engine,version:browser.version(),total:results.length,passed:results.length-failures.length,failures},null,2));
  assert.equal(failures.length,0,'Generated Fill must fit available space and preserve the other dimension across logical axes and container sizes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
