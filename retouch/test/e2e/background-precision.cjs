'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch(),page=await browser.newPage({viewport:{width:800,height:600}});try{
 await page.setContent('<div id="paint"></div>');for(const file of ['palette-values.js','html-css-values.js','inspector.js','responsive.js','background-paint.js','background-paint-ui.js'])await page.addScriptTag({path:path.join(__dirname,'../../shell',file)});
 const result=await page.evaluate(()=>{
  const el=document.querySelector('#paint'),style=document.createElement('style');document.head.append(style);const read=()=>RetouchBackgroundPaintUI.read({},el),checks=[];
  for(const color of ['#33669980','color(srgb 0.1234567 0.4 0.6 / 0.1234567)','color(display-p3 0.1234567 0.4 0.6 / 0.1234567)']){
   const token='![background-color:'+color.replace(/ /g,'_')+']';el.className=token;style.textContent='.'+CSS.escape(token)+'{background-color:'+color+'!important}';
   const before=document.documentElement.outerHTML,state=read();checks.push({color,actual:state.color,unchanged:before===document.documentElement.outerHTML});
  }
  const base='![background-color:#33669980]',inactive='wide:![background-color:#3366997f]';el.className=base+' '+inactive;style.textContent='.'+CSS.escape(base)+'{background-color:#33669980!important}@media(min-width:1200px){.'+CSS.escape(inactive)+'{background-color:#3366997f!important}}';const below=read().color;
  el.style.setProperty('background-color','#ff0000','important');const external=read().color;el.removeAttribute('style');
  const ambiguous='![background-color:rgb(51_102_153_/_0.5)]';el.className=base+' '+ambiguous;style.textContent+='.'+CSS.escape(ambiguous)+'{background-color:rgb(51 102 153 / .5)!important}';const fallback=read().color,computed=RetouchBackgroundPaint.state(getComputedStyle(el).backgroundColor).color;
  el.className='';style.textContent='';el.setAttribute('data-rt-style','1234567890');style.dataset.rtCss='1234567890';style.dataset.rtWidth='0';style.dataset.rtValues=JSON.stringify({'background-color':'#33669980'});style.textContent='[data-rt-style="1234567890"]{background-color:#33669980!important}';const html=read().color;
  return {checks,below,external,fallback,computed,html};
 });
 for(const check of result.checks){assert.equal(check.actual,check.color);assert.equal(check.unchanged,true);}assert.equal(result.below,'#33669980');assert.equal(result.external,'#ff0000ff');assert.equal(result.fallback,result.computed);assert.equal(result.html,'#33669980');
 console.log(engine+': PASS exact authored alpha/channels, inactive scopes, external override, ambiguous fallback and unchanged DOM');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
