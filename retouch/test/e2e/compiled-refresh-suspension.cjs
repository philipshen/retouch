'use strict';
const assert=require('node:assert/strict');
module.exports=async({page})=>{
 const result=await page.evaluate(async()=>{
  const info=sel?.info;if(!info?.renderRevisionAttribute)return null;
  const initial=doc(),originalNow=Object.getOwnPropertyDescriptor(performance,'now'),originalFetch=window.fetch,originalReload=reloadFrame;
  let clock=performance.now(),fetches=0,reloads=0;
  // A suspended tab can resume after the deadline with the correct revision
  // already rendered. Verify it before considering a destructive reload.
  Object.defineProperty(performance,'now',{configurable:true,value:()=>clock+=9000});
  window.fetch=(url,...args)=>{if(String(url)!==iframe.contentWindow.location.href)return originalFetch(url,...args);fetches++;return Promise.resolve({ok:true,text:async()=>initial.documentElement.outerHTML});};
  reloadFrame=async()=>{reloads++;};
  try{await refreshWrittenElement(info,()=>true);return {fetches,reloads,same:doc()===initial};}
  finally{if(originalNow)Object.defineProperty(performance,'now',originalNow);else delete performance.now;window.fetch=originalFetch;reloadFrame=originalReload;}
 });
 if(result){assert.deepEqual(result,{fetches:0,reloads:0,same:true});console.log('PASS compiled preview survives a clock gap without fetching or reloading a current revision');}
};
