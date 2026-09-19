'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function bounded(action){let timer;try{return await Promise.race([action,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The page did not finish capture within 30 seconds.')),30000);})]);}finally{clearTimeout(timer);}}
async function capture({url,directory,width=1440,height=900,wait=1000,browserType,signal,responsive=false}){
 let address;try{address=new URL(url);}catch{throw Error('Choose an http or https page URL.');}
 if(!['http:','https:'].includes(address.protocol)||address.username||address.password)throw Error('Choose an http or https page URL without embedded credentials.');
 if(!directory)throw Error('Choose a new output directory with --out.');
 if(![width,height].every(value=>Number.isInteger(value)&&value>=240&&value<=7680))throw Error('Capture dimensions must be whole numbers from 240 to 7680.');
 if(!Number.isInteger(wait)||wait<0||wait>30000)throw Error('Capture wait must be from 0 to 30000 milliseconds.');
 const target=path.resolve(directory);if(fs.existsSync(target))throw Error('The output directory already exists. Choose a new directory.');
 const parent=fs.realpathSync(path.dirname(target));if(!fs.statSync(parent).isDirectory())throw Error('The output parent must be a directory.');
 let browser,staging;const cancel=()=>{browser?.close().catch(()=>{});};signal?.throwIfAborted();signal?.addEventListener('abort',cancel,{once:true});
 try{
  browser=await (browserType||require('playwright').chromium).launch(browserType?{}:require('./capture-browser.cjs').launchOptions());signal?.throwIfAborted();const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,colorScheme:'light',serviceWorkers:'block',acceptDownloads:false}),page=await context.newPage();const stylesheets=require('./capture-stylesheets.cjs').collect(page);
  const shadowKey='__retouchCapture'+crypto.randomUUID().replaceAll('-','');await page.addInitScript(require('./capture-shadow-roots.cjs'),shadowKey);
  const response=await page.goto(address.href,{waitUntil:'load',timeout:30000});if(!response?.ok())throw Error('Page capture failed: HTTP '+(response?.status()||'unavailable')+'.');
  await page.waitForTimeout(wait);await bounded(page.evaluate(()=>{void document.documentElement.offsetHeight;return Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]);}));
  const snapshot=await bounded(page.evaluate(require('./capture-document.cjs'),{shadowKey,responsive}));if(typeof snapshot.html!=='string')throw Error('The page did not return a captured document.');if(Buffer.byteLength(snapshot.html)>20*1024*1024)throw Error('The captured document exceeds 20 MiB.');
  const author=responsive?await bounded(stylesheets.resolveStyles(snapshot.styleSheets)):{styleSheets:[],warnings:[],stylesheetCache:[]};if(responsive&&(author.warnings.length||snapshot.warnings.includes('An author stylesheet was unreadable.')))throw Error('Responsive capture could not recover all author stylesheets. Try capture without --responsive, or turn off Keep responsive layout.');snapshot.warnings.push(...author.warnings);
  const recovered=await bounded(stylesheets.resolve(responsive&&!snapshot.shadowRoots?[]:snapshot.fontFaces,context));snapshot.fontFaces=recovered.fontFaces;snapshot.warnings.push(...recovered.warnings);
  snapshot.html=require('./capture-sanitize.cjs').sanitize(snapshot.html);
  staging=fs.mkdtempSync(path.join(parent,'.retouch-capture-'));const saved=await require('./capture-assets.cjs').localize({html:snapshot.html,fontFaces:snapshot.fontFaces,styleSheets:author.styleSheets,stylesheetCache:author.stylesheetCache,baseURL:snapshot.baseURL||snapshot.url,directory:staging,context,page,signal});snapshot.html=saved.html;
  const manifest={version:1,kind:'rendered-page-capture',styling:responsive?'author-stylesheets':'computed-snapshot',sourceUrl:snapshot.url,title:snapshot.title,capturedAt:new Date().toISOString(),viewport:{width,height},layers:snapshot.layers,shadowRoots:snapshot.shadowRoots,warnings:[...snapshot.warnings,...saved.warnings],assets:saved.assets,unresolvedReferences:saved.unresolvedReferences,limitations:[responsive?'Author CSS retains responsive layout; the captured DOM and application state remain fixed.':'Captured layout reflects one viewport and page state.','Application scripts and live interactions are not included.','Assets reported as remote still require access to the original site.','This project is an editable copy; changes do not update the original site.']};
  fs.writeFileSync(path.join(staging,'index.html'),snapshot.html,{flag:'wx'});fs.writeFileSync(path.join(staging,'capture.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  // Reserve the destination exclusively before moving files. Never replace an
  // existing project, including one created while the browser was working.
  signal?.throwIfAborted();fs.mkdirSync(target);try{for(const name of fs.readdirSync(staging))fs.renameSync(path.join(staging,name),path.join(target,name));}catch(error){fs.rmSync(target,{recursive:true,force:true});throw error;}
  return {directory:target,...manifest};
 }finally{signal?.removeEventListener('abort',cancel);if(staging)fs.rmSync(staging,{recursive:true,force:true});await browser?.close();}
}
module.exports={capture};
