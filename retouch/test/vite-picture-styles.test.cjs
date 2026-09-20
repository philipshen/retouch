'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{discover}=require('../src/vite-picture-styles.cjs');
function fixture(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'rt-vite-picture-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const nodes=new Map(),graph={idToModuleMap:nodes},server={environments:{client:{moduleGraph:graph},ssr:{moduleGraph:{idToModuleMap:new Map()}}}};function add(name,query='',type='js'){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'');const node={id:file+query,file,type};nodes.set(node.id,node);return node;}return {root,nodes,server,add};}
test('Vite picture style discovery resolves loaded client source files and deduplicates component queries',t=>{
 const f=fixture(t),component=f.add('App.svelte'),css=f.add('styles/theme.css');f.add('App.svelte','?svelte&type=style&lang.css','css');f.add('main.js');f.server.environments.ssr.moduleGraph.idToModuleMap.set('ssr',{file:'/outside/server.css',id:'/outside/server.css',type:'css'});
 const result=discover(f.server,f);assert.deepEqual(result.files,[component.file,css.file].sort());assert.equal(result.coverage,'loaded-client-modules');assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
 f.add('Child.svelte');assert.notEqual(discover(f.server,f).fingerprint,result.fingerprint);assert.deepEqual(discover({moduleGraph:f.server.environments.client.moduleGraph},f),discover(f.server,f));
});
test('Vite picture style discovery refuses unavailable, generated and noneditable style sources',t=>{
 const f=fixture(t);assert.throws(()=>discover({},f),/unavailable/);assert.throws(()=>discover({environments:{ssr:{}},moduleGraph:{idToModuleMap:new Map()}},f),/unavailable/);
 for(const node of [{id:'\0virtual.css',type:'css'},{id:'/outside/x.css',file:'/outside/x.css',type:'css'}]){f.nodes.clear();f.nodes.set(node.id,node);assert.throws(()=>discover(f.server,f));}
 for(const name of ['theme.scss','theme.module.css','node_modules/theme.css']){f.nodes.clear();f.add(name);assert.throws(()=>discover(f.server,f));}
 for(const query of ['?inline','?raw','?url','?module=true']){f.nodes.clear();f.add('theme.css',query);assert.throws(()=>discover(f.server,f),/imported CSS values/);}
});
test('Vite picture style discovery refuses symlinked stylesheet files',t=>{
 const f=fixture(t),source=f.add('theme.css');f.nodes.clear();const file=path.join(f.root,'link.css');fs.symlinkSync(source.file,file);f.nodes.set(file,{id:file,file,type:'css'});assert.throws(()=>discover(f.server,f),/regular project/);
});
test('Vite picture coverage verifies exact compiled and managed CSS for each preview',async t=>{
 const f=fixture(t),component=f.add('App.svelte'),css=f.add('theme.css');const text='img { color: red }';css.transformResult={code:'const __vite__id = '+JSON.stringify(css.id)+'\nconst __vite__css = '+JSON.stringify(text)+'\n'};
 const managed=require('../src/svelte-css.cjs').runtimeSnapshot('', 'App.svelte').css,sheets=[{kind:'vite',id:css.id,text},{kind:'managed',id:managed.id,text:managed.text}],documents=[{issues:[],sheets},{issues:[],sheets}];
 const validate=options=>require('../src/vite-picture-styles.cjs').validate(f.server,{root:f.root,...options});assert.deepEqual((await validate({documents})).files,[component.file,css.file].sort());
 await assert.rejects(()=>validate({documents:[]}),/required/);await assert.rejects(()=>validate({documents:[{issues:['Unmapped inline style'],sheets:[]}]}),/Unmapped inline/);
 await assert.rejects(()=>validate({documents:[{issues:[],sheets:[...sheets,sheets[0]]}]}),/duplicate/);
 await assert.rejects(()=>validate({documents:[{issues:[],sheets:[{...sheets[0],text:'img {color:blue}'}]}]}),/differs/);
 css.transformResult=null;await assert.rejects(()=>validate({documents}),/differs/);
 let refreshed=0;css.url='/theme.css';f.server.environments.client.transformRequest=async url=>{assert.equal(url,css.url);refreshed++;return {code:'const __vite__id = '+JSON.stringify(css.id)+'\nconst __vite__css = '+JSON.stringify(text)+'\n'};};await validate({documents});assert.equal(refreshed,1);
});
