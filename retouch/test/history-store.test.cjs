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
test('abrupt process exit before or after source restore recovers the correct undo and redo sides',t=>{
 const {spawnSync}=require('node:child_process');
 for(const direction of ['undo','redo'])for(const phase of ['prepared','applied']){
  const {root,directory,open}=setup(t),file=path.join(root,'a');fs.writeFileSync(file,'after');let history=open();const id=history.record([{file,before:'before',after:'after'}],undefined,'/original?view=one');if(direction==='redo')assert.equal(history.apply(root,'undo',id,{}).ok,true);
  const code=`const {createHistoryStore}=require(${JSON.stringify(require.resolve('../src/history-store.cjs'))});const {SourceHistory}=require(${JSON.stringify(require.resolve('../src/history.cjs'))});const disk=createHistoryStore(process.argv[1],process.argv[2]);const history=new SourceHistory(100,{store:{load:()=>disk.load(),save(state){if(!state.pending&&process.argv[4]==='applied')process.exit(70);disk.save(state);if(state.pending&&process.argv[4]==='prepared')process.exit(70);}}});history.apply(process.argv[1],process.argv[3],process.argv[5],{});`;
  const child=spawnSync(process.execPath,['-e',code,root,directory,direction,phase,id],{encoding:'utf8',timeout:10000});assert.equal(child.status,70,child.stderr);
  const completed=phase==='applied',expected=direction==='undo'?(completed?'before':'after'):(completed?'after':'before');assert.equal(fs.readFileSync(file,'utf8'),expected);
  history=open();const stack=completed?(direction==='undo'?'redo':'undo'):direction;assert.equal(history[stack].at(-1).id,id);assert.equal(history[stack].at(-1).route,'/original?view=one');assert.equal(history.apply(root,stack,id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),expected==='before'?'after':'before');
 }
});
test('mixed interrupted restores and redirected source paths are reported without mutating source or journal',t=>{
 const {root,directory,open,base}=setup(t),a=path.join(root,'a'),b=path.join(root,'b');fs.writeFileSync(a,'after-a');fs.writeFileSync(b,'after-b');const history=open(),id=history.record([{file:a,before:'before-a',after:'after-a'},{file:b,before:'before-b',after:'after-b'}]);
 const store=createHistoryStore(root,directory),state=store.load();store.save({...state,pending:{type:'undo',id}});const journal=fs.readFileSync(store.file,'utf8');fs.writeFileSync(a,'before-a');assert.throws(()=>open(),/mixed files/);assert.equal(fs.readFileSync(a,'utf8'),'before-a');assert.equal(fs.readFileSync(b,'utf8'),'after-b');assert.equal(fs.readFileSync(store.file,'utf8'),journal);
 const outside=path.join(base,'outside');fs.writeFileSync(outside,'before-b');fs.unlinkSync(b);fs.symlinkSync(outside,b);assert.throws(()=>open(),/regular file/);assert.equal(fs.readFileSync(outside,'utf8'),'before-b');assert.equal(fs.readFileSync(store.file,'utf8'),journal);
});
test('a failed multi-file rollback retains its pending marker and prevents further restore attempts',t=>{
 const {root,directory,open}=setup(t),a=path.join(root,'a'),b=path.join(root,'b');fs.writeFileSync(a,'after-a');fs.writeFileSync(b,'after-b');const history=open(),id=history.record([{file:a,before:'before-a',after:'after-a'},{file:b,before:'before-b',after:'after-b'}]);
 const rename=fs.renameSync;t.mock.method(fs,'renameSync',(from,to)=>{if(to===a||to===b&&fs.readFileSync(b,'utf8')==='before-b')throw Error('Simulated replacement failure');return rename(from,to);});
 const result=history.apply(root,'undo',id,{});assert.equal(result.ok,false);assert.equal(result.rollbackFailed,true);assert.equal(fs.readFileSync(a,'utf8'),'after-a');assert.equal(fs.readFileSync(b,'utf8'),'before-b');assert.match(history.persistenceError,/requires recovery/);assert.match(history.apply(root,'undo',id,{}).reason,/requires recovery/);
 const journal=JSON.parse(fs.readFileSync(createHistoryStore(root,directory).file,'utf8'));assert.deepEqual(journal.pending,{type:'undo',id,owner:process.pid});assert.throws(()=>open(),/mixed files/);
});
test('new source commits survive process exit around source writes and invalidate redo only after application',t=>{
 const {spawnSync}=require('node:child_process');
 for(const phase of ['prepared','applied']){
  const {root,directory,open}=setup(t),a=path.join(root,'a'),created=path.join(root,'new'),removed=path.join(root,'old');fs.writeFileSync(a,'original');fs.writeFileSync(removed,'remove me');let history=open();const initial=history.commit(root,{ok:true,edits:[{file:a,before:'original',after:'previous'}]});assert.equal(initial.ok,true);assert.equal(history.apply(root,'undo',initial.undoId,{}).ok,true);
  const plan={ok:true,edits:[{file:a,before:'original',after:'next'},{file:created,before:null,after:'created'},{file:removed,before:'remove me',after:null}]};
  const code=`const {createHistoryStore}=require(${JSON.stringify(require.resolve('../src/history-store.cjs'))});const {SourceHistory}=require(${JSON.stringify(require.resolve('../src/history.cjs'))});const disk=createHistoryStore(process.argv[1],process.argv[2]);const history=new SourceHistory(100,{store:{load:()=>disk.load(),save(state){if(!state.pending&&process.argv[3]==='applied')process.exit(70);disk.save(state);if(state.pending&&process.argv[3]==='prepared')process.exit(70);}}});history.commit(process.argv[1],JSON.parse(process.argv[4]),{route:'/edited'});`;
  const child=spawnSync(process.execPath,['-e',code,root,directory,phase,JSON.stringify(plan)],{encoding:'utf8',timeout:10000});assert.equal(child.status,70,child.stderr);history=open();
  if(phase==='prepared'){assert.equal(history.undo.length,0);assert.equal(history.redo.length,1);assert.equal(fs.existsSync(created),false);assert.equal(fs.readFileSync(a,'utf8'),'original');}
  else{assert.equal(history.undo.length,1);assert.equal(history.redo.length,0);assert.equal(history.undo[0].route,'/edited');assert.equal(fs.readFileSync(a,'utf8'),'next');assert.equal(fs.readFileSync(created,'utf8'),'created');assert.equal(fs.existsSync(removed),false);assert.equal(history.apply(root,'undo',history.undo[0].id,{}).ok,true);assert.equal(fs.readFileSync(a,'utf8'),'original');assert.equal(fs.existsSync(created),false);assert.equal(fs.readFileSync(removed,'utf8'),'remove me');}
 }
});
test('normal grouped commits retain one undo and rejected source plans leave redo intact',t=>{
 const {root,open}=setup(t),file=path.join(root,'a');fs.writeFileSync(file,'zero');let history=open();
 const first=history.commit(root,{ok:true,edits:[{file,before:'zero',after:'one'}]},{group:'gesture'}),second=history.commit(root,{ok:true,edits:[{file,before:'one',after:'two'}]},{group:'gesture'});assert.equal(first.undoId,second.undoId);assert.equal(history.undo.length,1);history=open();assert.equal(history.apply(root,'undo',first.undoId,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),'zero');assert.equal(history.commit(root,{ok:true,edits:[{file,before:'wrong',after:'bad'}]}).ok,false);history=open();assert.equal(history.redo.length,1);assert.equal(fs.readFileSync(file,'utf8'),'zero');
});

test('a different live process cannot recover an in-progress source operation',t=>{
 const {spawnSync}=require('node:child_process'),{root,directory,open}=setup(t),file=path.join(root,'a');fs.writeFileSync(file,'after');const history=open(),id=history.record([{file,before:'before',after:'after'}]),store=createHistoryStore(root,directory),state=store.load();store.save({...state,pending:{type:'undo',id,owner:process.pid}});const bytes=fs.readFileSync(store.file,'utf8');
 const code=`const {createHistoryStore}=require(${JSON.stringify(require.resolve('../src/history-store.cjs'))});try{createHistoryStore(process.argv[1],process.argv[2]).load();process.exit(2);}catch(error){if(!error.message.includes('another running editor'))throw error;}`;
 const child=spawnSync(process.execPath,['-e',code,root,directory],{encoding:'utf8',timeout:10000});assert.equal(child.status,0,child.stderr);assert.equal(fs.readFileSync(store.file,'utf8'),bytes);assert.equal(fs.readFileSync(file,'utf8'),'after');
});
