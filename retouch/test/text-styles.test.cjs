'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const library=require('../src/text-styles.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-styles-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const props={'font-family':'"Geist", sans-serif','font-size':'32px','font-weight':'700','font-variation-settings':'"wght" 700','line-height':'1.2'};
const create=(root,revision=null,name='Heading')=>library.change(root,{type:'create',revision,name,properties:props});
test('text styles persist stable identity through edits and deletion',t=>{
 const root=fixture(t);assert.deepEqual(library.read(root),{version:1,styles:[],revision:null});assert.equal(fs.existsSync(path.join(root,'.retouch')),false);
 const first=create(root);assert.equal(first.styles[0].id,first.id);assert.deepEqual(library.read(root).styles,first.styles);
 const edited=library.change(root,{type:'update',revision:first.revision,id:first.id,name:'Display',properties:{...props,'font-size':'48px'}});
 assert.equal(edited.styles[0].id,first.id);assert.notEqual(edited.revision,first.revision);
 const deleted=library.change(root,{type:'delete',revision:edited.revision,id:first.id});assert.deepEqual(library.read(root).styles,[]);assert.equal(library.read(root).revision,deleted.revision);
});
test('stale editors and external edits cannot overwrite a library',t=>{
 const root=fixture(t),first=create(root),file=path.join(root,'.retouch/text-styles.json');
 assert.throws(()=>create(root,null,'Other'),{statusCode:409});
 fs.appendFileSync(file,'\n');const external=fs.readFileSync(file,'utf8');
 assert.throws(()=>library.change(root,{type:'delete',revision:first.revision,id:first.id}),{statusCode:409});assert.equal(fs.readFileSync(file,'utf8'),external);
 assert.equal(create(root,library.read(root).revision,'Other').styles.length,2);
});
test('invalid and duplicate styles leave exact stored bytes unchanged',t=>{
 const root=fixture(t),first=create(root),file=path.join(root,'.retouch/text-styles.json'),before=fs.readFileSync(file,'utf8');
 for(const operation of [
  {type:'create',name:' heading ',properties:props},
  {type:'create',name:'Bad',properties:{color:'red'}},
  {type:'create',name:'Bad',properties:{'font-size':'url(https://example.com)'}},
  {type:'update',id:first.id,name:'',properties:props},
  {type:'delete',id:'missing'},
  {type:'create',id:first.id,name:'Other',properties:props}
 ]){assert.throws(()=>library.change(root,{revision:first.revision,...operation}));assert.equal(fs.readFileSync(file,'utf8'),before);}
});
test('corrupt, oversized and symlinked libraries are refused without writing',t=>{
 const root=fixture(t),outside=fixture(t),dir=path.join(root,'.retouch'),file=path.join(dir,'text-styles.json');fs.mkdirSync(dir);
 fs.writeFileSync(file,'secret invalid JSON');assert.throws(()=>library.read(root),error=>error.statusCode===409&&!error.message.includes('secret'));
 fs.writeFileSync(file,' '.repeat(library.LIMIT+1));assert.throws(()=>library.read(root),{statusCode:413});fs.unlinkSync(file);
 const target=path.join(outside,'target');fs.writeFileSync(target,'untouched');fs.symlinkSync(target,file);assert.throws(()=>create(root),{statusCode:409});assert.equal(fs.readFileSync(target,'utf8'),'untouched');
 fs.unlinkSync(file);fs.rmdirSync(dir);fs.symlinkSync(outside,dir);assert.throws(()=>library.read(root),{statusCode:409});
});
