'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{once}=require('node:events'),{retouch}=require('../src/vite.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vite-plugin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'App.jsx'),source='export default function App(){return <main><h1>Hello</h1></main>}';fs.writeFileSync(file,source);return {root,file,source,config:{root,base:'/',command:'serve',server:{host:'127.0.0.1'}}};}
test('Vite stamps only project JSX in development and preserves the source',t=>{const {root,file,source,config}=fixture(t),plugin=retouch(),warnings=[],context={addWatchFile(){},warn:m=>warnings.push(m)};assert.equal(plugin.apply,'serve');plugin.configResolved(config);const outside=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vite-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.writeFileSync(path.join(outside,'Outside.jsx'),source);const stamped=plugin.transform.call(context,source,file);assert.match(stamped.code,/data-rt="[a-f0-9]{10}"/);assert.match(stamped.code,/virtual:retouch-group-scale.jsx/);assert.equal(fs.readFileSync(file,'utf8'),source);for(const id of [file+'?raw',path.join(root,'node_modules/Package.jsx'),path.join(outside,'Outside.jsx')])assert.equal(plugin.transform.call(context,source,id),null);assert.equal(plugin.transform.call(context,source,file,{ssr:true}),null);assert.equal(plugin.transform.call(context,'<broken',file),null);assert.equal(warnings.length,1);plugin.configResolved({...config,command:'build'});assert.equal(plugin.transform.call(context,source,file),null);assert.equal(plugin.resolveId('virtual:retouch-group-scale.jsx'),undefined);});
test('Vite refuses reserved or malformed bases and externally bound editor hosts',t=>{const {config}=fixture(t);for(const change of [{base:'/rt/'},{base:'/%72t/'},{base:'//other/'},{base:'/docs/?x'},{base:'/a/../b/'},{server:{host:true}},{server:{host:'0.0.0.0'}}])assert.throws(()=>retouch().configResolved({...config,...change}),/\[retouch\]/);});
test('Vite same-origin middleware preserves API authentication and closes cleanly',async t=>{const {config}=fixture(t),plugin=retouch();plugin.configResolved(config);let middleware;const server=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end('app route');}));t.after(async()=>{await plugin.closeBundle();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});await plugin.configureServer({middlewares:{use(fn){middleware=fn;}},httpServer:server,config:{logger:{info(){}}}});server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(url+'/rt/__api/health')).status,200);assert.equal((await fetch(url+'/rtother')).status,404);const shell=await fetch(url+'/rt');assert.equal(shell.status,200);assert.match(await shell.text(),/Retouch/);assert.equal((await fetch(url+'/rt/__api/op',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);});

test('Vite base paths route the editor to the app while preserving query and API paths',async t=>{
 const {config}=fixture(t),plugin=retouch();plugin.configResolved({...config,base:'/docs/'});
 let middleware,announced='';const server=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end('app route');}));
 t.after(async()=>{await plugin.closeBundle();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 await plugin.configureServer({middlewares:{use(fn){middleware=fn;}},httpServer:server,config:{logger:{info(message){announced=message;}}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;
 assert.match(announced,/\/rt\/docs\/$/);
 for(const start of ['/rt','/rt/']){const response=await fetch(url+start+'?page=2&x=%2F',{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),'/rt/docs/?page=2&x=%2F');}
 assert.equal((await fetch(url+'/rt/docs/')).status,200);
 assert.equal((await fetch(url+'/rt/docs/nested?x=1')).status,200);
 assert.equal((await fetch(url+'/rt/__api/health')).status,200);
 assert.equal((await fetch(url+'/docs/')).status,404);
});
test('Vite uploads respect custom, disabled, and external public directories',async t=>{
 for(const mode of ['custom','disabled','external'])await t.test(mode,async t=>{
  const {root,config}=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vite-assets-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const plugin=retouch();plugin.configResolved({...config,base:'/docs/',publicDir:mode==='custom'?path.join(root,'static'):mode==='disabled'?'':outside});
  let middleware;const server=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));
  t.after(async()=>{await plugin.closeBundle();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  await plugin.configureServer({middlewares:{use(fn){middleware=fn;}},httpServer:server,config:{logger:{info(){}}}});server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;
  const shell=await (await fetch(url+'/rt/docs/')).text(),token=shell.match(/window\.__RT_TOKEN = "([^"]+)"/)[1];
  const response=await fetch(url+'/rt/__api/upload?name=test.svg',{method:'POST',headers:{'x-retouch-token':token},body:'<svg/>'}),data=await response.json();
  assert.equal(response.status,mode==='custom'?200:409);
  if(mode==='custom'){assert.ok(data.src.startsWith('/docs/rt-assets/'));assert.equal(fs.readFileSync(path.join(root,'static/rt-assets',path.basename(data.src)),'utf8'),'<svg/>');const image=await fetch(url+data.src);assert.equal(image.headers.get('content-type'),'image/svg+xml');assert.equal(await image.text(),'<svg/>');const head=await fetch(url+data.src,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');const secret=path.join(outside,'private.svg');fs.writeFileSync(secret,'private');const alias='rt-abcdefabcdef-secret.svg';fs.symlinkSync(secret,path.join(root,'static/rt-assets',alias));assert.equal((await fetch(url+'/docs/rt-assets/'+alias)).status,404);assert.equal((await fetch(url+'/docs/rt-assets/arbitrary.svg')).status,404);}
  else {assert.equal(fs.existsSync(path.join(root,'public')),false);assert.deepEqual(fs.readdirSync(outside),[]);}
 });
});
