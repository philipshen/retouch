'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),source=require('../src/svelte-source.cjs'),planner=require('../src/svelte-picture-sources.cjs'),compiler=require('svelte/compiler');
const original='<script>let count=$state(0);</script><main><picture><source media="(max-width:600px)" srcset="/small.svg 1x"/><source media="(min-width:601px)" srcset="/wide.svg 1x"/><img src="/fallback.svg" alt="Scene" onload={()=>count++}/></picture><p>{count}</p></main>';
function resolve(text=original){return {source:text,relPath:'App.svelte',file:'/app/App.svelte',hash:source.contentHash(text),element:source.collect(text,'App.svelte').elements.find(e=>e.tag==='img')};}
function plan(r,op){const result=planner.plan(r,{fileHash:r.hash,...op});assert.equal(result.ok,true,result.reason);if(result.edits.length)compiler.compile(result.edits[0].after,{filename:'App.svelte'});return result;}
test('Svelte picture sources add, move and remove with preserved handlers and source identity',()=>{
 const r=resolve(),added=plan(r,{action:'add',src:'/literal{count}.svg',media:'(max-width:400px)'}),next=resolve(added.edits[0].after);assert.equal(added.createdSourceIds.length,1);assert.equal(next.element.id,added.imageId);assert.ok(next.source.includes('srcset="/literal&#123;count&#125;.svg 1x"'));assert.ok(next.source.includes('onload={()=>count++}'));
 const moved=plan(next,{action:'move',sourceIndex:0,destinationIndex:2}),m=resolve(moved.edits[0].after);assert.ok(m.source.indexOf('/wide.svg')<m.source.indexOf('/literal'));assert.equal(moved.createdSourceIds.length,0);
 const removed=plan(m,{action:'remove',sourceIndex:2});assert.equal(removed.edits[0].after,original);assert.equal(removed.removedSourceIds.length,1);
});
test('Svelte picture source operations refuse stale, bound, generated and unsupported wrappers',()=>{
 for(const text of ['<main><img src="/old"/></main>','<main><picture>{#if show}<source srcset="/a 1x"/>{/if}<img src="/b"/></picture></main>','<main><picture><source srcset={urls}/><img src="/b"/></picture></main>']){const r=resolve(text);assert.equal(planner.plan(r,{fileHash:r.hash,action:'add',src:'/new'}).refused,true);}
 const r=resolve();for(const op of [{action:'remove',sourceIndex:9},{action:'move',sourceIndex:0,destinationIndex:9},{action:'add',src:'javascript:alert(1)'},{action:'add',src:'/new',fileHash:'stale'}])assert.equal(planner.plan(r,{fileHash:r.hash,...op}).refused,true);
});
test('Svelte picture source operations restore exact bytes through history and retain an empty authored picture',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),adapter=require('../src/adapters/svelte.cjs'),{SourceHistory}=require('../src/history.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-svelte-picture-')),file=path.join(root,'App.svelte');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const op of [{action:'add',src:'/new'},{action:'move',sourceIndex:1,destinationIndex:0},{action:'remove',sourceIndex:0}]){fs.writeFileSync(file,original);const r={...resolve(),file},history=new SourceHistory(),saved=history.commit(root,plan(r,op));assert.equal(saved.ok,true,saved.reason);const after=fs.readFileSync(file,'utf8');assert.equal(history.apply(root,'undo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(history.apply(root,'redo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);}
 let r=resolve();for(let i=0;i<2;i++)r=resolve(plan(r,{action:'remove',sourceIndex:0}).edits[0].after);assert.ok(r.source.includes('<picture><img'));plan(r,{action:'add',src:'/restored'});
});
