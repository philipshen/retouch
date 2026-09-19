'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../shell/prototype-timers.js');
const item={trigger:'after-delay',delay:100,action:'back'};
test('timers count only active time and fire once per mounted interaction',()=>{
 const fired=[];let active=true;const c=T.create({eligible:()=>active,perform:(item,key)=>fired.push(key)});c.update([{key:'a',item}]);c.tick(0);c.tick(40);active=false;c.tick(50);c.tick(1000);active=true;c.tick(1100);c.tick(1159);assert.deepEqual(fired,[]);c.tick(1160);assert.deepEqual(fired,['a']);c.update([{key:'a',item}]);c.tick(5000);assert.deepEqual(fired,['a']);assert.equal(c.pending,false);
});
test('removal, metadata replacement, visibility suspension and disposal reset or cancel clocks',()=>{
 const fired=[];const c=T.create({eligible:()=>true,perform:item=>fired.push(item.delay)});c.update([{key:'a',item}]);c.tick(0);c.tick(60);c.pause();c.tick(10000);assert.deepEqual(fired,[]);c.tick(10040);assert.deepEqual(fired,[100]);
 c.update([]);c.update([{key:'a',item:{...item,delay:50}}]);c.tick(20000);c.tick(20049);assert.deepEqual(fired,[100]);c.tick(20050);assert.deepEqual(fired,[100,50]);c.update([{key:'a',item}]);c.tick(30000);c.dispose();c.tick(40000);assert.deepEqual(fired,[100,50]);assert.equal(c.pending,false);
});
test('an action that changes the active frame prevents competing timers from firing',()=>{
 const fired=[];let active=true;const c=T.create({eligible:()=>active,perform:(item,key)=>{fired.push(key);active=false;}});c.update([{key:'a',item},{key:'b',item}]);c.tick(0);c.tick(100);assert.deepEqual(fired,['a']);c.dispose();c.tick(200);assert.deepEqual(fired,['a']);
});
