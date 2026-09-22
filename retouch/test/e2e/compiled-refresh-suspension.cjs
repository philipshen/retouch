'use strict';
const assert=require('node:assert/strict');
module.exports=async({page})=>{
 for(const delivery of ['ready','pending','missing']){
 const result=await page.evaluate(async delivery=>{
  const info=sel?.info;if(!info?.renderRevisionAttribute)return null;
  const initial=doc(),originalNow=Object.getOwnPropertyDescriptor(performance,'now'),originalFetch=window.fetch,originalReload=reloadFrame,originalTimeout=window.setTimeout;
  let clock=performance.now(),fetches=0,reloads=0,probes=0;
  // A suspended tab can resume after the deadline with the correct revision
  // already rendered or queued for the next few browser tasks. A permanently
  // missing update must still exhaust its bounded wait and reach fallback.
  Object.defineProperty(performance,'now',{configurable:true,value:()=>clock+=9000});
  window.fetch=(url,...args)=>{if(String(url)!==iframe.contentWindow.location.href)return originalFetch(url,...args);fetches++;return Promise.resolve({ok:true,text:async()=>initial.documentElement.outerHTML});};
  reloadFrame=async()=>{reloads++;};
  if(delivery==='missing')window.setTimeout=(fn,delay,...args)=>originalTimeout(fn,[50,150].includes(delay)?0:delay,...args);
  try{await refreshWrittenElement(info,()=>{probes++;return delivery==='ready'||delivery==='pending'&&probes>2;});return {fetches,reloads,same:doc()===initial,probes};}
  finally{if(originalNow)Object.defineProperty(performance,'now',originalNow);else delete performance.now;window.fetch=originalFetch;reloadFrame=originalReload;window.setTimeout=originalTimeout;}
 },delivery);
 if(result){
  assert.equal(result.same,true);
  if(delivery==='missing'){assert.equal(result.reloads,1);assert.ok(result.fetches>0);assert.ok(result.probes<1000);}
  else {assert.equal(result.fetches,0);assert.equal(result.reloads,0);}
  console.log('PASS compiled preview clock gap: '+delivery+' delivery, '+(delivery==='missing'?'bounded fallback reached':'no fetch or reload'));
 }
 }
};
