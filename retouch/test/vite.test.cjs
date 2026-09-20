'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{once}=require('node:events'),{retouch:plugins}=require('../src/vite.cjs');
const retouch=options=>plugins(options)[0];
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vite-plugin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'App.jsx'),source='export default function App(){return <main><h1>Hello</h1></main>}';fs.writeFileSync(file,source);return {root,file,source,config:{root,base:'/',command:'serve',server:{host:'127.0.0.1'}}};}
test('Vite stamps only project JSX in development and preserves the source',t=>{const {root,file,source,config}=fixture(t),plugin=retouch(),warnings=[],context={addWatchFile(){},warn:m=>warnings.push(m)};assert.equal(plugin.apply,'serve');plugin.configResolved(config);const outside=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vite-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.writeFileSync(path.join(outside,'Outside.jsx'),source);const stamped=plugin.transform.call(context,source,file);assert.match(stamped.code,/data-rt="[a-f0-9]{10}"/);assert.match(stamped.code,/virtual:retouch-group-scale.jsx/);assert.equal(fs.readFileSync(file,'utf8'),source);for(const id of [file+'?raw',path.join(root,'node_modules/Package.jsx'),path.join(outside,'Outside.jsx')])assert.equal(plugin.transform.call(context,source,id),null);assert.equal(plugin.transform.call(context,source,file,{ssr:true}),null);assert.equal(plugin.transform.call(context,'<broken',file),null);assert.equal(warnings.length,1);plugin.configResolved({...config,command:'build'});assert.equal(plugin.transform.call(context,source,file),null);assert.equal(plugin.resolveId('virtual:retouch-group-scale.jsx'),undefined);});
test('Vite refuses reserved or malformed bases and externally bound editor hosts',t=>{const {config}=fixture(t);for(const change of [{base:'/rt/'},{base:'/%72t/'},{base:'//other/'},{base:'/docs/?x'},{base:'/a/../b/'},{server:{host:true}},{server:{host:'0.0.0.0'}}])assert.throws(()=>retouch().configResolved({...config,...change}),/\[retouch\]/);});
test('Vite Vue integration uses matching compiler options and preserves hot-template markers',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.vue'),source='<template><x-card><p>[[ title ]]</p></x-card></template>';
 fs.writeFileSync(file,source);
 const vue={name:'vite:vue',api:{options:{template:{compilerOptions:{isCustomElement:tag=>tag==='x-card',delimiters:['[[',']]']}}}}};
 const plugin=retouch();plugin.configResolved({...config,plugins:[vue]});
 const context={warn:message=>assert.fail(message)},initial=plugin.transform.call(context,source,file);
 assert.match(initial.code,/<x-card data-rt=/);assert.match(initial.code,/\[\[ title \]\]/);
 const update={file,read:async()=>source};plugin.handleHotUpdate(update);assert.equal(await update.read(),initial.code);
 assert.ok(initial.code.includes('data-rt-revision="'+require('../src/vue-source.cjs').contentHash(source)+'"'));
 assert.equal(plugin.transform.call(context,source,file+'?vue&type=template'),null);
 assert.equal(plugin.transform.call(context,source,file,{ssr:true}),null);
 assert.equal(plugin.resolveId('virtual:retouch-group-scale.jsx'),undefined);
 assert.equal(await plugin.load('\0retouch-group-scale.jsx'),null);
 const unsupported='<template lang="pug">p Hello</template>',warnings=[],updateUnsupported={file,read:async()=>unsupported,server:{config:{logger:{warn:message=>warnings.push(message)}}}};
 plugin.handleHotUpdate(updateUnsupported);assert.equal(await updateUnsupported.read(),unsupported);assert.equal(warnings.length,1);
 const external={file:path.join(root,'node_modules/App.vue'),read:async()=>source},read=external.read;plugin.handleHotUpdate(external);assert.equal(external.read,read);
 assert.throws(()=>retouch({adapter:'vue'}).configResolved(config),/plugin-vue/);
 assert.throws(()=>retouch({adapter:'unknown'}),/source adapter/);
 const react=retouch({adapter:'react'});react.configResolved({...config,plugins:[vue]});assert.equal(react.transform.call(context,source,file),null);
 plugin.configResolved({...config,command:'build'});assert.equal(plugin.transform.call(context,source,file),null);
});
test('Vue responsive styles use a stable independent CSS module and refuse outside-root requests',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.vue'),source='<template><h1>Hello</h1></template>';
 fs.writeFileSync(file,source);const plugin=retouch({adapter:'vue'});plugin.configResolved({...config,plugins:[{name:'vite:vue',api:{options:{}}}]});
 const transformed=plugin.transform.call({warn:message=>assert.fail(message)},source,file),style=transformed.code.match(/<style src="([^"]+)"/)[1];
 const id=plugin.resolveId(style)+'?vue&type=style&index=0&src=true&lang.css',watched=[];
 const css=await plugin.load.call({addWatchFile:file=>watched.push(file)},id);
 assert.match(css,/--retouch-css-revision:[a-f0-9]{40}/);assert.deepEqual(watched,[fs.realpathSync(file)]);
 const module={id},reloaded=[],update={file,read:async()=>source,server:{moduleGraph:{getModuleById:value=>value===id?module:null},reloadModule:async value=>reloaded.push(value)}};
 await plugin.handleHotUpdate(update);assert.deepEqual(reloaded,[module]);assert.equal((await update.read()).match(/<style src="([^"]+)"/)[1],style);
 const outside='virtual:retouch-vue-css/'+Buffer.from('../Outside.vue').toString('base64url')+'.css';assert.equal(plugin.resolveId(outside),undefined);assert.equal(await plugin.load.call({addWatchFile:()=>assert.fail('No outside dependency')},'\0'+outside),null);
 plugin.configResolved({...config,command:'build'});assert.equal(plugin.resolveId(style),undefined);assert.equal(await plugin.load(id),null);
});
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
test('Vite registers Vue source revision HMR after compilation and leaves script updates to Vue',t=>{
 const {root,config}=fixture(t),file=fs.realpathSync(root)+'/App.vue',source='<script setup>const count=0;</script><template><p>{{ count }}</p></template>';fs.writeFileSync(file,source);
 const [pre,post]=plugins({adapter:'vue'});assert.equal(pre.enforce,'pre');assert.equal(post.enforce,'post');pre.configResolved({...config,plugins:[{name:'vite:vue',api:{options:{}}}]});const context={warn(){}};pre.transform.call(context,source,file);
 const generated='__VUE_HMR_RUNTIME__.createRecord("id", {});\nexport const _rerender_only = __VUE_HMR_RUNTIME__.CHANGED_FILE === '+JSON.stringify(file)+';\nimport.meta.hot.accept(() => {});';
 const result=post.transform(generated,file);assert.ok(result);assert.doesNotMatch(result.code,/CHANGED_FILE/);assert.match(result.code,new RegExp(require('../src/adapters/vue.cjs').contentHash(source)));
 assert.equal(post.transform(generated,file,{ssr:true}),null);assert.equal(post.transform(generated,file+'?vue&type=template'),null);assert.equal(post.transform(generated,root+'/Other.vue'),null);
 pre.configResolved({...config,command:'build'});assert.equal(post.transform(generated,file),null);
});
test('Svelte Vite text-only updates use compiler-bound stores and leave script changes to HMR',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.svelte'),source='<script>let n=0;</script><h1>Hello</h1>',plugin=retouch();fs.writeFileSync(file,source);plugin.configResolved({...config,plugins:[{name:'vite-plugin-svelte'}]});const transformed=plugin.transform.call({warn:message=>assert.fail(message)},source,file);assert.match(transformed.code,/virtual:retouch-svelte-source/);assert.match(transformed.code,/data-rt-revision=\{/);assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(plugin.resolveId('virtual:retouch-svelte-source'),'\0retouch-svelte-source');assert.match(await plugin.load('\0retouch-svelte-source'),/retouch:svelte-source/);
 const messages=[],context={environment:{config:{consumer:'client'},hot:{send:message=>messages.push(message)}}},updated=source.replace('Hello','New text'),ctx={file,read:async()=>updated};assert.deepEqual(await plugin.hotUpdate.handler.call(context,ctx),[]);assert.equal(messages.length,1);assert.equal(messages[0].event,'retouch:svelte-source');assert.ok(Object.values(messages[0].data.texts).includes('New text'));assert.deepEqual(await plugin.hotUpdate.handler.call(context,ctx),[]);assert.equal(messages.length,1);assert.equal(await plugin.hotUpdate.handler.call(context,{file,read:async()=>updated.replace('n=0','n=1')}),undefined);assert.equal(messages.length,1);
 assert.throws(()=>retouch({adapter:'svelte'}).configResolved(config),/Svelte editing needs/);assert.throws(()=>retouch().configResolved({...config,plugins:[{name:'vite-plugin-svelte'},{name:'vite:vue'}]}),/mixed-framework/);plugin.configResolved({...config,command:'build'});assert.equal(plugin.transform.call({},source,file),null);assert.equal(await plugin.load('\0retouch-svelte-source'),null);
});

