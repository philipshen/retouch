'use strict';
// Integration test: boots the real sidecar against a temp app and drives
// the HTTP API exactly as the shell does — resolve, op, upload, and the R-9
// security checks. No browser, no Next build; runs in well under a second.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { makeApp, cleanup, SRC } = require('./helpers.cjs');
const { startServer } = require(path.join(SRC, 'server.cjs'));

const APP = `export function Page() {
  return (
    <main className="p">
      <h2 className="text-lg">Hello</h2>
      <img src="/a.png" />
    </main>
  );
}
`;

let root, server, port, token;

before(async () => {
  root = makeApp({ 'app/Page.tsx': APP, 'public/.keep': '' });
  // The sidecar prints its token; capture it by reading the shell HTML.
  const origLog = console.log;
  console.log = () => {};
  port = 3900 + Math.floor(Math.random() * 90);
  server = startServer({ appRoot: root, port });
  console.log = origLog;
  await waitReady(port);
  const shell = await req(port, 'GET', '/rt');
  token = /__RETOUCH_TOKEN__|__RT_TOKEN = "([0-9a-f]+)"/.exec(shell.body)[1];
});

after(() => {
  if (server.retouchIndex) server.retouchIndex.close();
  server.close();
  cleanup(root);
});

function req(port, method, p, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: headers || {} }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function waitReady(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await req(port, 'GET', '/rt/__api/health');
      if (r.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('sidecar did not start');
}

const AUTH = () => ({ 'x-retouch-token': token, 'content-type': 'application/json' });

test('style undo restores exact source and refuses to overwrite a later external edit', async () => {
  const file = path.join(root, 'app/Page.tsx');
  const original = fs.readFileSync(file, 'utf8');
  const id = await firstIdOfTag('h2');
  const run = async body => JSON.parse((await req(port, 'POST', '/rt/__api/op', { body: JSON.stringify(body), headers: AUTH() })).body);
  const resolved = JSON.parse((await req(port, 'GET', '/rt/__api/resolve?id=' + id, { headers: AUTH() })).body).element;
  const saved = await run({ type: 'setClasses', id, classes: 'opacity-[0.4] shadow-lg', fileHash: resolved.hash });
  assert.ok(saved.undoId);
  assert.ok((await run({ type: 'undo', undoId: saved.undoId })).ok);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), original);
  const second = await run({ type: 'setClasses', id, classes: 'opacity-[0.6]', fileHash: resolved.hash });
  fs.appendFileSync(file, '\n// external change\n');
  const changed = fs.readFileSync(file, 'utf8');
  assert.strictEqual((await run({ type: 'undo', undoId: second.undoId })).ok, false);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), changed);
  fs.unlinkSync(file);
  assert.strictEqual((await run({ type: 'undo', undoId: second.undoId })).ok, false, 'missing source refuses without stopping the server');
  fs.writeFileSync(file, original);
});

test('image browser lists project assets and requires authentication', async () => {
  fs.writeFileSync(path.join(root, 'public', 'sample.svg'), '<svg/>');
  const denied = await req(port, 'GET', '/rt/__api/images');
  assert.strictEqual(denied.status, 401);
  const result = await req(port, 'GET', '/rt/__api/images', { headers: AUTH() });
  assert.ok(JSON.parse(result.body).images.some(image => image.src === '/sample.svg'));
});

async function firstIdOfTag(tag) {
  const src = fs.readFileSync(path.join(root, 'app/Page.tsx'), 'utf8');
  const { collectElements } = require(path.join(SRC, 'id.cjs'));
  const el = collectElements(src, 'app/Page.tsx').elements.find(
    (e) => e.node.openingElement.name.name === tag
  );
  return el.id;
}

test('health identifies Retouch without a token', async () => {
  const r = await req(port, 'GET', '/rt/__api/health');
  assert.strictEqual(r.status, 200);
  assert.equal(JSON.parse(r.body).service, 'retouch');
});

test('resolve without the token is rejected', async () => {
  const id = await firstIdOfTag('h2');
  const r = await req(port, 'GET', '/rt/__api/resolve?id=' + id);
  assert.notStrictEqual(r.status, 200);
});

