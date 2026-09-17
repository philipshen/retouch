'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const adapter=require('../src/adapters/vue.cjs'),styles=require('../src/vue-text-styles.cjs').create(adapter),css=require('../src/vue-css.cjs'),catalog=require('../src/text-styles.cjs'),update=require('../src/text-style-update.cjs'),{SourceHistory}=require('../src/history.cjs');
const style={id:'11111111-1111-4111-8111-111111111111',name:'Body',properties:{'font-size':'20px','font-weight':'400'}};
const original='<script setup>const count=1</script><template><main><p :class="count ? \'yes\' : \'no\'">Hello {{ count }}</p><p>Second</p></main></template><style scoped>p { color: red; }</style>';
function resolve(source=original,file='/app/App.vue',a=adapter){const relPath=path.basename(file),elements=a.collect(source,relPath).elements;return {source,file,relPath,elements,element:elements.find(el=>el.tag==='p'),hash:a.contentHash(source)};}
function after(result,source){assert.equal(result.ok,true,result.reason);return result.edits[0]?.after||source;}
test('Vue text styles apply at a width, preserve template logic, track overrides, reset and detach',()=>{
 let source=after(styles.plan(resolve(),{type:'applyTextStyle',width:768},style),original),r=resolve(source),info=adapter.describe(r);assert.equal(info.textStyleAuthoring,true);assert.equal(info.linkedStyleAuthoring,false);assert.equal(info.textStyleLinks[768].id,style.id);assert.deepEqual(info.cssRules[768],style.properties);assert.match(source,/:class="count \? 'yes' : 'no'"/);assert.match(source,/Hello \{\{ count \}\}/);assert.match(source,/<style scoped>p \{ color: red; \}<\/style>/);
 source=after(css.plan(r,{width:768,property:'font-size',value:'31px'},adapter),source);r=resolve(source);assert.deepEqual(styles.describe(r).textStyleOverrides[768],['font-size']);
 const revised={...style,properties:{'font-size':'24px','font-weight':'700','letter-spacing':'2px'}};source=after(styles.plan(r,{type:'refreshTextStyle',width:768},revised),source);r=resolve(source);assert.equal(adapter.describe(r).cssRules[768]['font-size'],'31px');assert.equal(adapter.describe(r).cssRules[768]['font-weight'],'700');assert.deepEqual(styles.links(r)[768].overrides,['font-size']);
 source=after(styles.plan(r,{type:'resetTextStyle',width:768},revised),source);r=resolve(source);assert.deepEqual(styles.describe(r).textStyleOverrides[768],[]);assert.deepEqual(adapter.describe(r).cssRules[768],revised.properties);
 source=after(styles.plan(r,{type:'detachTextStyle',width:768}),source);r=resolve(source);assert.deepEqual(styles.links(r),{});assert.deepEqual(adapter.describe(r).cssRules[768],revised.properties);
});
test('Vue text style selections are atomic and retain per-layer local overrides',()=>{
 const r=resolve(),ids=r.elements.filter(el=>el.tag==='p').map(el=>el.id),selection=require('../src/text-style-selection.cjs');
 const result=selection.plan(r,{type:'applyTextStyleSelection',fileHash:r.hash,ids,width:0},style,adapter);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.selection.length,2);for(const info of result.selection){assert.equal(info.textStyleLinks[0].id,style.id);assert.deepEqual(info.cssRules[0],style.properties);}
 const broken=original.replace('<p>Second','<p :style="computed">Second'),b=resolve(broken);assert.equal(selection.plan(b,{type:'applyTextStyleSelection',fileHash:b.hash,ids,width:0},style,adapter).refused,true);
 assert.equal(selection.plan(r,{type:'applyColorStyleSelection',fileHash:r.hash,ids,width:0,property:'color'},style,adapter,'color').refused,true);
});
test('Vue project style updates include unvisited components and exact shared history',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-styles-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const saved=catalog.change(root,{type:'create',revision:null,name:'Body',properties:style.properties}),linked=saved.styles[0];
 for(const name of ['App.vue','Unvisited.vue']){const file=path.join(root,name);fs.writeFileSync(file,after(styles.plan(resolve(original,file),{type:'applyTextStyle',width:0},linked),original));}
 fs.writeFileSync(path.join(root,'Unused.vue'),'<script>export default {}</script>');fs.writeFileSync(path.join(root,'Bindings.vue'),'<template><button v-bind="attrs">Unlinked</button></template>');
 const snapshot=()=>Object.fromEntries(['App.vue','Unvisited.vue','.retouch/text-styles.json'].map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')])),before=snapshot(),operation={type:'update',revision:saved.revision,id:linked.id,name:'Body updated',properties:{'font-size':'29px'}};
 const planned=update.plan(root,operation,'vue','text',adapter);assert.equal(planned.ok,true,planned.reason);assert.equal(planned.updated,2);assert.equal(planned.pages,2);assert.deepEqual(snapshot(),before);
 const history=new SourceHistory(),result=history.commit(root,planned);assert.equal(result.ok,true,result.reason);const changed=snapshot();for(const name of ['App.vue','Unvisited.vue'])assert.equal(adapter.describe(resolve(changed[name],path.join(root,name))).cssRules[0]['font-size'],'29px');
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.deepEqual(snapshot(),before);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.deepEqual(snapshot(),changed);
});
test('Vue style metadata bindings, unsupported owners and external CSS edits refuse without partial changes',()=>{
 for(const attributes of [':data-rt-text-styles="links"','v-bind="attrs"']){
  const r=resolve('<template><p '+attributes+'>Text</p></template>');assert.equal(styles.plan(r,{type:'applyTextStyle',width:0},style).refused,true);
 }
 assert.throws(()=>resolve('<template><p data-rt-text-styles="{}" data-rt-text-styles="{}">Text</p></template>'),/Duplicate attribute/);
 const applied=after(styles.plan(resolve(),{type:'applyTextStyle',width:0},style),original),broken=applied.replace('font-size:20px','font-size:99px');assert.equal(styles.plan(resolve(broken),{type:'resetTextStyle',width:0},style).refused,true);
 const marker=applied.match(/data-rt-text-styles="[^"]*"/)[0];for(const markup of ['<Widget '+marker+'/>','<template><p '+marker+'>Hidden</p></template>'])assert.equal(styles.planFile('/app/App.vue','App.vue','<template>'+markup+'</template>',style).refused,true);
 assert.equal(styles.plan(resolve(),{type:'applyTextStyle',width:0,fileHash:'stale'},style).refused,true);
});
test('Vue text style files honor custom compiler options',()=>{
 const a=adapter.create({compilerOptions:{delimiters:['[[',']]']}}),linked=require('../src/vue-text-styles.cjs').create(a),text='<template><p>Hello [[ value ]]</p></template>',r=resolve(text,'/app/App.vue',a),source=after(linked.plan(r,{type:'applyTextStyle',width:0},style),text);assert.match(source,/Hello \[\[ value \]\]/);assert.equal(a.describe(resolve(source,'/app/App.vue',a)).canSetChildren,true);
});
test('Vue HTTP style routes enforce revisions, propagate both update paths and undo the entire selection',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-style-api-')),file=path.join(root,'App.vue');fs.writeFileSync(file,original);const server=require('../src/server.cjs').startServer({appRoot:root,port:0,adapter,quiet:true});
 t.after(async()=>{server.retouchIndex.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});});await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port,shell=await(await fetch(base+'/rt')).text(),token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(shell)[1];
 const request=async(route,body)=>{const response=await fetch(base+'/rt/__api/'+route,{method:body?'POST':'GET',headers:{'x-retouch-token':token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};},read=()=>fs.readFileSync(file,'utf8');
 const created=await request('text-styles',{type:'create',revision:null,name:'HTTP Body',properties:style.properties});assert.equal(created.status,200,created.reason);const r=resolve(read(),file),ids=r.elements.filter(el=>el.tag==='p').map(el=>el.id),id=ids[0];
 const operation={type:'applyTextStyleSelection',id,ids,fileHash:r.hash,width:0,styleId:created.id,libraryRevision:created.revision};const stale=await request('op',{...operation,libraryRevision:'stale'});assert.equal(stale.status,409);assert.equal(read(),original);
 const applied=await request('op',operation);assert.equal(applied.status,200,applied.reason);assert.equal(applied.selection.length,2);const linked=read(),snapshot=()=>({source:read(),catalog:fs.readFileSync(path.join(root,'.retouch/text-styles.json'),'utf8')});
 const before=snapshot(),changed=await request('text-styles',{type:'update',revision:created.revision,id:created.id,name:'HTTP Body',properties:{'font-size':'28px'}});assert.equal(changed.status,200,changed.reason);assert.equal(changed.updated,2);assert.equal(adapter.describe(resolve(read(),file)).cssRules[0]['font-size'],'28px');assert.equal((await request('op',{type:'undo',undoId:changed.undoId})).ok,true);assert.deepEqual(snapshot(),before);
 const current=(await request('resolve?id='+id)).element,update=await request('op',{type:'updateTextStyle',id,fileHash:current.hash,width:0,libraryRevision:created.revision,styleId:created.id,name:'HTTP Body',properties:{'font-size':'33px'}});assert.equal(update.status,200,update.reason);assert.equal(adapter.describe(resolve(read(),file)).cssRules[0]['font-size'],'33px');assert.equal((await request('op',{type:'undo',undoId:update.undoId})).ok,true);assert.deepEqual(snapshot(),before);
 const override=await request('op',{type:'setCSS',id,fileHash:adapter.contentHash(read()),width:0,property:'font-size',value:'40px'});assert.equal(override.ok,true);const reset=await request('op',{type:'resetTextStyleSelection',id,ids,fileHash:adapter.contentHash(read()),width:0,libraryRevision:created.revision});assert.equal(reset.ok,true,reset.reason);assert.equal(reset.selection[0].cssRules[0]['font-size'],'20px');assert.equal((await request('op',{type:'undo',undoId:reset.undoId})).ok,true);assert.equal((await request('op',{type:'undo',undoId:override.undoId})).ok,true);assert.equal(read(),linked);
 assert.equal((await request('op',{type:'undo',undoId:applied.undoId})).ok,true);assert.equal(read(),original);
});
