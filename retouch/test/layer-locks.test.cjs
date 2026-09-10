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
test('session storage restores batch and history changes only for the same project session',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},scope={project:'a'.repeat(64),session:'b'.repeat(64)},a=node('a'.repeat(10)),b=node('b'.repeat(10)),options={storage,scope};
 const locks=create(options),change=locks.changeMany([a,b],true);assert.equal(create(options).direct(a),true);assert.equal(create(options).direct(b),true);
 locks.restoreMany(change,'undo');assert.equal(create(options).direct(a),false);locks.restoreMany(change,'redo');assert.equal(create(options).direct(a),true);
 assert.equal(create({...options,scope:{...scope,project:'c'.repeat(64)}}).direct(a),false);assert.equal(create({...options,scope:{...scope,session:'d'.repeat(64)}}).direct(a),false);
 locks.change(a,false);assert.equal(create(options).direct(a),false);assert.equal(create(options).direct(b),true);
});
test('malformed lock storage is discarded atomically and unavailable storage preserves live editing',()=>{
 const scope={project:'a'.repeat(64),session:'b'.repeat(64)},a=node('a'.repeat(10));
 const corrupt={getItem:()=>JSON.stringify({version:1,session:scope.session,pages:[['/', ['a'.repeat(10)]],['bad',['invalid']]]}),setItem(){throw Error('quota');}};
 const locks=create({scope,storage:corrupt,route:()=>'/'});assert.equal(locks.direct(a),false);locks.set(a,true);assert.equal(locks.direct(a),true);
 const unavailable=create({scope,storage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}}});unavailable.changeMany([a],true);assert.equal(unavailable.direct(a),true);
});
test('source reordering remaps locks simultaneously on every route and reverses with history',()=>{
 let route='/a';const locks=create({route:()=>route}),a=node('aaaaaaaaaa'),b=node('bbbbbbbbbb'),c=node('cccccccccc'),mapping=[['aaaaaaaaaa','bbbbbbbbbb'],['bbbbbbbbbb','aaaaaaaaaa']];locks.set(a,true);route='/b';locks.set(b,true);locks.set(c,true);locks.remap(mapping);assert.equal(locks.direct(a),true);assert.equal(locks.direct(b),false);assert.equal(locks.direct(c),true);route='/a';assert.equal(locks.direct(a),false);assert.equal(locks.direct(b),true);locks.remap(mapping,'undo');assert.equal(locks.direct(a),true);assert.equal(locks.direct(b),false);route='/b';assert.equal(locks.direct(b),true);assert.equal(locks.direct(c),true);assert.throws(()=>locks.remap([['aaaaaaaaaa','bbbbbbbbbb'],['cccccccccc','bbbbbbbbbb']]));assert.equal(locks.direct(b),true);
});
test('deletion removes subtree locks before survivor remapping and restores both across routes',()=>{
 let route='/a';const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},scope={project:'a'.repeat(64),session:'b'.repeat(64)},options={route:()=>route,storage,scope},locks=create(options),removed=node('aaaaaaaaaa'),survivor=node('bbbbbbbbbb'),mapping=[['bbbbbbbbbb','aaaaaaaaaa']];locks.set(removed,true);route='/b';locks.set(survivor,true);
 const changes=locks.removeSourceIds(['aaaaaaaaaa']);locks.remap(mapping);assert.equal(locks.direct(removed),true);route='/a';assert.equal(locks.direct(removed),false);assert.equal(create(options).direct(removed),false);
 locks.remap(mapping,'undo');assert.equal(locks.restoreMany(changes,'undo').ok,true);assert.equal(locks.direct(removed),true);route='/b';assert.equal(locks.direct(survivor),true);assert.equal(locks.direct(removed),false);
 locks.removeSourceIds(['aaaaaaaaaa']);locks.remap(mapping);assert.equal(locks.direct(removed),true);route='/a';assert.equal(locks.direct(removed),false);
});