test('Svelte Vite styles and exact first-write undo use CSS HMR while authored styles use framework HMR',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.svelte'),original='<h1>Hello</h1><style>h1{color:red}</style>',plugin=retouch(),adapter=require('../src/adapters/svelte.cjs');
 fs.writeFileSync(file,original);plugin.configResolved({...config,plugins:[{name:'vite-plugin-svelte'}]});plugin.transform.call({warn:message=>assert.fail(message)},original,file);
 const elements=adapter.collect(original,'App.svelte').elements,r={file,relPath:'App.svelte',source:original,elements,element:elements[0],hash:adapter.contentHash(original)};
 const result=adapter.planOp(r,{type:'setCSS',fileHash:r.hash,width:768,changes:{color:'#112233'}});assert.equal(result.ok,true,result.reason);
 const messages=[],context={environment:{config:{consumer:'client'},hot:{send:message=>messages.push(message)}}},update=source=>plugin.hotUpdate.handler.call(context,{file,read:async()=>source});
 assert.deepEqual(await update(result.edits[0].after),[]);assert.equal(messages.length,1);assert.match(messages[0].data.css.text,/min-width: 768px/);assert.equal(messages[0].data.styleIds[elements[0].id],elements[0].id);
 assert.deepEqual(await update(original),[]);assert.equal(messages.length,2);assert.doesNotMatch(messages[1].data.css.text,/min-width/);assert.equal(messages[1].data.revision,r.hash);
 assert.equal(await update(original.replace('color:red','color:blue')),undefined);assert.equal(messages.length,2);
});
test('Svelte recovery snapshots are scoped to served components and carry monotonic source versions',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.svelte'),source='<h1>Hello</h1>',plugin=retouch(),channel=new (require('node:events').EventEmitter)();
 fs.writeFileSync(file,source);fs.writeFileSync(path.join(root,'Unserved.svelte'),'<h1>Private</h1>');plugin.configResolved({...config,plugins:[{name:'vite-plugin-svelte'}]});
 await plugin.configureServer({environments:{client:{hot:channel}},middlewares:{use(){}},config:{logger:{info(){}}}});t.after(()=>plugin.closeBundle());
 const replies=[],client={send:message=>replies.push(message)};
 channel.emit('retouch:svelte-sync',{file:'App.svelte',request:1},client);assert.equal(replies.length,0);
 plugin.transform.call({warn:message=>assert.fail(message)},source,file);
 for(const file of ['../App.svelte','/App.svelte','Unserved.svelte','node_modules/App.svelte'])channel.emit('retouch:svelte-sync',{file,request:1},client);
 for(const request of [null,-1,0,1.5,'1',Infinity])channel.emit('retouch:svelte-sync',{file:'App.svelte',request},client);
 assert.equal(replies.length,0);channel.emit('retouch:svelte-sync',{file:'App.svelte',request:1},client);
 assert.equal(replies.length,1);assert.equal(replies[0].event,'retouch:svelte-snapshot');assert.equal(replies[0].data.sequence,0);assert.equal(replies[0].data.request,1);assert.match(replies[0].data.signature,/^[a-f0-9]{40}$/);
 const events=[],context={environment:{config:{consumer:'client'},hot:{send:message=>events.push(message)}}};
 await plugin.hotUpdate.handler.call(context,{file,read:async()=>source.replace('Hello','New')});
 await plugin.hotUpdate.handler.call(context,{file,read:async()=>source});
 assert.deepEqual(events.map(e=>e.data.sequence),[1,2]);assert.equal(events[1].data.revision,replies[0].data.revision);
 channel.emit('retouch:svelte-sync',{file:'App.svelte',request:2},client);assert.equal(replies[1].data.sequence,2);assert.equal(replies[1].data.epoch,replies[0].data.epoch);
 await plugin.closeBundle();assert.equal(channel.listenerCount('retouch:svelte-sync'),0);
});
test('Svelte delayed file reads cannot publish an older edit after a newer HMR result',async t=>{
 const {root,config}=fixture(t),file=path.join(root,'App.svelte'),source='<h1>Hello</h1>',plugin=retouch();fs.writeFileSync(file,source);plugin.configResolved({...config,plugins:[{name:'vite-plugin-svelte'}]});plugin.transform.call({warn:message=>assert.fail(message)},source,file);
 const events=[],context={environment:{config:{consumer:'client'},hot:{send:message=>events.push(message)}}};let release;
 const slow=plugin.hotUpdate.handler.call(context,{file,read:()=>new Promise(resolve=>release=resolve)});
 await plugin.hotUpdate.handler.call(context,{file,read:async()=>source.replace('Hello','Latest')});release(source.replace('Hello','Stale'));assert.deepEqual(await slow,[]);
 assert.equal(events.length,1);assert.ok(Object.values(events[0].data.texts).includes('Latest'));
 await plugin.hotUpdate.handler.call(context,{file,read:async()=>source});assert.equal(events[1].data.sequence,2);
});
