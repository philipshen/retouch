'use strict';
// Local renderer fixture; no Shopify account, remote theme, or existing app is used.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), {once} = require('node:events'), assert = require('node:assert/strict');
const {startServer} = require('../../src/server.cjs');
const liquid = require('../../src/adapters/liquid.cjs');
const {chromium} = require(process.env.RT_PLAYWRIGHT_MODULE || '/tmp/retouch-interaction-fixture/node_modules/playwright');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'retouch-render-sync-e2e-'));
  fs.mkdirSync(path.join(root,'layout'));
  const file = path.join(root,'layout/theme.liquid');
  fs.mkdirSync(path.join(root,'assets'));const cssFile=path.join(root,'assets/theme.css');fs.writeFileSync(cssFile,'h1{color:rgb(1,2,3)}');
  fs.writeFileSync(file,'<!doctype html><html><head><title>Local source sync</title><link rel="stylesheet" href="/assets/theme.css"></head><body><main><h1>Hello source</h1><p>Preserve this node</p></main></body></html>');
  const upstream = http.createServer((_req,res) => {
    if (new URL(_req.url,'http://localhost').pathname==='/assets/theme.css') {res.writeHead(200,{'content-type':'text/css','cache-control':'no-store'});res.end(fs.readFileSync(cssFile,'utf8'));return;}
    const source = fs.readFileSync(file,'utf8');
    const stamped = liquid.stamp(source,file,root)?.code || source;
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
    res.end(stamped.replace('</head>','<script id="hot-reload-client">window.__upstreamReloadClientRan = true;</script></head>'));
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const server = startServer({appRoot:root,adapter:liquid,port:0,quiet:true,proxyTo:`http://127.0.0.1:${upstream.address().port}`,rendering:{reloadAfterWrite:true}});
  await once(server,'listening');
  let browser;
  try {
    browser = await chromium.launch({headless:true});const page = await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/rt`);
    const heading=page.frameLocator('#app').locator('h1');await heading.waitFor();
    await page.evaluate(() => { window.__originalFrameDocument=document.getElementById('app').contentDocument;window.__originalSibling=window.__originalFrameDocument.querySelector('p'); });
    assert.equal(await page.evaluate(() => document.getElementById('app').contentWindow.__upstreamReloadClientRan),undefined);
    await heading.click();await page.frameLocator('#app').locator('h1[contenteditable=true]').waitFor();await heading.fill('Saved without navigation');await heading.press('Enter');
    await page.waitForFunction(() => document.getElementById('app').contentDocument.querySelector('h1')?.textContent==='Saved without navigation' && !document.getElementById('app').contentDocument.querySelector('h1').hasAttribute('contenteditable'));
    assert.match(fs.readFileSync(file,'utf8'),/Saved without navigation/);
    assert.equal(await page.evaluate(() => document.getElementById('app').contentDocument===window.__originalFrameDocument && document.getElementById('app').contentDocument.querySelector('p')===window.__originalSibling),true);
    await page.locator('#undoBtn').click();await heading.filter({hasText:'Hello source'}).waitFor();
    await page.locator('#redoBtn').click();await heading.filter({hasText:'Saved without navigation'}).waitFor();
    assert.equal(await page.evaluate(() => document.getElementById('app').contentDocument===window.__originalFrameDocument),true);
    fs.writeFileSync(cssFile,'h1{color:rgb(4,5,6)}');
    await page.waitForFunction(() => {const frame=document.getElementById('app');return frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector('h1')).color==='rgb(4, 5, 6)';});
    assert.equal(await page.locator('#previewStatus').isVisible(),false,'stylesheet compilation does not pause editing');
    await heading.click();await page.frameLocator('#app').locator('h1[contenteditable=true]').waitFor();await heading.fill('Uncommitted typing');
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('Saved without navigation','External source edit'));
    await page.locator('#previewStatus').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('#panelBody').evaluate(el=>el.inert),true);
    assert.equal(await heading.getAttribute('contenteditable'),null,'external changes cancel speculative inline editing');
    assert.match(fs.readFileSync(file,'utf8'),/External source edit/);
    assert.equal(await page.locator('#undoBtn').isDisabled(),true);
    assert.equal(await page.locator('#redoBtn').isDisabled(),true);
    await page.keyboard.press('Control+z');await page.keyboard.press('Meta+z');
    assert.match(fs.readFileSync(file,'utf8'),/External source edit/,'stale keyboard undo cannot alter source');
    assert.equal(await page.evaluate(() => document.getElementById('app').contentDocument===window.__originalFrameDocument),true);
    assert.deepEqual(errors,[]);
    console.log('PASS local Liquid: immediate source write, authoritative preview, undo/redo, retained document/sibling, suppressed upstream reload script, CSS refresh, canceled stale typing and blocked history');
  } finally {
    await browser?.close();server.retouchIndex.close();await new Promise(r=>server.close(r));await new Promise(r=>upstream.close(r));fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
