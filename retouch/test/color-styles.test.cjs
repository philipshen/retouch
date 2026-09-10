'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const library=require('../src/color-styles.cjs'),text=require('../src/text-styles.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-colors-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const create=(root,value='#1a2b3c80',name='Brand')=>library.change(root,{type:'create',revision:library.read(root).revision,name,properties:{color:value}});
test('color libraries preserve alpha and stable identity independently of text styles',t=>{
 const root=fixture(t);assert.deepEqual(library.read(root),{version:1,styles:[],revision:null});assert.equal(fs.existsSync(path.join(root,'.retouch')),false);
 const typography=text.change(root,{type:'create',revision:null,name:'Brand',properties:{'font-size':'32px'}}),color=create(root);assert.equal(color.styles[0].properties.color,'#1a2b3c80');assert.deepEqual(text.read(root).styles,typography.styles);
 const renamed=library.change(root,{type:'update',revision:color.revision,id:color.id,name:'Primary',properties:{color:'#f008'}});assert.equal(renamed.id,color.id);assert.equal(renamed.styles[0].properties.color,'#f008');
 const exported={version:1,styles:renamed.styles},other=fixture(t),imported=library.change(other,{type:'import',revision:null,library:exported});assert.deepEqual(imported.styles,exported.styles);assert.deepEqual(library.planChange(other,{type:'import',revision:imported.revision,library:exported}).edits,[]);
});
test('invalid, conflicting, stale and symlinked color libraries cannot be mutated',t=>{
 const root=fixture(t),saved=create(root),file=path.join(root,'.retouch/color-styles.json'),before=fs.readFileSync(file,'utf8');
 for(const value of ['red','currentColor','var(--brand)','#12','#12345','url(evil)','#000;display:none'])assert.throws(()=>create(root,value,'Other'));
 assert.throws(()=>create(root,'#fff','brand'));assert.throws(()=>library.change(root,{type:'delete',revision:'stale',id:saved.id}),/changed/);assert.equal(fs.readFileSync(file,'utf8'),before);
 assert.throws(()=>library.change(root,{type:'import',revision:saved.revision,library:{version:1,styles:[{...saved.styles[0],properties:{color:'#fff'}}]}}),/different version/);
 const target=path.join(root,'outside.json');fs.renameSync(file,target);fs.symlinkSync(target,file);assert.throws(()=>library.read(root),/regular/);assert.equal(fs.readFileSync(target,'utf8'),before);
});
test('color palette API authenticates writes and records exact shared undo/redo',async t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'index.html'),'<html><body><p>Palette</p></body></html>');const server=require('../src/html-site.cjs').start({root,port:0,quiet:true});
 t.after(async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});if(!server.listening)await require('node:events').once(server,'listening');
 const url='http://localhost:'+server.address().port,shell=await(await fetch(url+'/rt')).text(),token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(shell)[1],headers={'x-retouch-token':token,'content-type':'application/json'};
 assert.equal((await fetch(url+'/rt/__api/color-styles')).status,401);
 const post=async(endpoint,body)=>{const response=await fetch(url+endpoint,{method:'POST',headers,body:JSON.stringify(body)});return {status:response.status,value:await response.json()};};
 const result=await post('/rt/__api/color-styles',{type:'create',revision:null,name:'Brand',properties:{color:'#1234'}});assert.equal(result.status,200);assert.ok(result.value.undoId);const file=path.join(root,'.retouch/color-styles.json'),after=fs.readFileSync(file,'utf8');
 assert.equal((await post('/rt/__api/op',{type:'undo',undoId:result.value.undoId})).status,200);assert.equal(fs.existsSync(file),false);assert.equal((await post('/rt/__api/op',{type:'redo',undoId:result.value.undoId})).status,200);assert.equal(fs.readFileSync(file,'utf8'),after);
 const current=await(await fetch(url+'/rt/__api/color-styles',{headers})).json();
 const malformed=await post('/rt/__api/color-styles',{type:'import',revision:current.revision,library:{version:1,styles:[{id:'bad',name:'Bad',properties:{color:'#fff'}}]}});assert.equal(malformed.status,422);assert.match(malformed.value.reason,/Invalid or duplicate color style ID/);assert.equal(fs.readFileSync(file,'utf8'),after);
 assert.deepEqual(current.styles,result.value.styles);assert.deepEqual(text.read(root).styles,[]);
 assert.equal((await post('/rt/__api/color-styles',{type:'update',revision:'stale',id:current.styles[0].id,name:'Changed',properties:{color:'#fff'}})).status,409);assert.equal(fs.readFileSync(file,'utf8'),after);
});
