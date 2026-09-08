'use strict';
// The adapter seam (DR-0015): the core depends only on this interface, so an
// adapter is contract-testable in isolation, and the Index works with any
// adapter passed in.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { getAdapter, defaultAdapter, register } = require('../src/adapter.cjs');
const { Index, makeApp, cleanup } = require('./helpers.cjs');

test('the default adapter is react and implements the interface', () => {
  const a = defaultAdapter();
  assert.strictEqual(a.name, 'react');
  for (const m of ['matches', 'stamp', 'collect', 'contentHash', 'describe', 'planOp', 'applyOp']) {
    assert.strictEqual(typeof a[m], 'function', `adapter.${m} is a function`);
  }
  assert.ok(a.capabilities && Array.isArray(a.capabilities.ops));
});

test('react.matches accepts tsx/jsx and rejects others and node_modules', () => {
  const a = getAdapter('react');
  assert.ok(a.matches('/app/Page.tsx'));
  assert.ok(a.matches('/app/Card.jsx'));
  assert.ok(!a.matches('/app/util.ts'));
  assert.ok(!a.matches('/app/node_modules/x/Y.tsx'));
});

test('the Index drives an arbitrary adapter, not JSX directly', () => {
  // A tiny fake adapter over a made-up ".lines" format: each non-empty line is
  // an element whose id is its line number. Proves the Index is language-blind.
  const fake = {
    name: 'lines',
    matches: (f) => f.endsWith('.lines'),
    collect: (src) => ({
      elements: src.split('\n').map((l, i) => ({ id: String(i).padStart(10, '0'), text: l }))
        .filter((e) => e.text.trim() !== ''),
    }),
    contentHash: (s) => 'h' + s.length,
    describe: (r) => ({ id: r.element.id, text: r.element.text }),
    applyOp: () => ({ ok: true, hash: 'x' }),
    stamp: () => null,
    capabilities: { ops: [] },
  };
  const root = makeApp({ 'a.lines': 'one\n\nthree', 'ignore.txt': 'x' });
  const idx = new Index(root, fake);
  const n = idx.scanAll();
  assert.strictEqual(n, 1); // only a.lines matched
  assert.strictEqual(idx.idToFile.size, 2); // "one" and "three"
  const r = idx.resolve('0000000000');
  assert.strictEqual(r.element.text, 'one');
  assert.strictEqual(r.hash, 'h' + 'one\n\nthree'.length);
  cleanup(root);
});

test('unknown adapter name throws', () => {
  assert.throws(() => getAdapter('does-not-exist'));
});

test('the HTTP core handles component, assets, multi-file edits and undo for an unknown language', async t => {
  const fs = require('node:fs');
  const { once } = require('node:events');
  const { startServer } = require('../src/server.cjs');
  const root = makeApp({'screen.lines':'Original\n','backing.data':'Backing\n','media/logo.svg':'<svg/>'});
  const adapter = {
    name:'contract-language', matches:file=>file.endsWith('.lines'), contentHash:source=>'hash:'+source,
    collect:()=>({elements:[{id:'1234567890',kind:'instance'}]}),
    describe:r=>({id:r.element.id,kind:'instance',file:r.relPath,hash:r.hash,text:r.source}),
    describeComponent:()=>({ok:true,name:'Example',props:[],definitionId:'1234567890'}),
    assets:{directory:'media',urlPrefix:'/pictures/',uploadDirectory:'added'},
    planOp:r=>({ok:true,hash:'hash:Edited\n',edits:[
      {file:r.file,before:r.source,after:'Edited\n'},
      {file:path.join(root,'backing.data'),before:'Backing\n',after:'Updated backing\n'},
    ]}),
  };
  const server=startServer({appRoot:root,port:0,adapter,quiet:true});await once(server,'listening');
  t.after(()=>{server.retouchIndex.close();server.close();cleanup(root);});
  const base='http://127.0.0.1:'+server.address().port;
  const shell=await(await fetch(base+'/rt')).text();
  const headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'};
  const get=async route=>(await fetch(base+route,{headers})).json();
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  assert.strictEqual((await get('/rt/__api/component?id=1234567890')).name,'Example');
  assert.strictEqual((await get('/rt/__api/images')).images[0].src,'/pictures/logo.svg');
  const uploaded=await(await fetch(base+'/rt/__api/upload?name=test.svg',{method:'POST',headers,body:'<svg/>'})).json();
  assert.ok(uploaded.src.startsWith('/pictures/added/'));
  const result=await post({type:'example',id:'1234567890'});assert.ok(result.ok);assert.ok(result.undoId);
  assert.strictEqual(fs.readFileSync(path.join(root,'backing.data'),'utf8'),'Updated backing\n');
  assert.ok((await post({type:'undo',undoId:result.undoId})).ok);
  assert.strictEqual(fs.readFileSync(path.join(root,'screen.lines'),'utf8'),'Original\n');
  assert.strictEqual(fs.readFileSync(path.join(root,'backing.data'),'utf8'),'Backing\n');
});
