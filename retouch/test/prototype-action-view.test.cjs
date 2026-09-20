'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{reconcile}=require('../shell/prototype-action-view.js');
const item=(path,signature,open=true)=>({path,signature,open});
test('collapsed actions follow reordering and moving between branches',()=>{
 const before=[item([0],'A',false),item([1],'B',true),item([2,'then',0],'C',false)];
 assert.deepEqual(reconcile([item([0],'B'),item([1],'A'),item([2,'else',0],'C')],before),[true,false,false]);
});
test('field edits preserve the local state without stealing an identical sibling state',()=>{
 const before=[item([0],'A',true),item([1],'B',false)];
 assert.deepEqual(reconcile([item([0],'B'),item([1],'B')],before),[true,false]);
 assert.deepEqual(reconcile([item([0],'Changed'),item([1],'B')],before),[true,false]);
 assert.deepEqual(reconcile([item([0],'B')],before),[false]);
 assert.deepEqual(reconcile([item([0],'New'),item([1],'A'),item([2],'B')],before),[true,true,false]);
});
test('identical actions keep positional states and new actions begin expanded',()=>{
 const before=[item([0],'Same',false),item([1],'Same',true)];assert.deepEqual(reconcile([item([0],'Same'),item([1],'Same'),item([2],'Same')],before),[false,true,true]);assert.deepEqual(reconcile([item([0],'New')]),[true]);
});
