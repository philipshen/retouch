'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),html=require('../../src/adapters/html.cjs');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',sharp=require(path.join(fixture,'node_modules/sharp'));
const resolve=(source,id)=>{const elements=html.collect(source,'index.html').elements;return {source,elements,element:id?elements.find(e=>e.id===id):elements.find(e=>e.tag==='circle'),file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source)};};
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{const page=await browser.newPage();let checks=0;
 const source='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><circle cx="25%" cy="50%" r="20%" fill="red"/><rect width="50%" height="100%" fill="blue"/></svg>',r=resolve(source),ids=r.elements.filter(e=>['circle','rect'].includes(e.tag)).map(e=>e.id);
 for(const mode of ['alpha','luminance']){
  const made=html.planOp(r,{type:'createSVGMask',fileHash:r.hash,ids,maskId:r.element.id,mode});assert.ok(made.ok,made.reason);const masked=made.edits[0].after;
  const fresh=resolve(masked),edited=html.planOp(fresh,{type:'setSVGGeometry',fileHash:fresh.hash,property:'r',value:'5%'});assert.ok(edited.ok,edited.reason);const small=edited.edits[0].after,group=resolve(small,made.selectionIds[0]),released=html.planOp(group,{type:'releaseSVGMask',fileHash:group.hash});assert.ok(released.ok,released.reason);assert.equal(released.edits[0].after,source.replace('r="20%"','r="5%"'));
  for(const width of [200,400])for(const [state,markup]of [['masked',masked],['edited',small],['released',released.edits[0].after]]){
   await page.setContent('<style>body{margin:0;background:white}svg{display:block}</style>'+markup);await page.locator('svg').evaluate((el,width)=>el.setAttribute('width',width),width);const {data,info}=await sharp(await page.locator('svg').screenshot()).raw().toBuffer({resolveWithObject:true}),pixel=(x,y)=>[...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)];
   const center=pixel(width*.25,50),middle=pixel(width*.35,50),edge=pixel(width*.48,50),blue=[0,0,255],white=[255,255,255],maskedColor=mode==='alpha'?blue:[201,201,255],close=(actual,expected)=>actual.every((n,i)=>Math.abs(n-expected[i])<=3);
   for(const [actual,expected]of [[center,state==='released'?blue:maskedColor],[middle,state==='released'?blue:state==='edited'?white:maskedColor],[edge,state==='released'?blue:white]]){checks++;assert.ok(close(actual,expected),JSON.stringify({mode,width,state,actual,expected}));}
  }
 }
 console.log(engine+': PASS '+checks+' rendered mask pixel checks for alpha/luminance, two viewport sizes, editable percentage mask geometry and lossless release');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
