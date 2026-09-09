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
