'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const planner=require('../src/svelte-picture-style-plan.cjs'),{SourceHistory}=require('../src/history.cjs'),adapter=require('../src/adapters/svelte.cjs');
const original='<main><img src="/wide.svg" alt="Art"/></main><style>@import "./inside.css";main > img{width:40px}</style>';
const wrapped=original.replace('<img','<picture data-rt-picture="" style="display:contents"><img').replace('/></main>','/></picture></main>');
function fixture(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'rt-svelte-picture-imports-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'App.svelte');fs.writeFileSync(file,original);fs.writeFileSync(path.join(root,'inside.css'),'@import "./base.css";main > img{height:20px}');fs.writeFileSync(path.join(root,'base.css'),'@import "./inside.css";img + span{margin-left:8px}');return {file,appRoot:root,source:original,relPath:'App.svelte'};}
test('Svelte picture style graph adapts cyclic imports and preserves exact multi-file history',t=>{
 const r=fixture(t),extra=path.join(r.appRoot,'entry.css');fs.writeFileSync(extra,'\ufeff/* entry */ @import "./base.css" layer(art);img{opacity:.8}');
 const result=planner.plan(r,{source:wrapped,files:[extra,extra]}),plan={ok:true,edits:result.edits};assert.equal(result.edits.length,4);assert.equal(result.edits.find(edit=>edit.file===extra).after[0],'\ufeff');
 for(const edit of result.edits.filter(edit=>edit.file!==extra))assert.match(edit.after,/data-rt-picture/);
 const history=new SourceHistory(),saved=history.commit(r.appRoot,plan);assert.equal(saved.ok,true,saved.reason);
 assert.equal(history.apply(r.appRoot,'undo',saved.undoId,adapter).ok,true);for(const edit of result.edits)assert.equal(fs.readFileSync(edit.file,'utf8'),edit.before);
 assert.equal(history.apply(r.appRoot,'redo',saved.undoId,adapter).ok,true);for(const edit of result.edits)assert.equal(fs.readFileSync(edit.file,'utf8'),edit.after);
});
test('Svelte picture graph plans refuse external, ambiguous and non-source imports without writes',t=>{
 const r=fixture(t),entry=path.join(r.appRoot,'entry.css');
 for(const value of ['https://example.com/a.css','/global.css','../outside.css','./base.css?inline','./base.scss','./missing.css']){fs.writeFileSync(entry,'@import "'+value+'";');assert.throws(()=>planner.plan(r,{source:wrapped,files:[entry]}));assert.equal(fs.readFileSync(r.file,'utf8'),original);}
 fs.symlinkSync(path.join(r.appRoot,'base.css'),path.join(r.appRoot,'linked.css'));assert.throws(()=>planner.plan(r,{files:['linked.css']}),/symbolic/);
 fs.writeFileSync(entry,Buffer.from([0xff]));assert.throws(()=>planner.plan(r,{files:[entry]}));fs.writeFileSync(r.file,original+' ');assert.throws(()=>planner.plan(r,{source:wrapped}),/changed/);
});
test('Svelte picture graph includes unchanged dependencies in stale transaction guards',t=>{
 const r=fixture(t),entry=path.join(r.appRoot,'entry.css');fs.writeFileSync(entry,'body{color:red}');const plan=planner.plan(r,{source:wrapped,files:[entry]});const dependency=plan.edits.find(edit=>edit.file===entry);assert.equal(dependency.before,dependency.after);fs.writeFileSync(entry,'body{color:blue}');
 const result=new SourceHistory().commit(r.appRoot,{ok:true,edits:plan.edits});assert.equal(result.ok,false);assert.equal(fs.readFileSync(r.file,'utf8'),original);
});
