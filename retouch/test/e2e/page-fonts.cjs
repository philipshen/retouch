'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events');
const variableFont=process.env.RT_E2E_VARIABLE_FONT||process.env.RT_E2E_OPTICAL_FONT;
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const kind=process.env.RT_E2E_RENDERER||'html',engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-page-fonts-')),file=path.join(root,kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html'),css=(variableFont?'@font-face{font-family:"Variable Test";font-weight:100 900;src:url(data:font/'+(process.env.RT_E2E_OPTICAL_FONT?'ttf':'woff2')+';base64,'+fs.readFileSync(process.env.RT_E2E_OPTICAL_FONT?path.resolve(__dirname,'../fixtures/fonts/RobotoFlex.ttf'):path.join(fixture,'node_modules/next/dist/next-devtools/server/font/geist-latin.woff2')).toString('base64')+')}':'')+'@font-face{font-family:"Page Face";src:local("Arial")} .type-editorial{font-family:'+ (variableFont?'"Variable Test"':'Georgia') +',serif;font-size:32px;font-weight:700}.other-font{font-family:"Studio_Test",serif}.named-font{font-family:"Page Face",serif}';fs.mkdirSync(path.dirname(file),{recursive:true});const body='<main><h1 '+(kind==='react'?'className':'class')+'="type-editorial font-bold md:opacity-90 [&:hover]:opacity-50">Headline</h1><p '+(kind==='react'?'className':'class')+'="other-font">Other text</p><p '+(kind==='react'?'className':'class')+'="named-font">Named text</p></main>',original=kind==='react'?'export default function Page(){return '+body+'}':'<html><head><style>'+css+'</style></head><body>'+(kind==='liquid'&&process.env.RT_E2E_LIQUID_DYNAMIC?body.replace('type-editorial font-bold','type-editorial font-bold {% if alternate %}font-mono{% else %}font-serif{% endif %}'):body)+'</body></html>';fs.writeFileSync(file,original);
 let server,child,stopped,browser,url,logs='';const read=()=>fs.readFileSync(file,'utf8'),wait=async fn=>{for(let i=0;i<400;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed|fetch failed/.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out '+logs.slice(-1000));};
 try{
  if(kind==='react'){fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');fs.copyFileSync(path.join(fixture,'postcss.config.mjs'),path.join(root,'postcss.config.mjs'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0'}}));fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";\n'+css);fs.writeFileSync(path.join(root,'app/layout.jsx'),'import "./style.css";export default function Layout({children}){return <html><body>{children}</body></html>}');child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});stopped=new Promise(r=>child.once('exit',r));for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data;url=logs.match(/http:\/\/localhost:\d+/)?.[0];});await wait(()=>url);await wait(async()=>{try{return(await fetch(url+'/rt/__api/health')).ok;}catch{return false;}});
  }else if(kind==='liquid'){
   const liquid=require('../../src/adapters/liquid.cjs'),engine=new(require('liquidjs').Liquid)(),{Scanner}=require(path.join(fixture,'node_modules/@tailwindcss/oxide')),{compile}=require('node:module').createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
   const compiler=await compile('@import "tailwindcss";\n'+css,{base:fixture,onDependency(){}});
   server=require('../../src/server.cjs').startServer({appRoot:root,adapter:liquid,port:0,quiet:true,rendering:{reloadAfterWrite:true},serveSite:async(req,res)=>{try{const source=read(),candidates=new Scanner({}).scanFiles([{content:source,extension:'liquid'}]),styles=compiler.build(candidates),html=await engine.parseAndRender(liquid.stamp(source,file,root).code,{alternate:req.url.includes('alternate=1')});res.setHeader('content-type','text/html');res.end(html.replace('</head>','<style>'+styles+'</style></head>'));}catch(e){res.statusCode=500;res.end(e.stack);}}});await once(server,'listening');url='http://localhost:'+server.address().port;
  }else{server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');url='http://localhost:'+server.address().port;}
  browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],snapshots=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/rt',{timeout:90000});const app=page.frameLocator('#app');await app.locator('h1').waitFor({timeout:90000});await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true'),family=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily);await settled();
  const options=await page.getByLabel('Page font',{exact:true}).locator('option').evaluateAll(els=>els.map(el=>el.value)),custom=options.find(v=>v.includes('Studio_Test'));assert.ok(custom);assert.ok(options.some(v=>v.includes('Page Face')));assert.equal(read(),original);
  await page.getByText('Browse page fonts',{exact:true}).click();const search=page.getByRole('searchbox',{name:'Search page fonts'});await search.fill('NoSuchFamilyZZZ');await wait(async()=>await page.locator('.font-browser [role=status]').getAttribute('data-scanning')==='false');assert.equal(await page.getByRole('group',{name:'Matching fonts'}).getByRole('button').count(),0);assert.ok((await page.getByRole('status').allTextContents()).some(t=>t.includes('No matching fonts')));assert.equal(read(),original);assert.equal(await page.getByLabel('Page font',{exact:true}).inputValue(),await family());await search.press('Escape');assert.equal(await page.locator('.font-browser').getAttribute('open'),null);assert.equal(await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).getAttribute('aria-selected'),'true');
  const choose=async(value,browse=false)=>{snapshots.push(read());if(browse){await page.getByText('Browse page fonts',{exact:true}).click();await search.fill('sTuDiO_test');assert.equal(read(),snapshots.at(-1));const matching=page.getByRole('group',{name:'Matching fonts'}).getByRole('button');assert.equal(await matching.count(),1);if(process.env.RT_E2E_FONT_SEARCH_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_FONT_SEARCH_SCREENSHOT});await search.press('Tab');assert.equal(await matching.evaluate(el=>el===el.ownerDocument.activeElement),true);await page.keyboard.press('Enter');}else await page.getByLabel('Page font',{exact:true}).selectOption(value);await wait(()=>read()!==snapshots.at(-1));await settled();const normalize=s=>s.replace(/[\"']/g,'').replace(/\s*,\s*/g,',');try{await wait(async()=>normalize(await family())===normalize(value));}catch(error){console.log('FONT DIAGNOSTIC',JSON.stringify({source:read(),family:await family(),classes:await app.locator('h1').getAttribute('class')}));throw error;}if(kind==='liquid'&&process.env.RT_E2E_LIQUID_DYNAMIC){const alternate=await browser.newPage({viewport:await app.locator('html').evaluate(el=>({width:el.ownerDocument.defaultView.innerWidth,height:el.ownerDocument.defaultView.innerHeight}))});try{await alternate.goto(url+'/?alternate=1');assert.equal(normalize(await alternate.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily)),normalize(value));assert.equal(await alternate.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight),'700');}finally{await alternate.close();}}};
  await choose('monospace');assert.equal(await family(),'monospace');assert.equal(await app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight),'700');assert.match(read(),/type-editorial/);if(kind!=='html'){await app.locator('h1').hover();await wait(async()=>await app.locator('h1').evaluate(el=>getComputedStyle(el).opacity)==='0.5');await page.getByRole('button',{name:'Undo',exact:true}).hover();}
  await choose(options.find(v=>v.includes('Page Face')));assert.match(await family(),/Page Face/);
  await choose(options.find(v=>v.includes('Page Face')&&v.includes(',')));assert.match(await family(),/Page Face/);
  await choose(custom,true);assert.match(await family(),/Studio_Test/);assert.doesNotMatch(await family(),/Studio Test/);
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await choose('serif');assert.equal(await family(),'serif');await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();assert.match(await family(),/Studio_Test/);await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();
  if(kind!=='html')await wait(async()=>{try{return await page.frameLocator('iframe[title="Typography preview"]').locator('body div').evaluate(el=>getComputedStyle(el).fontFamily)==='serif';}catch(error){if(/Frame was detached/.test(error.message))return false;throw error;}});
  snapshots.push(read());await page.getByRole('button',{name:'Reset font family',exact:true}).click();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>/Studio_Test/.test(await family()));if(process.env.RT_E2E_FONT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_FONT_SCREENSHOT});
  while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}assert.equal(read(),original);await wait(async()=>(variableFont?/Variable Test/:/Georgia/).test(await family()));if(process.env.RT_E2E_CUSTOM_WEIGHT){
   const weight=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight),input=page.getByLabel(kind==='html'?'Font weight (CSS)':'Font weight (1–1000)',{exact:true});
   await page.getByLabel('Style screen scope').selectOption('');await settled();
   const writeWeight=async value=>{snapshots.push(read());await input.fill(value);await input.press('Tab');await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>await weight()===value);if(kind!=='html')assert.equal(await input.inputValue(),value,'inspector weight must reflect the rendered revision');};
   await writeWeight('537.5');let baseInk;
   const ink=()=>app.locator('h1').evaluate(async el=>{const d=el.ownerDocument;await d.fonts.ready;const face=[...d.fonts].find(f=>f.family.replace(/["']/g,'')==='Variable Test');if(face?.status!=='loaded')throw Error('Variable font is not loaded');const css=d.defaultView.getComputedStyle(el),canvas=d.createElement('canvas');canvas.width=400;canvas.height=80;const ctx=canvas.getContext('2d');ctx.font=css.fontWeight+' 32px '+css.fontFamily;ctx.fillText(el.textContent,5,50);const data=ctx.getImageData(0,0,400,80).data;let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i];return sum;});
   if(process.env.RT_E2E_VARIABLE_FONT)baseInk=await ink();assert.match(await family(),(variableFont?/Variable Test/:/Georgia/));if(kind!=='html'){assert.equal(await page.getByLabel('Font weight',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Font weight',{exact:true}).locator('option:checked').textContent(),'Inherited / custom');for(const invalid of ['0','1001']){const before=read();await input.fill(invalid);await input.press('Tab');assert.equal(await input.evaluate(el=>el.checkValidity()),false);assert.equal(read(),before);}await input.fill('537.5');}
   const beforeScope=read();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();assert.equal(read(),beforeScope,'changing scope after restoring an unchanged field must not write');await writeWeight('725.5');if(process.env.RT_E2E_VARIABLE_FONT){const heavyInk=await ink();assert.ok(heavyInk>baseInk*1.05,JSON.stringify({baseInk,heavyInk}));console.log('VARIABLE GLYPH INK',JSON.stringify({baseInk,heavyInk}));}
   if(process.env.RT_E2E_FONT_WEIGHT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_FONT_WEIGHT_SCREENSHOT});
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>await weight()==='537.5');await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await weight()==='725.5');
   if(kind!=='html'){snapshots.push(read());await page.getByLabel('Font weight',{exact:true}).selectOption('font-medium');await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>await weight()==='500');}
   snapshots.push(read());await page.getByRole('button',{name:'Reset font weight',exact:true}).click();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>await weight()==='537.5');assert.match(await family(),(variableFont?/Variable Test/:/Georgia/));
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===expected);await settled();}await wait(async()=>await weight()==='700');assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS custom fractional weights, scope isolation, reset, family retention and exact undo'+(kind==='html'?'':', range validation and preset replacement'));
  }
  if(process.env.RT_E2E_OPTICAL_SIZING){
    await page.getByLabel('Style screen scope').selectOption('');await settled();
    const extent=()=>app.locator('h1').evaluate(async el=>{await el.ownerDocument.fonts.ready;const range=el.ownerDocument.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().width;}),autoWidth=await extent();
    const optical=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontOpticalSizing);
    const change=async(action,expected)=>{snapshots.push(read());await action();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>await optical()===expected);if(kind!=='html')await wait(async()=>{try{return await page.frameLocator('iframe[title="Typography preview"]').locator('body div').evaluate(el=>getComputedStyle(el).fontOpticalSizing)===expected;}catch(error){if(/Frame was detached|Execution context was destroyed/.test(error.message))return false;throw error;}});};
    await change(()=>page.getByLabel('Optical sizing',{exact:true}).selectOption('none'),'none');if(process.env.RT_E2E_OPTICAL_FONT){const offWidth=await extent();assert.ok(Math.abs(autoWidth-offWidth)>.1,JSON.stringify({autoWidth,offWidth}));console.log(engine+' '+kind+': optical glyph widths '+JSON.stringify({autoWidth,offWidth}));}
    await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await change(()=>page.getByLabel('Optical sizing',{exact:true}).selectOption('auto'),'auto');
    await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>await optical()==='none');await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await optical()==='auto');
    await change(()=>page.getByRole('button',{name:'Reset optical sizing',exact:true}).click(),'none');
    const axisSection=page.locator('details').filter({has:page.locator('summary').getByText('Variable font axes',{exact:true})});if(await axisSection.getAttribute('open')===null)await page.getByText('Variable font axes',{exact:true}).click();
    await change(()=>page.getByLabel('Add font axis',{exact:true}).selectOption('opsz'),'none');await wait(async()=>await page.getByText('The explicit Optical size axis overrides automatic sizing. Remove that axis to let the font adapt to text size.',{exact:true}).count()===1);
    if(process.env.RT_E2E_OPTICAL_FONT){
      await page.getByRole('button',{name:'Inspect declared font axes',exact:true}).click();await wait(async()=>/Optical Size \(opsz\): 8 to 144 · default 14/.test(await page.getByLabel('Declared font axes',{exact:true}).textContent()));
      const input=page.getByLabel('Optical size axis',{exact:true});assert.equal(await input.getAttribute('min'),'8');assert.equal(await input.getAttribute('max'),'144');
      let reinspections=0;const metadataRequest=request=>{if(request.url().endsWith('/rt/__api/font-axes'))reinspections++;};page.on('request',metadataRequest);
      await change(async()=>{await input.fill('8');await input.press('Tab');},'none');await wait(async()=>await input.getAttribute('max')==='144');assert.equal(await page.getByRole('slider',{name:'Adjust Optical Size axis',exact:true}).count(),1);const small=await extent();await change(async()=>{await input.fill('144');await input.press('Tab');},'none');const large=await extent();assert.ok(Math.abs(small-large)>.1,JSON.stringify({small,large}));
      await change(()=>page.getByLabel('Optical sizing',{exact:true}).selectOption('auto'),'auto');assert.ok(Math.abs((await extent())-large)<.05);await wait(async()=>await input.getAttribute('max')==='144');assert.equal(reinspections,0);page.off('request',metadataRequest);console.log(engine+' '+kind+': PASS real opsz metadata, cached ranges after source reload, visible axis changes and explicit-axis precedence '+JSON.stringify({small,large}));
    }
    while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}assert.equal(read(),original);await wait(async()=>await optical()==='auto');
    if(await axisSection.getAttribute('open')!==null)await page.getByText('Variable font axes',{exact:true}).click();
    console.log(engine+' '+kind+': PASS optical sizing, responsive isolation, scoped reset, explicit-axis explanation, type preview and exact undo');
  }
  if(process.env.RT_E2E_FONT_AXES){
   if(process.env.RT_E2E_VARIABLE_FONT){
    const beforeMetadata=read(),font=fs.readFileSync(path.join(fixture,'node_modules/next/dist/next-devtools/server/font/geist-latin.woff2')).toString('base64');
    const metadata=await page.evaluate(async encoded=>{const response=await fetch('/rt/__api/font-axes',{method:'POST',headers:{'x-retouch-token':window.__RT_TOKEN,'content-type':'application/octet-stream'},body:Uint8Array.from(atob(encoded),char=>char.charCodeAt(0))});return {status:response.status,...await response.json()};},font);
    assert.equal(metadata.status,200);assert.equal(metadata.ok,true);assert.deepEqual(metadata.axes,[{tag:'wght',name:'Weight',min:100,default:400,max:900,hidden:false}]);assert.equal(read(),beforeMetadata);
    console.log(engine+' '+kind+': PASS authenticated real WOFF2 metadata API without source changes');
   }
   await page.getByLabel('Style screen scope').selectOption('');await settled();await page.getByText('Variable font axes',{exact:true}).click();
   const axes=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontVariationSettings);
   const write=async(action,expected)=>{snapshots.push(read());await action();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>expected.test(await axes()));if(kind!=='html')await wait(async()=>{try{return expected.test(await page.frameLocator('iframe[title="Typography preview"]').locator('body div').evaluate(el=>getComputedStyle(el).fontVariationSettings));}catch(error){if(/Frame was detached|Execution context was destroyed/.test(error.message))return false;throw error;}});};
   await write(()=>page.getByLabel('Add font axis',{exact:true}).selectOption('wght'),/wght/);
   await write(async()=>{const input=page.getByLabel('Weight axis',{exact:true});await input.fill('200');await input.press('Tab');},/200/);
   const extent=()=>app.locator('h1').evaluate(async el=>{await el.ownerDocument.fonts.ready;const range=el.ownerDocument.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().width;});const lightWidth=await extent();
   await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
   await write(async()=>{const input=page.getByLabel('Weight axis',{exact:true});await input.fill('850');await input.press('Tab');},/850/);const heavyWidth=await extent();
   if(process.env.RT_E2E_VARIABLE_FONT)assert.ok(Math.abs(heavyWidth-lightWidth)>.01,JSON.stringify({lightWidth,heavyWidth}));
   if(process.env.RT_E2E_FONT_AXES_SCREENSHOT){await page.getByLabel('Weight axis',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RT_E2E_FONT_AXES_SCREENSHOT});}
   if(process.env.RT_E2E_FONT_DISCOVERY){
    const beforeInspect=read();let requests=0;const listener=request=>{if(request.url().endsWith('/rt/__api/font-axes'))requests++;};page.on('request',listener);
    await page.getByRole('button',{name:'Inspect declared font axes',exact:true}).click();await wait(async()=>/Weight \(wght\): 100 to 900 · default 400/.test(await page.getByLabel('Declared font axes',{exact:true}).textContent()));assert.equal(requests,1);page.off('request',listener);assert.equal(read(),beforeInspect);
    const weightInput=page.getByLabel('Weight axis',{exact:true});assert.equal(await weightInput.getAttribute('min'),'100');assert.equal(await weightInput.getAttribute('max'),'900');
    if(process.env.RT_E2E_FONT_DISCOVERY_SCREENSHOT){await page.getByRole('button',{name:'Use Weight default',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RT_E2E_FONT_DISCOVERY_SCREENSHOT});}
    await weightInput.fill('950');await weightInput.press('Tab');assert.equal(await weightInput.evaluate(node=>node.checkValidity()),false);assert.equal(read(),beforeInspect);await weightInput.fill('850');await weightInput.press('Tab');await settled();
    await write(()=>page.getByRole('button',{name:'Use Weight default',exact:true}).click(),/400/);const beforeDefault=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeDefault);await settled();await wait(async()=>/850/.test(await axes()));assert.equal(await page.getByLabel('Weight axis',{exact:true}).getAttribute('max'),'900');
    const beforeFailure=read(),failureRoute='**/rt/__api/font-axes';await page.route(failureRoute,route=>route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({ok:false,reason:'Font metadata could not be read.'})}));
    await page.getByRole('button',{name:'Inspect declared font axes',exact:true}).click();await wait(async()=>/Font metadata could not be read/.test(await page.getByLabel('Declared font axes',{exact:true}).textContent()));assert.equal(read(),beforeFailure);assert.equal(await page.getByLabel('Weight axis',{exact:true}).getAttribute('max'),'10000');assert.equal(await page.getByRole('button',{name:'Use Weight default',exact:true}).count(),0);
    await page.unroute(failureRoute);await page.getByRole('button',{name:'Inspect declared font axes',exact:true}).click();await wait(async()=>await page.getByLabel('Weight axis',{exact:true}).getAttribute('max')==='900');assert.equal(read(),beforeFailure);
    const slider=page.getByRole('slider',{name:'Adjust Weight axis',exact:true});const sliderBox=async()=>{let box;await wait(async()=>{try{await slider.scrollIntoViewIfNeeded();box=await slider.boundingBox();return !!box;}catch(error){if(/not attached/.test(error.message))return false;throw error;}});return box;};await sliderBox();
    const beforeSlide=read(),inlineBefore=await app.locator('h1').getAttribute('style');let rect=await slider.boundingBox();assert.ok(rect);
    await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.3,rect.y+rect.height/2,{steps:8});assert.equal(read(),beforeSlide);assert.ok(Math.abs(Number((await axes()).match(/"wght"\s+([\d.]+)/)[1])-Number(await slider.inputValue()))<.01);assert.ok(Math.abs((await extent())-heavyWidth)>.01);assert.ok(Math.abs(Number(await weightInput.inputValue())-Number(await slider.inputValue()))<.01);if(process.env.RT_E2E_FONT_LIVE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_FONT_LIVE_SCREENSHOT});await page.keyboard.press('Escape');await page.mouse.up();await settled();assert.equal(read(),beforeSlide);assert.equal(await slider.inputValue(),'850');assert.equal(await app.locator('h1').getAttribute('style'),inlineBefore);assert.match(await axes(),/850/);
    if(process.env.RT_E2E_FONT_PREVIEW_CLEANUP){
      rect=await sliderBox();await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.3,rect.y+rect.height/2,{steps:8});
      await app.locator('h1').evaluate(el=>el.style.setProperty('color','rgb(1, 2, 3)'));await page.keyboard.press('Escape');await page.mouse.up();await settled();assert.match(await axes(),/850/);assert.equal(await app.locator('h1').evaluate(el=>el.style.color),'rgb(1, 2, 3)');assert.equal(read(),beforeSlide);
      await app.locator('h1').evaluate((el,original)=>original===null?el.removeAttribute('style'):el.setAttribute('style',original),inlineBefore);await settled();
      rect=await sliderBox();await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.3,rect.y+rect.height/2,{steps:8});
      await slider.evaluate(el=>el.remove());await wait(async()=>await app.locator('h1').getAttribute('style')===inlineBefore);await page.mouse.up();await settled();await wait(async()=>/850/.test(await axes()));assert.equal(read(),beforeSlide);
      await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click();await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();
      console.log(engine+' '+kind+': PASS live-preview cleanup on control removal and preservation of concurrent page styles');
    }
    rect=await sliderBox();
    await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height/2,{steps:8});const slid=Number(await slider.inputValue());assert.ok(slid>100&&slid<800);assert.equal(read(),beforeSlide);assert.ok(Math.abs(Number((await axes()).match(/"wght"\s+([\d.]+)/)[1])-slid)<.01);
    await write(()=>page.mouse.up(),/wght/);const rendered=Number((await axes()).match(/"wght"\s+([\d.]+)/)[1]);assert.ok(Math.abs(rendered-slid)<.01);assert.equal(await app.locator('h1').getAttribute('style'),inlineBefore);
    const beforeGesture=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeGesture);await settled();await wait(async()=>/850/.test(await axes()));
    await write(()=>slider.press('Home'),/100/);const beforeKey=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeKey);await settled();await wait(async()=>/850/.test(await axes()));
    if(process.env.RT_E2E_FONT_DISCOVERY_SCREENSHOT){await slider.scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RT_E2E_FONT_DISCOVERY_SCREENSHOT});}
    console.log(engine+' '+kind+': PASS declared font discovery, metadata request, range validation, default application, cached metadata, failure recovery, live glyph preview, pointer commit/cancel, keyboard slider and exact undo');
   }
   await write(()=>page.getByLabel('Add font axis',{exact:true}).selectOption('wdth'),/wdth/);assert.match(await axes(),/850/);
   await write(()=>page.getByRole('button',{name:'Remove Width axis',exact:true}).click(),/850/);assert.doesNotMatch(await axes(),/wdth/);
   const beforeCustom=read();await page.getByLabel('Add font axis',{exact:true}).selectOption('custom');assert.equal(read(),beforeCustom);
   const tag=page.getByRole('textbox',{name:'Custom axis tag',exact:true});await tag.fill('BAD');await page.getByRole('button',{name:'Add custom axis',exact:true}).click();assert.equal(await tag.evaluate(node=>node.checkValidity()),false);assert.equal(read(),beforeCustom);
   await tag.fill('wght');await page.getByRole('button',{name:'Add custom axis',exact:true}).click();assert.equal(await tag.evaluate(node=>node.validationMessage),'This axis is already listed.');assert.equal(read(),beforeCustom);
   await tag.fill('GRAD');await page.getByLabel('Initial axis value',{exact:true}).fill('-12.5');await write(()=>page.getByLabel('Initial axis value',{exact:true}).press('Enter'),/GRAD/);assert.match(await axes(),/-12.5/);assert.match(await axes(),/850/);
   await write(()=>page.getByRole('button',{name:'Remove GRAD axis',exact:true}).click(),/850/);assert.doesNotMatch(await axes(),/GRAD/);
   const beforeCancel=read();await page.getByLabel('Add font axis',{exact:true}).selectOption('custom');await tag.fill('GRAD');await tag.press('Escape');assert.equal(read(),beforeCancel);assert.equal(await page.getByLabel('Add font axis',{exact:true}).inputValue(),'');
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>/200/.test(await axes()));await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>/850/.test(await axes()));
   await write(()=>page.getByRole('button',{name:'Reset font axes',exact:true}).click(),/200/);
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}assert.equal(read(),original);await wait(async()=>await axes()==='normal');
   console.log(engine+' '+kind+': PASS variable axes, independent removal, breakpoint isolation, reset and exact undo; glyph extents '+JSON.stringify({lightWidth,heavyWidth}));
  }
  if(process.env.RT_E2E_LINE_HEIGHT){
   const height=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).lineHeight),initialHeight=await height(),initialFamily=await family(),initialWeight=await app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight),input=page.getByLabel(kind==='html'?'Line height (CSS)':'Line height (px)',{exact:true});
   const write=async(action,expected)=>{snapshots.push(read());await action();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>await height()===expected);assert.equal(await family(),initialFamily);assert.equal(await app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight),initialWeight);};
   const pixels=async value=>{await input.fill(value+(kind==='html'?'px':''));await input.press('Tab');};
   await page.getByLabel('Style screen scope').selectOption('');await settled();await write(()=>pixels('80'),'80px');
   await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await write(()=>page.getByRole('button',{name:'Automatic line height',exact:true}).click(),'normal');
   if(kind!=='html'){assert.equal(await input.inputValue(),'');assert.equal(await input.getAttribute('placeholder'),'Automatic');await write(()=>page.getByRole('button',{name:'Reset text overrides',exact:true}).click(),'80px');const automatic=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===automatic);await settled();await wait(async()=>await height()==='normal');}
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>await height()==='80px');await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await height()==='normal');
   await write(()=>pixels('45'),'45px');await write(()=>page.getByRole('button',{name:'Reset line height',exact:true}).click(),'80px');
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}await wait(async()=>await height()===initialHeight);assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS automatic/custom line height, responsive isolation, family/weight retention, reset and exact undo');
  }
  if(process.env.RT_E2E_RELATIVE_SPACING){
   const spacing=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).letterSpacing),initial=await spacing();
   const edit=async(label,value,expected)=>{snapshots.push(read());const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>Math.abs(parseFloat(await spacing())-expected)<.02);};
   await page.getByLabel('Style screen scope').selectOption('');await settled();await edit('Letter spacing (%)','10',3.2);
   assert.match(read(),/0\.1em/);await edit(kind==='html'?'Font size (CSS)':'Font size (px)',kind==='html'?'40px':'40',4);
   await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit('Letter spacing (%)','-5',-2);
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>Math.abs(parseFloat(await spacing())-4)<.02);await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>Math.abs(parseFloat(await spacing())+2)<.02);
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}await wait(async()=>await spacing()===initial);assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS percentage letter spacing scales with font size, negative tablet override, phone isolation and exact undo');
  }
  if(process.env.RT_E2E_NUMERIC){
   const numeric=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontVariantNumeric),initial=await numeric();
   const same=(actual,expected)=>actual.split(' ').sort().join(' ')===expected.split(' ').sort().join(' ');
   const change=async(label,value,expected)=>{snapshots.push(read());await page.getByLabel(label,{exact:true}).selectOption(value);await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>same(await numeric(),expected));assert.equal(await page.locator('.numeric-typography').getAttribute('open'),'');};
   await page.getByLabel('Style screen scope').selectOption('');await settled();
   if(process.env.RT_E2E_VARIABLE_FONT){snapshots.push(read());const weight=page.getByLabel(kind==='html'?'Font weight (CSS)':'Font weight (1–1000)',{exact:true});await weight.fill('400');await weight.press('Tab');await wait(()=>read()!==snapshots.at(-1));await settled();await wait(()=>app.locator('h1').evaluate(el=>getComputedStyle(el).fontWeight==='400'));}
   await page.getByText('Number formatting',{exact:true}).click();
   const digitWidths=()=>app.locator('h1').evaluate(async el=>{const d=el.ownerDocument;await d.fonts.ready;const css=d.defaultView.getComputedStyle(el),probe=d.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;white-space:pre;';for(const property of ['font-family','font-size','font-weight','font-variant-numeric'])probe.style.setProperty(property,css.getPropertyValue(property));d.body.append(probe);try{return ['111111','888888'].map(text=>{probe.textContent=text;return probe.getBoundingClientRect().width;});}finally{probe.remove();}});
   await change('Number width','tabular-nums','tabular-nums');
   if(process.env.RT_E2E_VARIABLE_FONT){const widths=await digitWidths();assert.ok(Math.abs(widths[0]-widths[1])<.1,JSON.stringify(widths));console.log('TABULAR DIGIT WIDTHS',JSON.stringify(widths));}

   if(process.env.RT_E2E_VARIABLE_FONT){await change('Number width','proportional-nums','proportional-nums');const widths=await digitWidths();assert.ok(Math.abs(widths[0]-widths[1])>.5,JSON.stringify(widths));console.log('PROPORTIONAL DIGIT WIDTHS',JSON.stringify(widths));await change('Number width','tabular-nums','tabular-nums');}
   await change('Number style','oldstyle-nums','tabular-nums oldstyle-nums');
   await change('Fractions','diagonal-fractions','tabular-nums oldstyle-nums diagonal-fractions');
   await change('Ordinals','ordinal','tabular-nums oldstyle-nums diagonal-fractions ordinal');
   await change('Zero style','slashed-zero','tabular-nums oldstyle-nums diagonal-fractions ordinal slashed-zero');
   if(process.env.RT_E2E_NUMERIC_SCREENSHOT){await page.getByLabel('Zero style',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.RT_E2E_NUMERIC_SCREENSHOT});}
   const baseNumeric=await numeric();
   await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
   await change('Number width','proportional-nums','proportional-nums oldstyle-nums diagonal-fractions ordinal slashed-zero');

   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>same(await numeric(),baseNumeric));
   await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();
   snapshots.push(read());await page.getByRole('button',{name:'Reset number formatting',exact:true}).click();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>same(await numeric(),baseNumeric));
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}await wait(async()=>same(await numeric(),initial));assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS numeric feature composition, open controls survive edits, responsive isolation, reset and exact undo');
  }
  if(process.env.RT_E2E_PANEL_TAB){
   await page.getByLabel('Style screen scope').selectOption('');await settled();
   const before=read(),input=page.getByLabel('Line height (%)',{exact:true}),next=page.getByRole('button',{name:'Use relative line height',exact:true});
   await input.fill('181');await input.press('Tab');await wait(()=>read()!==before);await settled();
   await wait(()=>next.evaluate(el=>el===el.ownerDocument.activeElement));
   await page.keyboard.press('Shift+Tab');assert.equal(await input.evaluate(el=>el===el.ownerDocument.activeElement),true);
   await input.press('Tab');assert.equal(await next.evaluate(el=>el===el.ownerDocument.activeElement),true);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before);await settled();
   assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).evaluate(el=>el.ownerDocument.activeElement?.getAttribute('aria-label'))==='Line height (%)',false);
   let release,intercepted=false;const gate=new Promise(resolve=>{release=resolve;});
   const hold=async route=>{intercepted=true;await gate;await route.continue();};
   await page.route('**/rt/__api/op',hold);
   try{
    await input.fill('182');await input.press('Tab');await wait(()=>intercepted);
    await page.getByRole('searchbox',{name:'Find a layer',exact:true}).click();release();
    await wait(()=>read()!==before);await settled();
    assert.equal(await page.getByRole('searchbox',{name:'Find a layer',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true,'a deliberate click during save must retain focus');
   }finally{release();await page.unroute('**/rt/__api/op',hold);}
   await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===before);await settled();
   console.log(engine+' '+kind+': PASS Tab retains next control after save/rebuild, Shift+Tab returns, unchanged Tab does not write, explicit click cancels queued focus, exact undo');
  }
  if(process.env.RT_E2E_CONVERT_SPACING){
   await page.getByLabel('Style screen scope').selectOption('');await settled();
   const write=async action=>{snapshots.push(read());await action();await wait(()=>read()!==snapshots.at(-1));await settled();};
   const edit=async(label,value)=>write(async()=>{const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');});
   const metrics=()=>app.locator('h1').evaluate(el=>{const s=getComputedStyle(el);return [parseFloat(s.lineHeight),parseFloat(s.letterSpacing)];});
   await edit(kind==='html'?'Line height (CSS)':'Line height (px)',kind==='html'?'64px':'64');
   await edit(kind==='html'?'Line height (CSS)':'Line height (px)',kind==='html'?'48px':'48');
   await edit(kind==='html'?'Letter spacing (CSS)':'Letter spacing (px)',kind==='html'?'3.2px':'3.2');
   assert.equal(await page.getByLabel('Line height (%)',{exact:true}).inputValue(),'150');
   assert.equal(await page.getByLabel('Letter spacing (%)',{exact:true}).inputValue(),'10');
   await write(()=>page.getByRole('button',{name:'Use relative line height',exact:true}).click());
   await write(()=>page.getByRole('button',{name:'Use relative letter spacing',exact:true}).click());
   assert.deepEqual(await metrics(),[48,3.2]);
   if(process.env.RT_E2E_CONVERT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_CONVERT_SCREENSHOT});
   await edit(kind==='html'?'Font size (CSS)':'Font size (px)',kind==='html'?'40px':'40');
   await wait(async()=>JSON.stringify(await metrics())==='[60,4]');
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS unchanged-value conversion preserves appearance, scales both spacing properties with font size, and exact undo');
  }
  if(process.env.RT_E2E_RELATIVE_LINE_HEIGHT){
   const height=()=>app.locator('h1').evaluate(el=>getComputedStyle(el).lineHeight),initial=await height();
   const edit=async(label,value,expected)=>{snapshots.push(read());const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>Math.abs(parseFloat(await height())-expected)<.02);};
   await page.getByLabel('Style screen scope').selectOption('');await settled();await edit('Line height (%)','175',56);
   await edit(kind==='html'?'Font size (CSS)':'Font size (px)',kind==='html'?'40px':'40',70);
   assert.equal(Number(await page.getByLabel('Line height (%)',{exact:true}).inputValue()),175);
   await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit('Line height (%)','200',80);
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>Math.abs(parseFloat(await height())-70)<.02);await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>Math.abs(parseFloat(await height())-80)<.02);
   snapshots.push(read());await page.getByRole('button',{name:'Reset line height',exact:true}).click();await wait(()=>read()!==snapshots.at(-1));await settled();await wait(async()=>Math.abs(parseFloat(await height())-70)<.02);
   while(snapshots.length){const expected=snapshots.pop();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===expected);await settled();}await wait(async()=>await height()===initial);assert.equal(read(),original);
   console.log(engine+' '+kind+': PASS percentage line height scales with font size, tablet override, phone isolation, reset and exact undo');
  }
  assert.deepEqual(errors,[]);console.log(engine+' '+kind+': PASS searchable page font catalog, keyboard apply/cancel, no-match preservation, declared and used families, underscore preservation, weight/named-style retention, responsive isolation, reset, preview and exact source undo');
 }finally{if(browser)await browser.close();if(child){child.kill('SIGTERM');await stopped;}if(server){server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
