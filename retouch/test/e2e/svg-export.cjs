'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svg-export-')),file=path.join(root,'index.html');
 let source='<!doctype html><html><head><style>#solid{fill:rgb(12,180,70);width:50px}@media(min-width:768px){#solid{fill:rgb(180,12,70)}}</style></head><body><svg aria-label="Test artwork" width="200" height="100" viewBox="0 0 200 100"><defs><linearGradient id="paint"><stop stop-color="blue"/><stop offset="1" stop-color="red"/></linearGradient><clipPath id="clip"><rect x="100" y="10" width="40" height="80"/></clipPath></defs><rect width="200" height="100" fill="white"/><rect id="solid" aria-label="Solid" x="10" y="10" width="5" height="50"/><rect x="100" y="10" width="80" height="80" fill="url(#paint)" clip-path="url(#clip)"/><script>void 0</script></svg></body></html>';
 if(process.env.RT_E2E_SHARED_DEFS){const defs=source.match(/<defs>[\s\S]*?<\/defs>/)[0],shared=defs.replace('id="paint"','id="paint-base"').replace('</linearGradient>','</linearGradient><linearGradient id="paint" href="#paint-base"/>');source=source.replace(defs,'').replace('<body>','<body><svg width="0" height="0" style="position:absolute">'+shared+'</svg>');}
 if(process.env.RT_E2E_IMAGE){fs.writeFileSync(path.join(root,'pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQifrwHwAEQgJeVXe71gAAAABJRU5ErkJggg==','base64'));source=source.replace('<script>void 0</script>','<image href="/pixel.png" x="160" y="70" width="20" height="20"/><image href="/pixel.png" x="180" y="70" width="20" height="20"/><script>void 0</script>');}
 if(process.env.RT_E2E_TEXT)source=source.replace('<script>void 0</script>','<text x="10" y="95" style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;fill:black">TEST</text><script>void 0</script>');
 if(process.env.RT_E2E_TEXT_PATH){source=source.replace('<text x="10" y="95"','<text').replace('>TEST</text>','><textPath href="#text-track">TEST</textPath></text>').replace('<defs>','<defs><path id="text-track" d="M10 95 Q35 75 85 95"/>');}
 if(process.env.RT_E2E_SYMBOL){
  source=source.replace('</style>',(process.env.RT_E2E_SYMBOL_ANCESTRY?'.defs-holder ':'')+'.symbol-ink{fill:currentColor} #absent,.symbol-ink{stroke:none}</style>');
  source=source.replace('<body>','<body><div class="defs-holder"><svg width="0" height="0" style="position:absolute"><defs><symbol id="export-icon" viewBox="0 0 10 10"><path class="symbol-ink" d="M0 0h10v10H0z"/></symbol><symbol id="export-icon-wrapper" viewBox="0 0 10 10"><use href="#export-icon" width="10" height="10"/></symbol></defs></svg></div>');
  source=source.replace('<script>void 0</script>','<use href="#export-icon-wrapper" x="160" y="30" width="20" height="20" color="rgb(25,160,70)"/><use href="#export-icon-wrapper" x="180" y="30" width="20" height="20" color="rgb(160,25,180)"/><script>void 0</script>');
 }
 if(process.env.RT_E2E_SYMBOL_VARIABLE)source=source.replace('fill:currentColor','fill:var(--icon-fill,currentColor)').replace('color="rgb(160,25,180)"','color="rgb(10,10,200)" style="--icon-fill:rgb(160,25,180)"');
 fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.locator('#solid').waitFor();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await page.getByRole('treeitem',{name:'rect · Solid',exact:true}).click();
  let imageFetches=0;page.on('request',request=>{if(request.resourceType()==='fetch'&&request.url().endsWith('/pixel.png'))imageFetches++;});
  const exportFile=async(embedded=true)=>{await page.getByLabel('Export format',{exact:true}).selectOption('svg');const before=imageFetches;const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export SVG canvas',exact:true}).click();const download=await event;assert.equal(download.suggestedFilename(),'Test-artwork.svg');const dest=path.join(root,'export.svg');await download.saveAs(dest);if(process.env.RT_E2E_IMAGE)assert.equal(imageFetches-before,embedded?1:0,'embedding fetches reused images once; linked export does not fetch');return fs.readFileSync(dest,'utf8');};
  const raster=async text=>page.evaluate(async text=>{const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const c=canvas.getContext('2d');c.drawImage(img,0,0);return {size:[img.naturalWidth,img.naturalHeight],pixels:[[30,30],[55,30],[120,40],[160,40],[175,80],[195,80]].map(([x,y])=>[...c.getImageData(x,y,1,1).data])};}finally{URL.revokeObjectURL(url);}},text);
  const text=await exportFile();assert.doesNotMatch(text,/data-rt|<script/);if(!process.env.RT_E2E_SYMBOL)assert.doesNotMatch(text,/<style/);assert.match(text,/linearGradient/);assert.match(text,/clipPath/);const result=await raster(text);assert.deepEqual(result.size,[200,100]);assert.deepEqual(result.pixels[0],[12,180,70,255]);assert.deepEqual(result.pixels[1],[12,180,70,255]);assert.ok(result.pixels[2][0]>0&&result.pixels[2][2]>0&&result.pixels[2][1]===0);assert.deepEqual(result.pixels[3],process.env.RT_E2E_SYMBOL?((!process.env.RT_E2E_SYMBOL_ANCESTRY||engine==='webkit')?[25,160,70,255]:[0,0,0,255]):[255,255,255,255]);if(process.env.RT_E2E_IMAGE){assert.deepEqual(result.pixels[4],[20,90,240,255]);assert.deepEqual(result.pixels[5],[20,90,240,255]);assert.match(text,/data:image\/png;base64/);assert.doesNotMatch(text,/href="[^"]*pixel.png/);}
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');const tablet=await raster(await exportFile());assert.deepEqual(tablet.pixels[0],[180,12,70,255]);assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);
  if(process.env.RT_E2E_PNG){
   await page.getByLabel('Export format',{exact:true}).selectOption('png');
   for(const scale of [1,2,4]){
    await page.getByLabel('Export scale',{exact:true}).selectOption(String(scale));const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const download=await event;
    assert.equal(download.suggestedFilename(),'Test-artwork'+(scale===1?'':'@'+scale+'x')+'.png');const dest=path.join(root,'export-'+scale+'.png');await download.saveAs(dest);
    const pixels=await page.evaluate(async({data,scale})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {size:[img.naturalWidth,img.naturalHeight],bitmap:[...ctx.getImageData(175*scale,80*scale,1,1).data],symbols:[170,190].map(x=>[...ctx.getImageData(x*scale,40*scale,1,1).data]),edge:[60*scale-1,60*scale].map(x=>[...ctx.getImageData(x,30*scale,1,1).data])};},{data:fs.readFileSync(dest).toString('base64'),scale});
    if(process.env.RT_E2E_TEXT&&scale===1){
     const screen=await app.locator('svg[aria-label="Test artwork"]').screenshot();
     const ink=await page.evaluate(async images=>{const results=[];for(const data of images){const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,50,90,50).data;const mask=[];let count=0,left=90,right=0,top=50,bottom=0;for(let y=0;y<50;y++)for(let x=0;x<90;x++){const i=(y*90+x)*4;if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100&&pixels[i+3]>200){mask.push(y*90+x);count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}results.push({count,bounds:[left,right,top,bottom],mask});}return results;},[screen.toString('base64'),fs.readFileSync(dest).toString('base64')]);
     assert.ok(ink[0].count>100);assert.ok(Math.abs(ink[1].count-ink[0].count)/ink[0].count<.2,JSON.stringify(ink));ink[0].bounds.forEach((value,i)=>assert.ok(Math.abs(value-ink[1].bounds[i])<=1,JSON.stringify(ink)));const sourceMask=new Set(ink[0].mask),exportMask=new Set(ink[1].mask),intersection=ink[0].mask.filter(pixel=>exportMask.has(pixel)).length,overlap=intersection/(sourceMask.size+exportMask.size-intersection);assert.ok(overlap>.95,'Glyph pixel overlap: '+overlap);console.log(engine+': text ink '+JSON.stringify(ink.map(({count,bounds})=>({count,bounds})))+'; pixel overlap '+overlap);
    }
    assert.deepEqual(pixels.size,[200*scale,100*scale]);if(process.env.RT_E2E_SYMBOL)assert.deepEqual(pixels.symbols,(!process.env.RT_E2E_SYMBOL_ANCESTRY||engine==='webkit')?[[25,160,70,255],[160,25,180,255]]:[[0,0,0,255],[0,0,0,255]]);if(process.env.RT_E2E_IMAGE)assert.deepEqual(pixels.bitmap,[20,90,240,255]);assert.deepEqual(pixels.edge,[[180,12,70,255],[255,255,255,255]]);
   }
   await page.getByLabel('Export format',{exact:true}).selectOption('jpeg');assert.equal(await page.getByLabel('Export scale',{exact:true}).inputValue(),'4','scale persists across formats');await page.getByLabel('Export scale',{exact:true}).selectOption('2');
   await app.locator('svg[aria-label="Test artwork"]').evaluate(svg=>{svg.__exportBackground=svg.querySelector(':scope > rect');svg.__exportBackground.remove();});
   try{
    const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export JPEG',exact:true}).click();const download=await event;assert.equal(download.suggestedFilename(),'Test-artwork@2x.jpg');const dest=path.join(root,'export.jpg');await download.saveAs(dest);const bytes=fs.readFileSync(dest);assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
    const result=await page.evaluate(async data=>{const image=new Image();image.src='data:image/jpeg;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {size:[image.naturalWidth,image.naturalHeight],white:[...ctx.getImageData(2,2,1,1).data],color:[...ctx.getImageData(60,60,1,1).data]};},bytes.toString('base64'));assert.deepEqual(result.size,[400,200]);assert.deepEqual(result.white,[255,255,255,255]);[180,12,70,255].forEach((value,i)=>assert.ok(Math.abs(result.color[i]-value)<8));
    const sizes=[];await page.getByLabel('JPEG background',{exact:true}).evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('change',{bubbles:true}));});
    for(const quality of [35,95]){
     const field=page.getByLabel('JPEG quality (%)',{exact:true});await field.fill(String(quality));await field.press('Tab');const ready=page.waitForEvent('download');await page.getByRole('button',{name:'Export JPEG',exact:true}).click();const download=await ready;const dest=path.join(root,'quality-'+quality+'.jpg');await download.saveAs(dest);const bytes=fs.readFileSync(dest);sizes.push(bytes.length);
     const color=await page.evaluate(async data=>{const image=new Image();image.src='data:image/jpeg;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(2,2,1,1).data];},bytes.toString('base64'));[18,52,86,255].forEach((value,i)=>assert.ok(Math.abs(color[i]-value)<6));
    }
    assert.ok(sizes[1]>sizes[0],JSON.stringify(sizes));
    await page.getByLabel('Export format',{exact:true}).selectOption('png');assert.equal(await page.getByLabel('JPEG quality (%)',{exact:true}).count(),0);await page.getByLabel('Export format',{exact:true}).selectOption('jpeg');assert.equal(await page.getByLabel('JPEG quality (%)',{exact:true}).inputValue(),'95');assert.equal(await page.getByLabel('JPEG background',{exact:true}).inputValue(),'#123456');
    const quality=page.getByLabel('JPEG quality (%)',{exact:true});for(const value of ['0','101','50.5']){await quality.fill(value);await quality.press('Tab');assert.equal(await quality.evaluate(el=>el.checkValidity()),false);}await quality.fill('95');await quality.press('Tab');
    console.log(engine+': JPEG quality byte sizes '+JSON.stringify(sizes));
    if(process.env.RT_E2E_EXPORT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_EXPORT_SCREENSHOT});
   }finally{await app.locator('svg[aria-label="Test artwork"]').evaluate(svg=>{svg.insertBefore(svg.__exportBackground,svg.querySelector(':scope > rect'));delete svg.__exportBackground;});}
   console.log(engine+': PASS JPEG download dimensions, white compositing, color fidelity and format/scale switching');
   const transparent=await app.locator('svg[aria-label="Test artwork"]').evaluate(async svg=>{const background=svg.querySelector(':scope > rect');background.remove();try{const result=await parent.RetouchSVGExport.png(svg,2),url=URL.createObjectURL(result.blob);try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=result.width;canvas.height=result.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,1,1).data];}finally{URL.revokeObjectURL(url);}}finally{svg.insertBefore(background,svg.querySelector(':scope > rect'));}});assert.deepEqual(transparent,[0,0,0,0]);
   const refusals=await app.locator('svg[aria-label="Test artwork"]').evaluate(async svg=>{const messages=[];for(const scale of [0,5])try{await parent.RetouchSVGExport.png(svg,scale);}catch(error){messages.push(error.message);}const text=svg.ownerDocument.createElementNS(svg.namespaceURI,'foreignObject');svg.append(text);try{await parent.RetouchSVGExport.png(svg);}catch(error){messages.push(error.message);}finally{text.remove();}return messages;});assert.equal(refusals.length,3);assert.match(refusals[2],/embedded HTML/);
   const assets=await app.locator('svg[aria-label="Test artwork"]').evaluate(async svg=>{const failures=[];const image=svg.ownerDocument.createElementNS(svg.namespaceURI,'image');image.setAttribute('href','/missing-export-image.png');svg.append(image);try{await parent.RetouchSVGExport.png(svg);}catch(error){failures.push(error.message);}finally{image.remove();}const style=svg.getAttribute('style');svg.style.width='10000px';svg.style.height='10000px';try{await parent.RetouchSVGExport.png(svg);}catch(error){failures.push(error.message);}finally{if(style===null)svg.removeAttribute('style');else svg.setAttribute('style',style);}return failures;});assert.match(assets[0],/HTTP 404/);assert.match(assets[1],/32 million/);

   assert.equal(fs.readFileSync(file,'utf8'),source);console.log(engine+': PASS downloaded PNG at 1x/2x/4x, crisp scaled edges, transparency, filename scales, invalid-scale/unsupported-content refusal and unchanged source');
  }
  if(process.env.RT_E2E_SYMBOL){
   const screenshot=await app.locator('svg[aria-label="Test artwork"]').screenshot(),standalone=await exportFile();
   const comparison=await page.evaluate(async({screen,svg})=>{
    const samples=[];
    for(const url of ['data:image/png;base64,'+screen,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)]){
     const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
     samples.push([170,190].map(x=>[...ctx.getImageData(x,40,1,1).data]));
    }
    return samples;
   },{screen:screenshot.toString('base64'),svg:standalone});
   assert.deepEqual(comparison[0],(!process.env.RT_E2E_SYMBOL_ANCESTRY||engine==='webkit')?[[25,160,70,255],[160,25,180,255]]:[[0,0,0,255],[0,0,0,255]]);assert.deepEqual(comparison[1],comparison[0]);
   console.log(engine+': PASS shared nested symbol export matches source instance colors '+JSON.stringify(comparison));
  }
  const references=await app.locator('svg[aria-label="Test artwork"]').evaluate(svg=>{
   const d=svg.ownerDocument,holder=d.createElement('div');
   holder.innerHTML='<svg width="0" height="0"><defs><path id="export-ref-shape" d="M0 0h10v10z"/><symbol id="export-ref-a"><use href="#export-ref-shape"/></symbol><symbol id="export-ref-b"><use href="#export-ref-a"/></symbol></defs></svg><svg id="export-ref-canvas"><use href="#export-ref-b"/><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#export-ref-b"/></svg>';
   d.body.append(holder);
   try{
    const canvas=holder.querySelector('#export-ref-canvas'),before=holder.innerHTML,api=window.parent.RetouchSVGExport;
    const result=api.useReferences(canvas),ids=result.definitions.map(node=>node.id).sort(),count=result.instances.size;
    if(holder.innerHTML!==before)throw Error('Reference collection mutated the page');
    const nested=holder.querySelector('#export-ref-a use');nested.setAttribute('href','#export-ref-b');
    let cycle;try{api.useReferences(canvas);}catch(error){cycle=error.message;}
    nested.setAttribute('href','#export-ref-missing');let missing;try{api.snapshot(canvas);}catch(error){missing=error.message;}
    nested.setAttribute('href','https://example.invalid/icons.svg#icon');let external;try{api.useReferences(canvas);}catch(error){external=error.message;}
    return {ids,count,cycle,missing,external};
   }finally{holder.remove();}
  });
  assert.deepEqual(references.ids,['export-ref-a','export-ref-b','export-ref-shape']);assert.equal(references.count,4);
  assert.match(references.cycle,/Cyclic SVG symbol reference/);assert.match(references.missing,/Missing SVG definition: export-ref-missing/);assert.match(references.external,/External SVG symbol references/);
  console.log(engine+': PASS transitive shared symbol collection, href/xlink, reuse deduplication, cycle/missing/external diagnostics and no DOM mutation');
  const refusal=await app.locator('svg[aria-label="Test artwork"]').evaluate(svg=>{const use=svg.ownerDocument.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#solid');svg.append(use);try{return window.parent.RetouchSVGExport.snapshot(svg);}catch(error){return error.message;}finally{use.remove();}});assert.match(refusal,/reference visible artwork/);
  if(process.env.RT_E2E_TEXT_PATH){assert.match(text,/id="text-track"/);assert.match(text,/href="#text-track"/);}
  if(process.env.RT_E2E_SHARED_DEFS){assert.match(text,/id="paint-base"/);assert.match(text,/href="#paint-base"/);}
  const missing=await app.locator('#solid').evaluate(el=>{el.style.clipPath='url(#missing-export-definition)';try{return window.parent.RetouchSVGExport.snapshot(el);}catch(error){return error.message;}finally{el.style.removeProperty('clip-path');}});assert.match(missing,/Missing SVG definition/);
  if(process.env.RT_E2E_IMAGE){
   await page.getByLabel('Export format',{exact:true}).selectOption('svg');await page.getByLabel('Embed images in SVG',{exact:true}).uncheck();const linked=await exportFile(false);assert.match(linked,/href="[^"]*pixel.png/);await page.getByLabel('Embed images in SVG',{exact:true}).check();
   fs.writeFileSync(path.join(root,'bad-image.png'),'not an image');
   const error=await app.locator('svg[aria-label="Test artwork"]').evaluate(async svg=>{const image=svg.ownerDocument.createElementNS(svg.namespaceURI,'image');image.setAttribute('href','/bad-image.png');svg.append(image);try{await parent.RetouchSVGExport.prepared(svg);}catch(error){return error.message;}finally{image.remove();}});assert.match(error,/decode a linked bitmap/);
  }
  const webFont=await app.locator('svg[aria-label="Test artwork"]').evaluate(async svg=>{const d=svg.ownerDocument,face=new FontFace('Export, Test Face','url(/missing-export-font.woff2)'),text=d.createElementNS(svg.namespaceURI,'text');text.textContent='Font';text.style.fontFamily='"Export, Test Face"';d.fonts.add(face);svg.append(text);try{await parent.RetouchSVGExport.png(svg);}catch(error){return error.message;}finally{text.remove();d.fonts.delete(face);}});assert.match(webFont,/Font embedding/);
  if(process.env.RT_E2E_EXPORT_ARTIFACT)fs.writeFileSync(process.env.RT_E2E_EXPORT_ARTIFACT,text);
  console.log(engine+': PASS downloaded SVG decodes independently with viewport dimensions, CSS geometry/colors, gradient, clipping, responsive styling, no editor/script markup, unchanged source');
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
