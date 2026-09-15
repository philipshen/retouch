'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const move=require('../shell/group-move.js'),css=require('../shell/html-css-values.js');
test('group translations compose existing pixel offsets and reject unresolved coordinates',()=>{
 assert.equal(move.translation('none',{x:10,y:-2}),'10px -2px');
 assert.equal(move.translation('2px -3px',{x:1,y:10}),'3px 7px');
 for(const value of ['10% 0px','1px 2px 3px','calc(1px + 2%) 0px'])assert.throws(()=>move.translation(value,{x:1,y:0}));
 assert.throws(()=>move.translation('none',{x:Infinity,y:0}));assert.throws(()=>move.translation('99999px 0px',{x:2,y:0}));
});
test('group classes replace only active translation utilities and preserve other scopes and transforms',()=>{
 assert.equal(move.classes('rotate-12 translate-x-2 md:translate-y-4 hover:opacity-50','','10px 20px'),'md:translate-y-4 hover:opacity-50 rotate-12 [translate:10px_20px]');
 assert.equal(move.classes('translate-x-2 md:translate-y-4 md:scale-125','md:','10px 20px'),'translate-x-2 md:scale-125 md:[translate:10px_20px]');
});
test('managed translation values accept bounded pixel pairs and resetting, never arbitrary declarations',()=>{
 for(const value of ['0px -2px','100000px 0px',null])assert.equal(css.valid('translate',value),true);
 for(const value of ['100001px 0px','1px; color:red','1px','var(--x)','NaNpx 0px'])assert.equal(css.valid('translate',value),false);
});