test('resolve with the token returns the element description', async () => {
  const id = await firstIdOfTag('h2');
  const r = await req(port, 'GET', '/rt/__api/resolve?id=' + id, { headers: AUTH() });
  const el = JSON.parse(r.body).element;
  assert.strictEqual(el.className, 'text-lg');
  assert.strictEqual(el.text, 'Hello');
});

test('a non-loopback Host header is rejected (anti DNS-rebind)', async () => {
  const id = await firstIdOfTag('h2');
  const r = await req(port, 'GET', '/rt/__api/resolve?id=' + id, {
    headers: { ...AUTH(), host: 'evil.example.com' },
  });
  assert.strictEqual(r.status, 403);
});

test('a class op writes back and reports a new hash', async () => {
  const id = await firstIdOfTag('h2');
  const got = JSON.parse((await req(port, 'GET', '/rt/__api/resolve?id=' + id, { headers: AUTH() })).body);
  const r = await req(port, 'POST', '/rt/__api/op', {
    headers: AUTH(),
    body: JSON.stringify({ type: 'setClasses', id, classes: 'text-xl', fileHash: got.element.hash }),
  });
  const out = JSON.parse(r.body);
  assert.ok(out.ok);
  assert.match(fs.readFileSync(path.join(root, 'app/Page.tsx'), 'utf8'), /className="text-xl"/);
});

test('an op without the token is rejected', async () => {
  const id = await firstIdOfTag('img');
  const r = await req(port, 'POST', '/rt/__api/op', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'setSrc', id, src: '/x.png', fileHash: 'x' }),
  });
  assert.notStrictEqual(r.status, 200);
});

