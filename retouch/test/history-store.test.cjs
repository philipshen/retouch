'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHistoryStore}=require('../src/history-store.cjs'),{SourceHistory}=require('../src/history.cjs'),{applyPlan}=require('../src/transactions.cjs');
function setup(t){const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'rt-durable-history-'))),root=path.join(base,'project'),directory=path.join(base,'state');fs.mkdirSync(root);t.after(()=>fs.rmSync(base,{recursive:true,force:true}));return {base,root,directory,open:()=>new SourceHistory(100,{store:createHistoryStore(root,directory)})};}
test('source snapshots and both history directions survive backend restart with stale-file refusal',t=>{
 const {root,open}=setup(t),file=path.join(root,'page.html');fs.writeFileSync(file,'original');let history=open();
 const write=value=>{const result=applyPlan(root,{ok:true,edits:[{file,before:fs.readFileSync(file,'utf8'),after:value}]});assert.equal(result.ok,true);return history.record(result.edits);};
 const first=write('one'),second=write('two');history=open();assert.equal(history.undo.length,2);assert.equal(history.apply(root,'undo',second,{}).ok,true);
 history=open();assert.equal(history.redo.length,1);fs.writeFileSync(file,'external');assert.equal(history.apply(root,'undo',first,{}).ok,false);assert.equal(fs.readFileSync(file,'utf8'),'external');fs.writeFileSync(file,'one');assert.equal(history.apply(root,'redo',second,{}).ok,true);history=open();assert.equal(history.apply(root,'undo',second,{}).ok,true);assert.equal(history.apply(root,'undo',first,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),'original');
});
test('journal refuses traversal, symlinks, corruption and competing writers without changing snapshots',t=>{
 const {root,directory,base}=setup(t),one=createHistoryStore(root,directory),two=createHistoryStore(root,directory);one.load();two.load();const state={undo:[{id:'a'.repeat(32),edits:[{file:path.join(root,'a'),before:null,after:'one'}]}],redo:[]};one.save(state);const bytes=fs.readFileSync(one.file,'utf8');assert.throws(()=>two.save(state),/another editor/);assert.equal(fs.readFileSync(one.file,'utf8'),bytes);
 assert.throws(()=>one.save({undo:[{...state.undo[0],edits:[{file:path.join(base,'outside'),before:null,after:'bad'}]}],redo:[]}),/snapshot/);assert.equal(fs.readFileSync(one.file,'utf8'),bytes);
 fs.writeFileSync(one.file,'broken');assert.throws(()=>createHistoryStore(root,directory).load());fs.unlinkSync(one.file);fs.symlinkSync(path.join(base,'missing'),one.file);assert.throws(()=>one.load(),/regular file/);
});
test('persistence failures retain usable in-memory source history and report the failure',t=>{
 const {root}=setup(t),file=path.join(root,'a');fs.writeFileSync(file,'after');const history=new SourceHistory(100,{store:{load:()=>({undo:[],redo:[]}),save:()=>{throw Error('disk full');}}});const id=history.record([{file,before:'before',after:'after'}]);assert.equal(history.persistenceError,'disk full');assert.equal(history.apply(root,'undo',id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),'before');assert.equal(history.persistenceError,'disk full');
});
