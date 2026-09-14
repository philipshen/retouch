'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled,made})=>{
 const url=await app.locator('body').evaluate(()=>location.href),response=await page.request.get(url),stale=await response.text();let served=0;
 const route=async route=>{if(route.request().isNavigationRequest())return route.continue();served++;await route.fulfill({status:200,contentType:'text/html',body:stale});};
 await page.route(url,route);
 try{
  // Verify the stale-response route itself, even when live-first sync avoids HTTP.
  assert.equal(await page.evaluate(async url=>(await fetch(url)).text(),url),stale);
  const x=page.getByLabel('Vector X',{exact:true}),initial=Number(await x.inputValue());await x.fill(String(initial+20));await x.press('Tab');await settled();await wait(()=>read()!==made);
  assert.ok(served>0,'stale render fault must be exercised');assert.equal(await app.locator('[data-rt-boolean]').getAttribute('transform'),'matrix(1 0 0 1 20 0)');assert.equal(await app.locator('input').inputValue(),'retained state');assert.equal(await app.locator('input').evaluate(()=>window.booleanDocumentToken),'same document');
 }finally{await page.unroute(url,route);}
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===made);console.log('Stale server HTML with live React update: retained document/input and exact Undo PASS');
};
