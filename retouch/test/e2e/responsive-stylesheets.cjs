'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{const browser=await browserType.launch(),page=await browser.newPage();try{
 const responses={
  '/':'<link id="external" rel="stylesheet" href="/outer.css" media="(min-width:700px)"><link rel="stylesheet" href="http://retouch-assets.test/opaque.css"><style>@import url("/inner.css") (max-width:400px);div{opacity:1}</style><div class="imported:opacity">Imported</div><div class="nestedimport:opacity">Nested</div><div class="adopted:opacity">Adopted</div><div class="opaque:opacity">Opaque</div>',
  '/outer.css':'@import url("/inner.css") (min-height:800px);.imported\\:opacity{opacity:.5}',
  '/inner.css':'.nestedimport\\:opacity{opacity:.25}'
 };
 await page.route('http://retouch-css.test/**',route=>{const url=new URL(route.request().url());return route.fulfill({status:200,contentType:url.pathname.endsWith('.css')?'text/css':'text/html',body:responses[url.pathname]||''});});
 await page.route('http://retouch-assets.test/**',route=>route.fulfill({status:200,contentType:'text/css',body:'@media(min-width:1px){.opaque\\:opacity{opacity:.2}}'}));
 await page.goto('http://retouch-css.test/');await page.addScriptTag({path:path.resolve(__dirname,'../../shell/responsive.js')});
 await page.evaluate(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync('@media(min-width:900px){.adopted\\:opacity{opacity:.75}}');document.adoptedStyleSheets=[sheet];});
 for(const [width,height] of [[390,844],[768,700],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});const state=await page.evaluate(()=>{const choices=RetouchResponsive.discover(document);return{choices,items:[...document.querySelectorAll('div:not(.opaque\\:opacity)')].map(el=>{const prefix=el.className.split(':')[0]+':';return{prefix,applies:RetouchResponsive.matches(choices.find(c=>c.prefix===prefix),window),opacity:getComputedStyle(el).opacity};}),opaqueOpacity:getComputedStyle(document.querySelector('.opaque\\:opacity')).opacity};});
  assert.deepEqual(state.choices.map(c=>c.prefix),['adopted:','imported:','nestedimport:']);assert.equal(state.opaqueOpacity,'0.2');for(const item of state.items)assert.equal(item.applies,item.opacity!=='1',JSON.stringify({width,height,item}));
  assert.equal(state.choices.find(c=>c.prefix==='imported:').queries[0].length,1,'stylesheet and import media must not duplicate');
 }
 await page.evaluate(()=>{document.getElementById('external').disabled=true;document.adoptedStyleSheets=[];});
 const changed=await page.evaluate(()=>({choices:RetouchResponsive.discover(document),opacity:getComputedStyle(document.querySelector('.imported\\:opacity')).opacity}));assert.deepEqual(changed.choices.map(c=>c.prefix),['nestedimport:']);assert.equal(changed.opacity,'1');
 console.log(engine+': PASS imported/nested/shared stylesheets, document-adopted sheets, media restrictions, CSS agreement, disabled/removal updates and opaque stylesheet isolation');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
