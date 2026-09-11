'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { isMirrorRequest, stripReloadClient, watchSource } = require('../src/mirror-sync.cjs');
test('mirror opt-in is scoped by marker or same-origin editor referer', () => {
  const req = (url,referer) => ({url,headers:{host:'localhost:9400',referer}});
  assert.equal(isMirrorRequest(req('/')),false);
  assert.equal(isMirrorRequest(req('/?__rt_mirror=1')),true);
  assert.equal(isMirrorRequest(req('/','http://localhost:9400/rt')),true);
  assert.equal(isMirrorRequest(req('/','http://localhost:9400/products?__rt_mirror=1')),true);
  assert.equal(isMirrorRequest(req('/','http://other.test/rt')),false);
});
test('only Shopify reload script is removed and surrounding HTML preserved', () => {
  const html = `<head><script src="app.js"></script><script defer id='hot-reload-client' src='/cdn/shopifycloud/theme-hot-reload/theme-hot-reload.js'></script></head><body>hello</body>`;
  assert.equal(stripReloadClient(html), '<head><script src="app.js"></script></head><body>hello</body>');
});
test('source revision distinguishes exact editor writes from external JSON and CSS changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'retouch-source-watch-'));
  fs.writeFileSync(path.join(root,'index.json'),'old'); fs.writeFileSync(path.join(root,'theme.css'),'a{}');
  const watch = watchSource(root);
  try {
    const file=path.join(root,'index.json'); fs.writeFileSync(file,'editor');watch.acknowledge([{file,after:'editor'}]);watch.check('index.json');assert.equal(watch.state().revision,0);
    fs.writeFileSync(file,'external');watch.check('index.json');assert.equal(watch.state().revision,1);
    fs.writeFileSync(path.join(root,'theme.css'),'b{}');watch.check('theme.css');assert.equal(watch.state().revision,1);assert.equal(watch.state().styleRevision,1);
    watch.check('theme.css');assert.equal(watch.state().revision,1);assert.equal(watch.state().styleRevision,1);
    fs.writeFileSync(path.join(root,'uploaded.svg'),'<svg/>');watch.check('uploaded.svg');assert.equal(watch.state().revision,1);
  } finally { watch.close();fs.rmSync(root,{recursive:true,force:true}); }
});
test('proxy suppresses compressed Shopify reload client only in mirror and keeps upstream URLs clean', async t => {
  const http = require('node:http'), {once} = require('node:events'), zlib = require('node:zlib');
  const {startServer} = require('../src/server.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'retouch-mirror-proxy-'));
  const html = '<html><head><script id="hot-reload-client" src="/reload.js"></script><script src="/app.js"></script></head><body>preview</body></html>';
  let requested;
  const upstream = http.createServer((req,res) => {requested=req.url;res.writeHead(200,{'content-type':'text/html','content-encoding':'gzip'});res.end(zlib.gzipSync(html));});
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const server = startServer({appRoot:root,port:0,quiet:true,proxyTo:`http://127.0.0.1:${upstream.address().port}`,rendering:{reloadAfterWrite:true}});await once(server,'listening');
  t.after(() => {server.retouchIndex.close();server.close();upstream.close();fs.rmSync(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base+'/')).text(),html);
  const rendered=await (await fetch(base+'/?__rt_mirror=1')).text();
  assert.equal(requested,'/');assert.equal(rendered.includes('hot-reload-client'),false);assert.equal(rendered.includes('/app.js'),true);
  assert.equal((await fetch(base+'/rt/__api/source-revision')).status,401);
});
