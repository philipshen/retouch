'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const {chromium}=require(path.join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/playwright')),browser=await chromium.launch({headless:true});try{const page=await browser.newPage();
 for(const language of ['react','liquid']){const adapter=require('../../src/adapters/'+language+'.cjs'),tag=e=>language==='react'?e.node.openingElement.name.name:e.tag;
  for(const [markup,selected,invalid]of [
   ['<main><section><button id="move">Move</button></section><button><div id="destination"></div></button></main>','button',true],
   ['<main><section><a id="move">Move</a></section><a><div id="destination"></div></a></main>','a',true],
   ['<main><section><li id="move">Move</li></section><ul><li><div id="destination"></div></li></ul></main>','li',true],
   ['<main><section><table id="move"><tr><td>Cell</td></tr></table></section><div id="destination"></div></main>','table',false],
   ['<main><section><svg id="move"><circle></circle></svg></section><div id="destination"></div></main>','svg',false]
  ]){const source=language==='react'?'const view='+markup:markup,relPath=language==='react'?'view.jsx':'view.liquid',elements=adapter.collect(source,relPath).elements,element=elements.find(e=>tag(e)===selected),destination=elements.find(e=>tag(e)==='div'),result=adapter.planOp({source,relPath,file:'/p/'+relPath,elements,element,hash:adapter.contentHash(source)},{type:'reparentElement',fileHash:adapter.contentHash(source),destinationId:destination.id});
   await page.setContent(markup);const originalParent=await page.locator('#destination').evaluate(el=>el.parentElement.tagName);const original=await page.locator('#move').evaluate(el=>({html:el.innerHTML,namespace:el.namespaceURI}));
   if(invalid){assert.equal(result.refused,true);assert.equal(result.edits,undefined);const moved=await page.locator('#move').evaluate(el=>el.outerHTML),proposed=markup.replace(moved,'').replace('<div id="destination">','<div id="destination">'+moved);await page.setContent(proposed);assert.equal(await page.locator('#destination').count()===1&&await page.locator('#move').count()===1&&await page.locator('#destination > #move').count()===1&&await page.locator('#destination').evaluate(el=>el.parentElement.tagName)===originalParent,false,language+' '+selected+' '+await page.locator('body').innerHTML());}
   else{assert.equal(result.ok,true,result.reason);await page.setContent(result.edits[0].after.replace(/^const view=/,''));assert.equal(await page.locator('#destination > #move').count(),1);assert.deepEqual(await page.locator('#move').evaluate(el=>({html:el.innerHTML,namespace:el.namespaceURI})),original);}
  }
 }
 console.log('PASS Chromium parent parsing agrees with React/Liquid refusals and preserves valid table/SVG subtrees');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