test('upload stores under public/rt-assets and returns a root-relative src', async () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const r = await req(port, 'POST', '/rt/__api/upload?name=logo.png', {
    headers: { 'x-retouch-token': token, 'content-type': 'image/png' },
    body: png,
  });
  const out = JSON.parse(r.body);
  assert.ok(out.ok);
  assert.match(out.src, /^\/rt-assets\//);
  assert.ok(fs.existsSync(path.join(root, 'public', out.src.replace(/^\//, ''))));
});

test('React batch class API saves and restores all selected layers as one source transaction', async () => {
  const file=path.join(root,'app/Page.tsx'),original=fs.readFileSync(file,'utf8'),id=await firstIdOfTag('h2'),other=await firstIdOfTag('img');
  const run=async body=>JSON.parse((await req(port,'POST','/rt/__api/op',{body:JSON.stringify(body),headers:AUTH()})).body);
  const resolve=async target=>JSON.parse((await req(port,'GET','/rt/__api/resolve?id='+target,{headers:AUTH()})).body).element;
  const selected=await resolve(id),operation={type:'setClassesSelection',id,ids:[id,other],fileHash:selected.hash,classesById:{[id]:'text-lg md:opacity-[0.4]',[other]:'md:opacity-[0.7]'}};
  const invalid=await run({...operation,classesById:{...operation.classesById,[other]:'bad" token'}});assert.strictEqual(invalid.refused,true);assert.strictEqual(fs.readFileSync(file,'utf8'),original);
  const saved=await run(operation);assert.ok(saved.ok);assert.ok(saved.undoId);assert.deepStrictEqual(saved.selection.map(e=>e.id),[id,other]);assert.ok(saved.selection.every(e=>e.hash===saved.hash));
  const after=fs.readFileSync(file,'utf8');assert.notStrictEqual(after,original);assert.strictEqual((await resolve(other)).className,'md:opacity-[0.7]');assert.strictEqual((await resolve(id)).hash,saved.hash);
  const stale=await run(operation);assert.strictEqual(stale.refused,true);assert.strictEqual(fs.readFileSync(file,'utf8'),after);
  const noop=await run({...operation,fileHash:saved.hash});assert.ok(noop.ok);assert.strictEqual(noop.undoId,undefined);assert.strictEqual(fs.readFileSync(file,'utf8'),after);
  assert.ok((await run({type:'undo',undoId:saved.undoId})).ok);assert.strictEqual(fs.readFileSync(file,'utf8'),original);
  assert.ok((await run({type:'redo',undoId:saved.undoId})).ok);assert.strictEqual(fs.readFileSync(file,'utf8'),after);
  fs.appendFileSync(file,'\n// external edit\n');const external=fs.readFileSync(file,'utf8');assert.strictEqual((await run({type:'undo',undoId:saved.undoId})).ok,false);assert.strictEqual(fs.readFileSync(file,'utf8'),external);
  fs.writeFileSync(file,after);assert.ok((await run({type:'undo',undoId:saved.undoId})).ok);assert.strictEqual(fs.readFileSync(file,'utf8'),original);
});

test('shell state scope isolates projects and changes session identity on a fresh sidecar',async()=>{
 const scope=body=>JSON.parse(/window\.__RT_RENDERING = (.*);<\/script>/.exec(body)[1]).stateScope,first=scope((await req(port,'GET','/rt')).body);
 assert.match(first.project,/^[a-f0-9]{64}$/);assert.match(first.session,/^[a-f0-9]{64}$/);
 assert.equal(first.project,require('node:crypto').createHash('sha256').update(fs.realpathSync(root)).digest('hex'));
 assert.deepEqual(scope((await req(port,'GET','/rt/another')).body),first);
 const otherRoot=makeApp({'app/Page.tsx':APP});
 for(const appRoot of [root,otherRoot]){
  const next=startServer({appRoot,port:0,quiet:true});
  try{await new Promise(resolve=>next.once('listening',resolve));const fresh=scope((await req(next.address().port,'GET','/rt')).body);assert.notEqual(fresh.session,first.session);assert.equal(fresh.project===first.project,appRoot===root);}
  finally{next.retouchIndex.close();await new Promise(resolve=>next.close(resolve));}
 }
 cleanup(otherRoot);
});

test('font metadata API authenticates and parses bytes without writing assets or source',async()=>{
 const bytes=Buffer.alloc(64);bytes.writeUInt32BE(0x10000,0);bytes.writeUInt16BE(1,4);bytes.write('fvar',12);bytes.writeUInt32BE(28,20);bytes.writeUInt32BE(36,24);bytes.writeUInt16BE(1,28);bytes.writeUInt16BE(16,32);bytes.writeUInt16BE(1,36);bytes.writeUInt16BE(20,38);bytes.write('wght',44);[100,400,900].forEach((value,i)=>bytes.writeInt32BE(value*65536,48+i*4));
 const endpoint='/rt/__api/font-axes',headers={'x-retouch-token':token,'content-type':'application/octet-stream'},source=fs.readFileSync(path.join(root,'app/Page.tsx'),'utf8'),files=fs.readdirSync(root,{recursive:true}).sort();
 const denied=await req(port,'POST',endpoint,{body:bytes});assert.notEqual(denied.status,200);
 const method=await req(port,'GET',endpoint,{headers});assert.equal(method.status,405);
 const result=await req(port,'POST',endpoint,{headers,body:bytes});assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body),{ok:true,axes:[{tag:'wght',name:'wght',min:100,default:400,max:900,hidden:false}],instances:[]});
 const malformed=await req(port,'POST',endpoint,{headers,body:Buffer.from('not a font')});assert.equal(malformed.status,422);assert.equal(JSON.parse(malformed.body).ok,false);
 assert.equal(fs.readFileSync(path.join(root,'app/Page.tsx'),'utf8'),source);assert.deepEqual(fs.readdirSync(root,{recursive:true}).sort(),files);
});
test('oversized binary metadata and image uploads return usable 413 responses',async()=>{
 for(const [endpoint,limit]of [['/rt/__api/font-axes',16*1024*1024],['/rt/__api/upload?name=too-large.png',10000000]]){
  const result=await req(port,'POST',endpoint,{headers:{'x-retouch-token':token},body:Buffer.alloc(limit+1)});assert.equal(result.status,413);assert.equal(JSON.parse(result.body).ok,false);
 }
 const health=await req(port,'GET','/rt/__api/health');assert.equal(health.status,200);
});

test('text style API authenticates, persists and rejects stale or malformed writes', async () => {
 const endpoint='/rt/__api/text-styles';
 assert.strictEqual((await req(port,'GET',endpoint)).status,401);
 const initial=await req(port,'GET',endpoint,{headers:AUTH()});assert.strictEqual(initial.status,200);
 const post=body=>req(port,'POST',endpoint,{headers:AUTH(),body:JSON.stringify(body)});
 const created=await post({type:'create',revision:JSON.parse(initial.body).revision,name:'Title',properties:{'font-size':'32px','font-weight':'700'}});
 assert.strictEqual(created.status,200);const style=JSON.parse(created.body);
 assert.strictEqual(JSON.parse((await req(port,'GET',endpoint,{headers:AUTH()})).body).styles[0].id,style.id);
 assert.strictEqual((await post({type:'delete',revision:null,id:style.id})).status,409);
 assert.strictEqual((await req(port,'POST',endpoint,{headers:AUTH(),body:'{'})).status,400);
 assert.strictEqual((await req(port,'POST',endpoint,{headers:AUTH(),body:' '.repeat(512*1024+1)})).status,413);
 assert.strictEqual((await req(port,'DELETE',endpoint,{headers:AUTH()})).status,405);
 assert.strictEqual((await post({type:'delete',revision:style.revision,id:style.id})).status,200);
});

test('catalog mutations participate in shared exact-byte undo and redo',async()=>{
 const endpoint='/rt/__api/text-styles',file=path.join(root,'.retouch/text-styles.json'),before=fs.readFileSync(file,'utf8');
 const initial=JSON.parse((await req(port,'GET',endpoint,{headers:AUTH()})).body);
 const created=JSON.parse((await req(port,'POST',endpoint,{headers:AUTH(),body:JSON.stringify({type:'create',revision:initial.revision,name:'History style',properties:{'font-size':'24px'}})})).body);
 assert.ok(created.undoId);const after=fs.readFileSync(file,'utf8');
 for(const [type,expected]of [['undo',before],['redo',after]]){
  const result=await req(port,'POST','/rt/__api/op',{headers:AUTH(),body:JSON.stringify({type,undoId:created.undoId})});assert.strictEqual(result.status,200);assert.strictEqual(fs.readFileSync(file,'utf8'),expected);
 }
});

test('React text style API applies a scoped link and restores exact source through undo',async()=>{
 const id=await firstIdOfTag('h2'),resolved=JSON.parse((await req(port,'GET','/rt/__api/resolve?id='+id,{headers:AUTH()})).body).element;
 const library=JSON.parse((await req(port,'GET','/rt/__api/text-styles',{headers:AUTH()})).body);
 const created=JSON.parse((await req(port,'POST','/rt/__api/text-styles',{headers:AUTH(),body:JSON.stringify({type:'create',revision:library.revision,name:'API linked style',properties:{'font-size':'36px','line-height':'1.2'}})})).body);
 const file=path.join(root,'app/Page.tsx'),before=fs.readFileSync(file,'utf8');
 const response=await req(port,'POST','/rt/__api/op',{headers:AUTH(),body:JSON.stringify({type:'applyTextStyle',id,fileHash:resolved.hash,scope:'md:',styleId:created.id,libraryRevision:created.revision})});assert.strictEqual(response.status,200);const applied=JSON.parse(response.body);assert.ok(applied.undoId);assert.strictEqual(applied.element.textStyleLinks['md:'].id,created.id);assert.ok(applied.element.className.includes('md:![font-size:36px]'));
 const undone=await req(port,'POST','/rt/__api/op',{headers:AUTH(),body:JSON.stringify({type:'undo',undoId:applied.undoId})});assert.strictEqual(undone.status,200);assert.strictEqual(fs.readFileSync(file,'utf8'),before);
});
test('project component library requires a token and refreshes source-index discoveries',async()=>{
 const denied=await req(port,'GET','/rt/__api/components');assert.notEqual(denied.status,200);
 const file=path.join(root,'LibraryExample.tsx'),source='/** @retouch-component */\nfunction LibraryBadge(){return <aside/>} export default function Example(){return <LibraryBadge/>}';fs.writeFileSync(file,source);
 try{const response=await req(port,'GET','/rt/__api/components',{headers:{'X-Retouch-Token':token}});assert.equal(response.status,200,response.body);const data=JSON.parse(response.body),component=data.components.find(item=>item.name==='LibraryBadge');assert.ok(component);assert.equal(component.usageCount,1);assert.equal(component.file,'LibraryExample.tsx');assert.equal(fs.readFileSync(file,'utf8'),source);
  fs.unlinkSync(file);const refresh=await req(port,'GET','/rt/__api/components',{headers:{'X-Retouch-Token':token}});assert.equal(JSON.parse(refresh.body).components.some(item=>item.name==='LibraryBadge'),false);
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);}
});
