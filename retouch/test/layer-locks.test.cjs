'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('../shell/layer-locks.js');
const node=(id,parent=null,instance=null)=>({parentElement:parent,getAttribute:name=>name==='data-rt'?id:name==='data-rt-i'?instance:null});
test('editor locks preserve independent descendants, source instances and route separation',()=>{
 let route='/a';const locks=create({route:()=>route}),parent=node('frame'),a=node('a',parent),b=node('b',parent),instance=node('a',null,'instance');
 locks.set(a,true);locks.set(parent,true);assert.equal(locks.locked(b),true);assert.equal(locks.direct(b),false);assert.equal(locks.locked(instance),false);
 locks.set(parent,false);assert.equal(locks.locked(a),true);assert.equal(locks.locked(b),false);
 route='/b';assert.equal(locks.locked(a),false);route='/a';assert.equal(locks.locked(node('a')),true,'new rendered DOM keeps the source lock');
 locks.set(a,false);assert.equal(locks.locked(a),false);assert.equal(locks.set(node(null),true),false);
});

test('lock history records changes and refuses conflicting state without modifying another route',()=>{
 let route='/a';const locks=create({route:()=>route}),a=node('a');
 const change=locks.change(a,true);assert.equal(change.before,false);assert.equal(locks.change(a,true),null);
 route='/b';locks.set(a,true);assert.equal(locks.restore(change,'undo').ok,true);assert.equal(locks.direct(a),true);
 route='/a';assert.equal(locks.direct(a),false);assert.equal(locks.restore(change,'redo').ok,true);locks.set(a,false);
 assert.equal(locks.restore(change,'undo').ok,false);assert.equal(locks.direct(a),false);
});
test('batch lock history preserves mixed state and refuses the entire conflicting restore',()=>{
 const locks=create(),a=node('a'),b=node('b');locks.set(a,true);
 const changes=locks.changeMany([a,b,b],true);assert.equal(changes.length,1);assert.equal(changes[0].id,'b');assert.equal(locks.restoreMany(changes,'undo').ok,true);assert.equal(locks.direct(a),true);assert.equal(locks.direct(b),false);
 locks.set(a,false);const both=locks.changeMany([a,b],true);locks.set(b,false);assert.equal(locks.restoreMany(both,'undo').ok,false);assert.equal(locks.direct(a),true,'no partial restore before a conflicting member');
 locks.set(b,true);assert.equal(locks.restoreMany(both,'undo').ok,true);assert.equal(locks.direct(a),false);assert.equal(locks.direct(b),false);
 assert.deepEqual(locks.changeMany([a,node(null)],true),[]);assert.equal(locks.direct(a),false,'invalid member prevents every change');
});
