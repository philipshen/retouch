'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../shell/inspector.js'),V=require('../shell/html-css-values.js');
test('shadow stack classes retain scopes and other effects and round-trip ordered inner and outer shadows',()=>{
 const value='1px 2px 3px 4px rgba(0, 0, 0, 0.2), inset -2px 4px 5px 0px #ff000080',original='shadow-lg ![box-shadow:none] blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl',next=I.shadowClasses(original,value);
 assert.equal(next,'blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl ![box-shadow:1px_2px_3px_4px_rgba(0,_0,_0,_0.2),_inset_-2px_4px_5px_0px_#ff000080]');assert.equal(I.shadowClasses(next,value),next);
 const parsed=V.parseShadows(value);assert.equal(parsed.length,2);assert.equal(parsed[1].inset,true);assert.deepEqual(V.parseShadows(V.serializeShadows(parsed)),parsed);
 assert.equal(I.shadowClasses(next,null),'blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl');assert.equal(I.shadowClasses('','none'),'![box-shadow:none]');
});
test('shadow stack edits refuse unrepresentable values and conflicting important ownership',()=>{
 for(const value of ['url(evil)','0px 2px -1px red','var(--unknown)'])assert.throws(()=>I.shadowClasses('',value),/Unsupported/);
 for(const classes of ['!ring-2','![all:initial]'])assert.throws(()=>I.shadowClasses(classes,'none'),/important/);
 assert.equal(I.shadowClasses('ring-2 opacity-50','none'),'ring-2 opacity-50 ![box-shadow:none]');
});
