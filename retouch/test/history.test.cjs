'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {SourceHistory}=require('../src/history.cjs');
const {applyPlan}=require('../src/transactions.cjs');
const {createHistory,createGestureGroups}=require('../shell/history.js');
function setup(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-history-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const history=new SourceHistory();
  function write(file,before,after,group) {
    const edits=[{file:path.join(root,file),before,after}];
    const result=applyPlan(root,{ok:true,edits});assert.equal(result.ok,true,result.reason);
    return history.record(result.edits,group);
  }
  return {root,history,write,read:file=>fs.readFileSync(path.join(root,file),'utf8')};
}
test('one explicit gesture restores exact first and last source, then a new edit invalidates redo',t=>{
  const {root,history,write,read}=setup(t);
  fs.writeFileSync(path.join(root,'a'),'initial');
  const id=write('a','initial','one','drag-1');
  assert.equal(write('a','one','two','drag-1'),id);
  assert.equal(history.undo.length,1);
  assert.equal(history.apply(root,'undo',id,{}).ok,true);assert.equal(read('a'),'initial');
  assert.equal(history.apply(root,'redo',id,{}).ok,true);assert.equal(read('a'),'two');
  assert.equal(history.apply(root,'undo',id,{}).ok,true);
  const next=write('a','initial','next','drag-1');assert.notEqual(next,id);
  assert.equal(history.apply(root,'redo',id,{}).ok,false);
});
test('separate gestures remain separate regardless of timing and out-of-order undo is refused',t=>{
  const {root,history,write,read}=setup(t);
  const first=write('a',null,'one','drag-1');
  const second=write('a','one','two','drag-2');
  assert.notEqual(first,second);
  assert.equal(history.apply(root,'undo',first,{}).ok,false);assert.equal(read('a'),'two');
  assert.equal(history.apply(root,'undo',second,{}).ok,true);
  assert.equal(history.apply(root,'undo',first,{}).ok,true);assert.equal(fs.existsSync(path.join(root,'a')),false);
  assert.equal(history.apply(root,'redo',first,{}).ok,true);assert.equal(read('a'),'one');
});
test('multi-file undo and redo refuse stale files atomically and retain history',t=>{
  const {root,history,write,read}=setup(t);
  const id=write('a',null,'a','compound');write('b',null,'b','compound');
  fs.writeFileSync(path.join(root,'b'),'external');
  assert.equal(history.apply(root,'undo',id,{}).ok,false);assert.equal(read('a'),'a');assert.equal(read('b'),'external');
  fs.writeFileSync(path.join(root,'b'),'b');
  assert.equal(history.apply(root,'undo',id,{}).ok,true);
  fs.writeFileSync(path.join(root,'a'),'new external');
  assert.equal(history.apply(root,'redo',id,{}).ok,false);assert.equal(fs.existsSync(path.join(root,'b')),false);
  fs.unlinkSync(path.join(root,'a'));
  assert.equal(history.apply(root,'redo',id,{}).ok,true);assert.equal(read('b'),'b');
});
test('undo never removes a created module that gained an external reference',t=>{
  const {root,history,write,read}=setup(t);
  const id=write('module',null,'definition');
  assert.equal(history.apply(root,'undo',id,{hasReference:()=>true}).ok,false);
  assert.equal(read('module'),'definition');
});
test('client groups matching undo identities, moves entries only after successful response and blocks concurrent restore',async()=>{
  let resolve;const calls=[];
  const history=createHistory({apply:(type,entry)=>{calls.push([type,entry]);return new Promise(r=>resolve=r);}});
  history.record({undoId:'a',selection:'first'});history.record({undoId:'a',selection:'last'});
  const pending=history.undo();assert.equal(history.busy,true);
  assert.equal((await history.undo()).busy,true);
  resolve({ok:false});await pending;assert.equal(history.canUndo,true);assert.equal(history.canRedo,false);
  const success=history.undo();resolve({ok:true});await success;
  assert.equal(history.canUndo,false);assert.equal(history.canRedo,true);assert.equal(calls[1][1].selection,'first');
  history.record({undoId:'b'});assert.equal(history.canRedo,false);
});
test('gesture identities survive control replacement but close at explicit boundaries',()=>{
  const groups=createGestureGroups();
  const id=groups.begin('key','element:width');
  assert.equal(groups.begin('key','element:width'),id);assert.equal(groups.current('element:width'),id);
  assert.equal(groups.current('element:height'),undefined);
  groups.end('pointer');assert.equal(groups.current(),id);
  groups.end('key');assert.equal(groups.current(),undefined);
  assert.notEqual(groups.begin('key','element:width'),id);
});
test('an external edit between same-group writes starts a new undo entry',t=>{
  const {root,history,write,read}=setup(t);
  const first=write('a',null,'one','gesture');
  fs.writeFileSync(path.join(root,'a'),'external');
  const second=write('a','external','two','gesture');
  assert.notEqual(first,second);
  assert.equal(history.apply(root,'undo',second,{}).ok,true);
  assert.equal(read('a'),'external');
  assert.equal(history.apply(root,'undo',first,{}).ok,false);
});
test('a client transport exception releases busy state and preserves the undo entry',async()=>{
  const history=createHistory({apply:async()=>{throw new Error('offline');}});
  history.record({undoId:'saved'});
  await assert.rejects(history.undo(),/offline/);
  assert.equal(history.busy,false);assert.equal(history.canUndo,true);assert.equal(history.canRedo,false);
});
test('a grouped client entry undoes to its initial preview and redoes its final preview',async()=>{
  const applied=[];
  const history=createHistory({apply:async(type,entry)=>{applied.push({type,...entry});return {ok:true};}});
  history.record({undoId:'gesture',before:'initial',after:'intermediate',syncInfo:{hash:'one'}});
  history.record({undoId:'gesture',before:'intermediate',after:'final',syncInfo:{hash:'two'}});
  await history.undo();
  assert.equal(applied[0].before,'initial');
  await history.redo();
  assert.equal(applied[1].after,'final');assert.deepEqual(applied[1].syncInfo,{hash:'two'});
  assert.equal(history.canRedo,false);assert.equal(history.canUndo,true);
});

test('client history captures the original page once per gesture and retains it for redo',async()=>{
 let route='/first.html';const calls=[];
 const history=createHistory({capture:()=>({route}),apply:async(type,entry)=>{calls.push([type,entry.route]);return {ok:true};}});
 history.record({undoId:'a'});route='/second.html';history.record({undoId:'a'});history.record({undoId:'b'});
 await history.undo();await history.undo();await history.redo();
 assert.deepEqual(calls,[['undo','/second.html'],['undo','/first.html'],['redo','/first.html']]);
});
