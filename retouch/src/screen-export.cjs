'use strict';
const sanitize=require('./capture-sanitize.cjs').sanitize,rewrite=require('./capture-css-urls.cjs').rewrite;
function validate(body){
 if(!body||typeof body.html!=='string'||Buffer.byteLength(body.html)>20*1024*1024)throw Error('The screen snapshot must be at most 20 MiB.');
 if(![body.width,body.height].every(n=>Number.isInteger(n)&&n>=1&&n<=7680)||![1,2].includes(body.scale)||body.width*body.height*body.scale**2>64*1024*1024)throw Error('Choose 1× or 2× within the 64-megapixel export limit.');
 if(body.area!==undefined&&!['viewport','page'].includes(body.area))throw Error('Choose visible viewport or full page.');
 const base=new URL(body.baseURL);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('The screen must have an HTTP or HTTPS address.');
 if(!Array.isArray(body.fontFaces)||body.fontFaces.length>256||body.fontFaces.some(f=>typeof f.css!=='string'||f.css.length>2*1024*1024||typeof f.base!=='string'))throw Error('A font definition is unavailable. Export after its stylesheet is readable.');
 if(!Array.isArray(body.scroll)||body.scroll.length>10000||body.scroll.some(s=>!/^\d+$/.test(s.id)||![s.x,s.y].every(Number.isFinite))||!body.rootScroll||![body.rootScroll.x,body.rootScroll.y].every(Number.isFinite))throw Error('Invalid screen scroll positions.');
 return body;
}
async function render(body,{browserType,signal}={}){
 validate(body);let browser,timer,timedOut=false;const cancel=()=>browser?.close().catch(()=>{});signal?.throwIfAborted();signal?.addEventListener('abort',cancel,{once:true});
 try{
  browser=await (browserType||require('playwright').chromium).launch(browserType?{}:require('./capture-browser.cjs').launchOptions());signal?.throwIfAborted();timer=setTimeout(()=>{timedOut=true;cancel();},30000);
  const context=await browser.newContext({viewport:{width:body.width,height:body.height},deviceScaleFactor:body.scale,serviceWorkers:'block',acceptDownloads:false}),page=await context.newPage();const failed=new Set();let requests=0;
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(!['http:','https:','data:'].includes(url.protocol)||req.method()!=='GET'||!['image','font','stylesheet','media'].includes(req.resourceType())||url.pathname.startsWith('/rt/')||++requests>256){failed.add('blocked');return route.abort();}return route.continue();});
  page.on('requestfailed',()=>failed.add('unavailable'));page.on('response',r=>{if(!r.ok())failed.add('unavailable');});
  const html=sanitize(body.html,{baseURL:body.baseURL});await page.setContent('<!doctype html><meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'; frame-src \'none\'; connect-src \'none\'">'+html,{waitUntil:'load',timeout:20000});
  for(const font of body.fontFaces){const css=rewrite(font.css,url=>new URL(url,font.base).href);await page.addStyleTag({content:css});}
  await page.evaluate(async state=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));if([...document.images].some(img=>!img.complete||!img.naturalWidth)||[...document.fonts].some(font=>font.status==='error'))throw Error('An image or font could not be loaded for export.');for(const item of state.scroll)document.querySelector('[data-capture-node="'+item.id+'"]')?.scrollTo({left:item.x,top:item.y,behavior:'instant'});scrollTo({left:state.rootScroll.x,top:state.rootScroll.y,behavior:'instant'});},{scroll:body.scroll,rootScroll:body.rootScroll});
  if(failed.size)throw Error('Some screen resources could not be loaded. No image was exported.');signal?.throwIfAborted();
  let clip;if(body.area==='page'){const height=await page.evaluate(()=>{scrollTo({left:0,top:0,behavior:'instant'});return Math.max(innerHeight,document.documentElement.scrollHeight,document.documentElement.offsetHeight,document.body.scrollHeight,document.body.offsetHeight);});if(!Number.isFinite(height)||height*body.scale>32768||body.width*height*body.scale**2>64*1024*1024)throw Error('The full page exceeds the 64-megapixel or 32,768-pixel height limit. Try 1× or export the visible viewport.');clip={x:0,y:0,width:body.width,height};}
  return await page.screenshot({type:'png',timeout:15000,...(clip?{fullPage:true,clip}:{})});
 }catch(error){if(timedOut)throw Error('Screen export timed out after 30 seconds. Try a smaller screen or 1×.');throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);await browser?.close();}
}
module.exports={validate,render};
