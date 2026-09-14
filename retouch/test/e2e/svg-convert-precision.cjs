'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),ids=require('../../src/id.cjs');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{
 const page=await browser.newPage(),cases=[];
 for(const kind of ['html','react','liquid'])for(const [tag,attributes]of [['circle','cx="200" cy="108" r="65.96968841552734"'],['ellipse','cx="200" cy="108" rx="65.96968841552734" ry="33.1122334455"'],['circle','cx="0.1234567" cy="-0.7654321" r="0.0356789"'],['ellipse','cx="-13.17892" cy="47.84613" rx="7.12345678" ry="32.87654321"']]){
  const adapter=require('../../src/adapters/'+kind+'.cjs'),relPath='shape.'+(kind==='react'?'jsx':kind==='liquid'?'liquid':'html'),prefix=kind==='react'?'export default()=>':'',markup='<svg width="500" height="300" viewBox="-100 -100 500 300"><'+tag+' '+attributes+' fill="red" transform="rotate(17) scale(1.3 .7)"><title>Retained</title></'+tag+'><rect x="400" y="250" width="5" height="5"/></svg>',source=prefix+markup,elements=adapter.collect(source,relPath).elements,element=elements.find(e=>(kind==='react'?ids.jsxElementName(e.node):e.tag)===tag),resolved={source,elements,element,relPath,file:'/tmp/'+relPath,hash:ids.contentHash(source)},result=adapter.planOp(resolved,{type:'convertSVGToPath',fileHash:resolved.hash});assert.ok(result.ok,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.deepEqual(adapter.collect(result.edits[0].after,relPath).elements.map(e=>e.id),elements.map(e=>e.id));cases.push({kind,tag,markup,after:result.edits[0].after.slice(prefix.length)});
 }
 let checks=0;for(const item of cases){await page.setContent('<div id="before">'+item.markup+'</div><div id="after">'+item.after+'</div>');const result=await page.evaluate(({tag})=>{
  const before=document.querySelector('#before '+tag),after=document.querySelector('#after path'),a=before.getBBox(),b=after.getBBox(),failures=[];let checks=0;
  for(const key of ['x','y','width','height'])if(Math.abs(a[key]-b[key])>.002)failures.push({key,before:a[key],after:b[key]});
  for(let x=0;x<31;x++)for(let y=0;y<31;y++){const p=new DOMPoint(a.x+(x+.17)*a.width/31,a.y+(y+.29)*a.height/31);checks++;if(before.isPointInFill(p)!==after.isPointInFill(p))failures.push({x,y});}
  return {checks,failures,title:after.querySelector('title').textContent,transform:after.getAttribute('transform'),fill:getComputedStyle(after).fill};
 },item);assert.deepEqual(result.failures,[],item.kind+' '+item.tag+' native geometry mismatch');assert.equal(result.title,'Retained');assert.equal(result.transform,'rotate(17) scale(1.3 .7)');assert.equal(result.fill,'rgb(255, 0, 0)');checks+=result.checks;}
 console.log(engine+': PASS '+cases.length+' HTML/React/Liquid source conversions, '+checks+' native SVG fill checks, fractional bounds, paint, transforms, metadata and stable source identities');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
