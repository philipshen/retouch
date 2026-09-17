'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const adapter=require('../src/adapters/vue.cjs'),{SourceHistory}=require('../src/history.cjs');
function resolve(source){const elements=adapter.collect(source,'App.vue').elements;return {source,elements,element:elements.find(el=>el.tag==='a'),relPath:'App.vue',file:'/app/App.vue',hash:adapter.contentHash(source)};}
test('Vue link editing and removal preserve nested text, attributes, source identity and exact undo',t=>{
 const source=`<script setup>const value='unchanged'</script><template><main><a href='/old' id="owned" target="_blank" @click="record"><strong>Read</strong> {{ value }}</a></main></template>`;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-link-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const href of ['/new?x="<&q={{value}}',null,'mailto:reader@example.test','tel:+123','#section']){
  const r={...resolve(source),file},history=new SourceHistory();fs.writeFileSync(file,source);assert.equal(adapter.describe(r).canSetHref,true);
  const result=history.commit(root,adapter.planOp(r,{type:'setHref',href,fileHash:r.hash}));assert.equal(result.ok,true,result.reason);
  const after=fs.readFileSync(file,'utf8'),next=resolve(after);assert.equal(adapter.describe(next).href,href);
  assert.deepEqual(next.elements.map(el=>[el.id,el.tag]),r.elements.map(el=>[el.id,el.tag]));
  assert.ok(after.endsWith('id="owned" target="_blank" @click="record"><strong>Read</strong> {{ value }}</a></main></template>'));
  assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),source);
  assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 }
});
test('Vue links can gain a destination but bindings and executable or malformed values cannot be overwritten',()=>{
 const r=resolve('<template><main><a>Read</a></main></template>');
 const added=adapter.planOp(r,{type:'setHref',href:'/about',fileHash:r.hash});assert.equal(added.ok,true);assert.equal(adapter.describe(resolve(added.edits[0].after)).href,'/about');
 for(const href of ['javascript:alert(1)','data:text/html,x','file:///tmp/a','bad value','https://a/\nb',{},undefined])assert.equal(adapter.planOp(r,{type:'setHref',href,fileHash:r.hash}).refused,true);
 for(const attributes of [':href="url"','v-bind="props"',':[attribute]="value"','v-bind:href="url"']){
  const bound=resolve('<template><main><a '+attributes+'>Read</a></main></template>');if(!bound.element){assert.ok(['v-bind="props"',':[attribute]="value"'].includes(attributes));continue;}assert.equal(adapter.describe(bound).canSetHref,false);
  for(const href of ['/new',null])assert.equal(adapter.planOp(bound,{type:'setHref',href,fileHash:bound.hash}).refused,true);
 }
 assert.equal(adapter.planOp(r,{type:'setHref',href:'/new',fileHash:'stale'}).refused,true);
});
