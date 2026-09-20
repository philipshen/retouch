'use strict';
const sanitize=require('./capture-sanitize.cjs').sanitize,rewrite=require('./capture-css-urls.cjs').rewrite;
function validate(body){
 if(body?.screens!==undefined){
  if(!Array.isArray(body.screens)||!body.screens.length||body.screens.length>20||body.separate||!['viewport','page'].includes(body.area||'viewport'))throw Error('Choose up to 20 screens and viewport or full-page export.');
  for(const screen of body.screens){if(!screen||typeof screen!=='object'||screen.screens!==undefined||screen.separate||typeof screen.name!=='string'||screen.name.length>200)throw Error('Invalid screen export snapshot.');validate(require('./screen-export-batch.cjs').screenRequest(body,screen));}
  return body;
 }

 if(!body||typeof body.html!=='string'||Buffer.byteLength(body.html)>20*1024*1024)throw Error('The screen snapshot must be at most 20 MiB.');
 if(![body.width,body.height].every(n=>Number.isInteger(n)&&n>=1&&n<=7680)||!Number.isFinite(body.scale)||body.scale<0.01||body.scale>8||Math.min(body.width,body.height)*body.scale<1||Math.max(body.width,body.height)*body.scale>32768||Math.ceil(body.width*body.scale)*Math.ceil(body.height*body.scale)>64*1024*1024)throw Error('Choose a scale from 0.01× to 8×, with output dimensions from 1 to 32,768 pixels and at most 64 megapixels.');
 if(body.area!==undefined&&!['viewport','page','selection'].includes(body.area))throw Error('Choose visible viewport, full page or selected layers.');
 if(body.area==='selection'&&(!Array.isArray(body.selectionIds)||!body.selectionIds.length||body.selectionIds.length>10000||body.selectionIds.some(id=>typeof id!=='string'||!/^\d+$/.test(id))))throw Error('Choose at least one captured layer to export.');
 if(body.separate!==undefined&&typeof body.separate!=='boolean')throw Error('Invalid separate-layer export option.');
 if(body.separate&&(body.area!=='selection'||body.selectionIds.length>20||body.selectionNames!==undefined&&(!Array.isArray(body.selectionNames)||body.selectionNames.length!==body.selectionIds.length||body.selectionNames.some(name=>typeof name!=='string'||name.length>200))))throw Error('Separate export supports up to 20 selected layers with valid names.');
 if(body.format!==undefined&&!['png','jpeg','pdf'].includes(body.format))throw Error('Choose PNG, JPEG or PDF.');
 if(body.quality!==undefined&&(body.format!=='jpeg'||!Number.isInteger(body.quality)||body.quality<1||body.quality>100))throw Error('JPEG quality must be a whole number from 1 to 100.');
 if(body.transparent!==undefined&&(typeof body.transparent!=='boolean'||body.transparent&&body.format!==undefined&&body.format!=='png'))throw Error('Transparent background is available only for PNG.');
 const base=new URL(body.baseURL);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('The screen must have an HTTP or HTTPS address.');
 if(!Array.isArray(body.fontFaces)||body.fontFaces.length>256||body.fontFaces.some(f=>typeof f.css!=='string'||f.css.length>2*1024*1024||typeof f.base!=='string'))throw Error('A font definition is unavailable. Export after its stylesheet is readable.');
 if(!Array.isArray(body.scroll)||body.scroll.length>10000||body.scroll.some(s=>!/^\d+$/.test(s.id)||![s.x,s.y].every(Number.isFinite))||!body.rootScroll||![body.rootScroll.x,body.rootScroll.y].every(Number.isFinite))throw Error('Invalid screen scroll positions.');
 return body;
}
async function render(body,{browserType,signal}={}){
 validate(body);let browser;const cancel=()=>browser?.close().catch(()=>{});signal?.throwIfAborted();signal?.addEventListener('abort',cancel,{once:true});
 try{
  browser=await (browserType||require('playwright').chromium).launch(browserType?{}:require('./capture-browser.cjs').launchOptions());signal?.throwIfAborted();
  if(body.separate||body.screens)return await require('./screen-export-batch.cjs').renderBatch(body,{signal,render:(item,options)=>renderInBrowser(item,{browser,signal:options.signal})});
  return await renderInBrowser(body,{browser,signal});
 }finally{signal?.removeEventListener('abort',cancel);await browser?.close();}
}
async function renderInBrowser(body,{browser,signal}){
 let context,timer,timedOut=false;const cancel=()=> (context||browser).close().catch(()=>{});signal?.throwIfAborted();signal?.addEventListener('abort',cancel,{once:true});
 try{
  timer=setTimeout(()=>{timedOut=true;cancel();},30000);
  context=await browser.newContext({viewport:{width:body.width,height:body.height},deviceScaleFactor:body.scale,serviceWorkers:'block',acceptDownloads:false});signal?.throwIfAborted();if(timedOut)throw Error('Screen export timed out.');
  const page=await context.newPage(),failed=new Set();let requests=0;
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(!['http:','https:','data:'].includes(url.protocol)||req.method()!=='GET'||!['image','font','stylesheet','media'].includes(req.resourceType())||url.pathname.startsWith('/rt/')||++requests>256){failed.add('blocked');return route.abort();}return route.continue();});
  page.on('requestfailed',()=>failed.add('unavailable'));page.on('response',r=>{if(!r.ok())failed.add('unavailable');});
  const html=sanitize(body.html,{baseURL:body.baseURL});await page.setContent('<!doctype html><meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'; frame-src \'none\'; connect-src \'none\'">'+html,{waitUntil:'load',timeout:20000});
  for(const font of body.fontFaces){const css=rewrite(font.css,url=>new URL(url,font.base).href);await page.addStyleTag({content:css});}
  await page.evaluate(async state=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));if([...document.images].some(img=>!img.complete||!img.naturalWidth)||[...document.fonts].some(font=>font.status==='error'))throw Error('An image or font could not be loaded for export.');for(const item of state.scroll)document.querySelector('[data-capture-node="'+item.id+'"]')?.scrollTo({left:item.x,top:item.y,behavior:'instant'});scrollTo({left:state.rootScroll.x,top:state.rootScroll.y,behavior:'instant'});},{scroll:body.scroll,rootScroll:body.rootScroll});
  if(failed.size)throw Error('Some screen resources could not be loaded. No file was exported.');signal?.throwIfAborted();
  let clip;if(body.area==='page'){const height=await page.evaluate(()=>{scrollTo({left:0,top:0,behavior:'instant'});return Math.max(innerHeight,document.documentElement.scrollHeight,document.documentElement.offsetHeight,document.body.scrollHeight,document.body.offsetHeight);});if(!Number.isFinite(height)||height*body.scale>32768||Math.ceil(body.width*body.scale)*Math.ceil(height*body.scale)>64*1024*1024)throw Error('The full page exceeds the 64-megapixel or 32,768-pixel height limit. Try 1× or export the visible viewport.');clip={x:0,y:0,width:body.width,height};}
  if(body.area==='selection'){
   clip=await page.evaluate(require('./screen-export-selection.cjs'),body.selectionIds);
   if(Math.min(clip.width,clip.height)*body.scale<1||Math.max(clip.width,clip.height)*body.scale>32768||Math.ceil(clip.width*body.scale)*Math.ceil(clip.height*body.scale)>64*1024*1024)throw Error('Selected layers exceed the export dimension or 64-megapixel limit. Try a smaller scale.');
  }
  if(body.format==='pdf')return await require('./screen-export-pdf.cjs').renderPDF(page,body,clip);
  return await page.screenshot({type:body.format||'png',omitBackground:body.transparent===true,...(body.format==='jpeg'?{quality:body.quality??90}:{}),timeout:15000,...(clip?{fullPage:true,clip}:{})});
 }catch(error){if(timedOut)throw Error('Screen export timed out after 30 seconds. Try a smaller screen or 1×.');if(error.message?.startsWith('page.evaluate: '))throw Error(error.message.split('\n')[0].replace(/^page\.evaluate: (?:Error: )?/,''));throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);await context?.close();}
}
module.exports={validate,render};
