'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),source=require('../src/svelte-source.cjs'),images=require('../src/svelte-responsive-image.cjs'),compiler=require('svelte/compiler');
const original='<script>let n=$state(0);</script><picture><source media="(min-width: 700px)" srcset="/wide.svg 1x, /wide2.svg 2x"/><img src="/small.svg" alt="Scene" onload={()=>n++}/></picture><p>{n}</p>';
function resolve(text=original){return {source:text,relPath:'App.svelte',file:'/app/App.svelte',hash:source.contentHash(text),element:source.collect(text,'App.svelte').elements.find(e=>e.tag==='img')};}
function apply(method,r,extra){const result=images[method](r,{fileHash:r.hash,...extra});assert.equal(result.ok,true,result.reason);if(result.edits.length)compiler.compile(result.edits[0].after,{filename:'App.svelte'});return result;}
test('Svelte responsive candidates preserve authored expressions and encode literal braces',()=>{
 const r=resolve(),info=images.describe(r);assert.equal(info.picture,true);assert.equal(info.candidates.length,3);
 const result=apply('plan',r,{candidate:'0:1',src:'/literal{n}.svg?a=1&b=2'}),after=result.edits[0].after;
 assert.ok(after.includes('/literal&#123;n&#125;.svg?a=1&amp;b=2 2x'));assert.ok(after.includes('onload={()=>n++}'));assert.equal(images.describe(resolve(after)).candidates[2].url,'/literal{n}.svg?a=1&b=2');assert.deepEqual(source.collect(after,'App.svelte').elements.map(e=>e.id),source.collect(original,'App.svelte').elements.map(e=>e.id));
});
test('Svelte responsive source settings and candidate list operations compile',()=>{
 let r=resolve();r=resolve(apply('planSource',r,{sourceIndex:0,changes:{media:'(min-width: 800px)',type:'image/svg+xml',sizes:'50vw'}}).edits[0].after);
 r=resolve(apply('planCandidates',r,{sourceIndex:0,action:'add',src:'/triple.svg',descriptor:'3x'}).edits[0].after);assert.equal(images.describe(r).candidates.length,4);
 r=resolve(apply('planCandidates',r,{sourceIndex:0,action:'descriptor',candidate:'0:2',descriptor:'4x'}).edits[0].after);
 r=resolve(apply('planCandidates',r,{sourceIndex:0,action:'remove',candidate:'0:2'}).edits[0].after);assert.equal(images.describe(r).candidates.length,3);
 const plain=resolve('<img alt="Scene"/>');assert.equal(images.describe(plain).plain,true);apply('plan',plain,{candidate:'fallback',src:'/new.svg'});
});
test('Svelte responsive image writes refuse bindings, spreads, control-flow pictures and stale revisions',()=>{
 for(const text of ['<img src={url}/>','<img srcset={urls}/>','<picture><source media={media} srcset="/a 1x"/><img src="/b"/></picture>','<picture>{#if show}<source srcset="/a 1x"/>{/if}<img src="/b"/></picture>','<picture><source {...props}/><img src="/b"/></picture>']){const r=resolve(text);assert.ok(images.describe(r).reason,text);assert.equal(images.plan(r,{fileHash:r.hash,candidate:'fallback',src:'/new'}).refused,true,text);}
 const r=resolve();assert.equal(images.plan(r,{fileHash:'stale',candidate:'fallback',src:'/new'}).refused,true);assert.equal(images.planCandidates(r,{fileHash:r.hash,sourceIndex:0,action:'add',src:'/new',descriptor:'2x'}).refused,true);
});
test('Svelte responsive source edits restore exact bytes in one history transaction',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),adapter=require('../src/adapters/svelte.cjs'),{SourceHistory}=require('../src/history.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-svelte-responsive-')),file=path.join(root,'App.svelte');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const [method,op]of [['plan',{candidate:'0:0',src:'/new.svg'}],['planSource',{sourceIndex:0,changes:{sizes:'100vw',media:null}}],['planCandidates',{sourceIndex:0,action:'remove',candidate:'0:1'}]]){
  fs.writeFileSync(file,original);const r={...resolve(),file},history=new SourceHistory(),saved=history.commit(root,apply(method,r,op));assert.equal(saved.ok,true,saved.reason);const after=fs.readFileSync(file,'utf8');assert.equal(history.apply(root,'undo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(history.apply(root,'redo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 }
});
