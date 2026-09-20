'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium';if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{
 const page=await browser.newPage({viewport:{width:600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html><head></head><body><div id="container"><div id="target">Bound</div></div></body></html>');
 for(const file of ['html-css-values.js','prototype-binding-cascade.js','prototype-variable-watch.js'])await page.addScriptTag({path:path.resolve(__dirname,'../../shell',file)});
 await page.evaluate(()=>{
  window.info={classVariables:true,variableLinks:{},variableOverrides:{}};
  window.token=scope=>scope+'![background-color:#ffffff]';window.selector=scope=>'.'+CSS.escape(token(scope));
  for(const [n,scope]of ['','range:','portrait:','box:'].entries()){info.variableLinks[scope]={'background-color':{id:String(n),modes:{},value:'#ffffff'}};document.querySelector('#target').classList.add(token(scope));}
  window.styles=document.createElement('style');styles.textContent=selector('')+'{background-color:#fff!important}@media (600px <= width < 800px){'+selector('range:')+'{background-color:#fff!important}}@media (orientation:portrait){'+selector('portrait:')+'{background-color:#fff!important}}#container{container-type:inline-size;width:200px}@container (min-width:300px){'+selector('box:')+'{background-color:#fff!important}}';document.head.append(styles);
  window.pick=managed=>{const el=document.querySelector('#target'),before=styles.sheet.cssRules&&[...styles.sheet.cssRules].map(r=>r.cssText).join('\n'),style=el.getAttribute('style'),heads=document.head.childNodes.length,result=RetouchPrototypeBindingCascade.classLink(info,el,'background-color',managed);if(before!==[...styles.sheet.cssRules].map(r=>r.cssText).join('\n')||style!==el.getAttribute('style')||heads!==document.head.childNodes.length)throw Error('Probe left DOM or CSS changes');return result?.link.id??null;};
 });
 assert.equal(await page.evaluate(()=>pick()),'2','portrait wins equal-valued overlapping declarations');
 await page.setViewportSize({width:700,height:500});assert.equal(await page.evaluate(()=>pick()),'1','range active');
 await page.setViewportSize({width:900,height:500});assert.equal(await page.evaluate(()=>pick()),'0','range inactive');
 await page.evaluate(()=>document.querySelector('#container').style.width='400px');assert.equal(await page.evaluate(()=>pick()),'3','container scope wins');
 await page.evaluate(()=>document.querySelector('#target').style.setProperty('background-color','blue','important'));assert.equal(await page.evaluate(()=>pick()),null,'real important inline override blocks binding');
 assert.equal(await page.evaluate(()=>pick({applied:'blue',value:'',priority:''})),'3','owned temporary inline style does not mask source cascade');
 await page.evaluate(()=>document.querySelector('#target').removeAttribute('style'));
 await page.evaluate(()=>styles.sheet.insertRule('#target{background:red!important}',styles.sheet.cssRules.length));assert.equal(await page.evaluate(()=>pick()),null,'ordinary important shorthand blocks linked declaration');
 await page.evaluate(()=>styles.sheet.deleteRule(styles.sheet.cssRules.length-1));
 await page.evaluate(()=>{document.querySelector('#container').style.width='200px';styles.textContent='@layer first, second;@layer first{'+selector('')+'{background-color:white!important}}@layer second{'+selector('range:')+'{background-color:white!important}}';});
 assert.equal(await page.evaluate(()=>pick()),'0','important cascade layers use reverse precedence');
 await page.evaluate(()=>{styles.textContent=selector('')+'{background-color:white!important}'+selector('range:')+'{@media (min-width: 600px){&{background-color:white!important}}}';});assert.equal(await page.evaluate(()=>pick()),'1','nested Tailwind rule retains its class identity');
 await page.evaluate(()=>{info.variableOverrides['range:']=['background-color'];});assert.equal(await page.evaluate(()=>RetouchPrototypeBindingCascade.classLink(info,document.querySelector('#target'),'background-color').override),true);
 await page.evaluate(()=>{window.numeric=document.createElement('div');numeric.setAttribute('data-rt-style','0123456789');document.body.append(numeric);window.numericStyles=document.createElement('style');numericStyles.textContent='[data-rt-style="0123456789"],[data-rt-style="abcdef0123"]{background-color:#fff!important}@media (min-width:768px){[data-rt-style="0123456789"]{background-color:#fff!important}}';document.head.append(numericStyles);window.numericInfo={variables:true,variableLinks:{0:{'background-color':{id:'base',value:'#ffffffff',modes:{}}},768:{'background-color':{id:'wide',value:'#ffffffff',modes:{}}}},variableOverrides:{}};});
 assert.equal(await page.evaluate(()=>RetouchPrototypeBindingCascade.link(numericInfo,numeric,'background-color')?.link.id),'wide','compiled numeric media binding');
 await page.setViewportSize({width:500,height:400});assert.equal(await page.evaluate(()=>RetouchPrototypeBindingCascade.link(numericInfo,numeric,'background-color')?.link.id),'base','merged numeric selector list');
 await page.evaluate(()=>{numeric.remove();numericStyles.remove();});await page.setViewportSize({width:900,height:500});
 await page.evaluate(async()=>{window.watchChanges=0;window.stopWatch=RetouchPrototypeVariableWatch.mount(document,()=>watchChanges++,()=>false);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));watchChanges=0;for(let i=0;i<10;i++)pick();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(watchChanges)throw Error('Probe mutations retriggered the watcher: '+watchChanges);});
 await page.evaluate(async()=>{document.querySelector('#target').style.setProperty('background-color','purple','important');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));watchChanges=0;for(let i=0;i<10;i++)pick();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(watchChanges)throw Error('Inline probe mutations retriggered the watcher: '+watchChanges);stopWatch();watchChanges=0;document.querySelector('#target').removeAttribute('style');styles.textContent+='@media (prefers-color-scheme:dark){.unrelated{color:red}}';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(watchChanges)throw Error('Watcher continued after release');});
 await page.setViewportSize({width:400,height:500});await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(watchChanges)throw Error('Resize or media listener continued after release');});
 await page.route('https://styles.invalid/probe.css',route=>route.fulfill({contentType:'text/css',body:'.unrelated{color:red}'}));
 await page.addStyleTag({url:'https://styles.invalid/probe.css'});
 assert.match(await page.evaluate(()=>{const before=styles.sheet.cssRules&&[...styles.sheet.cssRules].map(r=>r.cssText).join('\n'),heads=document.head.childNodes.length;let message='';try{pick();}catch(error){message=error.message;}if(before!==[...styles.sheet.cssRules].map(r=>r.cssText).join('\n')||heads!==document.head.childNodes.length)throw Error('Failed probe did not restore styles');return message;}),/unreadable/);
 assert.deepEqual(errors,[]);console.log(engine+': prototype binding cascade ranges, orientation, container queries, layers, nesting, inline ownership and exact probe cleanup passed');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
