'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),html=require('../../src/adapters/html.cjs'),groups=require('../../src/svg-boolean-group.cjs'),geometry=require('../../shell/svg-path.js'),boolean=require('../../shell/svg-boolean.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',sharp=require(path.join(fixture,'node_modules/sharp'));
const source='<html><body style="margin:0"><svg width="80" height="50"><rect x="10" y="10" width="40" height="30" fill="red"/><rect x="30" y="10" width="40" height="30" fill="blue"/></svg></body></html>';
function resolve(text=source,id){const elements=html.collect(text,'index.html').elements;return {source:text,elements,element:id?elements.find(e=>e.id===id):elements.find(e=>e.tag==='rect'),hash:html.contentHash(text),file:'/tmp/boolean.html',relPath:'index.html'};}
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch(),page=await browser.newPage();try{
 for(const operation of ['union','subtract','intersect','exclude']){
  const result=boolean.combineShapes([{document:geometry.parseCompound('M10 10H50V40H10Z')},{document:geometry.parseCompound('M30 10H70V40H30Z')}],operation);assert.equal(result.ok,true,result.reason);
  const r=resolve(),made=groups.plan(r,{type:'createSVGBooleanGroup',fileHash:r.hash,ids:r.elements.filter(e=>e.tag==='rect').map(e=>e.id),operation,path:geometry.serializeCompound(result.document)},'html');assert.equal(made.ok,true,made.reason);
  await page.setContent(made.edits[0].after);assert.equal(await page.locator('[data-rt-boolean-operands] rect').count(),2);assert.equal(await page.locator('[data-rt-boolean-operands]').evaluate(el=>getComputedStyle(el).display),'none');
  const {data,info}=await sharp(await page.locator('svg').screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for(const x of [15,35,65]){const a=x<50,b=x>30,inside=operation==='union'?a||b:operation==='subtract'?a&&!b:operation==='intersect'?a&&b:a!==b;const offset=(20*info.width+x)*info.channels;assert.deepEqual([...data.subarray(offset,offset+3)],inside?[255,0,0]:[255,255,255],operation+' at '+x);}
  const fresh=resolve(made.edits[0].after,made.selectionIds[0]),released=groups.plan(fresh,{type:'releaseSVGBooleanGroup',fileHash:fresh.hash},'html');assert.equal(released.edits[0].after,source);
 }
 console.log(engine+': PASS standalone boolean group source renders all four operations with hidden retained operands and exact release');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
