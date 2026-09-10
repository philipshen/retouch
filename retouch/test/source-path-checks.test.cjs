'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup}=require('./helpers.cjs'),checks=require('../src/source-path-checks.cjs'),{applyPlan}=require('../src/transactions.cjs');
test('resolution preconditions reject malformed or external paths before any source write',()=>{
 const root=fs.realpathSync(makeApp({'page.tsx':'before'})),file=path.join(root,'page.tsx');try{
  for(const pathChecks of [null,{},[{}],[{file:'relative',kind:'missing'}],[{file:path.join(root,'../outside.ts'),kind:'missing'}],Array(1001).fill({file:path.join(root,'absent.ts'),kind:'missing'})]){
   const result=applyPlan(root,{ok:true,edits:[{file,before:'before',after:'after'}],pathChecks});assert.equal(result.ok,false);assert.equal(fs.readFileSync(file,'utf8'),'before');
  }
 }finally{cleanup(root);}
});
test('path snapshots distinguish files, directories, missing parents and unresolved symlinks',()=>{
 const root=fs.realpathSync(makeApp({'page.tsx':'before'}));try{
  const dir=path.join(root,'directory.ts'),link=path.join(root,'dangling.ts'),missing=path.join(root,'missing/subdir/types.ts');fs.mkdirSync(dir);fs.symlinkSync('absent.ts',link);
  const snapshots=[path.join(root,'page.tsx'),dir,link,missing].map(file=>checks.snapshot(root,file));assert.deepEqual(snapshots.map(check=>check.kind),['file','directory','unresolved-link','missing']);checks.verify(root,snapshots);
  fs.rmdirSync(dir);fs.writeFileSync(dir,'new module');assert.throws(()=>checks.verify(root,snapshots),/resolution changed/);
  fs.unlinkSync(link);fs.symlinkSync('other-absent.ts',link);assert.throws(()=>checks.verify(root,[snapshots[2]]),/resolution changed/);
 }finally{cleanup(root);}
});
test('a resolution refusal leaves history and source unchanged and clears its pending journal',()=>{
 const root=fs.realpathSync(makeApp({'page.tsx':'before'})),file=path.join(root,'page.tsx'),candidate=path.join(root,'preferred.ts'),{SourceHistory}=require('../src/history.cjs');let saved;
 const history=new SourceHistory(100,{store:{save(value){saved=value;}}});try{
  const pathChecks=[checks.snapshot(root,candidate)];fs.writeFileSync(candidate,'new contract');const result=history.commit(root,{ok:true,edits:[{file,before:'before',after:'after'}],pathChecks});assert.equal(result.ok,false);assert.deepEqual(history.snapshot(),{undo:[],redo:[]});assert.equal(history.recoveryRequired,false);assert.equal(saved.pending,undefined);assert.equal(fs.readFileSync(file,'utf8'),'before');
 }finally{cleanup(root);}
});
